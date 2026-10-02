"""Python-side API reference for Pytml 2.5.

The browser distribution provides this module dynamically through Pyodide.
"""

# The authoritative implementation is embedded by pytml.js so a CDN user does
# not need a separate Python package download. This file documents the module
# surface for source builds, editors and contributors.

class Event(dict):
    """Event dictionary; the browser runtime also provides prevent_default()."""
    def prevent_default(self): raise RuntimeError("Use the browser Pytml runtime")
    def stop_propagation(self): raise RuntimeError("Use the browser Pytml runtime")

class Element:  # pragma: no cover - browser implementation lives in pytml.js
    def __init__(self, obj): self._obj = obj

class Joystick(Element):
    pass

async def sleep(ms): raise RuntimeError("Use the browser Pytml runtime")
def element(target): raise RuntimeError("Use the browser Pytml runtime")
def get(target): return element(target)
def query(selector): return element(selector)
def query_all(selector): raise RuntimeError("Use the browser Pytml runtime")
def joystick(target): return element(target)
def timeout(callback, ms): raise RuntimeError("Use the browser Pytml runtime")
def interval(callback, ms): raise RuntimeError("Use the browser Pytml runtime")
def clear_timeout(timer_id): raise RuntimeError("Use the browser Pytml runtime")
def clear_interval(timer_id): raise RuntimeError("Use the browser Pytml runtime")
async def clipboard_copy(text): raise RuntimeError("Use the browser Pytml runtime")
async def clipboard_read(): raise RuntimeError("Use the browser Pytml runtime")
def alert(message): raise RuntimeError("Use the browser Pytml runtime")
def confirm(message): raise RuntimeError("Use the browser Pytml runtime")
def download(data, filename, mime='text/plain;charset=utf-8'): raise RuntimeError("Use the browser Pytml runtime")
def gamepads(): raise RuntimeError("Use the browser Pytml runtime")
def storage_get(key, fallback=None): raise RuntimeError("Use the browser Pytml runtime")
def storage_set(key, value): raise RuntimeError("Use the browser Pytml runtime")
def storage_remove(key): raise RuntimeError("Use the browser Pytml runtime")
def install(requirements, **kwargs):
    import micropip
    return micropip.install(requirements, **kwargs)
