// pytml.js - Fixed version with proper async input handling
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
            await this.pyodide.runPythonAsync(`
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
`);
        }

        async runPythonFiles() {
            const elements = document.querySelectorAll('link[type="text/python"], script[type="text/python"][src]');
            
            for (let el of elements) {
                let pythonFile = el.getAttribute('href') || el.getAttribute('src');
                if (pythonFile) {
                    await this.runPythonFile(pythonFile);
                }
            }
        }

        async runPythonFile(filePath) {
            try {
                this.display(f'Running: {filePath}', 'info');
                const response = await fetch(filePath);
                const pythonCode = await response.text();
                await this.pyodide.runPythonAsync(pythonCode);
                this.display(f'Completed: {filePath}', 'success');
            } catch (error) {
                this.display(`Error: ${error.message}`, 'error');
            }
        }

        getInputInline(prompt) {
            return new Promise((resolve) => {
                const container = document.createElement('div');
                container.style.cssText = `
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
                
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.style.cssText = `
                    width: calc(100% - 80px);
                    padding: 8px 12px;
                    background: #1e1e1e;
                    border: 1px solid #4ec9b0;
                    color: #d4d4d4;
                    border-radius: 4px;
                    font-family: monospace;
                    margin-right: 10px;
                `;
                inputField.placeholder = 'Type here...';
                
                const submitBtn = document.createElement('button');
                submitBtn.textContent = 'Submit';
                submitBtn.style.cssText = `
                    padding: 8px 16px;
                    background: #4ec9b0;
                    color: #1e1e1e;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                `;
                
                const wrapper = document.createElement('div');
                wrapper.appendChild(inputField);
                wrapper.appendChild(submitBtn);
                container.appendChild(promptText);
                container.appendChild(wrapper);
                
                this.output.appendChild(container);
                inputField.focus();
                
                const submit = () => {
                    const value = inputField.value;
                    container.remove();
                    
                    const userLine = document.createElement('div');
                    userLine.style.cssText = `
                        padding: 5px 0;
                        color: #ce9178;
                        font-style: italic;
                    `;
                    userLine.textContent = `> ${prompt}${value}`;
                    this.output.appendChild(userLine);
                    
                    resolve(value);
                };
                
                submitBtn.onclick = submit;
                inputField.onkeypress = (e) => {
                    if (e.key === 'Enter') submit();
                };
                
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        display(text, type = 'output') {
            if (!this.output) return;
            
            const line = document.createElement('div');
            line.textContent = text;
            
            let color = '#d4d4d4';
            let borderLeft = 'none';
            
            if (type === 'error') {
                color = '#f48771';
                borderLeft = '3px solid #f48771';
            } else if (type === 'success') {
                color = '#4ec9b0';
                borderLeft = '3px solid #4ec9b0';
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
                font-family: monospace;
                font-size: 13px;
            `;
            
            this.output.appendChild(line);
            line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytml = new PYTML();
        });
    } else {
        window.pytml = new PYTML();
    }
    
})(window);
