(function(window) {
    class PYTML {
        constructor() {
            this.outputContainer = null;
            this.outputBuffer = [];
            this.updateMode = 'append';
            this.init();
        }

        async init() {
            console.log('PYTML: Initializing...');
            this.createOutputContainer();
            this.showStatus('Loading Python...');
            
            const config = document.querySelector('meta[name="pytml-update-mode"]');
            if (config) {
                this.updateMode = config.getAttribute('content') === 'replace' ? 'replace' : 'append';
            }
            
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
    def __init__(self):
        self.buffer = []
    
    def write(self, text):
        if text and text != '\\n':
            self.buffer.append(str(text))
            if '\\n' in text or len(self.buffer) > 0:
                window.flushOutput()
    
    def flush(self):
        if self.buffer:
            window.flushOutput()

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
                    let code = await response.text();
                    
                    this.clearOutput();
                    
                    if (code.includes('# pytml-mode: replace')) {
                        this.updateMode = 'replace';
                    } else if (code.includes('# pytml-mode: append')) {
                        this.updateMode = 'append';
                    }
                    
                    await this.runPythonWithInlineInputs(code);
                    scriptTag.remove();

                } catch(e) {
                    this.addError(e.message);
                }
            }
        }

        async runPythonWithInlineInputs(code) {
            // Preserve indentation - execute as complete block
            let modifiedCode = code;
            
            // Find all input() calls
            const inputPattern = /input\s*\(\s*["'](.*?)["']\s*\)/g;
            const inputPromises = [];
            const replacements = [];
            let match;
            
            while ((match = inputPattern.exec(code)) !== null) {
                const prompt = match[1];
                inputPromises.push(this.createInlineInput(prompt));
                replacements.push({
                    original: match[0],
                    index: match.index
                });
            }
            
            const values = await Promise.all(inputPromises);
            
            // Replace in reverse order
            for (let i = replacements.length - 1; i >= 0; i--) {
                const value = values[i];
                const safeValue = value.replace(/"/g, '\\"');
                const before = modifiedCode.substring(0, replacements[i].index);
                const after = modifiedCode.substring(replacements[i].index + replacements[i].original.length);
                modifiedCode = before + `"${safeValue}"` + after;
            }
            
            // Execute complete code block (preserves indentation)
            await window.pyodide.runPythonAsync(modifiedCode);
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
                if (this.updateMode === 'replace') {
                    this.outputContainer.innerHTML = '';
                }
                this.outputBuffer = [];
            }
        }

        flushOutput() {
            if (this.outputBuffer.length === 0) return;
            
            const text = this.outputBuffer.join('');
            this.outputBuffer = [];
            
            if (this.updateMode === 'replace') {
                const lastChild = this.outputContainer.lastChild;
                if (lastChild && lastChild.classList && lastChild.classList.contains('pytml-line')) {
                    lastChild.textContent = text;
                } else {
                    this.addOutputLine(text, 'pytml-line');
                }
            } else {
                this.addOutputLine(text, 'pytml-line');
            }
            
            this.outputContainer.scrollTop = this.outputContainer.scrollHeight;
        }

        addOutputLine(text, className) {
            if (!this.outputContainer) return;
            
            const lines = text.split('\n');
            for (const line of lines) {
                if (line.trim() || line === '') {
                    const lineElement = document.createElement('div');
                    lineElement.textContent = line;
                    lineElement.className = className;
                    this.outputContainer.appendChild(lineElement);
                }
            }
        }

        addStyledOutput(text) {
            let className = 'pytml-line';
            
            if (text.includes('Error') || text.includes('not found')) {
                className = 'pytml-error';
            } else if (text.includes('successfully')) {
                className = 'pytml-success';
            } else if (text.includes('+----') || text.includes('----')) {
                className = 'pytml-border';
            }
            
            if (this.updateMode === 'replace') {
                const lastChild = this.outputContainer.lastChild;
                if (lastChild && lastChild.classList && lastChild.classList.contains(className)) {
                    lastChild.textContent = text;
                } else {
                    this.addOutputLine(text, className);
                }
            } else {
                this.addOutputLine(text, className);
            }
            
            this.outputContainer.scrollTop = this.outputContainer.scrollHeight;
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

    window.flushOutput = function() {
        if (window.pytmlInstance) {
            window.pytmlInstance.flushOutput();
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
