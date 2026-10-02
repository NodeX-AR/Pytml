---
title: 'Pytml: Running Python in the Browser Using Pyodide'
tags:
  - Python
  - JavaScript
  - WebAssembly
  - Education
  - Pyodide
authors:
  - name: Aswanth R
    orcid: 0009-0007-1619-374X
    affiliation: 1
affiliations:
 - name: Independent Researcher
   index: 1
date: 21 June 2026
bibliography: paper.bib
---

# Summary

Pytml is an open-source JavaScript library that enables developers to embed and execute Python code directly inside HTML web pages. It uses Pyodide—a port of CPython to WebAssembly—to run Python entirely in the browser without requiring a backend server (Pyodide, 2026).

The library allows Python to be written directly in HTML using either `<py>` tags or `<script type="text/python">` elements. Pytml automatically handles Pyodide initialization, captures Python's standard output and input streams, and renders them in the browser's DOM, providing a seamless experience for developers (NodeX-AR, 2026).

# Statement of Need

Embedding Python in web pages traditionally requires manual loading of Pyodide, creating output containers, binding events, and converting data types—often requiring 10 or more lines of JavaScript boilerplate code for a simple "print hello" example. Pytml reduces this to a single HTML tag, making Python-in-the-browser accessible to educators, students, and developers who may not be familiar with WebAssembly or JavaScript toolchains.

The library is particularly valuable for:
- **Educational settings**: Teachers can embed interactive Python examples directly in course materials
- **Prototyping**: Developers can quickly test Python code in a browser environment
- **Interactive documentation**: Create web pages with live Python code execution

# Use Cases

## Educational Applications
Pytml enables interactive coding exercises for Python education. Students can experiment with code examples directly in their browser without installing Python or configuring a development environment. This lowers the barrier to entry for learning programming.

## Technical Documentation
Technical writers and open-source maintainers can embed executable Python examples in documentation, allowing users to test code snippets immediately.

## State of the field

Several tools exist for running Python in web browsers. Pyodide provides CPython compiled to WebAssembly but requires JavaScript boilerplate for integration. Brython implements Python in JavaScript, offering similar functionality with different tradeoffs. Skulpt provides a lightweight Python-in-JavaScript implementation suitable for educational contexts. Pytml differs by providing a zero-boilerplate wrapper around Pyodide that handles DOM I/O automatically.

## Software design

Pytml is a JavaScript library that wraps Pyodide. On page load, it initializes Pyodide from a CDN, redirects Python's print() and input() to DOM elements, scans for `<py>` tags, and executes Python code in the browser. It transforms blocking input() calls into async JavaScript Promises.

## Research impact

Pytml enables educational Python use on any device with a browser, removing infrastructure barriers in resource-constrained environments. It supports rapid prototyping and interactive documentation.

## AI usage disclosure

GitHub Copilot was used as a coding assistant during the development of Pytml. The AI provided code comments and suggestions, particularly for boilerplate code and for official website. All code was reviewed, tested, and validated by the author before integration. No AI tools were used in the writing of this paper or its supporting documentation.

## Rapid Prototyping
Developers can quickly prototype Python-based web applications without setting up a backend server, making it ideal for early-stage development and testing.

# Implementation

Pytml consists of three primary components:

1. **JavaScript Core**: Dynamically loads and initializes Pyodide (CPython compiled to WebAssembly) when the page loads. The core handles version management and ensures a single instance of Pyodide is shared across all Python blocks on the page (Drake, 2025).

2. **Custom Parser**: Scans the HTML document for `<py>` tags and `<script type="text/python">` elements, extracting Python code for execution.

3. **I/O Bridging Layer**: Intercepts Python's `sys.stdout` and `sys.stdin` streams and redirects them to DOM elements, enabling `print()` and `input()` to work natively in the browser.

The library is distributed under the Apache License 2.0 and is available on GitHub (NodeX-AR, 2026). It has been released with persistent identifiers via Zenodo (10.5281/zenodo.20772922) and Software Heritage (swh:1:dir:f92a1f52bf3898ba006e009e4cbde4d9c40b9d73).

# Limitations and Future Work

While Pytml simplifies Python execution in the browser, it has some limitations:
- **Large initial download**: Pyodide is approximately 6–7 MB, making Pytml unsuitable for lightweight pages
- **Startup latency**: First execution can take several seconds while WebAssembly initializes
- **Limited library support**: Only pure-Python packages are supported; C-extensions must be recompiled to WebAssembly

Future development plans include:
- Replacing Pyodide with a custom WebAssembly-compiled Python interpreter for faster loading
- Support for scientific Python packages such as NumPy and Matplotlib
- Enhanced debugging and error reporting capabilities

# Acknowledgements

The author acknowledges the Pyodide project (Drake, 2025) for making Python-in-the-browser possible.

# References

Pyodide. (2026). Pyodide: Python in the browser. Retrieved from https://pyodide.org

NodeX-AR. (2026). Pytml GitHub repository. Retrieved from https://github.com/NodeX-AR/Pytml

Drake, M. (2025). Pyodide: Bringing the scientific Python stack to the browser. *Journal of Open Source Software*, 10(108), 7890. https://doi.org/10.21105/joss.07890
