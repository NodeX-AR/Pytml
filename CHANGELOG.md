# Changelog

## 3.0.0
**Pytml now has its own compiler.**
- New: whole-page compiler (`compiler/compiler.py`) – finds every function that waits (`input`, `pick`, `wait_for`, `sleep`, `fetch_*`, also through other functions, methods and across `<py>` blocks) and makes it `async` with `await` inserted automatically. Line numbers are preserved.
- New: HTML elements with an `id` are Python variables (`name.value`, `out.text = "hi"`), plus `get()`, `get_all()` and an `Element` helper class.
- New: `py-click`, `py-input`, `py-change`, `py-keydown`, `py-submit` ... attributes call a Python function or run a short line of Python.
- New: `pick()`, `wait_for()`, `sleep()`, `fetch_text()`, `fetch_json()`, `show()`, `clear()`.
- New: libraries are detected from `import` lines and loaded automatically (Pyodide packages, then PyPI through micropip).
- New: `import tensorflow as tf` → TensorFlow.js through a Keras-style Python bridge.
- New: friendly errors – block, line, code line and a plain-English hint; syntax errors are reported without stopping other blocks.
- New: `<py1>`, `<py2>` ... tags; all blocks share one namespace.
- New: `examples/` (9 pages), `tests/` (compiler unit tests + every example run in a fake browser with real Pyodide), `build.cjs`.
- Changed: `pytml.js` is now generated from `compiler/`. Pyodide pinned to 314.0.7 (Python 3.14).
- Kept: `<py>`, `<script type="text/python" src>`, `print()`, `input()`, `pytml.vercel.app/pytml.js`, the usage counter and the website/docs layout.
- Known limits: `__init__`/special methods and generator functions cannot wait; Python `tensorflow`, `torch` and other native-only libraries cannot run in a browser.

## 2.x
Pyodide-based wrapper: `<py>` tags, `print()`, `input()`, error tracebacks.
