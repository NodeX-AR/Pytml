(function(window) {
    class PYTML {
        constructor() {
            this.pyodide = null;
            this.ready = false;
            this.queue = [];
            this.init();
        }

        async init() {
            console.log('PYTML: Loading Python...');
            this.showLoader();
            
            // Load Pyodide
            if (typeof loadPyodide === 'undefined') {
                await this.loadScript('https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js');
            }
            
            this.pyodide = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.0/full/'
            });
            
            // Load common libraries
            await this.pyodide.loadPackage(['numpy', 'pandas']);
            
            this.ready = true;
            this.hideLoader();
            this.processPage();
        }

        async run(code, inputs = {}) {
            if (!this.ready) await this.wait();
            
            try {
                // Set input variables
                let inputCode = '';
                for (let [k, v] of Object.entries(inputs)) {
                    inputCode += `${k} = ${JSON.stringify(v)}\n`;
                }
                
                // Execute Python
                const result = await this.pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
try:
    ${inputCode}
    ${code}
    output = sys.stdout.getvalue()
except Exception as e:
    output = str(e)
sys.stdout = sys.__stdout__
output
                `);
                
                return result;
            } catch(e) {
                return `Error: ${e.message}`;
            }
        }

        async convertTag(pytmlTag) {
            let code = pytmlTag.textContent;
            let targetId = pytmlTag.getAttribute('target');
            let target = targetId ? document.getElementById(targetId) : pytmlTag;
            
            let result = await this.run(code);
            if (target) {
                target.innerHTML = result;
            }
        }

        processPage() {
            // Find all <pytml> tags
            let tags = document.querySelectorAll('pytml');
            for (let tag of tags) {
                this.convertTag(tag);
            }
            
            // Handle buttons with data-python
            document.querySelectorAll('[data-python]').forEach(btn => {
                let code = btn.getAttribute('data-python');
                let target = btn.getAttribute('data-target');
                
                btn.onclick = async () => {
                    let inputs = this.collectInputs(btn);
                    let result = await this.run(code, inputs);
                    if (target) {
                        let out = document.querySelector(target);
                        if (out) out.textContent = result;
                    }
                };
            });
        }

        collectInputs(btn) {
            let inputs = {};
            let form = btn.closest('[data-python-form]');
            if (form) {
                form.querySelectorAll('input, select').forEach(el => {
                    if (el.name) {
                        inputs[el.name] = el.type === 'number' ? parseFloat(el.value) : el.value;
                    }
                });
            }
            return inputs;
        }

        showLoader() {
            let loader = document.getElementById('pytml-loader');
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'pytml-loader';
                loader.innerHTML = 'Loading Python (first time: 10-15 seconds)...';
                loader.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#007acc;color:#fff;padding:10px;border-radius:5px;z-index:9999';
                document.body.appendChild(loader);
            }
        }

        hideLoader() {
            let loader = document.getElementById('pytml-loader');
            if (loader) loader.remove();
        }

        loadScript(src) {
            return new Promise((resolve, reject) => {
                let script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        async wait() {
            if (this.ready) return;
            return new Promise(resolve => this.queue.push(resolve));
        }
    }

    window.pytml = new PYTML();
})(window);
