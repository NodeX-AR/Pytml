(function(global) {
    'use strict';

    class PYTML {
        constructor() {
            this.variables = {};
            this.ready = true;
            this.init();
        }

        init() {
            console.log('PYTML: Ready!');
            this.processPage();
        }

        // Simple Python interpreter in JavaScript
        evaluatePython(code, inputs = {}) {
            try {
                // Merge inputs with variables
                const vars = { ...this.variables, ...inputs };
                
                // Create variable assignments
                let varDeclarations = '';
                for (const [key, value] of Object.entries(vars)) {
                    if (typeof value === 'string') {
                        varDeclarations += `let ${key} = "${value}";\n`;
                    } else if (typeof value === 'number') {
                        varDeclarations += `let ${key} = ${value};\n`;
                    } else {
                        varDeclarations += `let ${key} = ${JSON.stringify(value)};\n`;
                    }
                }
                
                // Parse and execute Python-like syntax
                let jsCode = varDeclarations;
                let output = '';
                
                // Override console.log to capture output
                const originalLog = console.log;
                console.log = (...args) => {
                    output += args.join(' ') + '\n';
                    originalLog(...args);
                };
                
                // Convert Python code to JavaScript
                let jsLines = [];
                const lines = code.split('\n');
                
                for (let line of lines) {
                    line = line.trim();
                    if (!line) continue;
                    
                    // Handle print statements
                    if (line.startsWith('print(') && line.endsWith(')')) {
                        let content = line.slice(6, -1);
                        jsLines.push(`console.log(${content});`);
                    }
                    // Handle variable assignments
                    else if (line.includes('=') && !line.includes('if') && !line.includes('for') && !line.includes('while')) {
                        jsLines.push(line + ';');
                    }
                    // Handle if statements
                    else if (line.startsWith('if ')) {
                        let condition = line.slice(3);
                        jsLines.push(`if (${condition}) {`);
                    }
                    else if (line === 'else:') {
                        jsLines.push(`} else {`);
                    }
                    else if (line === 'elif') {
                        jsLines.push(`} else if (${line.slice(5, -1)}) {`);
                    }
                    // Handle for loops
                    else if (line.startsWith('for ')) {
                        let forMatch = line.match(/for (\w+) in (.+):/);
                        if (forMatch) {
                            let varName = forMatch[1];
                            let iterable = forMatch[2];
                            jsLines.push(`for (let ${varName} of ${iterable}) {`);
                        }
                    }
                    // Handle while loops
                    else if (line.startsWith('while ')) {
                        let condition = line.slice(6, -1);
                        jsLines.push(`while (${condition}) {`);
                    }
                    // Close braces
                    else if (line === 'end' || line === '}') {
                        jsLines.push(`}`);
                    }
                    // Direct JavaScript execution
                    else {
                        jsLines.push(line);
                    }
                }
                
                jsCode += jsLines.join('\n');
                
                // Execute the converted code
                const execute = new Function(jsCode);
                execute();
                
                // Restore console.log
                console.log = originalLog;
                
                return output;
                
            } catch (error) {
                return `Error: ${error.message}`;
            }
        }

        async run(code, inputs = {}) {
            return this.evaluatePython(code, inputs);
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
                        } else if (el.type === 'checkbox') {
                            value = el.checked;
                        }
                        inputs[el.name] = value;
                    }
                }
            }
            
            return inputs;
        }

        async processPage() {
            // Process data-python-text
            const textElements = document.querySelectorAll('[data-python-text]');
            for (const el of textElements) {
                const code = el.getAttribute('data-python-text');
                const result = this.evaluatePython(`print(${code})`);
                el.textContent = result.trim();
            }
            
            // Process data-python-html
            const htmlElements = document.querySelectorAll('[data-python-html]');
            for (const el of htmlElements) {
                const code = el.getAttribute('data-python-html');
                const result = this.evaluatePython(`print(${code})`);
                el.innerHTML = result.trim();
            }
            
            // Process data-python buttons
            const buttons = document.querySelectorAll('[data-python]');
            for (const btn of buttons) {
                const code = btn.getAttribute('data-python');
                const target = btn.getAttribute('data-target');
                
                btn.addEventListener('click', async () => {
                    const inputs = this.collectInputs(btn);
                    const result = this.evaluatePython(code, inputs);
                    
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
