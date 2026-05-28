let pyodide = null;
let loading = false;
let ready = false;

async function initPyodide() {
    if (loading) return;
    loading = true;
    
    try {
        importScripts('https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js');
        
        pyodide = await loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
            fullStdLib: false
        });
        
        await pyodide.runPythonAsync(`
import sys
import io
import re

class OutputCapture:
    def __init__(self):
        self.buffer = []
    
    def write(self, text):
        self.buffer.append(text)
    
    def get(self):
        return ''.join(self.buffer)
    
    def clear(self):
        self.buffer = []

original_stdout = sys.stdout
capture = OutputCapture()

def normalize_indentation(code):
    lines = code.split('\\n')
    if not lines:
        return code
    
    base_indent = None
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith('#'):
            indent_match = re.match(r'^\\s+', line)
            if indent_match:
                base_indent = len(indent_match.group())
            else:
                base_indent = 0
            break
    
    if base_indent is None:
        return code
    
    normalized = []
    for line in lines:
        if line.strip():
            stripped = line.lstrip()
            if base_indent > 0:
                normalized.append(' ' * 4 + stripped)
            else:
                normalized.append(stripped)
        else:
            normalized.append('')
    
    return '\\n'.join(normalized)

def execute_python(code, inputs_dict):
    capture.clear()
    sys.stdout = capture
    
    try:
        code = normalize_indentation(code)
        
        for key, value in inputs_dict.items():
            globals()[key] = value
        
        exec(code)
        
        result = capture.get()
        sys.stdout = original_stdout
        return {'success': True, 'output': result}
    except Exception as e:
        sys.stdout = original_stdout
        return {'success': False, 'error': str(e)}
        `);
        
        ready = true;
        self.postMessage({ type: 'ready' });
        
    } catch (error) {
        self.postMessage({ type: 'error', error: error.message });
    }
}

self.addEventListener('message', async (event) => {
    if (!ready) {
        await initPyodide();
    }
    
    const { id, code, scope } = event.data;
    
    try {
        const scopeJson = JSON.stringify(scope || {});
        const result = await pyodide.runPythonAsync(`
result = execute_python(${JSON.stringify(code)}, ${scopeJson})
result
        `);
        
        let output = '';
        if (result.toJs && typeof result.toJs === 'function') {
            const jsResult = result.toJs();
            if (jsResult.success) {
                output = jsResult.output;
            } else {
                throw new Error(jsResult.error);
            }
        } else if (result.success === false) {
            throw new Error(result.error);
        } else {
            output = result.output || '';
        }
        
        self.postMessage({
            id: id,
            success: true,
            output: output
        });
        
    } catch (error) {
        self.postMessage({
            id: id,
            success: false,
            error: error.message
        });
    }
});

initPyodide();
