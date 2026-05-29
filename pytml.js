// pytml-min.js - Clean working version with NO visible UI box
(function(window) {
    class PYTML {
        constructor() {
            this.pyodide = null;
            this.init();
        }

        async init() {
            console.log('PYTML: Initializing...');
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
            
            script.onload = async () => {
                this.pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
                    fullStdLib: false
                });
                
                window.pyodide = this.pyodide;
                
                await this.pyodide.runPythonAsync(`
import sys
import js
import asyncio

class QuietOutput:
    def write(self, text):
        if text and text.strip():
            js.console.log(str(text))
    def flush(self):
        pass

sys.stdout = QuietOutput()
sys.stderr = QuietOutput()

async def get_input(prompt=""):
    if prompt:
        print(prompt, end='')
    return await js.window.pytml.getInput(prompt)

import builtins
builtins.input = get_input
`);
                
                console.log('PYTML: Ready');
                await this.loadPythonFiles();
            };
            
            script.onerror = () => console.error('Failed to load Pyodide');
            document.head.appendChild(script);
        }

        async loadPythonFiles() {
            const scripts = document.querySelectorAll('script[type="text/python"][src]');
            for (let script of scripts) {
                try {
                    const response = await fetch(script.src);
                    const code = await response.text();
                    await this.pyodide.runPythonAsync(code);
                    script.remove();
                } catch(e) {
                    console.error(e);
                }
            }
        }

        getInput(prompt) {
            return new Promise((resolve) => {
                const container = document.createElement('div');
                container.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    z-index: 10000;
                    font-family: monospace;
                `;
                
                const label = document.createElement('div');
                label.textContent = prompt;
                label.style.marginBottom = '10px';
                
                const input = document.createElement('input');
                input.type = 'text';
                input.style.padding = '5px';
                input.style.marginRight = '10px';
                
                const button = document.createElement('button');
                button.textContent = 'OK';
                button.onclick = () => {
                    container.remove();
                    resolve(input.value);
                };
                
                input.onkeypress = (e) => {
                    if (e.key === 'Enter') button.onclick();
                };
                
                container.appendChild(label);
                container.appendChild(input);
                container.appendChild(button);
                document.body.appendChild(container);
                input.focus();
            });
        }
    }

    window.pytml = new PYTML();
})(window);
