# Security Policy

## Supported Versions

I recommend to use stable version.

If you want real bugs and errors, then use our beta verion and say us how is it!
```html
<script src="https://cdn.jsdelivr.net/gh/NodeX-AR/Pytml@Beta-Version/pytml.js"></script>
```

| Version | Supported          |
| ------- | ------------------ |
|* 2.5    | :white_check_mark: |
| 2.4     | :white_check_mark: |
| 2.3     | :white_check_mark: |
| 2.2     | :white_check_mark: |
| 2.1     | :white_check_mark: |
| < 2.0   | :x:                |

>*This version is latest and we made it into production. The version is tested on various angles on production itself.

## Security Updates:

- Pytml defaults to using `element.text`, which uses the browser's textContent API. This means it is 100% secure against ***Cross-Site Scripting (XSS) attacks***.
If you must use element.html to render raw HTML, never pass untrusted user input directly into it. Use the built-in `pytml.escape()` helper to sanitize the input first.

## Reporting a Vulnerability

First off Thanks!
You can open a [Issue](https://github.com/nodex-ar/pytml/issues) and report your bugs or if its a security bug the report it on our [security advisory](https://github.com/NodeX-AR/Pytml/security/advisories/new).  
If you are confident about how to fix it then fork this respo, fix the bug then open a pr. We will look after that !
