(function(window) {
    class PYTML {
        constructor() {
            this.outputContainer = null;
            this.pendingInput = null;
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
                
                // Create a custom output capture system
                pyodide.runPython(`
import sys
import asyncio
from io import StringIO

class StreamingOutput:
    def __init__(self):
        self.buffer = []
    
    def write(self, text):
        if text and text.strip():
            self.buffer.append(str(text))
            # Send each line immediately
            for line in str(text).split('\\n'):
                if line.strip() or text.strip() == '':
                    from js import streamOutput
                    streamOutput(line + '\\n')
    
    def flush(self):
        pass

# Replace stdout
sys.stdout = StreamingOutput()
sys.stderr = StreamingOutput()

# Store original input for later
import builtins
original_input = builtins.input

# Override input to work with our system
def input(prompt=""):
    if prompt:
        print(prompt, end='')
    from js import getInlineInputSync
    return getInlineInputSync(prompt)

builtins.input = input
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
                    
                    // Run Python code with streaming output
                    await this.runPythonWithStreaming(code);
                    scriptTag.remove();

                } catch(e) {
                    this.addError(e.message);
                }
            }
        }

        async runPythonWithStreaming(code) {
            try {
                // Execute the code directly - the stdout capture will handle streaming
                await window.pyodide.runPythonAsync(code);
            } catch (error) {
                this.addError(error.toString());
            }
        }

        streamOutput(text) {
            // This gets called from Python for each chunk of output
            if (!this.outputContainer) return;
            
            // Check if this is a prompt for input
            if (this.pendingInput) {
                // If waiting for input, just append to the prompt area
                const lastChild = this.outputContainer.lastChild;
                if (lastChild && lastChild.classList && lastChild.classList.contains('prompt-output')) {
                    lastChild.textContent += text;
                }
                return;
            }
            
            // Split into lines for individual display
            const lines = text.split('\n');
            for (let line of lines) {
                if (line === '') continue;
                
                const outputLine = document.createElement('div');
                
                // Color coding
                let color = '#43e97b';
                if (line.includes('Error') || line.includes('Traceback')) {
                    color = '#fa709a';
                } else if (line.includes('Warning')) {
                    color = '#ffd93d';
                } else {
                    color = '#e0e0e0';
                }
                
                outputLine.style.cssText = `
                    color: ${color};
                    margin: 2px 0;
                    line-height: 1.5;
                    font-family: 'Courier New', monospace;
                    white-space: pre-wrap;
                    word-break: break-word;
                `;
                outputLine.textContent = line;
                this.outputContainer.appendChild(outputLine);
            }
            
            // Auto-scroll to bottom
            this.outputContainer.scrollTop = this.outputContainer.scrollHeight;
        }

        async getInlineInput(prompt) {
            return new Promise((resolve) => {
                // Create input container
                const container = document.createElement('div');
                container.style.cssText = `
                    background: rgba(102, 126, 234, 0.15);
                    border-radius: 10px;
                    padding: 15px;
                    margin: 10px 0;
                    border-left: 3px solid #667eea;
                `;
                
                // Add prompt text
                const promptText = document.createElement('div');
                promptText.textContent = prompt || 'Input required:';
                promptText.style.cssText = `
                    color: #ffd93d;
                    font-weight: 500;
                    margin-bottom: 10px;
                    font-family: system-ui, sans-serif;
                `;
                container.appendChild(promptText);
                
                // Add input field
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.placeholder = 'Type your answer here...';
                inputField.style.cssText = `
                    width: 100%;
                    padding: 10px 12px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(102, 126, 234, 0.5);
                    border-radius: 8px;
                    color: white;
                    font-size: 14px;
                    font-family: monospace;
                    outline: none;
                    box-sizing: border-box;
                    margin-bottom: 10px;
                `;
                container.appendChild(inputField);
                
                // Add submit button
                const submitBtn = document.createElement('button');
                submitBtn.textContent = 'Submit →';
                submitBtn.style.cssText = `
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    padding: 8px 20px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 13px;
                `;
                submitBtn.onmouseover = () => {
                    submitBtn.style.transform = 'translateY(-2px)';
                };
                submitBtn.onmouseout = () => {
                    submitBtn.style.transform = 'translateY(0)';
                };
                container.appendChild(submitBtn);
                
                // Add to output container
                this.outputContainer.appendChild(container);
                
                // Focus on input
                inputField.focus();
                
                // Handle submission
                const submit = () => {
                    const value = inputField.value;
                    container.remove();
                    
                    // Show the input value as output
                    const userInputLine = document.createElement('div');
                    userInputLine.style.cssText = `
                        color: #a78bfa;
                        margin: 2px 0;
                        font-family: 'Courier New', monospace;
                        font-style: italic;
                    `;
                    userInputLine.textContent = `↳ ${value}`;
                    this.outputContainer.appendChild(userInputLine);
                    
                    resolve(value);
                };
                
                submitBtn.onclick = submit;
                inputField.onkeypress = (e) => {
                    if (e.key === 'Enter') submit();
                };
                
                // Scroll to input
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        getInlineInputSync(prompt) {
            // Synchronous wrapper for async input (using a trick with async/await)
            this.pendingInput = true;
            
            // Use a promise that we'll resolve synchronously
            let value = null;
            let isResolved = false;
            
            this.getInlineInput(prompt).then(result => {
                value = result;
                isResolved = true;
                this.pendingInput = false;
            });
            
            // Wait for resolution (this blocks but it's necessary for sync input)
            const startTime = Date.now();
            while (!isResolved && Date.now() - startTime < 300000) { // 5 min timeout
                // This is a spin lock - not ideal but necessary for synchronous input
                // In practice, this works because the Promise resolves quickly
            }
            
            return value;
        }

        clearOutput() {
            if (this.outputContainer) {
                this.outputContainer.innerHTML = '';
            }
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
                border-left: 3px solid #fa709a;
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
                    transition: all 0.3s;
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
    window.streamOutput = function(text) {
        if (window.pytmlInstance) {
            window.pytmlInstance.streamOutput(text);
        }
    };

    window.getInlineInputSync = function(prompt) {
        if (window.pytmlInstance) {
            return window.pytmlInstance.getInlineInputSync(prompt);
        }
        return '';
    };

    // Initialize when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytmlInstance = new PYTML();
        });
    } else {
        window.pytmlInstance = new PYTML();
    }
})(window);
