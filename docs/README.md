# Pytml API Reference

When Pyodide loads, Pytml exposes a Python module named `pytml` and binds DOM elements with IDs to Python variables.

## Core Helpers

### `joystick(id)`
Creates a touch-enabled virtual joystick on the element with the given ID.
- Returns an object with `.on("joystickmove", callback)`.
- The callback receives an event with `joystick_x`, `joystick_y`, `magnitude`, and `angle`.

### `interval(callback, ms)`
Runs a Python function repeatedly every `ms` milliseconds without freezing the browser.

### `storage_get(key, fallback=None)`
Retrieves an item from the browser's `localStorage`.

### `storage_set(key, value)`
Saves an item to the browser's `localStorage`.

### `get(id)`
Returns a DOM element wrapper by its ID (use `.text`, `.value`, `.html`, `.style` to interact with it).

## DOM Bindings
Any HTML element with a valid `id` (e.g., `<button id="submit">`) automatically becomes available as a Python variable (`submit`). 
