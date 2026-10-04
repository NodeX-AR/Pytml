# PYTML - Python in Your Browser
[![Wikidata](https://img.shields.io/badge/Wikidata-Q140185675-006699?logo=wikidata&logoColor=white)](https://www.wikidata.org/wiki/Q140185675)
[![NUmber of times Pytml used](https://img.shields.io/endpoint?url=https://pytml.vercel.app/api/count)](https://pytml.vercel.app/api/count)
[![Website](https://img.shields.io/badge/🌐%20Website-pytml.js.org-3b82f6?style=for-the-badge&logo=google-chrome&logoColor=white)](https://pytml.js.org/)
[![GitHub stars](https://img.shields.io/badge/⭐%20Star%20on%20GitHub-yellow?style=for-the-badge&logo=github&logoColor=black)](https://github.com/NodeX-AR/Pytml)
[![License](https://img.shields.io/github/license/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/issues)
[![GitHub last commit](https://img.shields.io/github/last-commit/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/commits/main)
[![SWH](https://archive.softwareheritage.org/badge/origin/https://github.com/NodeX-AR/Pytml/)](https://archive.softwareheritage.org/browse/origin/?origin_url=https://github.com/NodeX-AR/Pytml)

**Run Python in your browser with zero configuration – no server, just a script tag.**

Pytml is a JavaScript library with its own Python compiler. Drop a single script tag into any static page, write your logic inside `<py>` tags, and it runs natively in the browser – including `input()`, buttons, clicks, NumPy, Pandas, Matplotlib and TensorFlow.js.

> **Version 3.0.0** – new compiler, buttons and clicks, friendly errors, more libraries. Old pages keep working. See [CHANGELOG.md](CHANGELOG.md).

---

##  Quick Start

Add one line to your HTML:

```html
<script src="https://pytml.vercel.app/pytml.js"></script>
```
## Usage
Option 1: Inline Python (Recommended for mobile/local)
```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://pytml.vercel.app/pytml.js"></script>
</head>
<body>
    <py>
print("Hello, world!")
name = input("Your name? ")
print(f"Hi {name}!")
    </py>
</body>
</html>
```
Option 2: External Python File (HTTP/HTTPS only)
```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://pytml.vercel.app/pytml.js"></script>
</head>
<body>
    <script type="text/python" src="script.py"></script>
</body>
</html>
```
```py
name = input("Enter your name: ")
age = input("Enter your age: ")
print(f"Hello {name}, you are {age} years old!")
```

> Python code that contains `<` or `&` (like `if a < b:`) is safest inside `<script type="text/python">`, because the browser reads `<py>` as HTML. Inside `<py>` you can write `&lt;` instead.

## Talking to the page (new in 3.0)
Python stays Python and HTML stays HTML. Only three small ideas are added:

**1. An element with an `id` is a Python variable.**
```html
<input id="name"> <button py-click="hello">Hi</button> <p id="out"></p>
<py>
def hello():
    out.text = "Hello " + name.value
</py>
```

**2. `py-click="function_name"` runs a Python function** (also `py-input`, `py-change`, `py-keydown`, `py-submit` ...). The attribute may hold a short line of Python, like `py-click="count = 0"`.

**3. Waiting functions look like normal code.** Use them anywhere – even inside your own functions:

| You write | What happens |
| --- | --- |
| `input("question")` | text box, returns what the user typed |
| `pick("+", "-", prompt="Operation?")` | one button per option, returns the clicked one |
| `wait_for(".key")` or `wait_for(button)` | waits for a click, returns the event (`e.text`) |
| `sleep(2)` | waits 2 seconds without freezing the page |
| `fetch_text(url)`, `fetch_json(url)` | download a file / JSON |
| `show(table_or_figure)` | display a pandas table or a matplotlib chart |

Element cheat sheet: `.text` `.html` `.value` `.number` `.checked` `.disabled` `.visible` `.show()` `.hide()` `.toggle()` `.clear()` `.add_class("x")` `.on_click(fn)`. Find elements with `get("id")`, `get(".css")`, `get_all(".css")`. Any other browser property also works (`el.scroll_into_view()`).

More: [Tutorial.md](Tutorial.md) and the [examples](examples/) folder.

## Libraries
Pytml runs real CPython (through Pyodide), so `import numpy`, `pandas`, `matplotlib`, `scipy`, `scikit-learn`, `sympy`, `pillow` ... just work – Pytml downloads them when you import them. Other pure-Python packages are installed from PyPI automatically.

`import tensorflow as tf` runs **TensorFlow.js** through a Keras-style bridge (`tf.keras.Sequential`, `Dense`, `compile`, `fit`, `predict`, `tf.constant`, tensor maths). Training happens on the visitor's device. The original Python TensorFlow package cannot run inside a browser, so Pytml does not pretend to – see [examples/tensorflow.html](examples/tensorflow.html).

## How the compiler works
A browser tab can never really "stop and wait", so `input()` cannot simply block. The Pytml compiler reads **every** Python block of the page, finds each function that (directly or through other functions) waits, makes it `async`, and puts `await` where it is called – including across blocks and in methods. The output is standard Python, so every library keeps working, and line numbers in errors are the ones you wrote.

Limits: `__init__` and other special methods cannot wait; generators (`yield`) cannot wait; a `while True:` loop needs a waiting call inside it (like `wait_for`) or the page freezes, as with any infinite loop.

## Important for Local Users (file:// protocol)
If you're running HTML locally from your device (mobile or desktop):

Use inline <py> tags — This is the only method that works with file:// protocol

## Features
Zero config – just add one script tag

Real I/O – print(), input(), pick(), buttons and clicks work live in the browser

Friendly errors – block, line, the code, and a plain-English hint

Package support – NumPy, Pandas, Matplotlib, SciPy, scikit-learn and more load automatically; TensorFlow.js through `import tensorflow`

Privacy-first – no code ever leaves your browser

One file – ~60KB with the compiler; Python loads in the background, page isn't blocked

## Tests
```bash
npm install
npm test      # compiler unit tests + every example, run in a fake browser with real Pyodide
```

## Links
Official Website =>
[Website](https://pytml.js.org)

Official Live Demo =>
[Demo](https://pytml.js.org/demo)

## License
Pytml is open-source under the Apache 2.0 License.

## Support
**If you find Pytml useful, consider giving it a star on GitHub!**
