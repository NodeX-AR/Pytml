(function(window) {
    class PYTML {
        constructor() {
            this.worker = null;
            this.callbacks = new Map();
            this.pendingInput = null;
            this.init();
        }

        async init() {
            console.log('PYTML: Initializing...');
            this.showStatus('Loading Python (first time: 10-15s)...');

            try {
                // Use your Vercel worker
                const workerUrl = 'https://pytml.vercel.app/worker.js';
                this.worker = new Worker(workerUrl);

                this.worker.onmessage = (event) => {
                    const data = event.data;
                    
                    // Handle input requests from Python
                    if (data.type === 'input_request') {
                        this.handleInputRequest(data.id, data.prompt);
                        return;
                    }
                    
                    // Handle normal execution results
                    if (this.callbacks.has(data.id)) {
                        const callback = this.callbacks.get(data.id);
                        if (data.success) {
                            callback.resolve(data.output);
                        } else {
                            callback.reject(new Error(data.error));
                        }
                        this.callbacks.delete(data.id);
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

                // Load external Python files
                await this.loadExternalPythonFiles();

            } catch (error) {
                console.error('PYTML Error:', error);
                this.showStatus('Failed to load: ' + error.message, true);
            }
        }

        handleInputRequest(id, prompt) {
            // Use browser's native prompt for simplicity
            const userInput = prompt(prompt);
            
            // Send the input back to the worker
            this.worker.postMessage({
                type: 'input_response',
                id: id,
                value: userInput || ''
            });
        }

        async loadExternalPythonFiles() {
            const pyScripts = document.querySelectorAll('script[type="text/python"][src]');

            for (let scriptTag of pyScripts) {
                const pyFile = scriptTag.getAttribute('src');
                console.log(`Loading Python file: ${pyFile}`);

                try {
                    const response = await fetch(pyFile);
                    const code = await response.text();

                    // Create output container near the script tag
                    const outputId = `pytml-out-${Date.now()}-${Math.random()}`;
                    const outputDiv = document.createElement('div');
                    outputDiv.id = outputId;
                    outputDiv.style.cssText = `
                        background: #1e1e1e;
                        color: #d4d4d4;
                        padding: 15px;
                        margin: 10px 0;
                        border-radius: 5px;
                        font-family: 'Courier New', monospace;
                        font-size: 14px;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    `;
                    scriptTag.insertAdjacentElement('afterend', outputDiv);

                    // Run Python code
                    const result = await this.runPythonInteractive(code);
                    
                    // Display output
                    outputDiv.innerHTML = `<strong>📄 Output:</strong><br><pre style="margin:10px 0 0 0;background:#2d2d2d;padding:10px;border-radius:3px;color:#d4d4d4">${this.escapeHtml(result)}</pre>`;

                    // Remove the original script tag
                    scriptTag.remove();

                } catch(e) {
                    console.error(`Error loading ${pyFile}:`, e);
                    const errorDiv = document.createElement('div');
                    errorDiv.style.cssText = 'background:#dc3545;color:#fff;padding:15px;margin:10px 0;border-radius:5px';
                    errorDiv.textContent = `Error loading ${pyFile}: ${e.message}`;
                    scriptTag.insertAdjacentElement('afterend', errorDiv);
                }
            }
        }

        async runPythonInteractive(code) {
            return new Promise((resolve, reject) => {
                const id = Date.now() + '-' + Math.random();
                this.callbacks.set(id, { resolve, reject });
                
                this.worker.postMessage({
                    type: 'run_interactive',
                    id: id,
                    code: code
                });
                
                // Timeout after 30 seconds
                setTimeout(() => {
                    if (this.callbacks.has(id)) {
                        this.callbacks.delete(id);
                        reject(new Error('Execution timeout (30s)'));
                    }
                }, 30000);
            });
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

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
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

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytml = new PYTML();
        });
    } else {
        window.pytml = new PYTML();
    }
})(window);
