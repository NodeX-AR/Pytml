(function(window) {
    class PYTML {
        constructor() {
            this.outputContainer = null;
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
                let pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
                });
                
                window.pyodide = pyodide;
                
                // Setup Python environment with proper async input
                pyodide.runPython(`
import sys
import js
import asyncio
from js import document

class HTMLOutput:
    def write(self, text):
        if text:
            js.displayStyledOutput(str(text))
    def flush(self):
        pass

sys.stdout = HTMLOutput()

# Async input using JavaScript modal
async def async_input(prompt):
    """Async input that shows HTML modal"""
    future = asyncio.Future()
    js.showInputModal(prompt, future)
    result = await future
    return result

# Create a sync wrapper that runs the async function
def input(prompt=""):
    """Synchronous wrapper for async_input"""
    if prompt:
        print(prompt, end="", flush=True)
    # Get the current event loop and run until complete
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(async_input(prompt))

print("Ready! Python input() will use custom HTML modal.")
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

        createInputModal() {
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
                    ">
                        <h3 style="color: #667eea; margin: 0 0 20px 0; font-family: sans-serif;">📝 Python Input</h3>
                        <p id="pytml-modal-prompt" style="color: #e0e0e0; font-family: monospace; font-size: 16px; margin-bottom: 20px;"></p>
                        <input type="text" id="pytml-modal-input" style="
                            width: 100%;
                            padding: 12px 16px;
                            background: rgba(255,255,255,0.1);
                            border: 1px solid rgba(102, 126, 234, 0.5);
                            border-radius: 10px;
                            color: white;
                            font-size: 14px;
                            outline: none;
                            box-sizing: border-box;
                        " autofocus>
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
                            ">Submit</button>
                            <button id="pytml-modal-cancel" style="
                                flex: 1;
                                background: rgba(250, 112, 154, 0.2);
                                border: 1px solid #fa709a;
                                padding: 12px;
                                border-radius: 10px;
                                color: #fa709a;
                                font-weight: 600;
                                cursor: pointer;
                            ">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            const modal = document.getElementById('pytml-modal');
            const closeBtn = document.getElementById('pytml-modal-submit');
            const cancelBtn = document.getElementById('pytml-modal-cancel');
            const submitBtn = document.getElementById('pytml-modal-submit');
            const inputField = document.getElementById('pytml-modal-input');
            
            const submit = () => {
                const value = inputField.value;
                modal.style.display = 'none';
                if (this.inputResolve) {
                    this.inputResolve(value);
                    this.inputResolve = null;
                }
                inputField.value = '';
            };
            
            const cancel = () => {
                modal.style.display = 'none';
                if (this.inputResolve) {
                    this.inputResolve('');
                    this.inputResolve = null;
                }
                inputField.value = '';
            };
            
            submitBtn.onclick = submit;
            cancelBtn.onclick = cancel;
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
            line.style.cssText = `
                color: #43e97b;
                margin: 4px 0;
                line-height: 1.5;
                font-family: monospace;
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

    window.showInputModal = function(prompt, future) {
        const modal = document.getElementById('pytml-modal');
        const promptEl = document.getElementById('pytml-modal-prompt');
        const inputEl = document.getElementById('pytml-modal-input');
        
        promptEl.textContent = prompt;
        inputEl.value = '';
        modal.style.display = 'flex';
        inputEl.focus();
        
        if (window.pytmlInstance) {
            window.pytmlInstance.inputResolve = (value) => {
                future.resolve(value);
            };
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
