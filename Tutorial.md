# Pytml 2.5 Tutorial

Pytml combines normal HTML with normal Python. The browser handles the UI; Python handles the logic.

## 1. Hello, Python

```html
<script src="https://pytml.vercel.app/pytml.js"></script>

<py>
print("Hello, world!")
</py>
```

## 2. Use an HTML element from Python

```html
<button id="hello">Hello</button>
<p id="message"></p>

<py>
def click(event):
    message.text = "Hello from Python!"

hello.on("click", click)
</py>
```

Any valid HTML `id` becomes a Python variable when Pytml starts.

## 3. Pytml numbered UI

Pytml 2.5 can put simple UI declarations directly inside a Python block:

```html
<py1>

<btn1>Say hello</btn1>


def hello(event):
    print("Hello!")


btn1.on("click", hello)

</py1>
```

The preprocessor creates the real button before `<py1>` and removes only the `<btn1>` tag from the source sent to Python.

## 4. Inputs

```html
<py1>

<input1>Type your name</input1>
<btn1>Show</btn1>


def show(event):
    print(input1.value)


btn1.on("click", show)

</py1>
```

`<inputN>` creates an `<input id="inputN">`. Its text is used as a convenient placeholder unless an explicit placeholder attribute is supplied.

`<txtN>` is a text-input shortcut.

## 5. Simple calculator

See `examples/calculator.html`. It uses numbered buttons entirely inside `<py1>`:

```html
<py1>
<btn1>1</btn1>
<btn2>2</btn2>
<btn3>3</btn3>
...
</py1>
```

The Python logic stays ordinary Python.

## 6. Multiple programs

`py1`, `py2`, `py3`, etc. are identifiers. They are not filenames.

```html
<py1>
value = 10
</py1>

<py2>
value += 5
</py2>

<py1>
print(value)
</py1>
```

All blocks run in one interpreter state, so variables can be reused between blocks.

## 7. Events

```python
button.on("click", handler)
input_box.on("input", handler)
slider.on("input", handler)
canvas.on("pointermove", handler)
page.on("keydown", handler)
```

Handlers receive a Python event object that behaves like a dictionary.

## 8. Joystick

```python
from pytml import joystick

stick = joystick("stick")


def move(event):
    state.text = f"x={event['joystick_x']:.2f} y={event['joystick_y']:.2f}"


stick.on("joystickmove", move)
```

## 9. Packages

```python
import micropip
await micropip.install("numpy")
```

Then import the package normally:

```python
import numpy as np
print(np.array([1, 2, 3]).mean())
```

## 10. What is coming in v3.0?

Pytml 3.0 will replace the focused 2.5 preprocessor with a full Pytml document compiler while preserving the beginner-first Python + HTML model.
