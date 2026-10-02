# API

## Global objects

Pytml exposes:

```js
window.Pytml
window.PytmlStart
window.pytml
```

A normal page only needs:

```html
<script src="https://pytml.vercel.app/pytml.js"></script>
```

## Python DOM binding

```python
button.text
button.value
button.checked
button.disabled
button.on("click", handler)
```

The runtime also provides helpers from `pytml`, including `joystick`, timers, clipboard, browser storage, downloads and gamepad access.

## Inline UI preprocessor

Recognized inside `<pyN>` blocks:

```text
btnN
inputN
txtN
```

The preprocessor is deliberately small. It creates DOM controls and then removes only those custom UI nodes from the Python source.
