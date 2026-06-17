#  PYTML - Python in Your Browser

**The easiest way to run Python in HTML. No server. No backend. Just one line of code.**

## Quick Start

Add one line to your HTML:
 
```html
<script src="https://pytml.vercel.app/pytml.js"></script>
```

## Usage

### Option 1: Inline Python (Recommended for mobile/local)

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://pytml.vercel.app/pytml.js"></script>
</head>
<body>
    <py>
print("Hello, world!")
name = input("Your name? ")
print(f"Hi {name}!")
    </py>
</body>
</html>
```

### Option 2: External Python File (HTTP/HTTPS only)

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

## ⚠️ Important for Local Users (file:// protocol)

If you're running HTML locally from your device (mobile or desktop):

- **Use inline `<py>` tags** — This is the only method that works with `file://` protocol
- **External `<script src="file.py">` won't work** — Browser security restrictions prevent loading local files this way
- **Solution**: Copy your Python code directly into `<py>` tags in your HTML

**Example for mobile/local:**
```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://pytml.vercel.app/pytml.js"></script>
</head>
<body>
    <py>
# Your Python code here
print("This works on mobile!")
    </py>
</body>
</html>
```

**pytml.js itself is always loaded from the CDN** — You only need:
- Your HTML file
- Your Python code (either inline or in external `.py` files served over HTTP/HTTPS)

