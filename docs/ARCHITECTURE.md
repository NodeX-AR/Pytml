# Pytml 2.5 Architecture

Pytml 2.5 is a runtime plus a lightweight inline UI preprocessor.

```text
HTML document
    |
    +-- normal HTML/CSS
    |
    +-- <py>, <py1>, <py2>, ...
             |
             v
      inline UI preprocessor
             |
             +-- <btnN>   -> <button id="btnN">
             +-- <inputN> -> <input id="inputN">
             +-- <txtN>   -> <input id="txtN" type="text">
             |
             +-- preserve every remaining text node
             |
             v
          Python source
             |
             v
           Pyodide
             |
             v
        DOM/event bridge
```

## Why the preprocessor is DOM-based

`Element.textContent` cannot identify `<btn1>` because the browser has already parsed that tag into a DOM element. Pytml therefore walks the block's child nodes:

- text nodes are appended directly to the Python source;
- recognized inline UI elements are converted into real DOM elements and omitted from the Python source;
- other element nodes are traversed recursively so their text remains available.

This preserves Python indentation instead of serializing the source through an HTML string or an AST round-trip.

## Program identifiers

A tag name matching `^py(?:\\d+)?$` is treated as a Python program identifier. Multiple blocks with the same identifier share the same Pyodide global namespace because Pytml executes them sequentially in the same interpreter.

## Runtime foundation

Pytml 2.5 uses Pyodide `0.314.0.7` as its Python/WebAssembly runtime. The Pytml layer remains independent from PyScript while reusing Pyodide's mature package/runtime ecosystem.

## v3.0 boundary

The 2.5 preprocessor intentionally only recognizes the small numbered UI vocabulary. Full document parsing, richer Pytml syntax, and language tooling are reserved for v3.0.
