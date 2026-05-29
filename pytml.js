// pytml.js - Complete Version with Proper Loop Handling
(function(window) {
    class PYTML {
        constructor() {
            this.outputContainer = null;
            this.pyodide = null;
            this.isRunning = true;
            this.outputMode = 'repetitive';
            this.outputCache = new Map();
            this.loopCounters = new Map();
            this.init();
        }

        async init() {
            console.log('PYTML: Initializing...');
            
            if (window.pytmlConfig) {
                if (window.pytmlConfig.outputMode) {
                    this.outputMode = window.pytmlConfig.outputMode;
                }
            }
            
            this.createOutputContainer();
            this.injectDefaultStyles();
            this.showStatus('Loading Python...');
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
            
            script.onload = async () => {
                this.showStatus('Initializing Python...');
                this.pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
                    fullStdLib: false
                });
                
                window.pyodide = this.pyodide;
                
                await this.pyodide.runPythonAsync(`
import sys
import js
import asyncio
from js import document, window

class HTMLOutput:
    def __init__(self):
        self.buffer = []
    
    def write(self, text):
        if text:
            self.buffer.append(str(text))
            full_text = ''.join(self.buffer)
            if full_text.strip():
                js.displayStyledOutput(full_text)
            self.buffer = []
    
    def flush(self):
        if self.buffer:
            full_text = ''.join(self.buffer)
            if full_text.strip():
                js.displayStyledOutput(full_text)
            self.buffer = []

sys.stdout = HTMLOutput()
sys.stderr = HTMLOutput()

async def python_input(prompt=""):
    if prompt:
        print(prompt, end='')
    await asyncio.sleep(0.01)
    return await js.createInlineInput(str(prompt))

import builtins
builtins.input = python_input

# Add loop protection
import time

def safe_print(*args, **kwargs):
    """Print with loop detection"""
    text = ' '.join(str(arg) for arg in args)
    if js.window.pytmlInstance.detectLoop(text):
        return
    original_print(*args, **kwargs)

original_print = print
print = safe_print

print("Python ready")
`);
                
                this.hideStatus();
                console.log('PYTML: Ready!');
                await this.loadExternalPythonFiles();
            };
            
            script.onerror = () => {
                this.showStatus('Failed to load Pyodide.', true);
            };
            
            document.head.appendChild(script);
        }

        detectLoop(text) {
            const now = Date.now();
            if (!this.loopTimers) this.loopTimers = new Map();
            
            if (this.loopCounters.has(text)) {
                let count = this.loopCounters.get(text) + 1;
                let lastTime = this.loopTimers.get(text) || now;
                
                if (count > 100 && (now - lastTime) < 1000) {
                    if (!this.warningShown) {
                        this.addOutput(`[Loop detected: "${text}" repeated ${count} times. Use Stop button to halt.]`, 'warning');
                        this.warningShown = true;
                    }
                    return true;
                }
                
                this.loopCounters.set(text, count);
                this.loopTimers.set(text, lastTime);
                
                setTimeout(() => {
                    if (this.loopCounters.get(text) === count) {
                        this.loopCounters.delete(text);
                        this.loopTimers.delete(text);
                        this.warningShown = false;
                    }
                }, 1000);
            } else {
                this.loopCounters.set(text, 1);
                this.loopTimers.set(text, now);
            }
            
            return false;
        }

        createOutputContainer() {
            if (!document.getElementById('pytml-output')) {
                const container = document.createElement('div');
                container.id = 'pytml-output';
                container.className = 'pytml-output';
                
                const controls = document.createElement('div');
                controls.className = 'pytml-controls';
                controls.innerHTML = `
                    <button class="pytml-stop-btn">Stop</button>
                    <button class="pytml-clear-btn">Clear</button>
                    <label class="pytml-mode-label">
                        <input type="checkbox" class="pytml-mode-checkbox">
                        Overlap Mode (replace repeated lines)
                    </label>
                `;
                
                const stopBtn = controls.querySelector('.pytml-stop-btn');
                const clearBtn = controls.querySelector('.pytml-clear-btn');
                const modeCheckbox = controls.querySelector('.pytml-mode-checkbox');
                
                stopBtn.onclick = () => this.stopExecution();
                clearBtn.onclick = () => this.clearOutput();
                modeCheckbox.onchange = (e) => {
                    this.outputMode = e.target.checked ? 'overlap' : 'repetitive';
                    if (this.outputMode === 'overlap') {
                        this.outputCache.clear();
                    }
                };
                
                container.appendChild(controls);
                
                const outputArea = document.createElement('div');
                outputArea.className = 'pytml-output-area';
                container.appendChild(outputArea);
                
                const pyScripts = document.querySelectorAll('script[type="text/python"]');
                if (pyScripts.length > 0) {
                    pyScripts[0].insertAdjacentElement('beforebegin', container);
                } else {
                    document.body.insertAdjacentElement('afterbegin', container);
                }
                this.outputContainer = outputArea;
            } else {
                const container = document.getElementById('pytml-output');
                this.outputContainer = container.querySelector('.pytml-output-area');
            }
        }

        injectDefaultStyles() {
            if (document.getElementById('pytml-default-styles')) return;
            
            const styles = document.createElement('style');
            styles.id = 'pytml-default-styles';
            styles.textContent = `
                .pytml-output {
                    background: #1e1e2e;
                    border-radius: 8px;
                    margin: 16px 0;
                    font-family: monospace;
                    font-size: 14px;
                    line-height: 1.5;
                    border: 1px solid #2d2d44;
                    overflow: hidden;
                }
                
                .pytml-controls {
                    display: flex;
                    gap: 12px;
                    padding: 12px 16px;
                    background: #0f0f23;
                    border-bottom: 1px solid #2d2d44;
                    align-items: center;
                    flex-wrap: wrap;
                }
                
                .pytml-stop-btn {
                    background: #dc2626;
                    color: white;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-family: monospace;
                    font-size: 12px;
                }
                
                .pytml-stop-btn:hover {
                    background: #b91c1c;
                }
                
                .pytml-clear-btn {
                    background: #2d2d44;
                    border: none;
                    color: #a1a1aa;
                    padding: 6px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-family: monospace;
                    font-size: 12px;
                }
                
                .pytml-clear-btn:hover {
                    background: #3d3d54;
                    color: white;
                }
                
                .pytml-mode-label {
                    color: #a1a1aa;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                }
                
                .pytml-output-area {
                    padding: 16px;
                    max-height: 500px;
                    overflow-y: auto;
                }
                
                .pytml-output-line {
                    margin: 4px 0;
                    padding: 2px 0;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    color: #e4e4e7;
                }
                
                .pytml-warning-line {
                    color: #fbbf24;
                    background: rgba(251, 191, 36, 0.1);
                    padding: 4px 8px;
                    border-radius: 4px;
                    margin: 4px 0;
                }
                
                .pytml-error-line {
                    color: #ff6b6b;
                    background: rgba(255, 107, 107, 0.1);
                    padding: 4px 8px;
                    border-radius: 4px;
                    margin: 4px 0;
                }
                
                .pytml-input-container {
                    margin: 12px 0;
                    padding: 12px;
                    background: #0f0f23;
                    border-radius: 6px;
                    border-left: 3px solid #7c3aed;
                }
                
                .pytml-input-prompt {
                    font-weight: bold;
                    margin-bottom: 8px;
                    color: #7c3aed;
                }
                
                .pytml-input-field {
                    width: calc(100% - 90px);
                    padding: 8px 12px;
                    margin-right: 10px;
                    background: #1a1a2e;
                    border: 1px solid #2d2d44;
                    border-radius: 4px;
                    color: #e4e4e7;
                    font-family: monospace;
                    font-size: 14px;
                }
                
                .pytml-input-field:focus {
                    outline: none;
                    border-color: #7c3aed;
                }
                
                .pytml-submit-btn {
                    padding: 8px 16px;
                    background: #7c3aed;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                .pytml-submit-btn:hover {
                    background: #6d28d9;
                }
                
                .pytml-status {
                    position: fixed;
                    bottom: 16px;
                    right: 16px;
                    background: #333;
                    color: white;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-family: monospace;
                    font-size: 12px;
                    z-index: 9999;
                }
                
                .pytml-output-area::-webkit-scrollbar {
                    width: 8px;
                }
                
                .pytml-output-area::-webkit-scrollbar-track {
                    background: #0f0f23;
                }
                
                .pytml-output-area::-webkit-scrollbar-thumb {
                    background: #2d2d44;
                    border-radius: 4px;
                }
            `;
            document.head.appendChild(styles);
        }

        async loadExternalPythonFiles() {
            const pyScripts = document.querySelectorAll('script[type="text/python"][src]');

            for (let scriptTag of pyScripts) {
                const pyFile = scriptTag.getAttribute('src');
                console.log(`Loading: ${pyFile}`);

                try {
                    const response = await fetch(pyFile);
                    const code = await response.text();
                    
                    this.clearOutput();
                    this.isRunning = true;
                    this.loopCounters.clear();
                    this.warningShown = false;
                    
                    // Execute with timeout protection
                    await this.executeWithTimeout(code);
                    scriptTag.remove();

                } catch(e) {
                    this.addError(e.message);
                }
            }
        }

        async executeWithTimeout(code, timeout = 30000) {
            return new Promise(async (resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    this.isRunning = false;
                    this.addError('Execution timeout (30s). Use Stop button to halt infinite loops.', 'warning');
                    reject(new Error('Execution timeout'));
                }, timeout);
                
                try {
                    await this.runPythonWithInlineInputs(code);
                    clearTimeout(timeoutId);
                    resolve();
                } catch (error) {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });
        }

        async runPythonWithInlineInputs(code) {
            const lines = code.split('\n');
            let result = '';
            
            for (let i = 0; i < lines.length; i++) {
                if (!this.isRunning) {
                    this.addOutput('Execution stopped by user', 'warning');
                    break;
                }
                
                const line = lines[i];
                
                if (line.includes('input(')) {
                    const promptMatch = line.match(/input\(["'](.+?)["']\)/);
                    if (promptMatch) {
                        const prompt = promptMatch[1];
                        const value = await this.createInlineInput(prompt);
                        const newLine = line.replace(/input\(["'].+?["']\)/, `"${value}"`);
                        result += newLine + '\n';
                    }
                } else if (line.trim().startsWith('while True:')) {
                    this.addOutput('[Warning: Infinite loop detected. Click Stop to halt execution.]', 'warning');
                    await this.runWithLoopProtection(line, lines.slice(i + 1));
                    break;
                } else {
                    result += line + '\n';
                }
                
                await this.sleep(5);
            }
            
            if (this.isRunning && result.trim()) {
                await window.pyodide.runPythonAsync(result);
            }
        }

        async runWithLoopProtection(loopLine, loopBody) {
            let iteration = 0;
            const maxIterations = 1000;
            
            this.addOutput('Running loop with protection (max 1000 iterations)...', 'info');
            
            while (this.isRunning && iteration < maxIterations) {
                for (let line of loopBody) {
                    if (!this.isRunning) break;
                    
                    if (line.includes('print(')) {
                        const printMatch = line.match(/print\(["'](.+?)["']\)/);
                        if (printMatch) {
                            const text = printMatch[1];
                            if (this.outputMode === 'overlap') {
                                this.addOverlapOutput(text, 'output');
                            } else {
                                this.addOutput(text, 'output');
                            }
                        }
                    }
                    await this.sleep(10);
                }
                iteration++;
                
                if (iteration % 100 === 0) {
                    this.addOutput(`Loop iteration: ${iteration}... (Click Stop to halt)`, 'info');
                }
            }
            
            if (iteration >= maxIterations) {
                this.addOutput(`Loop stopped after ${maxIterations} iterations. Use Stop button for longer runs.`, 'warning');
            }
        }

        addOutput(text, type = 'output') {
            if (!this.outputContainer) return;
            
            if (this.outputMode === 'overlap' && type === 'output') {
                this.addOverlapOutput(text, type);
            } else {
                this.addNewOutput(text, type);
            }
        }

        addNewOutput(text, type = 'output') {
            const line = document.createElement('div');
            if (type === 'error') line.className = 'pytml-error-line';
            else if (type === 'warning') line.className = 'pytml-warning-line';
            else line.className = 'pytml-output-line';
            line.textContent = text;
            this.outputContainer.appendChild(line);
            line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        addOverlapOutput(text, type = 'output') {
            const lastLine = this.outputContainer.lastChild;
            
            if (lastLine && lastLine.classList.contains('pytml-output-line') && 
                !lastLine.classList.contains('pytml-error-line') &&
                !lastLine.classList.contains('pytml-warning-line') &&
                lastLine.textContent.split(' (x')[0] === text) {
                
                let count = parseInt(lastLine.getAttribute('data-count') || '1');
                count++;
                lastLine.setAttribute('data-count', count);
                lastLine.textContent = `${text} (x${count})`;
                lastLine.classList.add('overlap');
                setTimeout(() => lastLine.classList.remove('overlap'), 300);
            } else {
                const line = document.createElement('div');
                line.className = 'pytml-output-line';
                line.textContent = text;
                line.setAttribute('data-count', '1');
                this.outputContainer.appendChild(line);
                line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        addStyledOutput(text) {
            this.addOutput(text, 'output');
        }

        addError(text) {
            this.addOutput(text, 'error');
        }

        createInlineInput(prompt) {
            return new Promise((resolve) => {
                const container = document.createElement('div');
                container.className = 'pytml-input-container';
                
                const promptText = document.createElement('div');
                promptText.className = 'pytml-input-prompt';
                promptText.textContent = prompt;
                container.appendChild(promptText);
                
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.className = 'pytml-input-field';
                inputField.placeholder = 'Type your answer...';
                container.appendChild(inputField);
                
                const submitBtn = document.createElement('button');
                submitBtn.className = 'pytml-submit-btn';
                submitBtn.textContent = 'Submit';
                container.appendChild(submitBtn);
                
                this.outputContainer.appendChild(container);
                
                const submit = () => {
                    const value = inputField.value;
                    container.remove();
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
                this.outputCache.clear();
                this.loopCounters.clear();
            }
        }

        stopExecution() {
            this.isRunning = false;
            this.addOutput('Execution stopped by user', 'warning');
        }

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        showStatus(message, isError = false) {
            let status = document.getElementById('pytml-status');
            if (!status) {
                status = document.createElement('div');
                status.id = 'pytml-status';
                status.className = 'pytml-status';
                document.body.appendChild(status);
            }
            status.textContent = message;
            if (isError) status.style.background = '#dc2626';
            
            setTimeout(() => {
                if (status) {
                    status.style.opacity = '0';
                    setTimeout(() => {
                        if (status) status.remove();
                    }, 300);
                }
            }, 2000);
        }

        hideStatus() {
            const status = document.getElementById('pytml-status');
            if (status) status.remove();
        }
    }

    window.displayStyledOutput = function(text) {
        if (window.pytmlInstance) {
            window.pytmlInstance.addStyledOutput(text);
        }
    };

    window.createInlineInput = function(prompt) {
        return window.pytmlInstance.createInlineInput(prompt);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.pytmlInstance = new PYTML();
        });
    } else {
        window.pytmlInstance = new PYTML();
    }
})(window);
