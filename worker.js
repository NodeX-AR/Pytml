importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

let pyodide;

async function initPyodide() {
    if (!pyodide) {
        pyodide = await loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
        });
        
        // Override Python's input() function to work with Web Worker
        pyodide.runPython(`
import sys
import asyncio

class PyodideInput:
    def __init__(self):
        self.input_queue = asyncio.Queue()
    
    async def async_input(self, prompt):
        await self.input_queue.put(prompt)
        value = await self.input_queue.get()
        return value
    
    def send_input(self, value):
        self.input_queue.put_nowait(value)

_input_handler = PyodideInput()
sys.stdin = _input_handler

def input(prompt=""):
    if prompt:
        print(prompt, end="")
    return asyncio.get_event_loop().run_until_complete(_input_handler.async_input(prompt))
`);
    }
    return pyodide;
}

self.onmessage = async function(event) {
    const { type, id, code } = event.data;
    
    if (type === 'ready') {
        try {
            await initPyodide();
            self.postMessage({ id, success: true });
        } catch (error) {
            self.postMessage({ id, success: false, error: error.message });
        }
    }
    
    else if (type === 'run_interactive') {
        try {
            const pyodide = await initPyodide();
            
            // Capture stdout
            pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
`);
            
            // Run the code
            await pyodide.runPythonAsync(code);
            
            // Get output
            const output = pyodide.runPython('sys.stdout.getvalue()');
            
            self.postMessage({ id, success: true, output: output });
        } catch (error) {
            self.postMessage({ id, success: false, error: error.message });
        }
    }
    
    else if (type === 'input_response') {
        // Send input back to Python
        pyodide.runPython(`_input_handler.send_input(${JSON.stringify(event.data.value)})`);
    }
};
