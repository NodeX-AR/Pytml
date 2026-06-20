# PYTML - Python in Your Browser

[![Website](https://img.shields.io/badge/🌐%20Website-pytml.js.org-3b82f6?style=for-the-badge&logo=google-chrome&logoColor=white)](https://pytml.js.org/)
[![GitHub stars](https://img.shields.io/badge/⭐%20Star%20on%20GitHub-yellow?style=for-the-badge&logo=github&logoColor=black)](https://github.com/NodeX-AR/Pytml)
[![License](https://img.shields.io/github/license/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/issues)
[![GitHub last commit](https://img.shields.io/github/last-commit/NodeX-AR/Pytml)](https://github.com/NodeX-AR/Pytml/commits/main)
<iframe style="width: 100%; height: 500px; border: 1px solid rgba(0, 0, 0, 0.125);"
        src="https://archive.softwareheritage.org/browse/embed/swh:1:dir:f92a1f52bf3898ba006e009e4cbde4d9c40b9d73;origin=https://github.com/NodeX-AR/Pytml;visit=swh:1:snp:0f6d585670f1398d99b5b4786b9e5c6631f3f117;anchor=swh:1:rev:65d0025c97ebfbd1bf11490ec2994a19486df0f0/">
</iframe>
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
