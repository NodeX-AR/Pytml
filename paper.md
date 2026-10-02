# Pytml 2.5: Python + HTML with a Lightweight Inline UI Layer

Pytml 2.5 is a browser-oriented Python runtime layer built on Pyodide. Its goal is to let developers keep normal Python syntax while using HTML as the presentation layer and a small numbered control vocabulary for beginner-friendly interactive examples.

The 2.5 release introduces a DOM-level inline preprocessor for `<py>`, `<py1>`, `<py2>`, and related program tags. Inside a Python block, `<btnN>`, `<inputN>`, and `<txtN>` are recognized as UI declarations. Pytml creates real browser elements with matching IDs immediately before the Python block, removes the UI nodes from the Python source, and preserves the remaining text nodes—including indentation—before execution in Pyodide.

This release intentionally avoids replacing Python with a second language. The larger Pytml document compiler, richer syntax and language tooling remain planned for 3.0.

The runtime retains Pyodide's package environment and `micropip` installation workflow, allowing compatible WebAssembly Python packages such as NumPy, pandas and Matplotlib to be used where available.
