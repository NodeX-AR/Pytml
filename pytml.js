// pytml.js - Complete Fixed Version
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
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            this.createOutput();
            await this.loadPyodide();
            await this.setupPython();
            await this.runPythonFiles();
        }

        createOutput() {
            if (!document.body) return;
            
            let output = document.getElementById('pytml-output');
            if (!output) {
                output = document.createElement('div');
                output.id = 'pytml-output';
                output.style.cssText = `
                    font-family: 'Courier New', 'Fira Code', monospace;
                    margin: 20px auto;
                    padding: 0;
                    background: #1e1e1e;
                    color: #d4d4d4;
                    border-radius: 8px;
                    max-width: 800px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                `;
                
                const header = document.createElement('div');
                header.style.cssText = `
                    padding: 10px 15px;
                    background: #2d2d2d;
                    border-bottom: 1px solid #3d3d3d;
                    border-radius: 8px 8px 0 0;
                    font-weight: bold;
                    color: #4ec9b0;
                `;
                header.textContent = 'Python Output';
                output.appendChild(header);
                
                const content = document.createElement('div');
                content.id = 'pytml-content';
                content.style.cssText = `
                    padding: 15px;
                    max-height: 500px;
                    overflow-y: auto;
                `;
                output.appendChild(content);
                
                document.body.appendChild(output);
            }
            this.output = document.getElementById('pytml-content');
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
            // Fixed: Proper multi-line string with correct syntax
            const pythonCode = `
import sys
import js
import asyncio
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
                window.pytml.display(full_text, 'output')
            self.buffer = []

sys.stdout = OutputCapture()
sys.stderr = OutputCapture()

async def python_input(prompt=""):
    if prompt:
        print(prompt, end='')
    result = await window.pytml.getInputInline(prompt)
    return result

import builtins
builtins.input = python_input
print("Python ready!")
`;
            await this.pyodide.runPythonAsync(pythonCode);
        }

        async runPythonFiles() {
            const elements = document.querySelectorAll('link[type="text/python"], script[type="text/python"][src]');
            
            if (elements.length === 0) {
                this.display('No Python files found. Use: <link type="text/python" href="yourfile.py">', 'warning');
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
                this.display('Running: ' + filePath, 'info');
                const response = await fetch(filePath);
                
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }
                
                const pythonCode = await response.text();
                await this.pyodide.runPythonAsync(pythonCode);
                this.display('Completed: ' + filePath, 'success');
                
            } catch (error) {
                this.display('Error: ' + error.message, 'error');
                console.error('Failed to run ' + filePath + ':', error);
            }
        }

        getInputInline(prompt) {
            return new Promise((resolve) => {
                // Create inline input element
                const inputContainer = document.createElement('div');
                inputContainer.style.cssText = `
                    margin: 10px 0;
                    padding: 10px;
                    background: #2d2d2d;
                    border-left: 3px solid #4ec9b0;
                    border-radius: 4px;
                `;
                
                const promptText = document.createElement('div');
                promptText.textContent = prompt;
                promptText.style.cssText = `
                    margin-bottom: 8px;
                    color: #4ec9b0;
                    font-weight: bold;
                `;
                
                const inputWrapper = document.createElement('div');
                inputWrapper.style.cssText = `
                    display: flex;
                    gap: 10px;
                    align-items: center;
                `;
                
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.style.cssText = `
                    flex: 1;
                    padding: 8px 12px;
                    background: #1e1e1e;
                    border: 1px solid #4ec9b0;
                    color: #d4d4d4;
                    border-radius: 4px;
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                `;
                inputField.placeholder = 'Type your answer here...';
                
                const submitButton = document.createElement('button');
                submitButton.textContent = 'Submit';
                submitButton.style.cssText = `
                    padding: 8px 16px;
                    background: #4ec9b0;
                    color: #1e1e1e;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: background 0.2s;
                `;
                submitButton.onmouseover = function() { 
                    submitButton.style.background = '#5fd9c0'; 
                };
                submitButton.onmouseout = function() { 
                    submitButton.style.background = '#4ec9b0'; 
                };
                
                inputWrapper.appendChild(inputField);
                inputWrapper.appendChild(submitButton);
                inputContainer.appendChild(promptText);
                inputContainer.appendChild(inputWrapper);
                
                this.output.appendChild(inputContainer);
                inputField.focus();
                
                var self = this;
                var submit = function() {
                    var value = inputField.value;
                    inputContainer.remove();
                    
                    // Display what the user typed
                    var userLine = document.createElement('div');
                    userLine.style.cssText = `
                        padding: 5px 0;
                        color: #ce9178;
                        font-style: italic;
                    `;
                    userLine.textContent = '> ' + prompt + value;
                    self.output.appendChild(userLine);
                    
                    resolve(value);
                };
                
                submitButton.onclick = submit;
                inputField.onkeypress = function(e) {
                    if (e.key === 'Enter') submit();
                };
                
                // Auto-scroll to input
                inputContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        display(text, type) {
            if (!this.output) return;
            
            var line = document.createElement('div');
            line.textContent = text;
            
            var color = '#d4d4d4';
            var borderLeft = 'none';
            
            if (type === 'error') {
                color = '#f48771';
                borderLeft = '3px solid #f48771';
            } else if (type === 'success') {
                color = '#4ec9b0';
                borderLeft = '3px solid #4ec9b0';
            } else if (type === 'warning') {
                color = '#ce9178';
                borderLeft = '3px solid #ce9178';
            } else if (type === 'info') {
                color = '#569cd6';
                borderLeft = '3px solid #569cd6';
            }
            
            line.style.cssText = `
                padding: 4px 0;
                margin: 2px 0;
                color: ${color};
                border-left: ${borderLeft};
                padding-left: ${borderLeft !== 'none' ? '10px' : '0'};
                white-space: pre-wrap;
                word-wrap: break-word;
                font-family: 'Courier New', monospace;
                font-size: 13px;
            `;
            
            this.output.appendChild(line);
            line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        clear() {
            if (this.output) {
                this.output.innerHTML = '';
                this.display('Output cleared', 'info');
            }
        }
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            window.pytml = new PYTML();
        });
    } else {
        window.pytml = new PYTML();
    }
    
})(window);
