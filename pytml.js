(function(window) {
    'use strict';

    class PYTML {
        constructor(options = {}) {
            this.version = '2.0.0';
            this.options = {
                containerId: 'pytml-output',
                pyodideVersion: '0.26.4',
                fullStdLib: false,
                packages: [],
                autoRun: true,
                showStatus: true,
                statusTimeout: 3000,
                inputPlaceholder: 'Type your answer here...',
                submitButtonText: 'Submit',
                clearButtonText: 'Clear',
                copyButtonText: 'Copy',
                theme: 'auto',
                ...options
            };
            
            this.outputContainer = null;
            this.statusContainer = null;
            this.pyodide = null;
            this.isReady = false;
            this.executionQueue = [];
            this.eventHandlers = new Map();
            
            this.init();
        }

        // Event handling
        on(event, handler) {
            if (!this.eventHandlers.has(event)) {
                this.eventHandlers.set(event, []);
            }
            this.eventHandlers.get(event).push(handler);
        }

        emit(event, data) {
            const handlers = this.eventHandlers.get(event);
            if (handlers) {
                handlers.forEach(handler => handler(data));
            }
        }

        async init() {
            try {
                this.emit('init', { status: 'starting' });
                this.consoleLog('Initializing PYTML v' + this.version, 'info');
                
                this.createOutputContainer();
                this.createStatusContainer();
                
                if (this.options.showStatus) {
                    this.showStatus('Loading Python runtime', 'loading');
                }
                
                await this.loadPyodide();
                await this.setupPythonEnvironment();
                await this.executePythonScripts();
                
                this.isReady = true;
                this.emit('ready', { version: this.version });
                this.consoleLog('PYTML ready', 'success');
                this.showStatus('Python ready', 'success');
                
                this.processQueue();
                
            } catch (error) {
                this.emit('error', { error: error.message });
                this.consoleLog('Initialization failed: ' + error.message, 'error');
                this.showStatus('Initialization failed', 'error');
            }
        }

        createOutputContainer() {
            let container = document.getElementById(this.options.containerId);
            
            if (!container) {
                container = document.createElement('div');
                container.id = this.options.containerId;
                container.className = 'pytml-container';
                
                const pythonScripts = document.querySelectorAll('script[type="text/python"]');
                if (pythonScripts.length > 0) {
                    pythonScripts[0].insertAdjacentElement('beforebegin', container);
                } else {
                    document.body.appendChild(container);
                }
            }
            
            this.outputContainer = container;
            this.setupContainerControls();
        }

        setupContainerControls() {
            const existingHeader = this.outputContainer.querySelector('.pytml-header');
            if (existingHeader) return;

            const header = document.createElement('div');
            header.className = 'pytml-header';
            
            const title = document.createElement('div');
            title.className = 'pytml-title';
            title.textContent = 'Python Output';
            
            const controls = document.createElement('div');
            controls.className = 'pytml-controls';
            
            const clearBtn = document.createElement('button');
            clearBtn.className = 'pytml-clear-btn';
            clearBtn.textContent = this.options.clearButtonText;
            clearBtn.setAttribute('data-action', 'clear');
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'pytml-copy-btn';
            copyBtn.textContent = this.options.copyButtonText;
            copyBtn.setAttribute('data-action', 'copy');
            
            controls.appendChild(clearBtn);
            controls.appendChild(copyBtn);
            header.appendChild(title);
            header.appendChild(controls);
            
            clearBtn.addEventListener('click', () => this.clearOutput());
            copyBtn.addEventListener('click', () => this.copyOutput());
            
            this.outputContainer.insertBefore(header, this.outputContainer.firstChild);
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'pytml-content';
            this.outputContainer.appendChild(contentDiv);
        }

        createStatusContainer() {
            if (!document.getElementById('pytml-status')) {
                this.statusContainer = document.createElement('div');
                this.statusContainer.id = 'pytml-status';
                this.statusContainer.className = 'pytml-status';
                document.body.appendChild(this.statusContainer);
            } else {
                this.statusContainer = document.getElementById('pytml-status');
            }
        }

        async loadPyodide() {
            if (window.loadPyodide) {
                await this.initializePyodide();
                return;
            }

            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `https://cdn.jsdelivr.net/pyodide/v${this.options.pyodideVersion}/full/pyodide.js`;
                script.crossOrigin = 'anonymous';
                
                script.onload = async () => {
                    try {
                        await this.initializePyodide();
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                };
                
                script.onerror = () => reject(new Error('Failed to load Pyodide'));
                document.head.appendChild(script);
            });
        }

        async initializePyodide() {
            this.pyodide = await window.loadPyodide({
                indexURL: `https://cdn.jsdelivr.net/pyodide/v${this.options.pyodideVersion}/full/`,
                fullStdLib: this.options.fullStdLib,
                packages: this.options.packages
            });
            
            window.pyodide = this.pyodide;
        }

        async setupPythonEnvironment() {
            await this.pyodide.runPythonAsync(`
import sys
import js
import asyncio
from pyodide.ffi import create_proxy

class PythonOutputRedirect:
    def __init__(self, output_type='stdout'):
        self.output_type = output_type
        self.buffer = []
    
    def write(self, text):
        if text and text != '\\n':
            self.buffer.append(str(text))
            if text.endswith('\\n') or len(self.buffer) > 10:
                self.flush()
    
    def flush(self):
        if self.buffer:
            js.window.pytml.addOutput(''.join(self.buffer), self.output_type)
            self.buffer = []

sys.stdout = PythonOutputRedirect('stdout')
sys.stderr = PythonOutputRedirect('stderr')

async def python_input(prompt=""):
    if prompt:
        print(prompt, end='')
    return await js.window.pytml.getUserInput(prompt or '')

import builtins
builtins.input = python_input

print("Python environment initialized")
`);
        }

        async executePythonScripts() {
            const scripts = document.querySelectorAll('script[type="text/python"]');
            
            for (const script of scripts) {
                if (script.hasAttribute('src')) {
                    await this.loadExternalScript(script);
                } else if (script.textContent.trim()) {
                    await this.executePython(script.textContent);
                }
                script.remove();
            }
        }

        async loadExternalScript(scriptElement) {
            const src = scriptElement.getAttribute('src');
            this.consoleLog('Loading: ' + src, 'info');
            
            try {
                const response = await fetch(src);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const code = await response.text();
                await this.executePython(code);
                this.emit('file-loaded', { file: src });
            } catch (error) {
                this.consoleLog('Failed to load ' + src + ': ' + error.message, 'error');
                this.addOutputLine('Error loading ' + src + ': ' + error.message, 'error');
            }
        }

        async executePython(code, context = {}) {
            if (!this.isReady) {
                return new Promise((resolve) => {
                    this.executionQueue.push(async () => {
                        const result = await this.executePython(code, context);
                        resolve(result);
                    });
                });
            }
            
            try {
                this.emit('execution-start', { code });
                
                for (const [key, value] of Object.entries(context)) {
                    this.pyodide.globals.set(key, value);
                }
                
                const result = await this.pyodide.runPythonAsync(code);
                this.emit('execution-complete', { code, result });
                
                return result;
                
            } catch (error) {
                this.emit('execution-error', { code, error: error.message });
                this.addOutputLine('Python Error: ' + error.message, 'error');
                throw error;
            }
        }

        async getUserInput(prompt) {
            return new Promise((resolve) => {
                const container = document.createElement('div');
                container.className = 'pytml-input-group';
                
                const promptElement = document.createElement('div');
                promptElement.className = 'pytml-input-prompt';
                promptElement.textContent = prompt || 'Input:';
                
                const inputWrapper = document.createElement('div');
                inputWrapper.className = 'pytml-input-wrapper';
                
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.className = 'pytml-input-field';
                inputField.placeholder = this.options.inputPlaceholder;
                
                const submitBtn = document.createElement('button');
                submitBtn.className = 'pytml-submit-btn';
                submitBtn.textContent = this.options.submitButtonText;
                
                inputWrapper.appendChild(inputField);
                inputWrapper.appendChild(submitBtn);
                container.appendChild(promptElement);
                container.appendChild(inputWrapper);
                
                const contentDiv = this.outputContainer.querySelector('.pytml-content');
                if (contentDiv) {
                    contentDiv.appendChild(container);
                } else {
                    this.outputContainer.appendChild(container);
                }
                
                const handleSubmit = () => {
                    const value = inputField.value;
                    container.remove();
                    this.addOutputLine(prompt + ' ' + value, 'user-input');
                    resolve(value);
                };
                
                submitBtn.addEventListener('click', handleSubmit);
                inputField.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') handleSubmit();
                });
                
                inputField.focus();
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        addOutput(text, type = 'stdout') {
            const className = type === 'stderr' ? 'error' : 'output';
            this.addOutputLine(text, className);
        }

        addOutputLine(text, className) {
            if (!this.outputContainer) return;
            
            const line = document.createElement('div');
            line.className = `pytml-line pytml-line-${className}`;
            line.textContent = text;
            
            const contentDiv = this.outputContainer.querySelector('.pytml-content');
            if (contentDiv) {
                contentDiv.appendChild(line);
            } else {
                this.outputContainer.appendChild(line);
            }
            
            line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        clearOutput() {
            const contentDiv = this.outputContainer.querySelector('.pytml-content');
            if (contentDiv) {
                contentDiv.innerHTML = '';
            } else {
                const children = Array.from(this.outputContainer.children);
                children.forEach(child => {
                    if (!child.classList || !child.classList.contains('pytml-header')) {
                        child.remove();
                    }
                });
            }
            
            this.emit('cleared');
            this.consoleLog('Output cleared', 'info');
        }

        async copyOutput() {
            const contentDiv = this.outputContainer.querySelector('.pytml-content');
            let text = '';
            
            if (contentDiv) {
                const lines = contentDiv.querySelectorAll('.pytml-line');
                text = Array.from(lines).map(line => line.textContent).join('\n');
            } else {
                const lines = this.outputContainer.querySelectorAll('.pytml-line:not(.pytml-header)');
                text = Array.from(lines).map(line => line.textContent).join('\n');
            }
            
            try {
                await navigator.clipboard.writeText(text);
                this.showStatus('Copied to clipboard', 'success');
            } catch (error) {
                this.showStatus('Failed to copy', 'error');
            }
        }

        showStatus(message, type = 'loading') {
            if (!this.options.showStatus || !this.statusContainer) return;
            
            this.statusContainer.textContent = message;
            this.statusContainer.className = `pytml-status pytml-status-${type}`;
            this.statusContainer.style.display = 'block';
            
            if (type !== 'loading') {
                setTimeout(() => {
                    if (this.statusContainer) {
                        this.statusContainer.style.display = 'none';
                    }
                }, this.options.statusTimeout);
            }
        }

        consoleLog(message, level = 'info') {
            const prefix = '[PYTML]';
            if (level === 'error') {
                console.error(prefix, message);
            } else if (level === 'warning') {
                console.warn(prefix, message);
            } else {
                console.log(prefix, message);
            }
        }

        processQueue() {
            while (this.executionQueue.length > 0) {
                const task = this.executionQueue.shift();
                task().catch(error => {
                    this.consoleLog('Queue task failed: ' + error.message, 'error');
                });
            }
        }

        // Public API
        async run(code, context = {}) {
            return this.executePython(code, context);
        }

        async runFile(url) {
            const response = await fetch(url);
            const code = await response.text();
            return this.executePython(code);
        }

        async installPackage(packageName) {
            if (!this.pyodide) {
                throw new Error('Pyodide not initialized');
            }
            
            this.showStatus('Installing ' + packageName, 'loading');
            try {
                await this.pyodide.runPythonAsync(`
import micropip
await micropip.install("${packageName}")
print("Package installed: ${packageName}")
`);
                this.showStatus(packageName + ' installed', 'success');
                return true;
            } catch (error) {
                this.showStatus('Installation failed', 'error');
                throw error;
            }
        }

        getPythonVersion() {
            if (!this.pyodide) return null;
            return this.pyodide.runPython(`
import sys
f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
`);
        }

        destroy() {
            this.clearOutput();
            if (this.statusContainer) {
                this.statusContainer.remove();
            }
            this.isReady = false;
            this.executionQueue = [];
            this.emit('destroyed');
            this.consoleLog('PYTML destroyed', 'info');
        }
    }

    // CSS Styles - Designed for easy overriding
    const styles = `
        /* Base Container - Can be overridden */
        .pytml-container {
            display: block;
            width: 100%;
            max-width: 100%;
            margin: 1rem 0;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            background-color: #ffffff;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.5;
            color: #333333;
        }

        /* Header Section */
        .pytml-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1rem;
            border-bottom: 1px solid #e0e0e0;
            background-color: #f8f9fa;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .pytml-title {
            font-weight: 600;
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #666666;
        }

        .pytml-controls {
            display: flex;
            gap: 0.5rem;
        }

        .pytml-clear-btn,
        .pytml-copy-btn {
            padding: 0.25rem 0.5rem;
            border: 1px solid #d0d0d0;
            border-radius: 3px;
            background-color: #ffffff;
            font-family: inherit;
            font-size: 0.75rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .pytml-clear-btn:hover,
        .pytml-copy-btn:hover {
            background-color: #f0f0f0;
            border-color: #b0b0b0;
        }

        .pytml-clear-btn:active,
        .pytml-copy-btn:active {
            transform: scale(0.98);
        }

        /* Content Area */
        .pytml-content {
            padding: 0.5rem 0;
            max-height: 500px;
            overflow-y: auto;
        }

        /* Output Lines */
        .pytml-line {
            padding: 0.25rem 1rem;
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
            word-break: break-word;
        }

        .pytml-line-output {
            color: #2c3e50;
        }

        .pytml-line-error {
            color: #e74c3c;
            background-color: #fdf0ed;
        }

        .pytml-line-user-input {
            color: #27ae60;
            font-style: italic;
        }

        /* Input Group */
        .pytml-input-group {
            padding: 1rem;
            margin: 0.5rem;
            border: 1px solid #3498db;
            border-radius: 4px;
            background-color: #f8f9fa;
        }

        .pytml-input-prompt {
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #2c3e50;
        }

        .pytml-input-wrapper {
            display: flex;
            gap: 0.5rem;
        }

        .pytml-input-field {
            flex: 1;
            padding: 0.5rem;
            border: 1px solid #d0d0d0;
            border-radius: 3px;
            font-family: inherit;
            font-size: 0.875rem;
            background-color: #ffffff;
        }

        .pytml-input-field:focus {
            outline: none;
            border-color: #3498db;
            box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.1);
        }

        .pytml-submit-btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 3px;
            background-color: #3498db;
            color: #ffffff;
            font-family: inherit;
            font-size: 0.875rem;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }

        .pytml-submit-btn:hover {
            background-color: #2980b9;
        }

        .pytml-submit-btn:active {
            transform: scale(0.98);
        }

        /* Status Messages */
        .pytml-status {
            position: fixed;
            bottom: 1rem;
            right: 1rem;
            padding: 0.75rem 1rem;
            border-radius: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 0.875rem;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            animation: pytmlSlideIn 0.3s ease;
        }

        .pytml-status-loading {
            background-color: #3498db;
            color: #ffffff;
        }

        .pytml-status-success {
            background-color: #27ae60;
            color: #ffffff;
        }

        .pytml-status-error {
            background-color: #e74c3c;
            color: #ffffff;
        }

        /* Scrollbar Styling - Optional */
        .pytml-content::-webkit-scrollbar {
            width: 8px;
        }

        .pytml-content::-webkit-scrollbar-track {
            background-color: #f1f1f1;
        }

        .pytml-content::-webkit-scrollbar-thumb {
            background-color: #c1c1c1;
            border-radius: 4px;
        }

        .pytml-content::-webkit-scrollbar-thumb:hover {
            background-color: #a8a8a8;
        }

        /* Animations */
        @keyframes pytmlSlideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;

    // Inject styles only once
    if (!document.getElementById('pytml-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'pytml-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    // Initialize on DOM ready
    const initializePYTML = () => {
        if (!window.pytml) {
            window.pytml = new PYTML(window.pytmlConfig);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePYTML);
    } else {
        initializePYTML();
    }

})(window);
