#  PYTML - Python in Your Browser

**The easiest way to run Python in HTML. No server. No backend. Just one line of code.**

## Quick Start

Add one line to your HTML:
 
```html
<script src="https://pytml.vercel.app/pytml.js"></script>
```
## Example 
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
```
```py
name = input("Enter your name: ")
age = input("Enter your age: ")
print(f"Hello {name}, you are {age} years old!")
```
