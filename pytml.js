// pytml.js - Simplified Working Version
(function(window) {
    'use strict';

    class PYTML {
        constructor() {
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
            
            // Load Pyodide
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            
            this.pyodide = await window.loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
                fullStdLib: false
            });
            
            await this.setupPython();
            await this.runPythonFiles();
        }

        createOutput() {
            if (!document.body) return;
            
            this.output = document.getElementById('pytml-content');
            if (!this.output) {
                const container = document.createElement('div');
                container.id = 'pytml-output';
                container.style.cssText = 'background:#1e1e1e;color:#d4d4d4;padding:15px;max-width:800px;margin:20px auto;border-radius:8px;font-family:monospace';
                
                const content = document.createElement('div');
                content.id = 'pytml-content';
                container.appendChild(content);
                document.body.appendChild(container);
                this.output = content;
            }
        }

        async setupPython() {
            await this.pyodide.runPythonAsync(`
import sys
import js

class OutputCapture:
    def write(self, text):
        if text and text.strip():
            js.window.pytml.display(str(text))
    def flush(self):
        pass

sys.stdout = OutputCapture()
sys.stderr = OutputCapture()

async def get_input(prompt):
    return await js.window.pytml.getInputInline(prompt)

import builtins
builtins.input = get_input
`);
        }

        async runPythonFiles() {
            const elements = document.querySelectorAll('link[type="text/python"][href]');
            
            for (let el of elements) {
                const pythonFile = el.getAttribute('href');
                if (pythonFile) {
                    try {
                        const response = await fetch(pythonFile);
                        const code = await response.text();
                        
                        // Execute with async wrapper
                        await this.pyodide.runPythonAsync(`
async def __main__():
${code.split('\n').map(l => '    ' + l).join('\n')}
await __main__()
`);
                    } catch(e) {
                        this.display('Error: ' + e.message);
                    }
                }
            }
        }

        getInputInline(prompt) {
            return new Promise((resolve) => {
                const container = document.createElement('div');
                container.style.cssText = 'margin:10px 0;padding:10px;background:#2d2d2d;border-left:3px solid #4ec9b0';
                
                const promptDiv = document.createElement('div');
                promptDiv.textContent = prompt;
                promptDiv.style.cssText = 'margin-bottom:8px;color:#4ec9b0';
                
                const input = document.createElement('input');
                input.type = 'text';
                input.style.cssText = 'padding:8px;margin-right:10px;width:200px;background:#1e1e1e;border:1px solid #4ec9b0;color:#fff';
                
                const button = document.createElement('button');
                button.textContent = 'Submit';
                button.style.cssText = 'padding:8px 16px;background:#4ec9b0;border:none;cursor:pointer';
                
                container.appendChild(promptDiv);
                container.appendChild(input);
                container.appendChild(button);
                this.output.appendChild(container);
                
                const submit = () => {
                    const value = input.value;
                    container.remove();
                    this.display(prompt + value, 'input');
                    resolve(value);
                };
                
                button.onclick = submit;
                input.onkeypress = (e) => { if (e.key === 'Enter') submit(); };
                input.focus();
            });
        }

        display(text, type) {
            if (!this.output) return;
            const line = document.createElement('div');
            line.textContent = text;
            line.style.cssText = 'padding:4px 0;color:' + (type === 'input' ? '#ce9178' : '#d4d4d4');
            this.output.appendChild(line);
            line.scrollIntoView();
        }
    }

    window.pytml = new PYTML();
})(window);
