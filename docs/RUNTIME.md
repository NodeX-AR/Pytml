# Runtime

Pytml 2.5 uses Pyodide `0.314.0.7`.

The Pytml runtime is responsible for:

- discovering `<pyN>` programs;
- preprocessing numbered inline UI tags;
- binding DOM IDs to Python objects;
- providing browser event helpers;
- wiring Python `input()` to a browser input UI;
- exposing `micropip`;
- keeping the page readable while Python loads.

The Pytml compiler planned for v3.0 is a separate project layer and does not require changes to the Pyodide runtime contract.
