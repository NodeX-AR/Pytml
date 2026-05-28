(function(global) {
    'use strict';

    class PYTMLCore {
        constructor() {
            this.pyodide = null;
            this.ready = false;
            this.queue = [];
            this.cache = new Map();
            this.components = new Map();
            this.eventHandlers = new Map();
            this.init();
        }

        async init() {
            if (this.ready) return;
            
            console.log('🐍 PYTML: Initializing...');
            
            // Show loading indicator
            this.showLoader();
            
            try {
                // Load Pyodide with fallback CDNs
                await this.loadPyodide();
                
                // Initialize Python environment
                await this.initPython();
                
                this.ready = true;
                this.hideLoader();
                
                // Process all Python elements
                this.processDOM();
                
                // Setup mutation observer for dynamic content
                this.observeDOM();
                
                console.log('✅ PYTML: Ready!');
                
            } catch (error) {
                console.error('❌ PYTML:', error);
                this.showError(error.message);
            }
        }

        async loadPyodide() {
            const cdns = [
                'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js',
                'https://unpkg.com/pyodide@0.24.1/pyodide.js',
                'https://cdn.skypack.dev/pyodide'
            ];
            
            for (const cdn of cdns) {
                try {
                    if (typeof loadPyodide === 'undefined') {
                        await this.loadScript(cdn);
                    }
                    break;
                } catch (e) {
                    console.warn(`Failed to load from ${cdn}`);
                }
            }
            
            this.pyodide = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
                fullStdLib: false
            });
        }

        async initPython() {
            await this.pyodide.runPythonAsync(`
import sys
import io
import json
import re
from typing import Any, Dict, Optional

class FastOutput:
    __slots__ = ['buffer']
    def __init__(self):
        self.buffer = []
    def write(self, text):
        if text:
            self.buffer.append(str(text))
    def get(self):
        return ''.join(self.buffer)
    def clear(self):
        self.buffer = []

class PYTMLRuntime:
    __slots__ = ['output', 'cache', 'globals']
    
    def __init__(self):
        self.output = FastOutput()
        self.cache = {}
        self.globals = {}
    
    def execute(self, code: str, inputs: Dict = None) -> str:
        self.output.clear()
        old_stdout = sys.stdout
        sys.stdout = self.output
        
        try:
            if inputs:
                for k, v in inputs.items():
                    self.globals[k] = v
            
            exec(code, self.globals)
            result = self.output.get()
            sys.stdout = old_stdout
            return result
        except Exception as e:
            sys.stdout = old_stdout
            raise e

runtime = PYTMLRuntime()

def fast_execute(code, inputs):
    return runtime.execute(code, inputs)
            `);
        }

        async run(code, inputs = {}) {
            if (!this.ready) await this.wait();
            
            const cacheKey = `${code}_${JSON.stringify(inputs)}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }
            
            try {
                const result = await this.pyodide.runPythonAsync(`
fast_execute(${JSON.stringify(code)}, ${JSON.stringify(inputs)})
                `);
                
                // Cache results for 1 second (prevents duplicate executions)
                setTimeout(() => this.cache.delete(cacheKey), 1000);
                this.cache.set(cacheKey, result);
                
                return result;
            } catch (error) {
                return `Error: ${error.message}`;
            }
        }

        async runFile(url, inputs = {}) {
            const response = await fetch(url);
            const code = await response.text();
            return this.run(code, inputs);
        }

        async component(name, code, inputs = {}) {
            this.components.set(name, { code, inputs });
            
            // Create a function that can be called from HTML
            global[name] = async (data = {}) => {
                const mergedInputs = { ...inputs, ...data };
                return this.run(code, mergedInputs);
            };
            
            return global[name];
        }

        processDOM() {
            // Process data-python-text
            document.querySelectorAll('[data-python-text]').forEach(async el => {
                const code = el.getAttribute('data-python-text');
                const result = await this.run(`result = ${code}\nprint(result)`);
                if (el) el.textContent = result;
            });
            
            // Process data-python-html
            document.querySelectorAll('[data-python-html]').forEach(async el => {
                const code = el.getAttribute('data-python-html');
                const result = await this.run(`result = ${code}\nprint(result)`);
                if (el) el.innerHTML = result;
            });
            
            // Process data-python buttons
            document.querySelectorAll('[data-python]').forEach(el => {
                const code = el.getAttribute('data-python');
                const eventType = el.getAttribute('data-event') || 'click';
                const target = el.getAttribute('data-target');
                const debounce = parseInt(el.getAttribute('data-debounce') || '300');
                
                let timeout = null;
                const handler = async () => {
                    if (timeout) return;
                    
                    if (el.getAttribute('data-loader') !== 'false') {
                        this.showButtonLoader(el);
                    }
                    
                    timeout = setTimeout(async () => {
                        try {
                            const inputs = this.collectInputs(el);
                            const result = await this.run(code, inputs);
                            
                            if (target) {
                                const targetEl = document.querySelector(target);
                                if (targetEl) {
                                    targetEl.innerHTML = result.replace(/\n/g, '<br>');
                                }
                            }
                            
                            if (el.getAttribute('data-output-self') === 'true') {
                                el.innerHTML = result;
                            }
                            
                        } catch (error) {
                            if (target) {
                                const targetEl = document.querySelector(target);
                                if (targetEl) {
                                    targetEl.innerHTML = `<span style="color:#dc3545">${error.message}</span>`;
                                }
                            }
                        } finally {
                            if (el.getAttribute('data-loader') !== 'false') {
                                this.hideButtonLoader(el);
                            }
                            timeout = null;
                        }
                    }, debounce);
                };
                
                el.removeEventListener(eventType, handler);
                el.addEventListener(eventType, handler);
            });
        }

        collectInputs(element) {
            const inputs = {};
            const form = element.closest('[data-python-form]');
            
            if (form) {
                form.querySelectorAll('input, select, textarea').forEach(input => {
                    if (input.name) {
                        let value = input.value;
                        if (input.type === 'number') value = parseFloat(value);
                        if (input.type === 'checkbox') value = input.checked;
                        if (input.type === 'radio' && input.checked) value = input.value;
                        inputs[input.name] = value;
                    }
                });
            }
            
            return inputs;
        }

        observeDOM() {
            const observer = new MutationObserver(() => {
                this.processDOM();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        showLoader() {
            let loader = document.getElementById('pytml-loader');
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'pytml-loader';
                loader.innerHTML = `
                    <div style="position:fixed;bottom:20px;right:20px;background:#007acc;color:white;padding:10px 15px;border-radius:8px;font-family:monospace;font-size:12px;z-index:10000;box-shadow:0 2px 10px rgba(0,0,0,0.2)">
                        🐍 PYTML: Loading Python...
                    </div>
                `;
                document.body.appendChild(loader);
            }
        }

        hideLoader() {
            const loader = document.getElementById('pytml-loader');
            if (loader) loader.remove();
        }

        showButtonLoader(button) {
            const originalText = button.innerHTML;
            button.setAttribute('data-original', originalText);
            button.innerHTML = '⏳ Processing...';
            button.disabled = true;
        }

        hideButtonLoader(button) {
            const original = button.getAttribute('data-original');
            if (original) button.innerHTML = original;
            button.disabled = false;
        }

        showError(message) {
            const error = document.createElement('div');
            error.style.cssText = 'position:fixed;top:20px;right:20px;background:#dc3545;color:white;padding:10px;border-radius:5px;z-index:10000';
            error.textContent = `PYTML Error: ${message}`;
            document.body.appendChild(error);
            setTimeout(() => error.remove(), 5000);
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

        async wait() {
            if (this.ready) return;
            return new Promise(resolve => this.queue.push(resolve));
        }

        getStatus() {
            return { ready: this.ready, version: '3.2.0' };
        }
    }

    // Create global instance
    const pytml = new PYTMLCore();
    global.pytml = pytml;
    
    // Auto-start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => pytml.processDOM());
    } else {
        pytml.processDOM();
    }

})(window);
