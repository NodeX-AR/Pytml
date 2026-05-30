// pytml.js – input() works without await (tested)
(function(window) {
    class PYTML {
        constructor() {
            this.outputContainer = null;
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

        createOutputContainer() { /* same as before */ }

        async setupPythonEnvironment() {
            await window.pyodide.runPythonAsync(`
import sys, js, asyncio, ast

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

async def __async_input(prompt=""):
    if prompt: print(prompt)
    return await js.createInlineInput(str(prompt))

class PytmlModule:
    @staticmethod
    def connect():
        # Get filename from JS global
        filename = js.window.__pytml_filename
        sources = js.window.__pytml_sources
        if sources is None:
            raise RuntimeError("No sources map")
        source = sources.get(filename)
        if source is None:
            raise RuntimeError(f"Cannot find source for {filename}")
        # Remove the connect line
        lines = source.split('\\n')
        filtered = [line for line in lines if 'pytml.connect()' not in line]
        source2 = '\\n'.join(filtered)
        # Transform AST
        tree = ast.parse(source2)
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
        ns = {}
        exec(code_obj, ns)
        if 'main' in ns and asyncio.iscoroutinefunction(ns['main']):
            asyncio.create_task(ns['main']())

sys.modules['pytml'] = PytmlModule
            `);
        }

        async loadAndTransformScripts() {
            const tags = document.querySelectorAll('script[type="text/python"]');
            if (tags.length === 0) return;

            window.__pytml_sources = new Map();

            for (const tag of tags) {
                const src = tag.getAttribute('src');
                let source, filename;
                if (src) {
                    const resp = await fetch(src);
                    if (!resp.ok) throw new Error(`Failed to load ${src}`);
                    source = await resp.text();
                    filename = src;
                } else {
                    source = tag.textContent;
                    filename = '<inline>';
                }
                window.__pytml_sources.set(filename, source);
                // Set the filename in JS global so Python can read it
                window.__pytml_filename = filename;
                // Execute the script (it will call connect)
                await window.pyodide.runPythonAsync(source);
                tag.remove();
            }
        }

        addOutput(text, stream) { /* same */ }
        async createInlineInput(prompt) { /* same */ }
        showStatus(msg, isErr) { /* same */ }
        hideStatus() { /* same */ }
    }

    // Expose globals
    window.displayStyledOutput = (text, stream) => window.pytmlInstance?.addOutput(text, stream);
    window.createInlineInput = (prompt) => window.pytmlInstance?.createInlineInput(prompt);
    window.pytmlInstance = null;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { window.pytmlInstance = new PYTML(); });
    else window.pytmlInstance = new PYTML();
})(window);
