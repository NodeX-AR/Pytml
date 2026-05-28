(function(global) {
    'use strict';

    class PYTML {
        constructor() {
            this.ready = true;
            this.init();
        }

        init() {
            console.log('PYTML: Ready!');
            this.processPage();
        }

        // Simple Python interpreter
        runPython(code, inputs = {}) {
            try {
                let output = '';
                
                // Build variables from inputs
                let varCode = '';
                for (const [key, value] of Object.entries(inputs)) {
                    if (typeof value === 'string') {
                        varCode += `var ${key} = "${value.replace(/"/g, '\\"')}";\n`;
                    } else if (typeof value === 'number') {
                        varCode += `var ${key} = ${value};\n`;
                    } else {
                        varCode += `var ${key} = ${JSON.stringify(value)};\n`;
                    }
                }
                
                // Parse Python-style code to JavaScript
                let jsCode = varCode;
                const lines = code.split('\n');
                
                for (let line of lines) {
                    line = line.trim();
                    if (!line) continue;
                    
                    // Handle print statements
                    if (line.startsWith('print(') && line.endsWith(')')) {
                        let content = line.slice(6, -1);
                        jsCode += `output += ${content} + '\\n';\n`;
                    }
                    // Handle if statements
                    else if (line.startsWith('if ')) {
                        let condition = line.slice(3, -1);
                        jsCode += `if (${condition}) {\n`;
                    }
                    // Handle elif
                    else if (line.startsWith('elif ')) {
                        let condition = line.slice(5, -1);
                        jsCode += `} else if (${condition}) {\n`;
                    }
                    // Handle else
                    else if (line === 'else:') {
                        jsCode += `} else {\n`;
                    }
                    // Handle variable assignments
                    else if (line.includes('=')) {
                        jsCode += line + ';\n';
                    }
                }
                
                // Execute the JavaScript
                const execute = new Function('output', jsCode + 'return output;');
                output = execute(output);
                
                return output || 'No output';
                
            } catch (error) {
                return `Error: ${error.message}`;
            }
        }

        collectInputs(element) {
            const inputs = {};
            const form = element.closest('[data-python-form]');
            
            if (form) {
                const elements = form.querySelectorAll('input, select, textarea');
                for (const el of elements) {
                    if (el.name) {
                        let value = el.value;
                        if (el.type === 'number') {
                            value = parseFloat(value);
                        }
                        inputs[el.name] = value;
                    }
                }
            }
            return inputs;
        }

        processPage() {
            // Handle data-python-text
            const textElements = document.querySelectorAll('[data-python-text]');
            for (const el of textElements) {
                const code = el.getAttribute('data-python-text');
                const result = this.runPython(`print(${code})`);
                if (el) el.textContent = result.trim();
            }
            
            // Handle data-python buttons
            const buttons = document.querySelectorAll('[data-python]');
            for (const btn of buttons) {
                const code = btn.getAttribute('data-python');
                const target = btn.getAttribute('data-target');
                
                btn.addEventListener('click', () => {
                    const inputs = this.collectInputs(btn);
                    const result = this.runPython(code, inputs);
                    
                    if (target) {
                        const targetEl = document.querySelector(target);
                        if (targetEl) {
                            targetEl.textContent = result;
                        }
                    }
                });
            }
        }
    }

    const pytml = new PYTML();
    global.pytml = pytml;

})(window);
