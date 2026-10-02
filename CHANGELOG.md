# Pytml 2.5.0

- Supports inline Pytml from `file://` pages.
- Keeps HTTPS runtime loading through the public `pytml.js` URL.
- Gives a clear error for relative local Python `src` files under `file://`.

Changelog

## 2.5.0 — 2026-10-02

- Kept Pyodide 0.314.0.7 as the runtime.
- Added numbered `<pyN>` block discovery.
- Added inline `<btnN>`, `<inputN>` and `<txtN>` preprocessing.
- Added DOM and browser interaction helpers.
- Kept the public `https://pytml.vercel.app/pytml.js` script URL.
- Updated demos to use the public HTTPS runtime.
- Added a local-file example.
- Kept original bot/API and repository support files.
- The full Pytml compiler remains planned for v3.0.
