(function(window) {
    class PYTML {
        constructor() {
            this.worker = null;
            this.callbacks = new Map();
            this.init();
        }

        async init() {
            console.log('PYTML: Initializing...');
            this.showStatus('Loading Python (first time: 10-15s)...');
            
            try {
                // Fetch worker script from CDN
                const workerUrl = 'https://cdn.jsdelivr.net/gh/NodeX-AR/Pytml@latest/worker.js';
                const response = await fetch(workerUrl);
                let workerCode = await response.text();
                
                // Create Blob URL to bypass CORS
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                const blobUrl = URL.createObjectURL(blob);
                
                // Create worker from blob
                this.worker = new Worker(blobUrl);
                
                // Handle messages from worker
                this.worker.onmessage = (event) => {
                    const { id, success, output, error } = event.data;
                    
                    if (this.callbacks.has(id)) {
                        const callback = this.callbacks.get(id);
                        if (success) {
                            callback.resolve(output);
                        } else {
                            callback.reject(new Error(error));
                        }
                        this.callbacks.delete(id);
                    }
                };
                
                this.worker.onerror = (error) => {
                    console.error('Worker error:', error);
                    this.showStatus('Worker error: ' + error.message, true);
                };
                
                // Wait for worker to be ready
                await this.waitForWorker();
                
                this.hideStatus();
                console.log('PYTML: Ready!');
                
                // Process page
                this.processPage();
                
            } catch (error) {
                console.error('PYTML Error:', error);
                this.showStatus('Failed to load: ' + error.message, true);
            }
        }

        // Clean Python code - remove HTML artifacts
        cleanPythonCode(code) {
            // Remove HTML comment artifacts
            let cleaned = code.replace(/<!--[\s\S]*?-->/g, '');
            
            // Fix common HTML entity issues
            cleaned = cleaned.replace(/&lt;/g, '<');
            cleaned = cleaned.replace(/&gt;/g, '>');
            cleaned = cleaned.replace(/&amp;/g, '&');
            cleaned = cleaned.replace(/&quot;/g, '"');
            
            // Normalize line endings
            cleaned = cleaned.replace(/\r\n/g, '\n');
            
            // Remove excessive blank lines
            cleaned = cleaned.replace(/\n\s*\n/g, '\n');
            
            return cleaned;
        }

        waitForWorker() {
            return new Promise((resolve, reject) => {
                const id = 'ready_' + Date.now();
                this.callbacks.set(id, { resolve, reject });
                this.worker.postMessage({ type: 'ready', id: id });
                
                setTimeout(() => {
                    if (this.callbacks.has(id)) {
                        this.callbacks.delete(id);
                        reject(new Error('Worker timeout'));
                    }
                }, 30000);
            });
        }

        async runPython(code, inputs = {}) {
            // Clean the code before sending to worker
            const cleanedCode = this.cleanPythonCode(code);
            
            return new Promise((resolve, reject) => {
                const id = Date.now() + '-' + Math.random();
                this.callbacks.set(id, { resolve, reject });
                
                this.worker.postMessage({
                    type: 'run',
                    id: id,
                    code: cleanedCode,
                    inputs: inputs
                });
                
                setTimeout(() => {
                    if (this.callbacks.has(id)) {
                        this.callbacks.delete(id);
                        reject(new Error('Execution timeout (10s)'));
                    }
                }, 10000);
            });
        }

        collectInputs(btn) {
            const inputs = {};
            const form = btn.closest('[data-python-form]');
            if (form) {
                form.querySelectorAll('input, select, textarea').forEach(el => {
                    if (el.name) {
                        let value = el.value;
                        if (el.type === 'number') {
                            value = parseFloat(value);
                        } else if (el.type === 'checkbox') {
                            value = el.checked;
                        }
                        inputs[el.name] = value;
                    }
                });
            }
            return inputs;
        }

        async processPage() {
            // Handle data-python-text
            const textElements = document.querySelectorAll('[data-python-text]');
            for (let el of textElements) {
                const code = el.getAttribute('data-python-text');
                try {
                    const result = await this.runPython(`print(${code})`);
                    el.textContent = result.trim();
                } catch(e) {
                    el.textContent = 'Error: ' + e.message;
                }
            }
            
            // Handle data-python buttons
            const buttons = document.querySelectorAll('[data-python]');
            for (let btn of buttons) {
                const code = btn.getAttribute('data-python');
                const target = btn.getAttribute('data-target');
                
                btn.addEventListener('click', async () => {
                    const inputs = this.collectInputs(btn);
                    const originalText = btn.textContent;
                    btn.disabled = true;
                    btn.textContent = '⏳ Processing...';
                    
                    try {
                        const result = await this.runPython(code, inputs);
                        if (target) {
                            const out = document.querySelector(target);
                            if (out) out.textContent = result;
                        }
                    } catch(e) {
                        if (target) {
                            const out = document.querySelector(target);
                            if (out) out.textContent = 'Error: ' + e.message;
                        }
                    } finally {
                        btn.disabled = false;
                        btn.textContent = originalText;
                    }
                });
            }
        }

        showStatus(message, isError = false) {
            let status = document.getElementById('pytml-status');
            if (!status) {
                status = document.createElement('div');
                status.id = 'pytml-status';
                status.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: #007acc;
                    color: white;
                    padding: 10px 15px;
                    border-radius: 5px;
                    font-family: monospace;
                    font-size: 12px;
                    z-index: 10000;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                `;
                document.body.appendChild(status);
            }
            status.textContent = message;
            if (isError) {
                status.style.background = '#dc3545';
            } else {
                status.style.background = '#007acc';
            }
        }

        hideStatus() {
            const status = document.getElementById('pytml-status');
            if (status) status.remove();
        }
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytml = new PYTML();
        });
    } else {
        window.pytml = new PYTML();
    }
})(window);
