# Packages

Pytml 2.5 keeps Pyodide's package environment and `micropip` workflow.

```python
import micropip
await micropip.install("numpy")
```

Examples in this repository cover NumPy, pandas and Matplotlib. Native-extension packages must have a compatible WebAssembly build available to the Pyodide environment.
