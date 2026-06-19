# PYTML - Python in Your Browser

[![Pytml](https://img.shields.io/badge/Pytml-Python%20in%20Browser-3b82f6?logo=python&logoColor=white)](https://pytml.js.org)

[![GitHub stars](https://img.shields.io/github/stars/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/stargazers)
[![License](https://img.shields.io/github/license/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/issues)
[![GitHub last commit](https://img.shields.io/github/last-commit/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/commits/main)

**Run Python in your browser with zero configuration – no server, just a script tag.**

Pytml is a lightweight (~15KB) JavaScript library that acts as a bridge between Python and HTML via WebAssembly. Drop a single script tag into any static page, write your logic inside `<py>` tags, and it runs natively in the browser.

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
py
name = input("Enter your name: ")
age = input("Enter your age: ")
print(f"Hello {name}, you are {age} years old!")
```
## Important for Local Users (file:// protocol)
If you're running HTML locally from your device (mobile or desktop):

Use inline <py> tags — This is the only method that works with file:// protocol

## Features
Zero config – just add one script tag

Real I/O – print() and input() work live in the browser

Full error tracebacks – debug like a local REPL

Package support – NumPy, Pandas, Matplotlib via micropip

Privacy-first – no code ever leaves your browser

15KB wrapper – Pyodide loads lazily, page isn't blocked

## Links
[Official Website](https://pytml.js.org)


## License
Pytml is open-source under the Apache 2.0 License.

## Support
**If you find Pytml useful, consider giving it a star on GitHub!**
