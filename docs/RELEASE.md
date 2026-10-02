# Pytml 2.5 Release Notes

Pytml 2.5 is the bridge release between the original lightweight runtime and the full v3.0 document compiler.

### Included

- Pyodide 0.314.0.7 foundation
- `<py>`, `<py1>`, `<py2>`, ... program identifiers
- inline `<btnN>`, `<inputN>`, `<txtN>` preprocessing
- DOM and browser events
- browser-backed `input()`
- timers, clipboard, storage, downloads and gamepads
- joystick helper
- `micropip` package installation
- updated tutorial and demo gallery

### Deliberately not included

- a full Pytml language parser/compiler
- a replacement Python runtime
- a new package ABI

Those larger changes belong to Pytml 3.0 and can build on the 2.5 runtime contract.
