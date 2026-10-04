# Contributing to Pytml

First off, thank you for considering contributing to Pytml! 🎉

The following is a set of guidelines for contributing to this project. These are mostly guidelines, not rules. Use your best judgment.

## How Can I Contribute?

### Reporting Bugs

- Check if the bug has already been reported in [Issues](https://github.com/nodex-ar/pytml/issues).
- If not, open a new issue with a clear title and description.
- Include steps to reproduce, expected behavior, and actual behavior.
- Add screenshots or code snippets if possible.

### Suggesting Enhancements

- Open an issue with the label `enhancement`.
- Explain why this enhancement would be useful to most Pytml users.

### Pull Requests

1. Fork the repository.
2. Create a new branch (`git checkout -b new`).
3. Make your changes. Keep them focused on one thing.
4. Test your changes locally.
5. Commit with a clear message (`git commit -m 'Add some amazing feature'`).
6. Push to your branch (`git push origin new`).
7. Open a Pull Request against the `main` branch.

## Development Setup

1. Clone your fork:
   ```bash
   git clone https://github.com/nodex-ar/pytml.git
   cd pytml

---

## Working on the code (v3)

`pytml.js` is **generated**. Edit the sources in `compiler/` and rebuild:

| File | What it is |
| --- | --- |
| `compiler/compiler.py` | The Pytml compiler: whole-page analysis, `await` insertion, friendly errors (runs in the browser, but is plain Python) |
| `compiler/runtime.py` | `get()`, `input()`, `pick()`, `wait_for()`, `show()`, elements and events |
| `compiler/tfjs_bridge.py` | `import tensorflow` on top of TensorFlow.js |
| `compiler/pytml.src.js` | Loader: finds the tags, loads Pyodide, draws the terminal box |
| `build.cjs` | Glues them into `pytml.js` |

```bash
npm install        # test tools only (pyodide, jsdom, tensorflow.js)
npm run build      # writes pytml.js
npm test           # compiler unit tests + every example in a fake browser
```
