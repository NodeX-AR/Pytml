// Web Worker for Pyodide Python execution

let pyodide = null;
let ready = false;

// Load Pyodide with absolute CDN
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js');

async function initPyodide() {
    if (!pyodide) {
        pyodide = await loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.0/full/'
        });
        
        // Pre-import sys and io
        await pyodide.runPythonAsync(`
import sys
import io
        `);
        ready = true;
        console.log('Worker: Pyodide ready');
    }
}

// Handle messages from main thread
self.onmessage = async (event) => {
    const { type, id, code, inputs } = event.data;
    
    if (type === 'ready') {
        await initPyodide();
        self.postMessage({ id: id, success: true, output: 'ready' });
        return;
    }
    
    if (type === 'run') {
        if (!ready) {
            await initPyodide();
        }
        
        try {
            // Pass inputs as Python dictionary (fixes inputs.get() error)
            pyodide.globals.set('inputs', pyodide.toPy(inputs || {}));
            
            // Setup output capture
            await pyodide.runPythonAsync('sys.stdout = io.StringIO()');
            
            // Execute user code (no indentation issues!)
            await pyodide.runPythonAsync(code);
            
            // Get captured output
            const output = pyodide.runPython('sys.stdout.getvalue()');
            
            // Restore stdout
            await pyodide.runPythonAsync('sys.stdout = sys.__stdout__');
            
            self.postMessage({
                id: id,
                success: true,
                output: output
            });
            
        } catch (error) {
            // Restore stdout on error
            try {
                await pyodide.runPythonAsync('sys.stdout = sys.__stdout__');
            } catch(e) {}
            
            self.postMessage({
                id: id,
                success: false,
                error: error.message
            });
        }
    }
};
