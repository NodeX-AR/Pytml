# Pytml 2.5

**Python + HTML, powered by Pyodide.**

Pytml lets you run Python directly from an HTML page and connect Python to real browser elements without adding a JavaScript framework.

## CDN usage

```html
<script src="https://pytml.vercel.app/pytml.js"></script>
```

For local development, use the repository's `./pytml.js`.

## Pytml 2.5 inline UI syntax

Pytml 2.5 adds a lightweight preprocessor for numbered Python blocks. The syntax is intentionally small and keeps normal Python intact.

```html
<div id="display">0</div>

<py1>

number = ""

<btn1>1</btn1>
<btn2>2</btn2>
<btn3>3</btn3>


def press(n):
    global number
    number += str(n)
    display.text = number


btn1.on("click", lambda e: press(1))
btn2.on("click", lambda e: press(2))
btn3.on("click", lambda e: press(3))

</py1>
```

During preprocessing:

1. `<btn1>1</btn1>` becomes a real `<button id="btn1">1</button>`.
2. The generated button is inserted immediately before the `<py1>` element.
3. The custom tag is removed from the Python source.
4. The remaining Python text, including indentation, is passed to Pyodide unchanged.
5. Pytml's existing DOM binding exposes `btn1`, `btn2`, `btn3`, and `display` as Python objects.

Supported inline tags currently include:

- `<btn1>...</btn99>` (and higher numbered IDs)
- `<input1>...</input99>` (text input by default; HTML input attributes are copied)
- `<txt1>...</txt99>` (text-input shortcut)

The numbered IDs must be unique within the document.

See `docs/COMPILER.md` for the preprocessing model and `docs/CONTROLS.md` for the inline control vocabulary.

## Multiple programs

`<py>`, `<py1>`, `<py2>`, `<py3>`, and so on are **program identifiers, not filenames**.

Blocks with the same identifier run in the same Python interpreter state:

```html
<py1>
value = 10
</py1>

<py2>
other = 20
</py2>

<py1>
value += 5
</py1>

<py2>
print(value + other)
</py2>
```

## Browser features

Pytml 2.5 provides Python access to HTML IDs, values, text, HTML, classes, attributes, focus, scrolling, forms, clipboard helpers, storage, timers, gamepads, touch/pointer/mouse/keyboard/wheel events, drag/drop, media controls, and a touch-friendly joystick helper.

## Packages

Pytml uses the Pyodide package environment and `micropip`:

```python
import micropip
await micropip.install("numpy")
```

The package layer is backed by Pyodide's WebAssembly Python distribution. Native-extension packages need compatible WebAssembly wheels.

## Pytml 2.5 vs 3.0

Pytml 2.5 adds a focused inline UI **preprocessor** on top of the existing runtime. It is not a full HTML/Python language compiler.

Pytml 3.0 is planned as the full document compiler and language layer.

## Local development

From the repository root:

```bash
npm run build
npm test
```

A simple local server can be started with Python:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080/`.

## License

Apache-2.0. See `LICENSE`.

## Website

Pytml 2.5 keeps the original Pytml website design as the main `index.html`. The page copy and examples are updated for the 2.5 runtime and inline `<pyN>` UI syntax. The demo gallery is available at `demo.html`.
