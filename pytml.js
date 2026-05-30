// pytml.js – input() works without await, using AST transformation
(function(window) {
    class PYTML {
        constructor() {
            this.outputContainer = null;
            this.scriptSources = new Map();   // filename -> source code
            this.init();
        }

        async init() {
            this.createOutputContainer();
            this.showStatus('Loading Pyodide...');
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
            script.onload = async () => {
                this.showStatus('Initializing...');
                window.pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
                });
                await this.setupPythonEnvironment();
                this.hideStatus();
                await this.loadAndTransformScripts();
            };
            script.onerror = () => this.showStatus('Pyodide load failed', true);
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
                    border: 1px solid #667eea;
                    max-height: 500px;
                    overflow-y: auto;
                `;
                const firstScript = document.querySelector('script[type="text/python"]');
                if (firstScript) firstScript.insertAdjacentElement('beforebegin', container);
                else document.body.appendChild(container);
                this.outputContainer = container;
            }
        }

        async setupPythonEnvironment() {
            await window.pyodide.runPythonAsync(`
import sys, js, asyncio, ast, inspect, types

class StdoutCapture:
    def write(self, text):
        if text: js.displayStyledOutput(str(text), 'stdout')
    def flush(self): pass

class StderrCapture:
    def write(self, text):
        if text: js.displayStyledOutput(str(text), 'stderr')
    def flush(self): pass

sys.stdout = StdoutCapture()
sys.stderr = StderrCapture()

# The real async input that will be used after transformation
async def __async_input(prompt=""):
    if prompt: print(prompt)
    return await js.createInlineInput(str(prompt))

class PytmlModule:
    @staticmethod
    def connect():
        # Get the caller's filename (URL for external, '<inline>' for inline)
        frame = inspect.currentframe().f_back
        filename = frame.f_code.co_filename
        source = js.window.__pytml_sources.get(filename)
        if source is None:
            raise RuntimeError(f"Cannot find source for {filename}. Make sure the script is loaded via <script type='text/python'>.")
        # Remove the line containing 'pytml.connect()' to avoid infinite recursion
        lines = source.split('\\n')
        filtered_lines = [line for line in lines if 'pytml.connect()' not in line]
        source_without_connect = '\\n'.join(filtered_lines)
        # Transform AST: replace input(...) with await __async_input(...)
        tree = ast.parse(source_without_connect)
        class InputTransformer(ast.NodeTransformer):
            def visit_Call(self, node):
                if isinstance(node.func, ast.Name) and node.func.id == 'input':
                    new_func = ast.Name(id='__async_input', ctx=ast.Load())
                    new_call = ast.Call(new_func, node.args, node.keywords)
                    return ast.Await(value=new_call)
                return self.generic_visit(node)
        InputTransformer().visit(tree)
        ast.fix_missing_locations(tree)
        code_obj = compile(tree, filename, 'exec')
        # Execute in an async context
        ns = {}
        exec(code_obj, ns)
        # If the user defined an async main(), run it
        if 'main' in ns and asyncio.iscoroutinefunction(ns['main']):
            asyncio.create_task(ns['main']())

sys.modules['pytml'] = PytmlModule
            `);
        }

        async loadAndTransformScripts() {
            const tags = document.querySelectorAll('script[type="text/python"]');
            if (tags.length === 0) {
                this.addOutput('No Python scripts found (type="text/python")', 'stderr');
                return;
            }

            // Store source of each script
            for (const tag of tags) {
                const src = tag.getAttribute('src');
                let source, filename;
                if (src) {
                    // External script – requires HTTP server
                    try {
                        const resp = await fetch(src);
                        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                        source = await resp.text();
                        filename = src;
                    } catch (err) {
                        this.addOutput(`Failed to load external script "${src}": ${err.message}`, 'stderr');
                        this.addOutput(`Tip: External scripts require a web server (http://). Use inline script for file://`, 'stderr');
                        tag.remove();
                        continue;
                    }
                } else {
                    // Inline script – works with file://
                    source = tag.textContent;
                    filename = '<inline>';
                }
                if (!window.__pytml_sources) window.__pytml_sources = new Map();
                window.__pytml_sources.set(filename, source);
                tag.setAttribute('data-pytml-stored', 'true');
                // Execute the script now – it will call pytml.connect() which transforms and re-runs
                await window.pyodide.runPythonAsync(source);
                tag.remove();
            }
        }

        addOutput(text, stream) {
            if (!this.outputContainer) return;
            const line = document.createElement('div');
            line.style.cssText = `color: ${stream === 'stderr' ? '#fa709a' : '#43e97b'}; margin: 4px 0; font-family: monospace; white-space: pre-wrap;`;
            line.textContent = text;
            this.outputContainer.appendChild(line);
        }

        async createInlineInput(prompt) {
            return new Promise((resolve) => {
                const container = document.createElement('div');
                container.style.cssText = `background: #1e1e3f; border-radius: 12px; padding: 15px; margin: 10px 0; border: 1px solid #667eea;`;
                const promptEl = document.createElement('div');
                promptEl.textContent = prompt || 'Input:';
                promptEl.style.cssText = `color: #ffd93d; margin-bottom: 10px;`;
                container.appendChild(promptEl);
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.style.cssText = `width: 100%; padding: 8px; background: #0a0e27; border: 1px solid #667eea; color: white; border-radius: 8px; box-sizing: border-box; margin-bottom: 10px;`;
                container.appendChild(inputField);
                const submitBtn = document.createElement('button');
                submitBtn.textContent = 'Submit';
                submitBtn.style.cssText = `background: #667eea; border: none; padding: 6px 16px; border-radius: 20px; color: white; cursor: pointer;`;
                container.appendChild(submitBtn);
                this.outputContainer.appendChild(container);
                const submit = () => { const val = inputField.value; container.remove(); resolve(val); };
                submitBtn.onclick = submit;
                inputField.onkeypress = (e) => { if (e.key === 'Enter') submit(); };
                inputField.focus();
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        showStatus(msg, isErr = false) {
            let s = document.getElementById('pytml-status');
            if (!s) {
                s = document.createElement('div');
                s.id = 'pytml-status';
                s.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: #667eea; color: white; padding: 6px 12px; border-radius: 20px; font-family: monospace; z-index: 10000;`;
                document.body.appendChild(s);
            }
            s.textContent = msg;
            s.style.background = isErr ? '#fa709a' : '#667eea';
            if (!isErr) setTimeout(() => s.remove(), 3000);
        }
        hideStatus() { document.getElementById('pytml-status')?.remove(); }
    }

    window.displayStyledOutput = (text, stream) => window.pytmlInstance?.addOutput(text, stream);
    window.createInlineInput = (prompt) => window.pytmlInstance?.createInlineInput(prompt);
    window.pytmlInstance = null;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { window.pytmlInstance = new PYTML(); });
    else window.pytmlInstance = new PYTML();
})(window);
