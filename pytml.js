fetch('https://pytml.vercel.app/api/count')
  .then(r => r.json())
  .then(data => console.log('Pytml loaded:', data.message, 'times'))
  .catch(() => {});
(function(window) {
    'use strict';
    class PYTML {
        constructor() {
            this.outputContainer = null;
            this.statusElement = null;
            this.isReady = false;
            this.pendingPromises = [];
            this.init();
        }
        async init() {
            console.log('[PYTML] Initialising...');
            this.createOutputContainer();
            this.showStatus('Loading Python engine...');

            try {
                await this.loadPyodideScript();
                const pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
                });
                window.pyodide = pyodide;
                await this.setupPythonEnvironment();

                this.isReady = true;
                this.hideStatus();
                console.log('[PYTML] Ready!');
                await this.runAllPythonScripts();

            } catch (error) {
                this.showStatus('Initialisation failed: ' + error.message, true);
                this.addError('PYTML initialisation error: ' + error.message);
                console.error('[PYTML] Fatal error:', error);
            }
        }
        createOutputContainer() {
            let container = document.getElementById('pytml-output');
            if (!container) {
                container = document.createElement('div');
                container.id = 'pytml-output';
                container.className = 'pytml-output';
                // Apply base styles via a style element to keep them scoped
                const style = document.createElement('style');
                style.textContent = `
                    .pytml-output {
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
                        color: #e0e0e0;
                    }
                    .pytml-output .pytml-line {
                        margin: 4px 0;
                        line-height: 1.5;
                        white-space: pre-wrap;
                        word-break: break-word;
                    }
                    .pytml-output .pytml-error {
                        color: #fa709a;
                        background: rgba(250,112,154,0.15);
                        padding: 10px;
                        margin: 10px 0;
                        border-radius: 8px;
                    }
                    .pytml-output .pytml-success {
                        color: #43e97b;
                    }
                    .pytml-output .pytml-info {
                        color: #667eea;
                    }
                    .pytml-output .pytml-input-container {
                        background: rgba(102,126,234,0.1);
                        border-radius: 10px;
                        padding: 15px;
                        margin: 15px 0;
                        border: 1px solid rgba(102,126,234,0.3);
                    }
                    .pytml-output .pytml-input-prompt {
                        color: #ffd93d;
                        font-weight: 500;
                        margin-bottom: 10px;
                        font-family: system-ui, sans-serif;
                    }
                    .pytml-output .pytml-input-field {
                        width: 100%;
                        padding: 10px 12px;
                        background: rgba(255,255,255,0.1);
                        border: 1px solid rgba(102,126,234,0.5);
                        border-radius: 8px;
                        color: white;
                        font-size: 14px;
                        font-family: monospace;
                        outline: none;
                        box-sizing: border-box;
                        margin-bottom: 10px;
                    }
                    .pytml-output .pytml-input-submit {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border: none;
                        padding: 10px 20px;
                        border-radius: 8px;
                        color: white;
                        font-weight: 600;
                        cursor: pointer;
                        transition: transform 0.2s;
                        font-size: 14px;
                        touch-action: manipulation;
                    }
                    .pytml-output .pytml-input-submit:hover {
                        transform: scale(1.02);
                    }
                    .pytml-status {
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
                        max-width: 80vw;
                        word-break: break-word;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        transition: opacity 0.3s;
                    }
                    .pytml-status.error {
                        background: #fa709a;
                    }
                `;
                document.head.appendChild(style);
                const hideStyle = document.createElement('style');
                hideStyle.textContent = 'py { display: none; }';
                document.head.appendChild(hideStyle);

                // Insert container before the first Python script, or at the top of body
                const firstScript = document.querySelector('py, script[type="text/python"]');
                if (firstScript) {
                    firstScript.insertAdjacentElement('beforebegin', container);
                } else {
                    document.body.insertAdjacentElement('afterbegin', container);
                }
            }
            this.outputContainer = container;
        }

        // --------------------------------------------------
        //  Pyodide Loading
        // --------------------------------------------------
        loadPyodideScript() {
            return new Promise((resolve, reject) => {
                if (typeof loadPyodide !== 'undefined') {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Failed to load Pyodide script from CDN.'));
                document.head.appendChild(script);
            });
        }

        // --------------------------------------------------
        //  Python Environment Setup
        // --------------------------------------------------
        async setupPythonEnvironment() {
            const pyodide = window.pyodide;

            
           // Override stdout and stderr + DEFINE AST TRANSFORMER ONCE
            await pyodide.runPythonAsync(`
import sys
import js
import ast

class OutputRedirect:
    def __init__(self, is_error=False):
        self.is_error = is_error
    def write(self, text):
        if text:
            js.pyodideInstance.addOutput(str(text), self.is_error)
    def flush(self):
        pass

sys.stdout = OutputRedirect(False)
sys.stderr = OutputRedirect(True)

# Override input – async function that calls JS
async def input(prompt=""):
    result = await js.pyodideInstance.getUserInput(str(prompt))
    return result

# ---------- AST TRANSFORMER (DEFINED ONCE) ----------
class InputTransformer(ast.NodeTransformer):
    def visit_Call(self, node):
        if isinstance(node.func, ast.Name) and node.func.id == 'input':
            new_node = ast.Await(value=node)
            return ast.copy_location(new_node, node)
        self.generic_visit(node)
        return node

def transform_pytml_code(code):
    tree = ast.parse(code)
    transformer = InputTransformer()
    new_tree = transformer.visit(tree)
    ast.fix_missing_locations(new_tree)
    return ast.unparse(new_tree)
`);
            // Also expose the instance to Python's js module
            window.pyodideInstance = this;

            // Store a reference to the Python input function for later use in transformation
            // Not needed because we'll transform the user code.
        }

        // --------------------------------------------------
        //  Running Python Scripts (inline & external)
        // --------------------------------------------------
        async runAllPythonScripts() {
            // Find all <py> tags (inline)
            const pyTags = document.querySelectorAll('py');
            for (const tag of pyTags) {
                const code = tag.textContent;
                await this.executePythonCode(code, tag);
                tag.remove(); // optional: remove after execution
            }

            // Find external scripts (<script type="text/python" src="...">)
            const scriptTags = document.querySelectorAll('script[type="text/python"][src]');
            for (const tag of scriptTags) {
                const src = tag.getAttribute('src');
                await this.executeExternalPython(src, tag);
                tag.remove();
            }
        }

        async executePythonCode(code, sourceElement = null) {
            if (!this.isReady) {
                this.addError('Python engine not ready yet.');
                return;
            }

            try {
                // Transform the code safely using AST
                const transformed = await this.transformPythonCode(code);
                // Execute with async wrapper
                await window.pyodide.runPythonAsync(transformed);
            } catch (error) {
                this.addError('Execution error: ' + error.message);
                console.error('[PYTML] Execution error:', error);
            }
        }

        async executeExternalPython(src, tag) {
            this.showStatus('Loading: ' + src);
            try {
                const response = await fetch(src);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} – ${src}`);
                }
                const code = await response.text();
                this.showStatus('Running: ' + src);
                await this.executePythonCode(code, tag);
                this.hideStatus();
            } catch (error) {
                this.addError('Failed to load external script: ' + error.message);
                this.showStatus('Error loading ' + src, true);
                console.error('[PYTML] External script error:', error);
            }
        }

        // --------------------------------------------------
        //  AST‑Based Code Transformation (safe input replacement)
        // --------------------------------------------------
            async transformPythonCode(code) {
            if (!this.isReady) {
                this.addError('Python engine not ready yet.');
                return code;
            }

            try {
                // ✅ Escape triple quotes to safely pass code to Python
                const escapedCode = code.replace(/"""/g, '\\"\\"\\"');
                
                // Pass code as a Python variable (safe, no interpolation crashes)
                await window.pyodide.runPythonAsync(`_pytml_code = """${escapedCode}"""`);
                
                // Call the pre-defined transformer (defined once in setupPythonEnvironment)
                const result = await window.pyodide.runPythonAsync(`
result = transform_pytml_code(_pytml_code)
result
`);
                return result;
            } catch (error) {
                this.addError('Code transformation error: ' + error.message);
                return code; // Fallback to raw code if transformation fails
            }
        }

        // --------------------------------------------------
        //  Interactive Input via DOM
        // --------------------------------------------------
        getUserInput(prompt) {
            return new Promise((resolve) => {
                const container = document.createElement('div');
                container.className = 'pytml-input-container';

                const promptDiv = document.createElement('div');
                promptDiv.className = 'pytml-input-prompt';
                promptDiv.textContent = prompt || 'Enter value:';
                container.appendChild(promptDiv);

                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.className = 'pytml-input-field';
                inputField.placeholder = 'Type your answer…';
                container.appendChild(inputField);

                const submitBtn = document.createElement('button');
                submitBtn.textContent = '✓ Submit';
                submitBtn.className = 'pytml-input-submit';
                container.appendChild(submitBtn);

                // Append to output container
                this.outputContainer.appendChild(container);

                const submit = () => {
                    const value = inputField.value;
                    container.remove();
                    resolve(value);
                };

                submitBtn.addEventListener('click', submit);
                inputField.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') submit();
                });

                inputField.focus();
                // Scroll into view
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        // --------------------------------------------------
        //  Output Methods
        // --------------------------------------------------
        addOutput(text, isError = false) {
            if (!this.outputContainer) return;
            const line = document.createElement('div');
            line.className = 'pytml-line';
            if (isError) {
                line.className += ' pytml-error';
            } else {
                // Basic heuristic for coloring (optional)
                if (text.includes('Error') || text.includes('Traceback')) {
                    line.className += ' pytml-error';
                } else if (text.includes('successfully') || text.includes('OK')) {
                    line.className += ' pytml-success';
                } else if (text.includes('+----') || text.includes('----+')) {
                    line.className += ' pytml-info';
                }
            }
            line.textContent = text;
            this.outputContainer.appendChild(line);
            line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        addError(text) {
            const line = document.createElement('div');
            line.className = 'pytml-line pytml-error';
            line.textContent = '❌ ' + text;
            this.outputContainer.appendChild(line);
        }

        // --------------------------------------------------
        //  Status Badge
        // --------------------------------------------------
        showStatus(message, isError = false) {
            if (!this.statusElement) {
                const el = document.createElement('div');
                el.className = 'pytml-status';
                document.body.appendChild(el);
                this.statusElement = el;
            }
            this.statusElement.textContent = message;
            this.statusElement.className = 'pytml-status' + (isError ? ' error' : '');
            this.statusElement.style.display = 'block';
        }

        hideStatus() {
            if (this.statusElement) {
                this.statusElement.remove(); // Actually remove from DOM
                this.statusElement = null;   // Free memory
            }
        }
    }

    // --------------------------------------------------
    //  Global Bridge for Python
    // --------------------------------------------------
    // We expose the instance as a global for Python's js module.
    // The instance will be set after construction.
    let instance;

    function init() {
        if (!instance) {
            instance = new PYTML();
            // Make it available to Python (already done in setupPythonEnvironment)
            // but also expose as a global for debugging
            window.pytml = instance;
        }
    }

    // Auto‑initialise when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);
