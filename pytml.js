(function(window) {
    class PYTML {
        constructor() {
            this.init();
        }

        async init() {
            console.log('PYTML: Initializing directly...');
            this.showStatus('Loading Python (first time: 10-15s)...');
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
            
            script.onload = async () => {
                this.showStatus('Initializing Python...');
                window.pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
                });
                
                window.pyodide.runPython(`
import sys
import js

def input(prompt=""):
    if prompt:
        print(prompt, end="")
    return js.prompt(prompt or "")
`);
                
                this.hideStatus();
                console.log('PYTML: Ready!');
                await this.loadExternalPythonFiles();
            };
            
            script.onerror = () => {
                this.showStatus('Failed to load Pyodide.', true);
            };
            
            document.head.appendChild(script);
        }

        async loadExternalPythonFiles() {
            const pyScripts = document.querySelectorAll('script[type="text/python"][src]');

            for (let scriptTag of pyScripts) {
                const pyFile = scriptTag.getAttribute('src');
                console.log(`Loading: ${pyFile}`);

                try {
                    const response = await fetch(pyFile);
                    const code = await response.text();

                    const outputDiv = document.createElement('div');
                    outputDiv.style.cssText = `
                        background: #1e1e1e;
                        color: #d4d4d4;
                        padding: 15px;
                        margin: 10px 0;
                        border-radius: 5px;
                        font-family: monospace;
                    `;
                    scriptTag.insertAdjacentElement('afterend', outputDiv);

                    window.pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
`);
                    
                    await window.pyodide.runPythonAsync(code);
                    const output = window.pyodide.runPython('sys.stdout.getvalue()');
                    
                    outputDiv.innerHTML = `<strong>Output:</strong><br><pre>${this.escapeHtml(output || 'Done!')}</pre>`;
                    scriptTag.remove();

                } catch(e) {
                    console.error(`Error:`, e);
                }
            }
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        showStatus(message, isError = false) {
            let status = document.getElementById('pytml-status');
            if (!status) {
                status = document.createElement('div');
                status.id = 'pytml-status';
                status.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: #007acc;
                    color: white;
                    padding: 8px 15px;
                    border-radius: 5px;
                    font-family: monospace;
                    font-size: 12px;
                    z-index: 10000;
                `;
                document.body.appendChild(status);
            }
            status.textContent = message;
            status.style.background = isError ? '#dc3545' : '#007acc';
        }

        hideStatus() {
            const status = document.getElementById('pytml-status');
            if (status) status.remove();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytml = new PYTML();
        });
    } else {
        window.pytml = new PYTML();
    }
})(window);
