# Pytml 2.5 Inline Compiler/Preprocessor

Pytml 2.5 introduces a deliberately small compiler-like preprocessing pass on top of the existing runtime.

## Input

```html
<py1>

number = ""

<btn1>1</btn1>
<btn2>2</btn2>


def press(value):
    global number
    number += str(value)
    display.text = number


btn1.on("click", lambda e: press(1))
btn2.on("click", lambda e: press(2))

</py1>
```

## Processing

When `findPythonBlocks()` encounters a `<pyN>` element, Pytml walks its DOM child nodes. Recognized UI nodes are:

```text
<btnN>...</btnN>
<inputN>...</inputN>
<txtN>...</txtN>
```

They are converted to real browser controls and inserted immediately before the owning `<pyN>` element.

The source sent to Pyodide contains the remaining text nodes only. No AST conversion is performed on normal Python source by this UI preprocessing pass.

### Mapping

```text
<btnN>Label</btnN>     -> <button id="btnN">Label</button>
<inputN>Hint</inputN>  -> <input id="inputN" type="text" placeholder="Hint">
<txtN>Hint</txtN>      -> <input id="txtN" type="text" placeholder="Hint">
```

Attributes on inline controls are copied where the target element supports them. For example:

```html
<btn1 class="key" disabled>1</btn1>
<input1 type="number" min="0" max="100">Age</input1>
```

## Why DOM walking is used

The browser parses `<btn1>` into an element before JavaScript runs. Calling `textContent` would erase the fact that the tag existed and leave only `1`. Pytml therefore inspects child nodes, removes recognized UI elements, and concatenates the actual text nodes. This is what preserves indentation in Python functions.

## Limits in 2.5

The preprocessor is not a general-purpose Pytml grammar. It intentionally recognizes only the small numbered UI vocabulary. The complete Pytml document compiler and richer syntax are planned for 3.0.
