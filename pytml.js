(function(global) {
    'use strict';

    class PYTMLRuntime {
        constructor() {
            this.pyodide = null;
            this.ready = false;
            this.queue = [];
            this.loading = false;
            this.startTime = null;
            this.init();
        }

        async init() {
            if (this.loading) return;
            this.loading = true;
            this.startTime = Date.now();
            
            console.log('[PYTML] Initializing Python runtime...');
            
            const statusDiv = this.createStatusIndicator();
            
            try {
                if (typeof loadPyodide === 'undefined') {
                    await this.loadScript('https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js');
                }
                
                statusDiv.textContent = '[PYTML] Loading Python WebAssembly (6MB)...';
                
                this.pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
                    fullStdLib: false
                });
                
                await this.setupPythonEnvironment();
                
                this.ready = true;
                const loadTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
                console.log(`[PYTML] Python ready in ${loadTime}s`);
                
                statusDiv.style.display = 'none';
                
                this.queue.forEach(cb => cb());
                this.queue = [];
                
                this.processPage();
                
            } catch (error) {
                console.error('[PYTML] Failed to load:', error);
                statusDiv.textContent = '[PYTML] Failed to load Python. Check network.';
                statusDiv.style.background = '#dc3545';
            }
        }

        createStatusIndicator() {
            const div = document.createElement('div');
            div.id = 'pytml-status';
            div.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: #007acc;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-family: monospace;
                z-index: 9999;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            `;
            div.textContent = '[PYTML] Loading Python...';
            document.body.appendChild(div);
            return div;
        }

        loadScript(src) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        async setupPythonEnvironment() {
            await this.pyodide.runPythonAsync(`
import sys
import io
import re

class OutputCapture:
    def __init__(self):
        self.buffer = []
    
    def write(self, text):
        self.buffer.append(text)
    
    def get(self):
        return ''.join(self.buffer)
    
    def clear(self):
        self.buffer = []

original_stdout = sys.stdout
capture = OutputCapture()

def normalize_indentation(code):
    lines = code.split('\\n')
    if not lines:
        return code
    
    base_indent = None
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith('#'):
            indent_match = re.match(r'^\\s+', line)
            if indent_match:
                base_indent = len(indent_match.group())
            else:
                base_indent = 0
            break
    
    if base_indent is None:
        return code
    
    normalized = []
    for line in lines:
        if line.strip():
            stripped = line.lstrip()
            if base_indent > 0:
                normalized.append(' ' * 4 + stripped)
            else:
                normalized.append(stripped)
        else:
            normalized.append('')
    
    return '\\n'.join(normalized)

def execute_python(code, inputs_dict):
    capture.clear()
    sys.stdout = capture
    
    try:
        code = normalize_indentation(code)
        
        for key, value in inputs_dict.items():
            globals()[key] = value
        
        exec(code)
        
        result = capture.get()
        sys.stdout = original_stdout
        return {'success': True, 'output': result}
    except Exception as e:
        sys.stdout = original_stdout
        return {'success': False, 'error': str(e)}
            `);
        }

        async wait() {
            if (this.ready) return;
            return new Promise(resolve => this.queue.push(resolve));
        }

        normalizePythonCode(code) {
            let normalized = code;
            normalized = normalized.replace(/\\/g, '\\\\');
            normalized = normalized.replace(/`/g, '\\`');
            
            const lines = normalized.split('\n');
            const processed = lines.map(line => {
                const match = line.match(/^(\s*)/);
                if (match) {
                    const spaces = match[1].length;
                    if (spaces > 0 && spaces % 4 !== 0) {
                        return '    '.repeat(Math.ceil(spaces / 4)) + line.trimStart();
                    }
                }
                return line;
            });
            
            return processed.join('\n');
        }

        async run(code, scope = {}, options = {}) {
            await this.wait();
            
            const normalizedCode = this.normalizePythonCode(code);
            
            try {
                const inputsJson = JSON.stringify(scope);
                
                const result = await this.pyodide.runPythonAsync(`
result = execute_python(${JSON.stringify(normalizedCode)}, ${inputsJson})
result
                `);
                
                if (result.toJs && typeof result.toJs === 'function') {
                    const jsResult = result.toJs();
                    if (!jsResult.success) {
                        throw new Error(jsResult.error);
                    }
                    return jsResult.output;
                }
                
                if (result.success === false) {
                    throw new Error(result.error);
                }
                
                return result.output || '';
                
            } catch (error) {
                console.error('[PYTML] Python error:', error);
                
                if (error.message.includes('IndentationError')) {
                    throw new Error('Python Indentation Error: Use consistent 4-space indentation');
                } else if (error.message.includes('SyntaxError')) {
                    throw new Error(`Python Syntax Error: ${error.message}`);
                }
                
                throw error;
            }
        }

        async processPage() {
            await this.wait();
            
            const elements = document.querySelectorAll('[data-python], [data-python-text], [data-python-html]');
            console.log(`[PYTML] Found ${elements.length} Python-enhanced elements`);
            
            for (const el of elements) {
                await this.bindElement(el);
            }
        }

        async bindElement(el) {
            if (el.hasAttribute('data-python-text')) {
                const code = el.getAttribute('data-python-text');
                try {
                    const result = await this.run(code);
                    el.textContent = result;
                } catch (error) {
                    el.textContent = `[Error: ${error.message}]`;
                    el.style.color = '#dc3545';
                }
            }
            
            if (el.hasAttribute('data-python-html')) {
                const code = el.getAttribute('data-python-html');
                try {
                    const result = await this.run(code);
                    el.innerHTML = result;
                } catch (error) {
                    el.innerHTML = `<span style="color:#dc3545">[Error: ${error.message}]</span>`;
                }
            }
            
            if (el.hasAttribute('data-python')) {
                const code = el.getAttribute('data-python');
                const eventType = el.getAttribute('data-event') || 'click';
                const targetSelector = el.getAttribute('data-target');
                const showLoader = el.getAttribute('data-loader') !== 'false';
                
                const handler = async () => {
                    if (showLoader) {
                        this.showLoader(el);
                    }
                    
                    try {
                        const inputs = this.collectInputs(el);
                        const result = await this.run(code, inputs);
                        
                        if (targetSelector) {
                            const target = document.querySelector(targetSelector);
                            if (target) {
                                target.innerHTML = result.replace(/\n/g, '<br>');
                            }
                        }
                        
                        if (el.getAttribute('data-output-self') === 'true') {
                            el.innerHTML = result;
                        }
                        
                    } catch (error) {
                        if (targetSelector) {
                            const target = document.querySelector(targetSelector);
                            if (target) {
                                target.innerHTML = `<span style="color:#dc3545">Error: ${error.message}</span>`;
                            }
                        }
                    } finally {
                        if (showLoader) {
                            this.hideLoader(el);
                        }
                    }
                };
                
                el.addEventListener(eventType, handler);
            }
        }

        collectInputs(element) {
            const inputs = {};
            const form = element.closest('[data-python-form]');
            
            if (form) {
                const allInputs = form.querySelectorAll('input, select, textarea');
                for (const input of allInputs) {
                    if (input.name) {
                        let value = input.value;
                        
                        if (input.type === 'number') {
                            value = parseFloat(value);
                        } else if (input.type === 'checkbox') {
                            value = input.checked;
                        } else if (input.type === 'radio' && input.checked) {
                            value = input.value;
                        }
                        
                        inputs[input.name] = value;
                    }
                }
            }
            
            return inputs;
        }

        showLoader(element) {
            const originalText = element.innerHTML;
            element.setAttribute('data-original-text', originalText);
            element.innerHTML = '[Processing Python...]';
            element.disabled = true;
        }

        hideLoader(element) {
            const originalText = element.getAttribute('data-original-text');
            if (originalText) {
                element.innerHTML = originalText;
            }
            element.disabled = false;
        }

        getStatus() {
            return {
                ready: this.ready,
                loadingTime: this.startTime ? ((Date.now() - this.startTime) / 1000).toFixed(1) : null,
                version: '3.1.0'
            };
        }
    }

    const pytml = new PYTMLRuntime();
    global.pytml = pytml;

    document.addEventListener('DOMContentLoaded', () => {
        pytml.processPage();
    });

})(window);
