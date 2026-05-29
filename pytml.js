// pytml.js - Professional Python in Browser with Customizable UI
(function(window) {
    'use strict';

    class PYTML {
        constructor(options = {}) {
            this.options = {
                theme: 'dark',
                showStatus: true,
                statusTimeout: 3000,
                inputPlaceholder: 'Type your answer...',
                submitButtonText: 'Submit',
                clearButtonText: 'Clear',
                stopButtonText: 'Stop',
                ...options
            };
            
            this.pyodide = null;
            this.isRunning = true;
            this.outputContainer = null;
            this.init();
        }

        async init() {
            console.log('PYTML: Initializing...');
            this.createUI();
            this.showStatus('Loading Python...', 'info');
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
            
            script.onload = async () => {
                this.showStatus('Initializing Python...', 'info');
                this.pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
                    fullStdLib: false
                });
                
                window.pyodide = this.pyodide;
                
                await this.pyodide.runPythonAsync(`
import sys
import js
import asyncio

class PythonOutput:
    def __init__(self):
        self.buffer = []
    
    def write(self, text):
        if text:
            self.buffer.append(str(text))
            if '\\n' in text or len(self.buffer) > 0:
                full = ''.join(self.buffer)
                if full.strip():
                    js.window.pytml.addOutput(full)
                self.buffer = []
    
    def flush(self):
        if self.buffer:
            full = ''.join(self.buffer)
            if full.strip():
                js.window.pytml.addOutput(full)
            self.buffer = []

sys.stdout = PythonOutput()
sys.stderr = PythonOutput()

async def python_input(prompt=""):
    if prompt:
        print(prompt, end='')
    return await js.window.pytml.getUserInput(prompt)

import builtins
builtins.input = python_input
`);
                
                this.showStatus('Python Ready!', 'success');
                console.log('PYTML: Ready');
                await this.loadPythonFiles();
            };
            
            script.onerror = () => {
                this.showStatus('Failed to load Pyodide', 'error');
            };
            
            document.head.appendChild(script);
        }

        createUI() {
            // Main container
            let container = document.getElementById('pytml-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'pytml-container';
                container.className = `pytml-container pytml-theme-${this.options.theme}`;
                
                // Header
                const header = document.createElement('div');
                header.className = 'pytml-header';
                header.innerHTML = `
                    <span class="pytml-title">Python Output</span>
                    <div class="pytml-controls">
                        <button class="pytml-stop-btn" data-action="stop">${this.options.stopButtonText}</button>
                        <button class="pytml-clear-btn" data-action="clear">${this.options.clearButtonText}</button>
                    </div>
                `;
                
                // Output area
                const outputArea = document.createElement('div');
                outputArea.className = 'pytml-output-area';
                
                // Status bar
                const statusBar = document.createElement('div');
                statusBar.className = 'pytml-status-bar';
                statusBar.style.display = 'none';
                
                container.appendChild(header);
                container.appendChild(outputArea);
                container.appendChild(statusBar);
                
                // Find where to insert
                const pyScripts = document.querySelectorAll('script[type="text/python"]');
                if (pyScripts.length > 0) {
                    pyScripts[0].insertAdjacentElement('beforebegin', container);
                } else {
                    document.body.insertAdjacentElement('afterbegin', container);
                }
                
                // Bind events
                header.querySelector('.pytml-stop-btn').onclick = () => this.stopExecution();
                header.querySelector('.pytml-clear-btn').onclick = () => this.clearOutput();
                
                this.outputContainer = outputArea;
                this.statusBar = statusBar;
            } else {
                this.outputContainer = container.querySelector('.pytml-output-area');
                this.statusBar = container.querySelector('.pytml-status-bar');
            }
            
            // Inject default styles if not present
            if (!document.getElementById('pytml-styles')) {
                this.injectStyles();
            }
        }

        injectStyles() {
            const styles = document.createElement('style');
            styles.id = 'pytml-styles';
            styles.textContent = `
                /* PYTML Default Styles - Override these in your HTML */
                
                .pytml-container {
                    font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
                    margin: 20px 0;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                }
                
                .pytml-theme-dark {
                    background: #1e1e2e;
                    border: 1px solid #2d2d44;
                }
                
                .pytml-theme-light {
                    background: #ffffff;
                    border: 1px solid #e0e0e0;
                }
                
                .pytml-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 20px;
                    border-bottom: 1px solid inherit;
                }
                
                .pytml-theme-dark .pytml-header {
                    background: #0f0f23;
                    border-bottom-color: #2d2d44;
                }
                
                .pytml-theme-light .pytml-header {
                    background: #f8f9fa;
                    border-bottom-color: #e0e0e0;
                }
                
                .pytml-title {
                    font-weight: 600;
                    font-size: 14px;
                    letter-spacing: 0.5px;
                }
                
                .pytml-theme-dark .pytml-title {
                    color: #7c3aed;
                }
                
                .pytml-theme-light .pytml-title {
                    color: #6366f1;
                }
                
                .pytml-controls {
                    display: flex;
                    gap: 10px;
                }
                
                .pytml-stop-btn, .pytml-clear-btn {
                    padding: 6px 14px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                
                .pytml-stop-btn {
                    background: #ef4444;
                    color: white;
                }
                
                .pytml-stop-btn:hover {
                    background: #dc2626;
                    transform: scale(1.02);
                }
                
                .pytml-clear-btn {
                    background: #3b82f6;
                    color: white;
                }
                
                .pytml-clear-btn:hover {
                    background: #2563eb;
                    transform: scale(1.02);
                }
                
                .pytml-output-area {
                    padding: 16px;
                    max-height: 500px;
                    overflow-y: auto;
                    font-size: 13px;
                    line-height: 1.6;
                }
                
                .pytml-theme-dark .pytml-output-area {
                    color: #e4e4e7;
                }
                
                .pytml-theme-light .pytml-output-area {
                    color: #333333;
                }
                
                .pytml-output-line {
                    padding: 4px 8px;
                    margin: 2px 0;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    border-radius: 4px;
                }
                
                .pytml-output-line:hover {
                    background: rgba(124, 58, 237, 0.1);
                }
                
                .pytml-error-line {
                    color: #ef4444;
                    background: rgba(239, 68, 68, 0.1);
                    padding: 6px 12px;
                    border-radius: 6px;
                    margin: 4px 0;
                    border-left: 3px solid #ef4444;
                }
                
                .pytml-success-line {
                    color: #10b981;
                    background: rgba(16, 185, 129, 0.1);
                    padding: 6px 12px;
                    border-radius: 6px;
                    margin: 4px 0;
                    border-left: 3px solid #10b981;
                }
                
                .pytml-warning-line {
                    color: #f59e0b;
                    background: rgba(245, 158, 11, 0.1);
                    padding: 6px 12px;
                    border-radius: 6px;
                    margin: 4px 0;
                    border-left: 3px solid #f59e0b;
                }
                
                .pytml-input-container {
                    margin: 12px 0;
                    padding: 16px;
                    border-radius: 8px;
                    animation: slideIn 0.3s ease;
                }
                
                .pytml-theme-dark .pytml-input-container {
                    background: #0f0f23;
                    border-left: 3px solid #7c3aed;
                }
                
                .pytml-theme-light .pytml-input-container {
                    background: #f8f9fa;
                    border-left: 3px solid #6366f1;
                }
                
                .pytml-input-prompt {
                    font-weight: 600;
                    margin-bottom: 12px;
                    font-size: 14px;
                }
                
                .pytml-theme-dark .pytml-input-prompt {
                    color: #7c3aed;
                }
                
                .pytml-theme-light .pytml-input-prompt {
                    color: #6366f1;
                }
                
                .pytml-input-wrapper {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                
                .pytml-input-field {
                    flex: 1;
                    padding: 10px 14px;
                    border: 1px solid;
                    border-radius: 6px;
                    font-family: inherit;
                    font-size: 13px;
                    transition: all 0.2s ease;
                }
                
                .pytml-theme-dark .pytml-input-field {
                    background: #1e1e2e;
                    border-color: #2d2d44;
                    color: #e4e4e7;
                }
                
                .pytml-theme-light .pytml-input-field {
                    background: #ffffff;
                    border-color: #d0d0d0;
                    color: #333333;
                }
                
                .pytml-input-field:focus {
                    outline: none;
                    border-color: #7c3aed;
                    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
                }
                
                .pytml-submit-btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 13px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                }
                
                .pytml-submit-btn {
                    background: #7c3aed;
                    color: white;
                }
                
                .pytml-submit-btn:hover {
                    background: #6d28d9;
                    transform: scale(1.02);
                }
                
                .pytml-status-bar {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 10px 18px;
                    border-radius: 30px;
                    font-family: inherit;
                    font-size: 12px;
                    font-weight: 500;
                    z-index: 10000;
                    animation: slideIn 0.3s ease;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                
                .pytml-status-info {
                    background: #3b82f6;
                    color: white;
                }
                
                .pytml-status-success {
                    background: #10b981;
                    color: white;
                }
                
                .pytml-status-error {
                    background: #ef4444;
                    color: white;
                }
                
                .pytml-status-warning {
                    background: #f59e0b;
                    color: white;
                }
                
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                /* Scrollbar Styling */
                .pytml-output-area::-webkit-scrollbar {
                    width: 8px;
                }
                
                .pytml-output-area::-webkit-scrollbar-track {
                    background: transparent;
                }
                
                .pytml-theme-dark .pytml-output-area::-webkit-scrollbar-thumb {
                    background: #2d2d44;
                    border-radius: 4px;
                }
                
                .pytml-theme-light .pytml-output-area::-webkit-scrollbar-thumb {
                    background: #d0d0d0;
                    border-radius: 4px;
                }
                
                .pytml-output-area::-webkit-scrollbar-thumb:hover {
                    background: #7c3aed;
                }
            `;
            document.head.appendChild(styles);
        }

        async loadPythonFiles() {
            const scripts = document.querySelectorAll('script[type="text/python"][src]');
            
            for (let script of scripts) {
                const pyFile = script.getAttribute('src');
                console.log(`Loading: ${pyFile}`);
                
                try {
                    const response = await fetch(pyFile);
                    const code = await response.text();
                    this.clearOutput();
                    this.isRunning = true;
                    await this.pyodide.runPythonAsync(code);
                    script.remove();
                } catch(e) {
                    this.addOutput(`Error: ${e.message}`, 'error');
                }
            }
        }

        addOutput(text, type = 'output') {
            if (!this.outputContainer) return;
            
            const line = document.createElement('div');
            line.textContent = text;
            
            if (type === 'error') {
                line.className = 'pytml-error-line';
            } else if (type === 'success') {
                line.className = 'pytml-success-line';
            } else if (type === 'warning') {
                line.className = 'pytml-warning-line';
            } else {
                line.className = 'pytml-output-line';
            }
            
            this.outputContainer.appendChild(line);
            line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        getUserInput(prompt) {
            return new Promise((resolve) => {
                const container = document.createElement('div');
                container.className = 'pytml-input-container';
                
                const promptEl = document.createElement('div');
                promptEl.className = 'pytml-input-prompt';
                promptEl.textContent = prompt;
                
                const wrapper = document.createElement('div');
                wrapper.className = 'pytml-input-wrapper';
                
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.className = 'pytml-input-field';
                inputField.placeholder = this.options.inputPlaceholder;
                
                const submitBtn = document.createElement('button');
                submitBtn.className = 'pytml-submit-btn';
                submitBtn.textContent = this.options.submitButtonText;
                
                wrapper.appendChild(inputField);
                wrapper.appendChild(submitBtn);
                container.appendChild(promptEl);
                container.appendChild(wrapper);
                
                this.outputContainer.appendChild(container);
                
                const submit = () => {
                    const value = inputField.value;
                    container.remove();
                    this.addOutput(`${prompt}${value}`, 'output');
                    resolve(value);
                };
                
                submitBtn.onclick = submit;
                inputField.onkeypress = (e) => {
                    if (e.key === 'Enter') submit();
                };
                
                inputField.focus();
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        clearOutput() {
            if (this.outputContainer) {
                this.outputContainer.innerHTML = '';
            }
        }

        stopExecution() {
            this.isRunning = false;
            this.addOutput('Execution stopped by user', 'warning');
        }

        showStatus(message, type = 'info') {
            if (!this.statusBar) return;
            
            this.statusBar.textContent = message;
            this.statusBar.className = `pytml-status-bar pytml-status-${type}`;
            this.statusBar.style.display = 'block';
            
            setTimeout(() => {
                this.statusBar.style.opacity = '0';
                setTimeout(() => {
                    if (this.statusBar) {
                        this.statusBar.style.display = 'none';
                        this.statusBar.style.opacity = '1';
                    }
                }, 300);
            }, this.options.statusTimeout);
        }

        // Public API
        setTheme(theme) {
            const container = document.getElementById('pytml-container');
            if (container) {
                container.classList.remove('pytml-theme-dark', 'pytml-theme-light');
                container.classList.add(`pytml-theme-${theme}`);
            }
            this.options.theme = theme;
        }

        async runCode(code) {
            this.clearOutput();
            await this.pyodide.runPythonAsync(code);
        }
    }

    // Initialize with user config
    window.pytmlConfig = window.pytmlConfig || {};
    window.pytml = new PYTML(window.pytmlConfig);
    
})(window);
