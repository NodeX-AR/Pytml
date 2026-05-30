// pytml.js – input() works without await, safe AST transformation
(function() {
    let outputContainer = null;
    let pyodide = null;
    let sourceMap = new Map(); // scriptId -> { source, filename }

    function createOutputContainer() {
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
            const first = document.querySelector('script[type="text/python"]');
            if (first) first.insertAdjacentElement('beforebegin', container);
            else document.body.appendChild(container);
            outputContainer = container;
        } else {
            outputContainer = document.getElementById('pytml-output');
        }
    }

    function addOutput(text, stream) {
        if (!outputContainer) return;
        const line = document.createElement('div');
        const color = stream === 'stderr' ? '#fa709a' : '#43e97b';
        line.style.cssText = `color: ${color}; margin: 4px 0; font-family: monospace; white-space: pre-wrap;`;
        line.textContent = text;
        outputContainer.appendChild(line);
    }

    function showStatus(msg, isErr = false) {
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

    function hideStatus() {
        const s = document.getElementById('pytml-status');
        if (s) s.remove();
    }

    async function createInlineInput(prompt) {
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
            outputContainer.appendChild(container);
            const submit = () => {
                const val = inputField.value;
                container.remove();
                resolve(val);
            };
            submitBtn.onclick = submit;
            inputField.onkeypress = (e) => { if (e.key === 'Enter') submit(); };
            inputField.focus();
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    async function runScript(source, filename) {
        // Store source for this script globally (for Python to retrieve)
        window.__pytml_current_source = source;
        window.__pytml_current_filename = filename;
        await pyodide.runPythonAsync(source);
    }

    async function setupPython() {
        await pyodide.runPythonAsync(`
import sys, js, asyncio, ast

class StdoutCapture:
    def write(self, text):
        if text: js.addOutput(str(text), 'stdout')
    def flush(self): pass

class StderrCapture:
    def write(self, text):
        if text: js.addOutput(str(text), 'stderr')
    def flush(self): pass

sys.stdout = StdoutCapture()
sys.stderr = StderrCapture()

async def __pytml_async_input(prompt=""):
    if prompt: print(prompt)
    return await js.createInlineInput(str(prompt))

class PytmlModule:
    @staticmethod
    def connect():
        source = js.window.__pytml_current_source
        filename = js.window.__pytml_current_filename
        if source is None:
            raise RuntimeError("No source available. Did you call connect()?")
        # Remove the line with pytml.connect()
        lines = source.split('\\n')
        filtered = [line for line in lines if 'pytml.connect()' not in line]
        source2 = '\\n'.join(filtered)
        # Parse and transform AST
        tree = ast.parse(source2)
        class InputTransformer(ast.NodeTransformer):
            def visit_Call(self, node):
                if isinstance(node.func, ast.Name) and node.func.id == 'input':
                    new_func = ast.Name(id='__pytml_async_input', ctx=ast.Load())
                    new_call = ast.Call(new_func, node.args, node.keywords)
                    return ast.Await(value=new_call)
                return self.generic_visit(node)
        InputTransformer().visit(tree)
        ast.fix_missing_locations(tree)
        code = compile(tree, filename, 'exec')
        ns = {}
        exec(code, ns)
        if 'main' in ns and asyncio.iscoroutinefunction(ns['main']):
            asyncio.create_task(ns['main']())

sys.modules['pytml'] = PytmlModule
        `);
    }

    async function loadAndRunScripts() {
        const tags = Array.from(document.querySelectorAll('script[type="text/python"]'));
        if (tags.length === 0) {
            addOutput('No <script type="text/python"> found.', 'stderr');
            return;
        }
        for (let i = 0; i < tags.length; i++) {
            const tag = tags[i];
            const src = tag.getAttribute('src');
            let source, filename;
            if (src) {
                try {
                    const resp = await fetch(src);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    source = await resp.text();
                    filename = src;
                } catch (err) {
                    addOutput(`Failed to load ${src}: ${err.message}`, 'stderr');
                    addOutput(`Tip: External scripts require a web server. Use inline script for file://`, 'stderr');
                    tag.remove();
                    continue;
                }
            } else {
                source = tag.textContent;
                filename = `<inline_${i}>`;
            }
            await runScript(source, filename);
            tag.remove();
        }
    }

    async function main() {
        createOutputContainer();
        showStatus('Loading Pyodide...');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
        script.onload = async () => {
            showStatus('Initializing Pyodide...');
            pyodide = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
            });
            await setupPython();
            hideStatus();
            await loadAndRunScripts();
        };
        script.onerror = () => showStatus('Pyodide load failed', true);
        document.head.appendChild(script);
    }

    // Expose helpers to Python
    window.addOutput = addOutput;
    window.createInlineInput = createInlineInput;

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();
