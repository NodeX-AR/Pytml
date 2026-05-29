(function(window) {
    class PYTML {
        constructor() {
            this.worker = null;
            this.callbacks = new Map();
            this.pendingInputs = new Map();
            this.init();
        }

        async init() {
            console.log('PYTML: Initializing...');
            this.showStatus('Loading Python (first time: 10-15s)...');

            try {
                const workerUrl = 'https://your-cdn.com/worker.js'; // Update this
                const response = await fetch(workerUrl);
                let workerCode = await response.text();

                const blob = new Blob([workerCode], { type: 'application/javascript' });
                const blobUrl = URL.createObjectURL(blob);
                this.worker = new Worker(blobUrl);

                this.worker.onmessage = (event) => {
                    const { id, success, output, error, inputRequest } = event.data;
                    
                    // Handle input() requests from Python
                    if (inputRequest) {
                        this.handleInputRequest(id, inputRequest);
                        return;
                    }
                    
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

                await this.waitForWorker();
                this.hideStatus();
                console.log('PYTML: Ready!');

                await this.loadExternalPythonFiles();

            } catch (error) {
                console.error('PYTML Error:', error);
                this.showStatus('Failed to load: ' + error.message, true);
            }
        }

        handleInputRequest(id, prompt) {
            // Create a modal dialog for input
            const modal = this.createInputModal(prompt, (value) => {
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
                    <p>${this.escapeHtml(prompt)}</p>
                    <input type="text" id="pytml-input" placeholder="Enter value...">
                    <button id="pytml-submit">Submit</button>
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
                min-width: 300px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            `;
            
            const input = modal.querySelector('#pytml-input');
            const submit = modal.querySelector('#pytml-submit');
            
            submit.onclick = () => {
                callback(input.value);
                modal.remove();
            };
            
            input.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    callback(input.value);
                    modal.remove();
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
                    // Fetch the Python file
                    const response = await fetch(pyFile);
                    const code = await response.text();

                    // Create container for this script
                    const container = document.createElement('div');
                    container.className = 'pytml-container';
                    container.style.cssText = `
                        margin: 20px 0;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        overflow: hidden;
                    `;

                    // Create output area
                    const outputArea = document.createElement('div');
                    outputArea.className = 'pytml-output';
                    outputArea.style.cssText = `
                        background: #1e1e1e;
                        color: #d4d4d4;
                        padding: 15px;
                        font-family: 'Courier New', monospace;
                        font-size: 14px;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        max-height: 400px;
                        overflow-y: auto;
                    `;
                    outputArea.textContent = 'Running...';

                    // Create input area for interactive mode
                    const inputArea = document.createElement('div');
                    inputArea.className = 'pytml-input-area';
                    inputArea.style.cssText = `
                        background: #2d2d2d;
                        padding: 10px;
                        display: none;
                        gap: 10px;
                    `;
                    inputArea.innerHTML = `
                        <input type="text" placeholder="Enter value..." style="flex: 1; padding: 8px;">
                        <button style="padding: 8px 15px;">Send</button>
                    `;

                    container.appendChild(outputArea);
                    container.appendChild(inputArea);
                    scriptTag.insertAdjacentElement('afterend', container);

                    // Run the Python code
                    const result = await this.runPythonInteractive(code, outputArea, inputArea);
                    
                    outputArea.textContent = result || 'Execution completed.';

                    // Optionally remove the script tag
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

        async runPythonInteractive(code, outputElement, inputElement) {
            return new Promise((resolve, reject) => {
                const id = Date.now() + '-' + Math.random();
                this.callbacks.set(id, { resolve, reject });
                
                // Store elements for this execution
                this.pendingInputs.set(id, { outputElement, inputElement });
                
                this.worker.postMessage({
                    type: 'run_interactive',
                    id: id,
                    code: code
                });
            });
        }

        cleanPythonCode(code) {
            let cleaned = code.replace(/<!--[\s\S]*?-->/g, '');
            cleaned = cleaned.replace(/</g, '<');
            cleaned = cleaned.replace(/>/g, '>');
            cleaned = cleaned.replace(/&/g, '&');
            cleaned = cleaned.replace(/"/g, '"');
            cleaned = cleaned.replace(/\r\n/g, '\n');
            cleaned = cleaned.replace(/\n\s*\n/g, '\n');
            return cleaned;
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
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
