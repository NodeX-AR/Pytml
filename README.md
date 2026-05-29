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
# CSS
Class Name	Purpose
.pytml-output	Main output container
.pytml-input-container	Input form wrapper
.pytml-prompt	Input prompt text
.pytml-input	Text input field
.pytml-submit	Submit button
.pytml-line	Regular output line
.pytml-user-input	User input display
.pytml-error	Error messages
.pytml-success	Success messages
.pytml-border	Border or separator lines
.pytml-status	Status message
.pytml-status-error	Error status
.pytml-status-hidden	Hidden status
