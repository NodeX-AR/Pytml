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
                    const { id, success, output, error, inputRequest } = event.data;
                    
                    // Handle input requests from Python
                    if (inputRequest) {
                        this.handleInputRequest(id, inputRequest);
                        return;
                    }
                    
                    // Handle normal execution results
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

                // Load external Python files
                await this.loadExternalPythonFiles();

            } catch (error) {
                console.error('PYTML Error:', error);
                this.showStatus('Failed to load: ' + error.message, true);
            }
        }

        handleInputRequest(id, prompt) {
            // Create a modal dialog for input
            const modal = this.createInputModal(prompt, (value) => {
                // Send the input back to the worker
                this.worker.postMessage({
                    type: 'input_response',
                    id: id,
                    value: value
                });
            });
            document.body.appendChild(modal);
        }

        createInputModal(prompt, callback) {
            const modal = document.createElement('div');
            modal.className = 'pytml-modal';
            modal.innerHTML = `
                <div class="pytml-modal-content">
                    <p><strong>${this.escapeHtml(prompt)}</strong></p>
                    <input type="text" id="pytml-input" placeholder="Type your answer here..." autofocus>
                    <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                        <button id="pytml-submit">Submit</button>
                    </div>
                </div>
            `;
            
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10001;
            `;
            
            const modalContent = modal.querySelector('.pytml-modal-content');
            modalContent.style.cssText = `
                background: white;
                padding: 20px;
                border-radius: 8px;
                min-width: 350px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                font-family: system-ui, -apple-system, sans-serif;
            `;
            
            const input = modal.querySelector('#pytml-input');
            const submit = modal.querySelector('#pytml-submit');
            
            const handleSubmit = () => {
                callback(input.value);
                modal.remove();
            };
            
            submit.onclick = handleSubmit;
            input.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    handleSubmit();
                }
            };
            
            return modal;
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytml = new PYTML();
        });
    } else {
        window.pytml = new PYTML();
    }
})(window);
