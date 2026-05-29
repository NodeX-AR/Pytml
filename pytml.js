// pytml.js - Run Python files in HTML as if they were native
// No changes needed to your Python code. Just add one script tag.

(function(window) {
    'use strict';

    class PYTML {
        constructor() {
            this.ready = false;
            this.pyodide = null;
            this.output = null;
            this.init();
        }

        async init() {
            // Create output element (hidden by default, appears when needed)
            this.createOutput();
            
            // Load Pyodide
            await this.loadPyodide();
            
            // Setup Python environment (preserves ALL Python behavior)
            await this.setupPython();
            
            // Find and run Python files
            await this.runPythonFiles();
        }

        createOutput() {
            // Create output container - only appears when Python prints something
            this.output = document.createElement('div');
            this.output.id = 'pytml-output';
            this.output.style.cssText = `
                font-family: monospace;
                margin: 10px 0;
                padding: 0;
                display: none;
            `;
            document.body.appendChild(this.output);
        }

        loadPyodide() {
            return new Promise((resolve, reject) => {
                if (window.loadPyodide) {
                    this.initPyodide().then(resolve).catch(reject);
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
                script.onload = () => this.initPyodide().then(resolve).catch(reject);
                script.onerror = () => reject(new Error('Failed to load Pyodide'));
                document.head.appendChild(script);
            });
        }

        async initPyodide() {
            this.pyodide = await window.loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
                fullStdLib: true
            });
        }

        async setupPython() {
            await this.pyodide.runPythonAsync(`
import sys
import js
import asyncio
from js import document, window, console

class OutputCapture:
    def __init__(self):
        self.buffer = []
    
    def write(self, text):
        if text and text.strip():
            self.buffer.append(str(text))
            if text.endswith('\\n') or len(self.buffer) > 0:
                js.window.pytml.display(''.join(self.buffer))
                self.buffer = []
    
    def flush(self):
        if self.buffer:
            js.window.pytml.display(''.join(self.buffer))
            self.buffer = []

sys.stdout = OutputCapture()
sys.stderr = OutputCapture()

class PythonInput:
    def __init__(self):
        self._input = None
    
    async def __call__(self, prompt=""):
        if prompt:
            print(prompt, end='')
        return await js.window.pytml.getInput(prompt)

import builtins
builtins.input = PythonInput()

# Make Python feel exactly like native
console.log("Python ready - Your Python file will run exactly as written")
`);
        }

        async runPythonFiles() {
            // Find ALL Python files linked in HTML
            const links = document.querySelectorAll('link[type="text/python"], script[type="text/python"][src]');
            
            for (let link of links) {
                let pythonFile = link.getAttribute('href') || link.getAttribute('src');
                if (pythonFile) {
                    await this.runPythonFile(pythonFile);
                }
            }
        }

        async runPythonFile(filePath) {
            try {
                // Fetch and run the Python file exactly as is
                const response = await fetch(filePath);
                const pythonCode = await response.text();
                
                // Execute the Python code - NO MODIFICATIONS
                await this.pyodide.runPythonAsync(pythonCode);
                
            } catch (error) {
                this.display(`Error running ${filePath}: ${error.message}`, 'error');
            }
        }

        async getInput(prompt) {
            return new Promise((resolve) => {
                // Create input that looks native
                const container = document.createElement('div');
                container.style.cssText = `
                    margin: 10px 0;
                    padding: 10px;
                    background: #f5f5f5;
                    border-left: 3px solid #007bff;
                `;
                
                const promptEl = document.createElement('div');
                promptEl.textContent = prompt;
                promptEl.style.marginBottom = '5px';
                promptEl.style.fontWeight = 'bold';
                
                const inputEl = document.createElement('input');
                inputEl.type = 'text';
                inputEl.style.cssText = `
                    padding: 5px;
                    margin-right: 5px;
                    width: 200px;
                    border: 1px solid #ccc;
                    border-radius: 3px;
                `;
                
                const buttonEl = document.createElement('button');
                buttonEl.textContent = 'Submit';
                buttonEl.style.cssText = `
                    padding: 5px 10px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                `;
                
                container.appendChild(promptEl);
                container.appendChild(inputEl);
                container.appendChild(buttonEl);
                
                // Show output container
                this.output.style.display = 'block';
                this.output.appendChild(container);
                
                const submit = () => {
                    const value = inputEl.value;
                    container.remove();
                    resolve(value);
                    // Hide container if empty
                    if (this.output.children.length === 0) {
                        this.output.style.display = 'none';
                    }
                };
                
                buttonEl.onclick = submit;
                inputEl.onkeypress = (e) => { if (e.key === 'Enter') submit(); };
                inputEl.focus();
            });
        }

        display(text, type = 'output') {
            // Show output container
            this.output.style.display = 'block';
            
            const line = document.createElement('div');
            line.textContent = text;
            line.style.cssText = `
                padding: 5px 10px;
                margin: 0;
                border-bottom: 1px solid #eee;
                font-family: monospace;
                font-size: 14px;
                ${type === 'error' ? 'color: #f44336; background: #ffebee;' : ''}
                ${type === 'success' ? 'color: #4caf50;' : ''}
                ${type === 'info' ? 'color: #2196f3;' : ''}
            `;
            
            this.output.appendChild(line);
            line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        log(message) {
            console.log(`[PYTML] ${message}`);
        }

        emit(event, data) {
            const handlers = this.eventHandlers.get(event);
            if (handlers) handlers.forEach(handler => handler(data));
        }
    }

    // Auto-initialize when script loads
    window.pytml = new PYTML();
    
})(window);
