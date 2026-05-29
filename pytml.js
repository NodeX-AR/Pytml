(function (window) {
  class PYTML {
    constructor() {
      this.output = null;
      this.pyodide = null;
      this.init();
    }

    async init() {
      this.createOutput();

      // Load Pyodide
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";

      script.onload = async () => {
        this.pyodide = await loadPyodide({
          indexURL:
            "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
        });

        window.pyodide = this.pyodide;

        // Inject bridge BEFORE running user code
        await this.setupPythonBridge();

        this.runAllPython();
      };

      document.head.appendChild(script);
    }

    async setupPythonBridge() {
      window.__pytml_input_queue__ = [];

      window.__pytml_request_input__ = async (prompt) => {
        return new Promise((resolve) => {
          const box = this.createInputBox(prompt, resolve);
          this.output.appendChild(box);
        });
      };

      // Python side overrides
      await this.pyodide.runPythonAsync(`
import builtins
import js

async def input(prompt=""):
    return await js.__pytml_request_input__(prompt)

builtins.input = input
`);
    }

    async runAllPython() {
      const scripts = document.querySelectorAll(
        'script[type="text/python"]'
      );

      for (let s of scripts) {
        const code = s.src
          ? await (await fetch(s.src)).text()
          : s.textContent;

        // IMPORTANT: no rewriting, no splitting, no line hacks
        await this.pyodide.runPythonAsync(code);
      }
    }

    createOutput() {
      const div = document.createElement("div");
      div.id = "pytml-output";
      div.style.cssText = `
        background:#0b1020;
        color:#fff;
        padding:15px;
        font-family:monospace;
        border-radius:10px;
        margin:10px;
      `;
      document.body.prepend(div);
      this.output = div;

      // capture print
      window.display = (msg) => {
        const el = document.createElement("div");
        el.textContent = msg;
        this.output.appendChild(el);
      };

      this.pyodideSetupPrintPatch = async (pyodide) => {
        await pyodide.runPythonAsync(`
import sys, js

class Stdout:
    def write(self, x):
        if x.strip():
            js.display(x)

sys.stdout = Stdout()
        `);
      };
    }

    createInputBox(prompt, resolve) {
      const wrap = document.createElement("div");
      wrap.style.margin = "10px 0";

      const label = document.createElement("div");
      label.textContent = prompt;

      const input = document.createElement("input");
      input.style.padding = "8px";

      const btn = document.createElement("button");
      btn.textContent = "OK";

      btn.onclick = () => {
        resolve(input.value);
        wrap.remove();
      };

      wrap.appendChild(label);
      wrap.appendChild(input);
      wrap.appendChild(btn);

      return wrap;
    }
  }

  window.PYTML = PYTML;

  window.addEventListener("DOMContentLoaded", () => {
    window.pytml = new PYTML();
  });
})(window);
