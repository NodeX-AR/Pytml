// pytml.js - Clean, Updated Version (No Emojis)
(function(window) {
    'use strict';

    class PYTML {
        constructor() {
            this.outputContainer = null;
            this.pyodide = null;
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
                this.pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
                    fullStdLib: false
                });
                
                window.pyodide = this.pyodide;
                
                // Setup Python environment
                this.pyodide.runPython(`
import sys
import js
from js import document, window

class PythonOutput:
    def write(self, text):
        if text and text.strip():
            window.pytmlInstance.addOutput(str(text))
    def flush(self):
        pass

sys.stdout = PythonOutput()
sys.stderr = PythonOutput()

def python_input(prompt=""):
    if prompt:
        print(prompt, end='')
    return window.pytmlInstance.getInput(str(prompt))

import builtins
builtins.input = python_input
`);
                
                this.hideStatus();
                console.log('PYTML: Ready');
                await this.loadExternalPythonFiles();
            };
            
            script.onerror = () => {
                this.showStatus('Failed to load Pyodide', true);
            };
            
            document.head.appendChild(script);
        }

        createOutputContainer() {
            let container = document.getElementById('pytml-output');
            if (!container) {
                container = document.createElement('div');
                container.id = 'pytml-output';
                container.className = 'pytml-container';
                
                // Add header
                const header = document.createElement('div');
                header.className = 'pytml-header';
                header.innerHTML = `
                    <span class="pytml-title">Python Output</span>
                    <button class="pytml-clear-btn">Clear</button>
                `;
                header.querySelector('.pytml-clear-btn').onclick = () => this.clearOutput();
                container.appendChild(header);
                
                // Add content area
                const content = document.createElement('div');
                content.className = 'pytml-content';
                container.appendChild(content);
                
                const pyScripts = document.querySelectorAll('script[type="text/python"]');
                if (pyScripts.length > 0) {
                    pyScripts[0].insertAdjacentElement('beforebegin', container);
                } else {
                    document.body.insertAdjacentElement('afterbegin', container);
                }
                
                // Add default styles if not present
                if (!document.getElementById('pytml-styles')) {
                    this.injectStyles();
                }
            }
            this.outputContainer = container.querySelector('.pytml-content');
        }

        injectStyles() {
            const styles = document.createElement('style');
            styles.id = 'pytml-styles';
            styles.textContent = `
                .pytml-container {
                    background: #1a1a2e;
                    border-radius: 12px;
                    margin: 20px 0;
                    font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
                    font-size: 14px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    border: 1px solid #2d2d44;
                    overflow: hidden;
                }
                
                .pytml-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    background: #0f0f23;
                    border-bottom: 1px solid #2d2d44;
                }
                
                .pytml-title {
                    color: #7c3aed;
                    font-weight: 600;
                    font-size: 13px;
                    letter-spacing: 0.5px;
                }
                
                .pytml-clear-btn {
                    background: #2d2d44;
                    border: none;
                    color: #a1a1aa;
                    padding: 4px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    font-family: inherit;
                    transition: all 0.2s;
                }
                
                .pytml-clear-btn:hover {
                    background: #3d3d54;
                    color: #fff;
                }
                
                .pytml-content {
                    padding: 16px;
                    max-height: 500px;
                    overflow-y: auto;
                }
                
                .pytml-output-line {
                    padding: 4px 0;
                    margin: 0;
                    color: #e4e4e7;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    font-family: monospace;
                }
                
                .pytml-error-line {
                    color: #ef4444;
                    background: rgba(239, 68, 68, 0.1);
                    padding: 8px 12px;
                    margin: 4px 0;
                    border-radius: 6px;
                    border-left: 3px solid #ef4444;
                }
                
                .pytml-success-line {
                    color: #10b981;
                }
                
                .pytml-input-container {
                    margin: 12px 0;
                    padding: 16px;
                    background: #0f0f23;
                    border-radius: 8px;
                    border: 1px solid #2d2d44;
                }
                
                .pytml-input-prompt {
                    color: #7c3aed;
                    font-weight: 500;
                    margin-bottom: 10px;
                    font-size: 13px;
                }
                
                .pytml-input-field {
                    width: 100%;
                    padding: 10px 12px;
                    background: #1a1a2e;
                    border: 1px solid #3d3d54;
                    border-radius: 6px;
                    color: #e4e4e7;
                    font-family: monospace;
                    font-size: 13px;
                    box-sizing: border-box;
                    margin-bottom: 10px;
                }
                
                .pytml-input-field:focus {
                    outline: none;
                    border-color: #7c3aed;
                }
                
                .pytml-submit-btn {
                    background: #7c3aed;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 6px;
                    color: white;
                    font-weight: 500;
                    cursor: pointer;
                    font-size: 13px;
                    transition: background 0.2s;
                }
                
                .pytml-submit-btn:hover {
                    background: #6d28d9;
                }
                
                .pytml-status {
                    position: fixed;
                    bottom: 16px;
                    right: 16px;
                    background: #1a1a2e;
                    color: #7c3aed;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-family: monospace;
                    font-size: 12px;
                    z-index: 9999;
                    border: 1px solid #2d2d44;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }
                
                .pytml-status-error {
                    color: #ef4444;
                    border-color: #ef4444;
                }
                
                .pytml-content::-webkit-scrollbar {
                    width: 8px;
                }
                
                .pytml-content::-webkit-scrollbar-track {
                    background: #0f0f23;
                }
                
                .pytml-content::-webkit-scrollbar-thumb {
                    background: #2d2d44;
                    border-radius: 4px;
                }
                
                .pytml-content::-webkit-scrollbar-thumb:hover {
                    background: #3d3d54;
                }
            `;
            document.head.appendChild(styles);
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
                    await this.executePythonCode(code);
                    scriptTag.remove();

                } catch(e) {
                    this.addError(e.message);
                }
            }
            
            // Handle inline scripts
            const inlineScripts = document.querySelectorAll('script[type="text/python"]:not([src])');
            for (let scriptTag of inlineScripts) {
                const code = scriptTag.textContent;
                if (code.trim()) {
                    await this.executePythonCode(code);
                    scriptTag.remove();
                }
            }
        }

        async executePythonCode(code) {
            try {
                await this.pyodide.runPythonAsync(code);
            } catch (error) {
                this.addError(error.message);
            }
        }

        getInput(prompt) {
            return new Promise((resolve) => {
                const container = document.createElement('div');
                container.className = 'pytml-input-container';
                
                const promptText = document.createElement('div');
                promptText.className = 'pytml-input-prompt';
                promptText.textContent = prompt;
                container.appendChild(promptText);
                
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.className = 'pytml-input-field';
                inputField.placeholder = 'Type your answer...';
                container.appendChild(inputField);
                
                const submitBtn = document.createElement('button');
                submitBtn.className = 'pytml-submit-btn';
                submitBtn.textContent = 'Submit';
                container.appendChild(submitBtn);
                
                this.outputContainer.appendChild(container);
                inputField.focus();
                
                const submit = () => {
                    const value = inputField.value;
                    container.remove();
                    this.addOutputLine(`${prompt}${value}`, 'user-input');
                    resolve(value);
                };
                
                submitBtn.onclick = submit;
                inputField.onkeypress = (e) => {
                    if (e.key === 'Enter') submit();
                };
                
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        addOutput(text) {
            this.addOutputLine(text, 'output');
        }

        addOutputLine(text, type = 'output') {
            if (!this.outputContainer) return;
            
            const line = document.createElement('div');
            line.textContent = text;
            
            if (type === 'error') {
                line.className = 'pytml-error-line';
            } else if (type === 'success') {
                line.className = 'pytml-success-line pytml-output-line';
            } else if (type === 'user-input') {
                line.className = 'pytml-output-line';
                line.style.color = '#7c3aed';
                line.style.fontStyle = 'italic';
            } else {
                line.className = 'pytml-output-line';
            }
            
            this.outputContainer.appendChild(line);
            line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        addError(text) {
            this.addOutputLine(text, 'error');
        }

        clearOutput() {
            if (this.outputContainer) {
                this.outputContainer.innerHTML = '';
            }
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
            status.className = isError ? 'pytml-status pytml-status-error' : 'pytml-status';
            
            setTimeout(() => {
                if (status) {
                    status.style.opacity = '0';
                    setTimeout(() => {
                        if (status) status.remove();
                    }, 300);
                }
            }, 2500);
        }

        hideStatus() {
            const status = document.getElementById('pytml-status');
            if (status) status.remove();
        }
    }

    // Global functions for Python
    window.displayStyledOutput = function(text) {
        if (window.pytmlInstance) {
            window.pytmlInstance.addOutput(text);
        }
    };

    window.createInlineInput = function(prompt) {
        return window.pytmlInstance.getInput(prompt);
    };

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytmlInstance = new PYTML();
        });
    } else {
        window.pytmlInstance = new PYTML();
    }
    
})(window);
