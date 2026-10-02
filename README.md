# PYTML - Python in Your Browser
[![Wikidata](https://img.shields.io/badge/Wikidata-Q140185675-006699?logo=wikidata&logoColor=white)](https://www.wikidata.org/wiki/Q140185675)
[![Number of times Pytml used](https://img.shields.io/endpoint?url=https://pytml.vercel.app/api/count)](https://pytml.vercel.app/api/count)
[![Website](https://img.shields.io/badge/🌐%20Website-pytml.js.org-3b82f6?style=for-the-badge&logo=google-chrome&logoColor=white)](https://pytml.js.org/)
[![GitHub stars](https://img.shields.io/badge/⭐%20Star%20on%20GitHub-yellow?style=for-the-badge&logo=github&logoColor=black)](https://github.com/NodeX-AR/Pytml)
[![License](https://img.shields.io/github/license/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/issues)
[![GitHub last commit](https://img.shields.io/github/last-commit/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/commits/main)

**Run Python in your browser with zero configuration — no server, just a script tag.**

Pytml 2.5 is a lightweight JavaScript bridge built on **Pyodide 0.314.0.7**. Write Python inside HTML, interact with ordinary DOM elements, and use the small numbered UI syntax supported by the 2.5 runtime.

---

## Quick Start

Add one line to your HTML:

```html
<script src="https://pytml.vercel.app/pytml.js"></script>
```

Then write Python:

```html
<py>
print("Hello, world!")
name = input("Your name? ")
print(f"Hi {name}!")
</py>
```

## Pytml 2.5 UI Syntax

Inside a `<pyN>` block, Pytml 2.5 recognizes numbered UI tags such as:

```html
<py1>

<btn1>1</btn1>
<btn2>2</btn2>
<txt1>

def show(e):
    print("You clicked a button")

btn1.on("click", show)

</py1>
```

`<btnN>` becomes a real `<button id="btnN">`, while `<inputN>` and `<txtN>` become real text inputs. Python indentation is preserved before the source is passed to Pyodide.

## Normal HTML + Python

Ordinary HTML IDs are available to Python:

```html
<button id="hello">Click me</button>
<p id="result"></p>

<py>
def hello(event):
    result.text = "Hello from Python!"

hello.on("click", hello)
</py>
```

## Packages

Pytml keeps the Pyodide package workflow, including `micropip`:

```python
import micropip
await micropip.install("numpy")

import numpy as np
print(np.mean([1, 2, 3]))
```

Packages available in the Pyodide environment can be used from Pytml, including common scientific packages such as NumPy, pandas and Matplotlib.

## Multiple Programs

`<py1>`, `<py2>`, `<py3>`, and so on are identifiers, not filenames. Blocks with the same identifier belong to the same program:

```html
<py1>
x = 10
</py1>

<py1>
print(x)
</py1>

<py2>
print("Another program")
</py2>
```

## Local Files

Pytml supports local HTML files opened directly with `file://` when the Python code is inline:

```html
<script src="https://pytml.vercel.app/pytml.js"></script>

<py>
print("Hello from a local file!")
</py>
```

No Python web server is required for this case. You can also use a local copy of `pytml.js` with `file://` by changing the script source to `./pytml.js`.

A relative external Python file such as `<py src="app.py">` cannot be fetched from `file://` by normal browser JavaScript because of browser security restrictions; use inline Python or an HTTPS Python source URL for that case.

See `local-file-test.html` for a ready-to-open example.

## Features

- Zero config — one script tag
- Python in HTML
- DOM interaction
- Browser `input()`
- Numbered inline UI controls
- Mouse, pointer, touch, keyboard and scroll events
- Joystick and gamepad helpers
- Canvas, audio and video helpers
- Clipboard, storage, downloads and fullscreen helpers
- Package support through `micropip`
- NumPy, pandas and Matplotlib support through the Pyodide environment
- Privacy-first client-side execution

## Links

Official Website → https://pytml.js.org/

Demos → https://pytml.js.org/demo.html

GitHub → https://github.com/NodeX-AR/Pytml

## License

Pytml is open-source under the Apache 2.0 License.

## Support

**If you find Pytml useful, consider giving it a star on GitHub!**
