(function(window) {
    class PYTML {
        constructor() {
            this.outputContainer = null;
            this.init();
        }

        async init() {
            console.log('PYTML: Initializing...');
            this.createOutputContainer();
            this.showStatus('Loading Python...');
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
            
            script.onload = async () => {
                this.showStatus('Initializing Python...');
                
                let pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
                    fullStdLib: false,
                    packages: []
                });
                
                window.pyodide = pyodide;
                
                pyodide.runPython(`
import sys
import js
from js import window

class HTMLOutput:
    def write(self, text):
        if text and text != '\\n':
            window.displayStyledOutput(str(text))
    def flush(self):
        pass

sys.stdout = HTMLOutput()

def input(prompt=""):
    if prompt:
        print(prompt)
    return js.createInlineInput(str(prompt))
`);
                
                this.hideStatus();
                console.log('PYTML: Ready');
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
                container.className = 'pytml-output';
                
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
                    await this.runPythonWithInlineInputs(code);
                    scriptTag.remove();

                } catch(e) {
                    this.addError(e.message);
                }
            }
        }

        async runPythonWithInlineInputs(code) {
            const lines = code.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                if (!line.trim()) continue;
                
                if (line.includes('input(')) {
                    const promptMatch = line.match(/input\s*\(\s*["'](.*?)["']\s*\)/);
                    const prompt = promptMatch ? promptMatch[1] : "Enter Input:";
                    
                    const value = await this.createInlineInput(prompt);
                    const safeValue = value.replace(/"/g, '\\"');
                    line = line.replace(/input\s*\(.*?\)/, `"${safeValue}"`);
                }
                
                await window.pyodide.runPythonAsync(line);
            }
        }

        createInlineInput(prompt) {
            return new Promise((resolve) => {
                const container = document.createElement('div');
                container.className = 'pytml-input-container';
                
                const promptText = document.createElement('div');
                promptText.textContent = prompt;
                promptText.className = 'pytml-prompt';
                
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.className = 'pytml-input';
                inputField.placeholder = 'Type your answer here...';
                
                const submitButton = document.createElement('button');
                submitButton.textContent = 'Submit';
                submitButton.className = 'pytml-submit';
                
                container.appendChild(promptText);
                container.appendChild(inputField);
                container.appendChild(submitButton);
                
                this.outputContainer.appendChild(container);
                
                const submit = () => {
                    const value = inputField.value;
                    container.remove();
                    this.addOutputLine(prompt + ' ' + value, 'pytml-user-input');
                    resolve(value);
                };
                
                submitButton.onclick = submit;
                inputField.onkeypress = (e) => {
                    if (e.key === 'Enter') submit();
                };
                
                inputField.focus();
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        clearOutput() {
            if (this.outputContainer) {
                this.outputContainer.innerHTML = '';
            }
        }

        addOutputLine(text, className) {
            if (!this.outputContainer) return;
            
            const line = document.createElement('div');
            line.textContent = text;
            line.className = className;
            this.outputContainer.appendChild(line);
            line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        addStyledOutput(text) {
            let className = 'pytml-line';
            
            if (text.includes('Error') || text.includes('not found')) {
                className = 'pytml-error';
            } else if (text.includes('successfully')) {
                className = 'pytml-success';
            } else if (text.includes('+----')) {
                className = 'pytml-border';
            } else if (text.includes('----')) {
                className = 'pytml-border';
            }
            
            this.addOutputLine(text, className);
        }

        addError(text) {
            if (!this.outputContainer) return;
            const errorDiv = document.createElement('div');
            errorDiv.textContent = text;
            errorDiv.className = 'pytml-error';
            this.outputContainer.appendChild(errorDiv);
        }

        showStatus(message, isError = false) {
            let status = document.getElementById('pytml-status');
            if (!status) {
                status = document.createElement('div');
                status.id = 'pytml-status';
                status.className = 'pytml-status';
                document.body.appendChild(status);
            }
            status.textContent = message;
            if (isError) {
                status.classList.add('pytml-status-error');
            } else {
                status.classList.remove('pytml-status-error');
            }
            setTimeout(() => {
                if (status) {
                    status.classList.add('pytml-status-hidden');
                }
            }, 3000);
        }

        hideStatus() {
            const status = document.getElementById('pytml-status');
            if (status) status.remove();
        }
    }

    window.displayStyledOutput = function(text) {
        if (window.pytmlInstance) {
            window.pytmlInstance.addStyledOutput(text);
        }
    };

    window.createInlineInput = function(prompt) {
        return window.pytmlInstance.createInlineInput(prompt);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytmlInstance = new PYTML();
        });
    } else {
        window.pytmlInstance = new PYTML();
    }
})(window);
