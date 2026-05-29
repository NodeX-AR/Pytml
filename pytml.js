// pytml.js - Run Python files in HTML as if they were native
// Fixed: Proper DOM loading, error handling, and CSP compliance

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
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            // Create output element
            this.createOutput();
            
            // Load Pyodide
            await this.loadPyodide();
            
            // Setup Python environment
            await this.setupPython();
            
            // Find and run Python files
            await this.runPythonFiles();
        }

        createOutput() {
            // Create output container only if body exists
            if (!document.body) {
                console.error('Document body not ready');
                return;
            }
            
            // Check if output already exists
            let output = document.getElementById('pytml-output');
            if (!output) {
                output = document.createElement('div');
                output.id = 'pytml-output';
                output.style.cssText = `
                    font-family: monospace;
                    margin: 10px 0;
                    padding: 0;
                    display: none;
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    max-width: 400px;
                    max-height: 300px;
                    overflow: auto;
                    background: white;
                    border: 1px solid #ccc;
                    border-radius: 5px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 10000;
                `;
                document.body.appendChild(output);
            }
            this.output = output;
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
                fullStdLib: false
            });
        }

        async setupPython() {
            await this.pyodide.runPythonAsync(`
import sys
import js
from js import document, window

class OutputCapture:
    def __init__(self):
        self.buffer = []
    
    def write(self, text):
        if text:
            self.buffer.append(str(text))
            if '\\n' in text or len(self.buffer) > 5:
                self.flush()
    
    def flush(self):
        if self.buffer:
            full_text = ''.join(self.buffer)
            if full_text.strip():
                window.pytml.display(full_text)
            self.buffer = []

sys.stdout = OutputCapture()
sys.stderr = OutputCapture()

async def python_input(prompt=""):
    if prompt:
        print(prompt, end='')
    return await window.pytml.getInput(prompt)

import builtins
builtins.input = python_input
`);
        }

        async runPythonFiles() {
            // Find all Python files - handle both link and script tags
            const elements = document.querySelectorAll('link[type="text/python"], script[type="text/python"][src]');
            
            if (elements.length === 0) {
                this.log('No Python files found');
                return;
            }
            
            for (let el of elements) {
                let pythonFile = el.getAttribute('href') || el.getAttribute('src');
                if (pythonFile) {
                    await this.runPythonFile(pythonFile);
                }
            }
        }

        async runPythonFile(filePath) {
            try {
                this.log(`Running: ${filePath}`);
                const response = await fetch(filePath);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const pythonCode = await response.text();
                await this.pyodide.runPythonAsync(pythonCode);
                this.log(`Completed: ${filePath}`);
                
            } catch (error) {
                this.display(`Error: ${error.message}`, 'error');
                console.error(`Failed to run ${filePath}:`, error);
            }
        }

        async getInput(prompt) {
            return new Promise((resolve) => {
                // Ensure output container exists
                if (!this.output || !document.body.contains(this.output)) {
                    this.createOutput();
                }
                
                // Create input container
                const container = document.createElement('div');
                container.style.cssText = `
                    margin: 5px;
                    padding: 10px;
                    background: #f9f9f9;
                    border-left: 3px solid #007bff;
                    border-radius: 3px;
                `;
                
                const promptEl = document.createElement('div');
                promptEl.textContent = prompt;
                promptEl.style.cssText = `
                    margin-bottom: 8px;
                    font-weight: bold;
                    color: #333;
                `;
                
                const inputWrapper = document.createElement('div');
                inputWrapper.style.cssText = `
                    display: flex;
                    gap: 5px;
                `;
                
                const inputEl = document.createElement('input');
                inputEl.type = 'text';
                inputEl.style.cssText = `
                    flex: 1;
                    padding: 8px;
                    border: 1px solid #ccc;
                    border-radius: 3px;
                    font-family: monospace;
                `;
                
                const buttonEl = document.createElement('button');
                buttonEl.textContent = 'Submit';
                buttonEl.style.cssText = `
                    padding: 8px 15px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                `;
                buttonEl.onmouseover = () => buttonEl.style.background = '#0056b3';
                buttonEl.onmouseout = () => buttonEl.style.background = '#007bff';
                
                inputWrapper.appendChild(inputEl);
                inputWrapper.appendChild(buttonEl);
                container.appendChild(promptEl);
                container.appendChild(inputWrapper);
                
                // Show output and add container
                this.output.style.display = 'block';
                this.output.appendChild(container);
                this.output.scrollTop = this.output.scrollHeight;
                
                const submit = () => {
                    const value = inputEl.value;
                    container.remove();
                    
                    // Hide output if empty
                    if (this.output.children.length === 0) {
                        this.output.style.display = 'none';
                    }
                    
                    resolve(value);
                };
                
                buttonEl.onclick = submit;
                inputEl.onkeypress = (e) => {
                    if (e.key === 'Enter') submit();
                };
                
                inputEl.focus();
            });
        }

        display(text, type = 'output') {
            // Ensure output exists
            if (!this.output || !document.body.contains(this.output)) {
                this.createOutput();
            }
            
            // Show output container
            this.output.style.display = 'block';
            
            const line = document.createElement('div');
            line.textContent = text;
            
            // Style based on type
            let color = '#333';
            let bgColor = 'transparent';
            
            if (type === 'error') {
                color = '#dc3545';
                bgColor = '#ffe6e6';
            } else if (type === 'success') {
                color = '#28a745';
            } else if (type === 'warning') {
                color = '#ffc107';
            }
            
            line.style.cssText = `
                padding: 8px 12px;
                margin: 0;
                border-bottom: 1px solid #eee;
                font-family: 'Courier New', monospace;
                font-size: 13px;
                color: ${color};
                background: ${bgColor};
                white-space: pre-wrap;
                word-wrap: break-word;
            `;
            
            this.output.appendChild(line);
            this.output.scrollTop = this.output.scrollHeight;
            
            // Auto-hide after 10 seconds if no activity (optional)
            clearTimeout(this.hideTimeout);
            this.hideTimeout = setTimeout(() => {
                if (this.output.children.length === 0) {
                    this.output.style.display = 'none';
                }
            }, 10000);
        }

        log(message) {
            console.log(`[PYTML] ${message}`);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytml = new PYTML();
        });
    } else {
        window.pytml = new PYTML();
    }
    
})(window);
