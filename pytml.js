// pytml-min.js - Minimal version with no visible UI
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
                
                // Silent Python setup - no output
                await this.pyodide.runPythonAsync(`
import sys
import js
import asyncio

class SilentOutput:
    def write(self, text):
        pass  # Suppress all output
    def flush(self):
        pass

sys.stdout = SilentOutput()
sys.stderr = SilentOutput()

async def python_input(prompt=""):
    return await js.promptInput(str(prompt))

import builtins
builtins.input = python_input
`);
                
                console.log('PYTML: Ready');
                await this.loadExternalPythonFiles();
            };
            
            script.onerror = () => console.error('Failed to load Pyodide');
            document.head.appendChild(script);
        }

        async loadExternalPythonFiles() {
            const pyScripts = document.querySelectorAll('script[type="text/python"][src]');
            
            for (let scriptTag of pyScripts) {
                const pyFile = scriptTag.getAttribute('src');
                try {
                    const response = await fetch(pyFile);
                    const code = await response.text();
                    await this.pyodide.runPythonAsync(code);
                    scriptTag.remove();
                } catch(e) {
                    console.error(e);
                }
            }
        }
    }

    window.promptInput = function(prompt) {
        return prompt;
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytml = new PYTML();
        });
    } else {
        window.pytml = new PYTML();
    }
})(window);
