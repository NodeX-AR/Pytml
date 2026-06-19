# PYTML - Python in Your Browser

.pytml-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    background: #0c0c0c;
    border: 2px solid #3b82f6;
    padding: 0.6rem 1.2rem;
    border-radius: 0.25rem;
    color: white;
    text-decoration: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 1rem;
    transition: all 0.2s ease;
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
}

.pytml-btn:hover {
    background: #3b82f6;
    color: #050505;
    transform: translateX(4px);
    box-shadow: 0 0 30px rgba(59, 130, 246, 0.3);
}

.pytml-btn svg {
    fill: currentColor;
    flex-shrink: 0;
}

.pytml-btn small {
    font-size: 0.6rem;
    opacity: 0.6;
    font-weight: 400;
    display: block;
    margin-top: -2px;
}

.pytml-btn span {
    font-weight: 700;
    letter-spacing: 0.05em;
}

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
