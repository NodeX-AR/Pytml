(function(window) {
    class PYTML {
        constructor() {
            this.ready = false;
            this.queue = [];
            this.init();
        }

        async init() {
            console.log('PYTML: Loading Python...');
            
            // Show loading indicator
            this.showStatus();
            
            try {
                // Load Pyodide script
                if (typeof loadPyodide === 'undefined') {
                    await this.loadScript('https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js');
                }
                
                // Initialize Pyodide
                this.pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
                });
                
                this.ready = true;
                console.log('PYTML: Python ready!');
                this.hideStatus();
                
                // Process queued callbacks
                this.queue.forEach(cb => cb());
                this.queue = [];
                
                // Process page
                this.processPage();
                
            } catch (error) {
                console.error('PYTML Error:', error);
                this.showError(error.message);
            }
        }

        showStatus() {
            let div = document.getElementById('pytml-status');
            if (!div) {
                div = document.createElement('div');
                div.id = 'pytml-status';
                div.style.cssText = `
                    position: fixed;
                    bottom: 10px;
                    right: 10px;
                    background: #007acc;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: monospace;
                    z-index: 9999;
                `;
                div.textContent = 'PYTML: Loading Python (first time takes 5-10s)...';
                document.body.appendChild(div);
            }
        }

        hideStatus() {
            const div = document.getElementById('pytml-status');
            if (div) div.remove();
        }

        showError(message) {
            const div = document.createElement('div');
            div.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: #dc3545;
                color: white;
                padding: 10px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 9999;
            `;
            div.textContent = `PYTML Error: ${message}`;
            document.body.appendChild(div);
            setTimeout(() => div.remove(), 5000);
        }

        loadScript(src) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
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

        async run(code, inputs = {}) {
            await this.wait();
            
            try {
                // Build input variables
                let inputCode = '';
                for (const [key, value] of Object.entries(inputs)) {
                    if (typeof value === 'string') {
                        inputCode += `${key} = "${value.replace(/"/g, '\\"')}"\n`;
                    } else {
                        inputCode += `${key} = ${JSON.stringify(value)}\n`;
                    }
                }
                
                // Execute Python and capture output
                const result = await this.pyodide.runPythonAsync(`
import sys
from io import StringIO

old_stdout = sys.stdout
sys.stdout = StringIO()

try:
    ${inputCode}
    ${code}
    output = sys.stdout.getvalue()
except Exception as e:
    output = f"Error: {str(e)}"
finally:
    sys.stdout = old_stdout

output
                `);
                
                return result;
            } catch (error) {
                return `Error: ${error.message}`;
            }
        }

        collectInputs(element) {
            const inputs = {};
            const form = element.closest('[data-python-form]');
            
            if (form) {
                const elements = form.querySelectorAll('input, select, textarea');
                for (const el of elements) {
                    if (el.name) {
                        let value = el.value;
                        if (el.type === 'number') {
                            value = parseFloat(value);
                        } else if (el.type === 'checkbox') {
                            value = el.checked;
                        }
                        inputs[el.name] = value;
                    }
                }
            }
            return inputs;
        }

        async processPage() {
            await this.wait();
            
            // Handle data-python-text
            const textElements = document.querySelectorAll('[data-python-text]');
            for (const el of textElements) {
                const code = el.getAttribute('data-python-text');
                const result = await this.run(`print(${code})`);
                if (el) el.textContent = result.trim();
            }
            
            // Handle data-python-html
            const htmlElements = document.querySelectorAll('[data-python-html]');
            for (const el of htmlElements) {
                const code = el.getAttribute('data-python-html');
                const result = await this.run(`print(${code})`);
                if (el) el.innerHTML = result.trim();
            }
            
            // Handle data-python buttons
            const buttons = document.querySelectorAll('[data-python]');
            for (const btn of buttons) {
                const code = btn.getAttribute('data-python');
                const target = btn.getAttribute('data-target');
                
                btn.addEventListener('click', async () => {
                    const inputs = this.collectInputs(btn);
                    const result = await this.run(code, inputs);
                    
                    if (target) {
                        const targetEl = document.querySelector(target);
                        if (targetEl) {
                            targetEl.textContent = result;
                        }
                    }
                });
            }
        }
    }

    window.pytml = new PYTML();
})(window);
