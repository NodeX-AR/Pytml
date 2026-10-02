# How to use Pytml?

Pytml lets you run Python directly in HTML with one script tag.

## 1. Start

```html
<script src="https://pytml.vercel.app/pytml.js"></script>
```

## 2. Write Python

```html
<py>
print("Hello from Pytml!")
</py>
```

## 3. Add HTML controls

```html
<button id="hello">Click me</button>
<p id="output"></p>

<py>
def hello(event):
    output.text = "Python handled the click."

hello.on("click", hello)
</py>
```

## 4. Use numbered Pytml controls

```html
<py1>

<btn1>1</btn1>
<btn2>2</btn2>

number = ""

def press(n):
    global number
    number += str(n)

btn1.on("click", lambda e: press(1))
btn2.on("click", lambda e: press(2))

</py1>
```

## 5. Multiple programs

`py1`, `py2`, and higher numbers are program identifiers. Repeating the same identifier shares that program's state.

See `demo.html` and the `examples/` directory for runnable examples.


### Local `file://` pages

You can open an HTML file directly from your computer and still load Pytml from the public HTTPS URL:

```html
<script src="https://pytml.vercel.app/pytml.js"></script>
```

Inline `<py>` and `<pyN>` programs work in this mode. `local-file-test.html` is a ready-to-open example. A relative Python source file such as `<py src="app.py">` cannot be fetched from `file://` because browsers block normal JavaScript access to local files; use inline Python or an HTTPS source URL instead.
