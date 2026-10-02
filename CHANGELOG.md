# Changelog

## 2.5.0

### Added

- Lightweight inline UI preprocessor for `<pyN>` blocks.
- `<btnN>`, `<inputN>` and `<txtN>` controls, with numbered IDs through 99 explicitly supported and larger numbers accepted.
- Generated controls are inserted immediately before the owning `<pyN>` block.
- Python indentation and non-UI source text are preserved by DOM node walking.
- New calculator demo using only inline numbered buttons inside `<py1>`.
- New counter, form, joystick and package demos.
- Demo gallery linked from the project index.

### Changed

- Documentation now describes the 2.5 inline UI preprocessor instead of saying the feature is entirely deferred to v3.0.
- Local examples use local `pytml.js`; published pages can use the Vercel CDN endpoint.
- Website copy now presents Pytml as Python + HTML with a small beginner UI vocabulary.

### Retained

- Pyodide `0.314.0.7`.
- `micropip` package installation.
- DOM event bridge and browser-backed `input()`.
- Fast preconnect/preload boot path and interactive boot lock.
