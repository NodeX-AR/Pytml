(function(window) {
    class PYTML {
        constructor() {
            this.outputContainer = null;
            this.pendingInput = null;
            this.inputResolve = null;
            this.init();
        }

        async init() {
            console.log('PYTML: Initializing with custom HTML input...');
            this.createOutputContainer();
            this.createInputModal();
            this.showStatus('Loading Python...');
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
            
            script.onload = async () => {
                this.showStatus('Initializing Python...');
                window.pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
                });
                
                // Override print and input with HTML versions
                window.pyodide.runPython(`
import sys
import js
from js import document, window

class HTMLOutput:
    def __init__(self):
        pass
    
    def write(self, text):
        if text:
            js.displayStyledOutput(text)
    
    def flush(self):
        pass

# Override stdout
sys.stdout = HTMLOutput()

# Override input with custom HTML modal
async def html_input(prompt=""):
    import asyncio
    future = asyncio.Future()
    js.showInputModal(prompt, future)
    result = await future
    return result

# Replace built-in input
__builtins__.input = html_input
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
                    font-family: 'Courier New', 'Fira Code', monospace;
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

        createInputModal() {
            // Create modal HTML (hidden initially)
            const modalHTML = `
                <div id="pytml-modal" style="
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(5px);
                    z-index: 10000;
                    justify-content: center;
                    align-items: center;
                ">
                    <div style="
                        background: linear-gradient(135deg, #1a1f3a 0%, #0a0e27 100%);
                        border-radius: 20px;
                        padding: 30px;
                        max-width: 450px;
                        width: 90%;
                        box-shadow: 0 25px 50px rgba(0,0,0,0.5);
                        border: 1px solid rgba(102, 126, 234, 0.5);
                        animation: slideIn 0.3s ease;
                    ">
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 20px;
                        ">
                            <h3 style="
                                color: #667eea;
                                margin: 0;
                                font-family: sans-serif;
                            ">📝 Python Input Required</h3>
                            <button id="pytml-modal-close" style="
                                background: none;
                                border: none;
                                color: #8892b0;
                                font-size: 24px;
                                cursor: pointer;
                                transition: color 0.2s;
                            ">&times;</button>
                        </div>
                        <p id="pytml-modal-prompt" style="
                            color: #e0e0e0;
                            font-family: monospace;
                            font-size: 16px;
                            margin-bottom: 20px;
                            line-height: 1.5;
                        "></p>
                        <input type="text" id="pytml-modal-input" style="
                            width: 100%;
                            padding: 12px 16px;
                            background: rgba(255,255,255,0.1);
                            border: 1px solid rgba(102, 126, 234, 0.5);
                            border-radius: 10px;
                            color: white;
                            font-size: 14px;
                            font-family: monospace;
                            outline: none;
                            transition: all 0.3s;
                            box-sizing: border-box;
                        " placeholder="Type your answer here...">
                        <div style="display: flex; gap: 12px; margin-top: 20px;">
                            <button id="pytml-modal-submit" style="
                                flex: 1;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                border: none;
                                padding: 12px;
                                border-radius: 10px;
                                color: white;
                                font-weight: 600;
                                cursor: pointer;
                                transition: transform 0.2s;
                            ">✓ Submit</button>
                            <button id="pytml-modal-cancel" style="
                                flex: 1;
                                background: rgba(250, 112, 154, 0.2);
                                border: 1px solid #fa709a;
                                padding: 12px;
                                border-radius: 10px;
                                color: #fa709a;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.2s;
                            ">✗ Cancel</button>
                        </div>
                    </div>
                </div>
                <style>
                    @keyframes slideIn {
                        from {
                            opacity: 0;
                            transform: translateY(-30px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    #pytml-modal-input:focus {
                        border-color: #43e97b;
                        box-shadow: 0 0 10px rgba(67, 233, 123, 0.3);
                    }
                    #pytml-modal-submit:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
                    }
                    #pytml-modal-cancel:hover {
                        background: rgba(250, 112, 154, 0.4);
                    }
                </style>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Setup event listeners
            const modal = document.getElementById('pytml-modal');
            const closeBtn = document.getElementById('pytml-modal-close');
            const cancelBtn = document.getElementById('pytml-modal-cancel');
            const submitBtn = document.getElementById('pytml-modal-submit');
            const inputField = document.getElementById('pytml-modal-input');
            
            const closeModal = () => {
                modal.style.display = 'none';
                if (this.inputResolve) {
                    this.inputResolve('');
                    this.inputResolve = null;
                }
            };
            
            const submit = () => {
                const value = inputField.value;
                modal.style.display = 'none';
                if (this.inputResolve) {
                    this.inputResolve(value);
                    this.inputResolve = null;
                }
                inputField.value = '';
            };
            
            closeBtn.onclick = closeModal;
            cancelBtn.onclick = closeModal;
            submitBtn.onclick = submit;
            inputField.onkeypress = (e) => {
                if (e.key === 'Enter') submit();
            };
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
                    await window.pyodide.runPythonAsync(code);
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
            
            // Auto-detect and style different output types
            let style = '';
            
            if (text.includes('+--') || text.includes('+--')) {
                // Borders/separators
                style = `
                    color: #667eea;
                    font-weight: bold;
                    margin: 8px 0;
                    letter-spacing: 1px;
                    text-shadow: 0 0 5px rgba(102, 126, 234, 0.3);
                `;
            } 
            else if (text.includes('LIBRARY MANAGEMENT SYSTEM') || text.includes('Library Statistics')) {
                // Main headers
                style = `
                    color: #f093fb;
                    font-weight: bold;
                    font-size: 1.15em;
                    text-align: center;
                    margin: 15px 0;
                    text-shadow: 0 0 10px rgba(240, 147, 251, 0.5);
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                `;
            }
            else if (text.includes('Options :') || text.includes('Options')) {
                // Menu headers
                style = `
                    color: #4facfe;
                    font-weight: bold;
                    font-size: 1.05em;
                    margin: 12px 0 8px 0;
                    border-left: 3px solid #4facfe;
                    padding-left: 10px;
                `;
            }
            else if (text.match(/^\d\./) || text.match(/^\d\)/)) {
                // Menu options
                style = `
                    color: #43e97b;
                    margin: 6px 0 6px 25px;
                    cursor: pointer;
                    transition: all 0.2s;
                    padding: 4px 8px;
                    border-radius: 5px;
                `;
                line.onmouseover = () => {
                    line.style.background = 'rgba(67, 233, 123, 0.1)';
                    line.style.transform = 'translateX(5px)';
                };
                line.onmouseout = () => {
                    line.style.background = 'transparent';
                    line.style.transform = 'translateX(0)';
                };
            }
            else if (text.includes('successfully') || text.includes('success')) {
                // Success messages
                style = `
                    color: #43e97b;
                    font-weight: bold;
                    margin: 10px 0;
                    padding: 8px 12px;
                    background: rgba(67, 233, 123, 0.1);
                    border-left: 3px solid #43e97b;
                    border-radius: 8px;
                    animation: fadeIn 0.5s;
                `;
            }
            else if (text.includes('Error') || text.includes('not found') || text.includes('invalid') || text.includes('already')) {
                // Error/warning messages
                style = `
                    color: #fa709a;
                    margin: 10px 0;
                    padding: 8px 12px;
                    background: rgba(250, 112, 154, 0.1);
                    border-left: 3px solid #fa709a;
                    border-radius: 8px;
                `;
            }
            else if (text.includes('Enter') || text.includes(':')) {
                // Prompts that would normally use input
                style = `
                    color: #ffd93d;
                    margin: 15px 0 5px 0;
                    font-style: italic;
                    font-weight: 500;
                `;
            }
            else {
                // Normal output
                style = `
                    color: #e0e0e0;
                    margin: 4px 0;
                    line-height: 1.5;
                `;
            }
            
            line.style.cssText = style;
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
                padding: 12px;
                margin: 10px 0;
                border-radius: 10px;
                border-left: 4px solid #fa709a;
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
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 25px;
                    font-family: monospace;
                    font-size: 12px;
                    z-index: 9999;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                `;
                document.body.appendChild(status);
            }
            status.textContent = message;
            if (isError) status.style.background = '#fa709a';
            setTimeout(() => {
                if (status && !isError) status.style.opacity = '0.7';
            }, 2000);
        }

        hideStatus() {
            const status = document.getElementById('pytml-status');
            if (status) status.remove();
        }
    }

    // Global functions called by Python
    window.displayStyledOutput = function(text) {
        if (window.pytmlInstance) {
            window.pytmlInstance.addStyledOutput(text);
        }
    };

    window.showInputModal = function(prompt, future) {
        const modal = document.getElementById('pytml-modal');
        const promptEl = document.getElementById('pytml-modal-prompt');
        const inputEl = document.getElementById('pytml-modal-input');
        
        promptEl.textContent = prompt;
        inputEl.value = '';
        modal.style.display = 'flex';
        inputEl.focus();
        
        // Store the resolve function
        const originalResolve = window.pytmlInstance?.inputResolve;
        window.pytmlInstance.inputResolve = (value) => {
            future.resolve(value);
        };
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytmlInstance = new PYTML();
        });
    } else {
        window.pytmlInstance = new PYTML();
    }
})(window);
