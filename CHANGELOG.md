# Pytml 2.5.1

- Supports inline Python on `file://` pages while keeping Pyodide on HTTPS.
- Loads Pyodide only when a page contains Python blocks.
- Gives a clear error for relative local Python `src` files under `file://`.
- Improves async callbacks, timer handling, and HTML escaping.

Changelog

## 2.5.1 — 2026-10-19

- Added inline Python support for `file://` pages and clearer errors for local Python `src` files.
- Avoided loading Pyodide on pages without Python blocks.
- Improved async callbacks, timer handling, and HTML escaping.

## 2.5.0 — 2026-10-02

- Kept Pyodide 314.0.7 as the runtime.
- Added numbered `<pyN>` block discovery.
- Added inline `<btnN>`, `<inputN>` and `<txtN>` preprocessing.
- Added DOM and browser interaction helpers.
- Kept the public `https://pytml.vercel.app/pytml.js` script URL.
- Updated demos to use the public HTTPS runtime.
- Added a local-file example.
- Kept original bot/API and repository support files.
- The full Pytml compiler remains planned for v3.0.
