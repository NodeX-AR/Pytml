(function(window) {
    class PYTML {
        constructor() {
            this.outputContainer = null;
            this.init();
        }

        async init() {
            console.log('PYTML: Initializing with inline inputs...');
            this.createOutputContainer();
            this.showStatus('Loading Python...');
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
            
            script.onload = async () => {
                this.showStatus('Initializing Python...');
                let pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
                });
                
                window.pyodide = pyodide;
                
                // Override print and input - USE SYNC INPUT WITH PROMPT
                pyodide.runPython(`
import sys
import js

class HTMLOutput:
    def write(self, text):
        if text:
            js.displayStyledOutput(str(text))
    def flush(self):
        pass

sys.stdout = HTMLOutput()

# Use the native JavaScript prompt which is synchronous
def input(prompt=""):
    if prompt:
        print(prompt)
    return js.window.prompt(str(prompt))
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

        createOutputContainer() {
            if (!document.getElementById('pytml-output')) {
                const container = document.createElement('div');
                container.id = 'pytml-output';
                container.style.cssText = `
                    background: #0a0e27;
                    border-radius: 15px;
                    padding: 20px;
                    margin: 20px 0;
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    border: 1px solid rgba(102, 126, 234, 0.3);
                    max-height: 500px;
                    overflow-y: auto;
                `;
                
                const pyScripts = document.querySelectorAll('script[type="text/python"]');
                if (pyScripts.length > 0) {
                    pyScripts[0].insertAdjacentElement('beforebegin', container);
                } else {
                    document.body.insertAdjacentElement('afterbegin', container);
                }
                this.outputContainer = container;
            } else {
                this.outputContainer = document.getElementById('pytml-output');
            }
        }

        async loadExternalPythonFiles() {
            const pyScripts = document.querySelectorAll('script[type="text/python"][src]');

            for (let scriptTag of pyScripts) {
                const pyFile = scriptTag.getAttribute('src');
                console.log(`Loading: ${pyFile}`);

                try {
                    const response = await fetch(pyFile);
                    const code = await response.text();
                    
                    this.clearOutput();
                    
                    // Run Python code synchronously
                    window.pyodide.runPython(code);
                    scriptTag.remove();

                } catch(e) {
                    this.addError(e.message);
                }
            }
        }

        clearOutput() {
            if (this.outputContainer) {
                this.outputContainer.innerHTML = '';
            }
        }

        addStyledOutput(text) {
            if (!this.outputContainer) return;
            
            const line = document.createElement('div');
            
            let color = '#43e97b';
            if (text.includes('Error') || text.includes('not found')) {
                color = '#fa709a';
            } else if (text.includes('successfully')) {
                color = '#43e97b';
            } else if (text.includes('+----')) {
                color = '#667eea';
            } else {
                color = '#e0e0e0';
            }
            
            line.style.cssText = `
                color: ${color};
                margin: 4px 0;
                line-height: 1.5;
                font-family: monospace;
                white-space: pre-wrap;
            `;
            line.textContent = text;
            this.outputContainer.appendChild(line);
            line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        addError(text) {
            if (!this.outputContainer) return;
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                color: #fa709a;
                background: rgba(250, 112, 154, 0.15);
                padding: 10px;
                margin: 10px 0;
                border-radius: 8px;
                font-family: monospace;
            `;
            errorDiv.textContent = `❌ ${text}`;
            this.outputContainer.appendChild(errorDiv);
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
                    background: #667eea;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-family: monospace;
                    font-size: 12px;
                    z-index: 9999;
                `;
                document.body.appendChild(status);
            }
            status.textContent = message;
            if (isError) status.style.background = '#fa709a';
            setTimeout(() => {
                if (status && !isError) {
                    status.style.opacity = '0.7';
                }
            }, 2000);
        }

        hideStatus() {
            const status = document.getElementById('pytml-status');
            if (status) status.remove();
        }
    }

    // Global functions for Python to call
    window.displayStyledOutput = function(text) {
        if (window.pytmlInstance) {
            window.pytmlInstance.addStyledOutput(text);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytmlInstance = new PYTML();
        });
    } else {
        window.pytmlInstance = new PYTML();
    }
})(window);
