# Security Policy

## Supported Versions

We recommend using the latest stable release. The beta version contains upcoming features and may have undiscovered bugs.

If you are using the beta version to help us test, you can load it here:
```html
<script src="https://cdn.jsdelivr.net/gh/NodeX-AR/Pytml@Beta-Version/pytml.js"></script>
```

| Version | Supported          |
| ------- | ------------------ |
| 2.5.x   | :white_check_mark: |
| 2.4.x   | :white_check_mark: |
| 2.3.x   | :white_check_mark: |
| 2.2.x   | :white_check_mark: |
| 2.1.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Security Model

Pytml is a client-side library. Because it bridges Python (via Pyodide) to the browser DOM, we take Cross-Site Scripting (XSS) and DOM manipulation vulnerabilities very seriously.

- **Secure by Default:** Pytml defaults to using `element.text`, which maps to the browser's `textContent` API. This makes it mathematically immune to XSS when rendering user input.
- **HTML Rendering:** If you must render raw HTML, use `element.html`. However, **never** pass untrusted user input directly into it. Use the built-in `pytml.escape()` helper to sanitize the input first.

## Scope for Security Researchers

We welcome reports regarding:
- XSS bypasses in the Pytml DOM bridge.
- DOM Clobbering or Prototype Pollution via Python's interaction with HTML elements.
- Denial of Service (DoS) vulnerabilities (e.g., freezing the browser thread via crafted event loops or proxy leaks).

## Reporting a Vulnerability

First off, thank you for helping keep Pytml secure! 

**Please do not report security vulnerabilities through public GitHub Issues.**

Instead, please report them using one of the following methods:

1. **GitHub Security Advisories:** Use the [Private Vulnerability Reporting](https://github.com/NodeX-AR/Pytml/security/advisories/new) tab in the repository. This is the fastest way to get a patch released.
2. **Email:** If you cannot use GitHub, email `admin@a-r.is-a.dev`. 

### What to include in your report:
- A description of the vulnerability.
- Steps to reproduce (a minimal HTML/Python example is best).
- The potential impact.

If you are confident in how to fix it, feel free to fork the repository, apply the patch, and open a Pull Request referencing the vulnerability. We will review it as quickly as possible and credit you in the release notes.
