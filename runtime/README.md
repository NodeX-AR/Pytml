# Pytml Runtime Helpers

This directory contains the Python-side helper module source used by the 2.6 browser runtime.

Pytml 2.6 relies on Pyodide `314.0.7` and injects the `pytml` helper module at startup.

The Game Kit (`pytml.game`, see `docs/GAME_KIT.md`) is embedded in `src/pytml-runtime.js` as a separate Python module that is compiled lazily on first use.
