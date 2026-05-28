(async function() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js';
    await new Promise(r => { script.onload = r; document.head.appendChild(script); });
    
    const pyodide = await loadPyodide({ 
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.0/full/' 
    });
    
    // Pyodide's input() already creates browser prompts!
    document.querySelectorAll('script[type="text/python"]').forEach(async (scriptTag) => {
        const response = await fetch(scriptTag.src);
        const code = await response.text();
        
        const result = await pyodide.runPythonAsync(code);
        
        const outputDiv = document.createElement('div');
        outputDiv.innerHTML = `<pre>${result}</pre>`;
        document.body.appendChild(outputDiv);
    });
})();
