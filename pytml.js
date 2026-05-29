(function(window) {
    class PYTML {
        constructor(options = {}) {
            this.options = {
                containerId: 'pytml-output',
                pyodideVersion: '0.26.4',
                fullStdLib: false,
                packages: [],
                theme: 'light', // 'light', 'dark', or 'auto'
                autoRun: true,
                showStatus: true,
                statusTimeout: 3000,
                inputPlaceholder: 'Type your answer here...',
                submitButtonText: 'Submit',
                ...options
            };
            
            this.outputContainer = null;
            this.statusContainer = null;
            this.pyodide = null;
            this.isReady = false;
            this.executionQueue = [];
            this.eventListeners = new Map();
            
            this.init();
        }

        // Event system
        on(event, callback) {
            if (!this.eventListeners.has(event)) {
                this.eventListeners.set(event, []);
            }
            this.eventListeners.get(event).push(callback);
        }

        emit(event, data) {
            const listeners = this.eventListeners.get(event);
            if (listeners) {
                listeners.forEach(callback => callback(data));
            }
        }

        async init() {
            try {
                this.emit('initializing');
                this.log('PYTML: Initializing...', 'info');
                
                this.createOutputContainer();
                this.injectStyles();
                
                if (this.options.showStatus) {
                    this.showStatus('Loading Python runtime...', 'loading');
                }
                
                await this.loadPyodide();
                await this.setupPythonEnvironment();
                await this.loadExternalPythonFiles();
                
                this.isReady = true;
                this.emit('ready');
                this.log('PYTML: Ready', 'success');
                
                // Process any queued executions
                this.processQueue();
                
            } catch (error) {
                this.emit('error', error);
                this.log(`Initialization failed: ${error.message}`, 'error');
                this.showStatus('Failed to initialize Python', 'error');
            }
        }

        async loadPyodide() {
            return new Promise((resolve, reject) => {
                if (window.loadPyodide) {
                    this.initPyodide().then(resolve).catch(reject);
                    return;
                }

                const script = document.createElement('script');
                script.src = `https://cdn.jsdelivr.net/pyodide/v${this.options.pyodideVersion}/full/pyodide.js`;
                script.integrity = this.getIntegrityHash(this.options.pyodideVersion);
                script.crossOrigin = 'anonymous';
                
                script.onload = async () => {
                    try {
                        await this.initPyodide();
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                };
                
                script.onerror = () => reject(new Error('Failed to load Pyodide script'));
                document.head.appendChild(script);
            });
        }

        async initPyodide() {
            this.showStatus('Initializing Python environment...', 'loading');
            
            this.pyodide = await window.loadPyodide({
                indexURL: `https://cdn.jsdelivr.net/pyodide/v${this.options.pyodideVersion}/full/`,
                fullStdLib: this.options.fullStdLib,
                packages: this.options.packages
            });
            
            window.pyodide = this.pyodide; // For debugging
        }

        async setupPythonEnvironment() {
            await this.pyodide.runPythonAsync(`
import sys
import js
import asyncio
from js import window, document
from pyodide.ffi import create_proxy

class HTMLOutput:
    def __init__(self):
        self.buffer = []
    
    def write(self, text):
        if text and text != '\\n':
            self.buffer.append(str(text))
            if text.endswith('\\n'):
                self.flush()
    
    def flush(self):
        if self.buffer:
            window.pytmlInstance.addOutput(''.join(self.buffer))
            self.buffer = []

class HTMLErrorOutput:
    def write(self, text):
        if text and text.strip():
            window.pytmlInstance.addError(str(text))
    
    def flush(self):
        pass

sys.stdout = HTMLOutput()
sys.stderr = HTMLErrorOutput()

# Enhanced input handler
async def async_input(prompt=""):
    if prompt:
        print(prompt, end='')
    return await window.pytmlInstance.createInputAsync(prompt or '')

# Async print with better formatting
async def aprint(*args, **kwargs):
    print(*args, **kwargs)

# Replace built-in input
import builtins
builtins.input = async_input

# Utility functions for JavaScript interaction
def js_alert(message):
    window.alert(str(message))

def js_confirm(message):
    return window.confirm(str(message))

def set_title(title):
    window.document.title = str(title)

print("✓ Python environment ready")
`);
        }

        createOutputContainer() {
            let container = document.getElementById(this.options.containerId);
            
            if (!container) {
                container = document.createElement('div');
                container.id = this.options.containerId;
                container.className = `pytml-output pytml-theme-${this.options.theme}`;
                
                // Find first python script or append to body
                const pyScripts = document.querySelectorAll('script[type="text/python"]');
                if (pyScripts.length > 0) {
                    pyScripts[0].insertAdjacentElement('beforebegin', container);
                } else {
                    document.body.appendChild(container);
                }
            }
            
            this.outputContainer = container;
            
            // Add header with controls
            this.addOutputHeader();
        }

        addOutputHeader() {
            const header = document.createElement('div');
            header.className = 'pytml-header';
            header.innerHTML = `
                <div class="pytml-title">
                    <span>🐍 Python Output</span>
                </div>
                <div class="pytml-controls">
                    <button class="pytml-clear-btn" title="Clear output">🗑️</button>
                    <button class="pytml-copy-btn" title="Copy all output">📋</button>
                </div>
            `;
            
            const clearBtn = header.querySelector('.pytml-clear-btn');
            const copyBtn = header.querySelector('.pytml-copy-btn');
            
            clearBtn.addEventListener('click', () => this.clearOutput());
            copyBtn.addEventListener('click', () => this.copyOutput());
            
            this.outputContainer.insertBefore(header, this.outputContainer.firstChild);
        }

        injectStyles() {
            if (document.getElementById('pytml-styles')) return;
            
            const styles = document.createElement('style');
            styles.id = 'pytml-styles';
            styles.textContent = `
                .pytml-output {
                    font-family: 'Segoe UI', 'Fira Code', 'Cascadia Code', monospace;
                    background: var(--pytml-bg, #f8f9fa);
                    border: 1px solid var(--pytml-border, #dee2e6);
                    border-radius: 8px;
                    margin: 20px;
                    padding: 0;
                    max-height: 600px;
                    overflow-y: auto;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                
                .pytml-theme-dark {
                    --pytml-bg: #1e1e1e;
                    --pytml-border: #444;
                    --pytml-text: #d4d4d4;
                    --pytml-input-bg: #2d2d2d;
                    --pytml-input-border: #555;
                    --pytml-success: #4ec9b0;
                    --pytml-error: #f48771;
                    --pytml-warning: #ce9178;
                    --pytml-header-bg: #252526;
                }
                
                .pytml-theme-light {
                    --pytml-bg: #ffffff;
                    --pytml-border: #dee2e6;
                    --pytml-text: #212529;
                    --pytml-input-bg: #ffffff;
                    --pytml-input-border: #ced4da;
                    --pytml-success: #28a745;
                    --pytml-error: #dc3545;
                    --pytml-warning: #ffc107;
                    --pytml-header-bg: #f8f9fa;
                }
                
                .pytml-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 15px;
                    background: var(--pytml-header-bg);
                    border-bottom: 1px solid var(--pytml-border);
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                
                .pytml-title {
                    font-weight: 600;
                    font-size: 14px;
                    color: var(--pytml-text);
                }
                
                .pytml-controls button {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    font-size: 16px;
                    padding: 5px;
                    margin-left: 10px;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                }
                
                .pytml-controls button:hover {
                    opacity: 1;
                }
                
                .pytml-line, .pytml-error, .pytml-success, .pytml-user-input {
                    padding: 8px 15px;
                    margin: 0;
                    border-bottom: 1px solid var(--pytml-border);
                    font-size: 14px;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                
                .pytml-line {
                    color: var(--pytml-text);
                }
                
                .pytml-error {
                    color: var(--pytml-error);
                    background: rgba(220, 53, 69, 0.1);
                }
                
                .pytml-success {
                    color: var(--pytml-success);
                }
                
                .pytml-user-input {
                    color: var(--pytml-success);
                    font-style: italic;
                }
                
                .pytml-input-container {
                    padding: 15px;
                    margin: 10px;
                    background: var(--pytml-input-bg);
                    border: 2px solid var(--pytml-success);
                    border-radius: 6px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .pytml-prompt {
                    font-weight: 600;
                    margin-bottom: 10px;
                    color: var(--pytml-text);
                }
                
                .pytml-input {
                    width: calc(100% - 100px);
                    padding: 8px 12px;
                    margin-right: 10px;
                    border: 1px solid var(--pytml-input-border);
                    border-radius: 4px;
                    font-family: inherit;
                    font-size: 14px;
                    background: var(--pytml-input-bg);
                    color: var(--pytml-text);
                }
                
                .pytml-input:focus {
                    outline: none;
                    border-color: var(--pytml-success);
                }
                
                .pytml-submit {
                    padding: 8px 16px;
                    background: var(--pytml-success);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: inherit;
                    font-weight: 600;
                    transition: transform 0.1s;
                }
                
                .pytml-submit:hover {
                    transform: scale(1.05);
                }
                
                .pytml-status {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-family: inherit;
                    font-size: 14px;
                    z-index: 1000;
                    animation: slideIn 0.3s ease;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                
                .pytml-status-loading {
                    background: #007bff;
                    color: white;
                }
                
                .pytml-status-success {
                    background: var(--pytml-success);
                    color: white;
                }
                
                .pytml-status-error {
                    background: var(--pytml-error);
                    color: white;
                }
                
                .pytml-status-hidden {
                    opacity: 0;
                    transition: opacity 0.3s;
                    pointer-events: none;
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
                
                /* Scrollbar styling */
                .pytml-output::-webkit-scrollbar {
                    width: 8px;
                }
                
                .pytml-output::-webkit-scrollbar-track {
                    background: var(--pytml-border);
                }
                
                .pytml-output::-webkit-scrollbar-thumb {
                    background: var(--pytml-success);
                    border-radius: 4px;
                }
            `;
            
            document.head.appendChild(styles);
        }

        async loadExternalPythonFiles() {
            const pyScripts = document.querySelectorAll('script[type="text/python"][src]');
            
            for (let scriptTag of pyScripts) {
                const pyFile = scriptTag.getAttribute('src');
                this.log(`Loading: ${pyFile}`, 'info');
                
                try {
                    const response = await fetch(pyFile);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    
                    const code = await response.text();
                    await this.executePython(code);
                    scriptTag.remove();
                    this.emit('file-loaded', { file: pyFile });
                    
                } catch (error) {
                    this.log(`Failed to load ${pyFile}: ${error.message}`, 'error');
                    this.addError(`Error loading ${pyFile}: ${error.message}`);
                }
            }
            
            // Execute inline scripts
            const inlineScripts = document.querySelectorAll('script[type="text/python"]:not([src])');
            for (let scriptTag of inlineScripts) {
                const code = scriptTag.textContent;
                if (code.trim()) {
                    await this.executePython(code);
                    scriptTag.remove();
                }
            }
        }

        async executePython(code, context = {}) {
            if (!this.isReady) {
                this.executionQueue.push(() => this.executePython(code, context));
                return;
            }
            
            try {
                this.emit('execution-start', { code });
                this.showStatus('Running Python code...', 'loading');
                
                // Add context variables to Python
                for (const [key, value] of Object.entries(context)) {
                    this.pyodide.globals.set(key, value);
                }
                
                await this.pyodide.runPythonAsync(code);
                
                this.emit('execution-complete', { code });
                this.showStatus('✓ Execution complete', 'success');
                
            } catch (error) {
                this.emit('execution-error', { code, error });
                this.addError(`Python Error: ${error.message}`);
                this.showStatus('✗ Execution failed', 'error');
                this.log(error.message, 'error');
            }
        }

        async createInputAsync(prompt) {
            return new Promise((resolve) => {
                const container = document.createElement('div');
                container.className = 'pytml-input-container';
                
                const promptText = document.createElement('div');
                promptText.textContent = prompt || 'Input:';
                promptText.className = 'pytml-prompt';
                
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.className = 'pytml-input';
                inputField.placeholder = this.options.inputPlaceholder;
                
                const submitButton = document.createElement('button');
                submitButton.textContent = this.options.submitButtonText;
                submitButton.className = 'pytml-submit';
                
                container.appendChild(promptText);
                container.appendChild(inputField);
                container.appendChild(submitButton);
                
                this.outputContainer.appendChild(container);
                
                const submit = () => {
                    const value = inputField.value;
                    container.remove();
                    this.addOutputLine(`${prompt}${value}`, 'pytml-user-input');
                    resolve(value);
                };
                
                submitButton.onclick = submit;
                inputField.onkeypress = (e) => {
                    if (e.key === 'Enter') submit();
                };
                
                inputField.focus();
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        addOutput(text, type = 'line') {
            if (!this.outputContainer) return;
            
            const className = type === 'error' ? 'pytml-error' : 
                             type === 'success' ? 'pytml-success' : 
                             'pytml-line';
            
            this.addOutputLine(text, className);
        }

        addOutputLine(text, className) {
            if (!this.outputContainer) return;
            
            const line = document.createElement('div');
            line.textContent = text;
            line.className = className;
            
            // Insert before header if it exists
            const header = this.outputContainer.querySelector('.pytml-header');
            if (header && header.nextSibling) {
                this.outputContainer.insertBefore(line, header.nextSibling);
            } else {
                this.outputContainer.appendChild(line);
            }
            
            line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        addError(text) {
            this.addOutputLine(text, 'pytml-error');
        }

        clearOutput() {
            if (!this.outputContainer) return;
            
            const header = this.outputContainer.querySelector('.pytml-header');
            this.outputContainer.innerHTML = '';
            if (header) {
                this.outputContainer.appendChild(header);
            }
            this.emit('cleared');
            this.log('Output cleared', 'info');
        }

        async copyOutput() {
            const lines = Array.from(this.outputContainer.querySelectorAll('.pytml-line, .pytml-error, .pytml-success, .pytml-user-input'))
                .map(el => el.textContent)
                .join('\n');
            
            try {
                await navigator.clipboard.writeText(lines);
                this.showStatus('✓ Copied to clipboard', 'success');
            } catch (error) {
                this.showStatus('Failed to copy', 'error');
            }
        }

        showStatus(message, type = 'loading') {
            if (!this.options.showStatus) return;
            
            if (this.statusContainer) {
                this.statusContainer.remove();
            }
            
            this.statusContainer = document.createElement('div');
            this.statusContainer.className = `pytml-status pytml-status-${type}`;
            this.statusContainer.textContent = message;
            document.body.appendChild(this.statusContainer);
            
            if (type !== 'loading') {
                setTimeout(() => {
                    if (this.statusContainer) {
                        this.statusContainer.classList.add('pytml-status-hidden');
                        setTimeout(() => {
                            if (this.statusContainer) this.statusContainer.remove();
                        }, 300);
                    }
                }, this.options.statusTimeout);
            }
        }

        log(message, level = 'info') {
            const prefix = '[PYTML]';
            switch(level) {
                case 'error':
                    console.error(prefix, message);
                    break;
                case 'warning':
                    console.warn(prefix, message);
                    break;
                default:
                    console.log(prefix, message);
            }
        }

        processQueue() {
            while (this.executionQueue.length > 0) {
                const task = this.executionQueue.shift();
                task();
            }
        }

        getIntegrityHash(version) {
            // In production, you would map versions to actual SRI hashes
            // This is a placeholder
            return '';
        }

        // Public API methods
        async run(code, context = {}) {
            return this.executePython(code, context);
        }

        async runFile(url) {
            try {
                const response = await fetch(url);
                const code = await response.text();
                return this.executePython(code);
            } catch (error) {
                this.log(`Failed to run file: ${error.message}`, 'error');
                throw error;
            }
        }

        setTheme(theme) {
            if (this.outputContainer) {
                this.outputContainer.classList.remove(`pytml-theme-light`, `pytml-theme-dark`);
                this.outputContainer.classList.add(`pytml-theme-${theme}`);
            }
            this.options.theme = theme;
        }

        getPythonVersion() {
            return this.pyodide?.runPython(`
import sys
return f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
`);
        }

        async installPackage(packageName) {
            if (!this.pyodide) throw new Error('Pyodide not ready');
            
            this.showStatus(`Installing ${packageName}...`, 'loading');
            try {
                await this.pyodide.runPythonAsync(`
import micropip
await micropip.install("${packageName}")
print(f"✓ ${packageName} installed successfully")
`);
                this.showStatus(`✓ ${packageName} installed`, 'success');
                return true;
            } catch (error) {
                this.showStatus(`Failed to install ${packageName}`, 'error');
                throw error;
            }
        }
    }

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytml = new PYTML(window.pytmlConfig);
        });
    } else {
        window.pytml = new PYTML(window.pytmlConfig);
    }
    
})(window);
