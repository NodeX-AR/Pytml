(async function() {
    // Load Pyodide
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js';
    await new Promise(r => { script.onload = r; document.head.appendChild(script); });
    
    const pyodide = await loadPyodide({ 
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.0/full/' 
    });
    
    // Override Python's input() to create HTML inputs
    pyodide.runPython(`
import sys
from io import StringIO

_input = input
def input(prompt=''):
    print(prompt)
    return _input(prompt)
    `);
    
    // Execute Python files
    document.querySelectorAll('script[type="text/python"]').forEach(async (scriptTag) => {
        const response = await fetch(scriptTag.src);
        let code = await response.text();
        
        // Capture output
        const result = await pyodide.runPythonAsync(`
sys.stdout = StringIO()
try:
    exec(${JSON.stringify(code)})
    output = sys.stdout.getvalue()
except Exception as e:
    output = str(e)
sys.stdout = sys.__stdout__
output
        `);
        
        document.body.innerHTML += `<pre>${result}</pre>`;
    });
})();
