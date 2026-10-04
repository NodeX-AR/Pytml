# How to use Pytml?

Five minutes, no JavaScript needed. Every step has a working file in [`examples/`](examples/).

## Step 1 – Add Pytml to the page
Put this line inside `<head>`:
```html
<script src="https://pytml.vercel.app/pytml.js"></script>
```

## Step 2 – Write Python inside `<py>`
```html
<py>
print("Hello!")
</py>
```
Code inside `<py>` runs from top to bottom when the page opens. If you write several `<py>` blocks they run in order and share their variables and functions. (`<py1>`, `<py2>` ... also work.)

Tip: if your code contains `<` or `&`, use `<script type="text/python"> ... </script>` instead of `<py>`.

## Step 3 – Ask questions
```python
name = input("Your name? ")
age = int(input("Your age? "))      # int() turns text into a number
print(f"{name} will be {age + 1} next year")
```
`input()` shows a text box. For a choice, show buttons:
```python
operation = pick("+", "-", "*", prompt="Which one?")
```
You can use `input()` and `pick()` inside your own functions too – nothing else to learn:
```python
def ask_number(text):
    return int(input(text))

total = ask_number("a? ") + ask_number("b? ")
```
(*example: `examples/calculator.html`, `examples/quiz.html`*)

## Step 4 – Use the page
Give an element an `id` and it becomes a Python variable:
```html
<input id="name">
<button py-click="greet">Greet</button>
<p id="message"></p>

<py>
def greet():
    message.text = "Hello " + name.value
</py>
```
* `py-click="greet"` runs the Python function `greet` when the button is clicked.
* `message.text = ...` changes the text of the paragraph; `name.value` reads the text box.
* Other events: `py-input`, `py-change`, `py-keydown`, `py-keyup`, `py-submit`, `py-dblclick`, `py-mouseover`.
* A short line also works: `<button py-click="count = 0">Reset</button>`.

| Element property | Meaning |
| --- | --- |
| `.text` / `.html` | the text / the HTML inside |
| `.value` / `.number` | what is typed in a box (as text / as a number) |
| `.checked` | a checkbox |
| `.disabled` / `.visible` | switch a control off / hide it |
| `.add_class("x")` `.remove_class("x")` | CSS classes |

(*examples: `counter.html`, `greeting-form.html`*)

## Step 5 – Wait for a click inside your code
```python
while True:
    key = wait_for(".key").text      # wait until any button with class="key" is clicked
    print("you pressed", key)
```
`wait_for(button)` waits for one specific element. `wait_for(box, "keydown")` waits for another event.
(*example: `keypad-calculator.html`*) Use `sleep(1)` to wait one second (*`timer.html`*).

## Step 6 – Use libraries
```python
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 6, 100)
fig, ax = plt.subplots()
ax.plot(x, np.sin(x))
show(fig)                  # puts the chart on the page
```
NumPy, Pandas, Matplotlib, SciPy, scikit-learn, SymPy and many more are downloaded automatically (first time takes a few seconds). `show(table)` displays a pandas table. (*example: `data-science.html`*)

## Step 7 – TensorFlow
```python
import tensorflow as tf
model = tf.keras.Sequential([tf.keras.layers.Dense(1, input_shape=[1])])
model.compile(optimizer="sgd", loss="mse")
model.fit([[0.0], [1.0], [2.0]], [[-1.0], [1.0], [3.0]], epochs=200, verbose=0)
print(model.predict([[10.0]]).tolist())
```
This is TensorFlow.js behind a Keras-style bridge, training on your own device. (*example: `tensorflow.html`*)

## When something goes wrong
Errors appear in the terminal box:
```
Traceback (most recent call last):
  block 1, line 2
    print(y)
NameError: name 'y' is not defined
Hint: 'y' has no value yet. Create it first (name = ...), check the spelling ...
```
*block 1, line 2* = the first `<py>` on the page, second line of code. The other blocks still run.

## Handy limits
* A `while True:` loop must contain `input`, `pick`, `wait_for` or `sleep`, otherwise the page freezes (like any endless loop).
* `__init__` (and other `__special__` methods) cannot wait for the user. Put `input()` in a normal method.
* The first visit downloads about 10 MB of Python; after that the browser keeps it.
