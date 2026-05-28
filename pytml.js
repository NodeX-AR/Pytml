(function() {
    // Create a clean iframe to run Python (bypasses CSP)
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    
    // Load Pyodide in iframe (no CSP restrictions)
    const script = doc.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js';
    script.onload = async () => {
        const pyodide = await win.loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.0/full/'
        });
        
        // Run Python files
        document.querySelectorAll('script[type="text/python"]').forEach(async (tag) => {
            const response = await fetch(tag.src);
            const code = await response.text();
            
            const result = await pyodide.runPythonAsync(code);
            
            const out = document.createElement('pre');
            out.textContent = result;
            document.body.appendChild(out);
        });
    };
    doc.head.appendChild(script);
})();
