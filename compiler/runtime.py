"""
Pytml runtime (v3.0.0) - runs inside Pyodide.

Gives beginners a tiny, friendly toolbox that is available in every <py> block
without any import:

    get("id")            find an element         (elements with an id are also plain variables)
    get_all(".class")    find many elements
    input(), pick(...)   ask the user            (look blocking, never freeze the page)
    wait_for(button)     wait for a click / key
    sleep(seconds)       wait
    show(thing)          display a table, a chart, an object
    clear()              empty the output area
"""
import asyncio
import base64
import builtins
import inspect
import io
import keyword
import linecache
import sys

import js
from pyodide.ffi import create_proxy, to_js

import pytml_compiler as C

_UI = js.pytml            # JavaScript helper object (console, input box, pick buttons)
_KEEP = set()             # keeps proxies / tasks alive


def _camel(name):
    if name.startswith("_") or "_" not in name:
        return name
    head, *rest = name.split("_")
    return head + "".join(p[:1].upper() + p[1:] for p in rest)


def _to_js(value):
    if isinstance(value, Element):
        return value._el
    if isinstance(value, (dict, list, tuple, set)):
        return to_js(value, dict_converter=js.Object.fromEntries, create_pyproxies=False)
    return value


def _is_dom(value):
    try:
        return value is not None and hasattr(value, "nodeType")
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Elements
# ---------------------------------------------------------------------------
class Element:
    """A friendly wrapper around an HTML element."""

    _PROPS = {"text", "html", "value", "number", "checked", "disabled", "visible"}

    def __init__(self, el):
        object.__setattr__(self, "_el", el)

    # text / value ---------------------------------------------------------
    @property
    def text(self):
        return self._el.textContent

    @text.setter
    def text(self, v):
        self._el.textContent = str(v)

    @property
    def html(self):
        return self._el.innerHTML

    @html.setter
    def html(self, v):
        self._el.innerHTML = str(v)

    @property
    def value(self):
        return self._el.value

    @value.setter
    def value(self, v):
        self._el.value = str(v)

    @property
    def number(self):
        """The value as an int or float (None when it is not a number)."""
        raw = str(self._el.value).strip()
        try:
            return int(raw)
        except ValueError:
            try:
                return float(raw)
            except ValueError:
                return None

    @number.setter
    def number(self, v):
        self._el.value = str(v)

    @property
    def checked(self):
        return bool(self._el.checked)

    @checked.setter
    def checked(self, v):
        self._el.checked = bool(v)

    @property
    def disabled(self):
        return bool(self._el.disabled)

    @disabled.setter
    def disabled(self, v):
        self._el.disabled = bool(v)

    @property
    def visible(self):
        return not self._el.hidden and self._el.style.display != "none"

    @visible.setter
    def visible(self, v):
        self._el.hidden = False
        self._el.style.display = "" if v else "none"

    # actions --------------------------------------------------------------
    def show(self):
        self.visible = True

    def hide(self):
        self.visible = False

    def toggle(self):
        self.visible = not self.visible

    def clear(self):
        self._el.innerHTML = ""

    def add_class(self, name):
        self._el.classList.add(name)

    def remove_class(self, name):
        self._el.classList.remove(name)

    def toggle_class(self, name):
        self._el.classList.toggle(name)

    def attr(self, name, value=None):
        if value is None:
            return self._el.getAttribute(name)
        self._el.setAttribute(name, str(value))

    def focus(self):
        self._el.focus()

    def on(self, event, handler):
        """Run `handler` whenever `event` ("click", "input", "keydown" ...) happens."""
        _listen(self._el, event, handler)
        return handler

    def on_click(self, handler):
        return self.on("click", handler)

    # anything else goes straight to the browser element --------------------
    def __getattr__(self, name):
        el = object.__getattribute__(self, "_el")
        value = getattr(el, name, None)
        if value is None and "_" in name:
            value = getattr(el, _camel(name), None)
        if value is None:
            raise AttributeError("This element has no '%s'" % name)
        if callable(value) and not _is_dom(value):
            return lambda *a, **k: value(*[_to_js(x) for x in a], *([_to_js(k)] if k else []))
        return Element(value) if _is_dom(value) else value

    def __setattr__(self, name, value):
        if name in Element._PROPS:
            object.__setattr__(self, name, value)
        else:
            el = self._el
            setattr(el, _camel(name) if not hasattr(el, name) else name, _to_js(value))

    def __repr__(self):
        el = self._el
        return "<Element %s%s>" % (str(el.tagName).lower(), "#" + el.id if el.id else "")

    def __eq__(self, other):
        return isinstance(other, Element) and self._el == other._el

    def __hash__(self):
        return hash(self._el.__hash__()) if hasattr(self._el, "__hash__") else id(self._el)


class ElementList(list):
    """Several elements at once: get_all(".digit").on_click(handler)"""

    def on(self, event, handler):
        for e in self:
            e.on(event, handler)
        return handler

    def on_click(self, handler):
        return self.on("click", handler)

    def show(self):
        for e in self:
            e.show()

    def hide(self):
        for e in self:
            e.hide()


class Event:
    """What happened.  `e.text`, `e.value`, `e.id` describe the element it happened to."""

    def __init__(self, ev):
        self._ev = ev
        self._el = Element(ev.currentTarget) if _is_dom(ev.currentTarget) else None

    @property
    def target(self):
        t = self._ev.target
        return Element(t) if _is_dom(t) else None

    @property
    def element(self):
        return self._el or self.target

    @property
    def key(self):
        return self._ev.key

    def prevent_default(self):
        self._ev.preventDefault()

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        try:
            return getattr(self.element, name)
        except AttributeError:
            return getattr(self._ev, name if hasattr(self._ev, name) else _camel(name))

    def __repr__(self):
        return "<Event %s>" % self._ev.type


def _find(selector):
    if isinstance(selector, Element):
        return selector._el
    s = str(selector).strip()
    doc = js.document
    if not s:
        return None
    if s[0] in "#.[:" or any(c in s for c in " >+~*"):
        try:
            return doc.querySelector(s)
        except Exception:
            return None
    return doc.getElementById(s) or doc.querySelector(s.replace("_", "-") if False else s)


def get(selector):
    """Find one element by id (get("name")) or CSS selector (get(".card"))."""
    el = _find(selector)
    if el is None:
        raise LookupError("No element '%s' on this page. Give it an id: <div id=\"%s\">" % (selector, selector))
    return Element(el)


def get_all(selector):
    """Find every element that matches a CSS selector."""
    return ElementList(Element(e) for e in js.document.querySelectorAll(str(selector)))


def _targets(target):
    if isinstance(target, (list, tuple)) and not isinstance(target, Element):
        out = []
        for t in target:
            out.extend(_targets(t))
        return out
    if isinstance(target, Element):
        return [target._el]
    s = str(target)
    found = list(js.document.querySelectorAll(s)) if s[:1] in "#.[:" or any(c in s for c in " >+~*") else []
    if not found:
        el = _find(s)
        if el is not None:
            found = [el]
    if not found:
        raise LookupError("No element '%s' on this page." % target)
    return found


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------
def _accepts_arg(fn):
    try:
        params = inspect.signature(fn).parameters.values()
    except (TypeError, ValueError):
        return True
    return any(p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD, p.VAR_POSITIONAL) for p in params)


def _spawn(awaitable):
    async def guard():
        try:
            await awaitable
        except BaseException as exc:      # noqa: BLE001 - shown to the user
            _report(exc)
    task = asyncio.ensure_future(guard())
    _KEEP.add(task)
    task.add_done_callback(_KEEP.discard)
    return task


def _listen(el, event, handler):
    takes = _accepts_arg(handler)

    def callback(jsevent):
        try:
            result = handler(Event(jsevent)) if takes else handler()
            if inspect.isawaitable(result):
                _spawn(result)
        except BaseException as exc:      # noqa: BLE001
            _report(exc)

    proxy = create_proxy(callback)
    _KEEP.add(proxy)
    el.addEventListener(event, proxy)


async def wait_for(target, event="click"):
    """Wait until `event` happens on `target`; returns the Event.

        which = wait_for(".digit")      # any element with class "digit"
        print(which.text)
    """
    elements = _targets(target)
    future = asyncio.get_event_loop().create_future()
    registered = []

    def callback(jsevent):
        if not future.done():
            future.set_result(Event(jsevent))

    proxy = create_proxy(callback)
    for el in elements:
        el.addEventListener(event, proxy)
        registered.append(el)
    try:
        return await future
    finally:
        for el in registered:
            el.removeEventListener(event, proxy)
        proxy.destroy()


# ---------------------------------------------------------------------------
# Asking the user
# ---------------------------------------------------------------------------
async def input(prompt=""):          # noqa: A001 - intentionally replaces the builtin
    """Ask the user to type something.  Returns the text."""
    return str(await _UI.input(str(prompt)))


async def pick(*options, prompt=""):
    """Show one button per option and return the option the user clicked."""
    if len(options) == 1 and isinstance(options[0], (list, tuple)):
        options = tuple(options[0])
    index = await _UI.pick(str(prompt), to_js([str(o) for o in options]))
    return options[int(index)]


async def sleep(seconds=0):
    """Wait without freezing the page."""
    await asyncio.sleep(seconds)


async def fetch_text(url):
    """Download a text file / web page and return its text."""
    response = await js.fetch(url)
    if not response.ok:
        raise OSError("Could not download %s (HTTP %s)" % (url, response.status))
    return str(await response.text())


async def fetch_json(url):
    """Download JSON and return it as normal Python dicts and lists."""
    response = await js.fetch(url)
    if not response.ok:
        raise OSError("Could not download %s (HTTP %s)" % (url, response.status))
    return (await response.json()).to_py()


async def _pytml_maybe(value):
    return await value if inspect.isawaitable(value) else value


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
class _Out:
    def __init__(self, is_error=False):
        self.is_error = is_error
        self.encoding = "utf-8"

    def write(self, text):
        if text:
            _UI.write(str(text), self.is_error)
        return len(text or "")

    def flush(self):
        pass

    def isatty(self):
        return False


def clear():
    """Empty the output area."""
    _UI.clear()


def show(*things):
    """Display tables (pandas), charts (matplotlib), HTML objects - or plain text."""
    for thing in things:
        fig = thing if hasattr(thing, "savefig") else getattr(thing, "figure", None)
        if hasattr(thing, "_repr_html_"):
            html = thing._repr_html_()
            if html:
                _UI.html(html)
                continue
        if fig is not None and hasattr(fig, "savefig"):
            buf = io.BytesIO()
            fig.savefig(buf, format="png", bbox_inches="tight")
            _UI.image("data:image/png;base64," + base64.b64encode(buf.getvalue()).decode())
            continue
        print(thing)


def alert(message=""):
    js.alert(str(message))


def _report(exc, namespace=None):
    if isinstance(exc, SystemExit):
        return
    _UI.error(C.format_error(exc, namespace if namespace is not None else RUNTIME.G))


# ---------------------------------------------------------------------------
# The runtime itself
# ---------------------------------------------------------------------------
def _setup_matplotlib():
    """Draw charts into the output box: plt.show() and show(fig) both work."""
    try:
        import matplotlib
        matplotlib.use("agg")
        import matplotlib.pyplot as plt
    except Exception:
        return
    if getattr(plt, "_pytml_patched", False):
        return

    def _show(*args, **kwargs):
        for number in plt.get_fignums():
            show(plt.figure(number))
        plt.close("all")

    plt.show = _show
    plt._pytml_patched = True


class Runtime:
    def __init__(self):
        self.prog = C.Program()
        self.order = []
        self.snippets = {}
        self.G = {"__name__": "__main__", "__builtins__": builtins}
        for fn in (get, get_all, wait_for, pick, input, sleep, fetch_text, fetch_json,
                   show, clear, alert, _pytml_maybe, Element):
            self.G[fn.__name__] = fn
        self.G["window"] = js.window
        self.G["document"] = js.document
        sys.stdout = _Out(False)
        sys.stderr = _Out(True)

    # ---- program loading -------------------------------------------------
    def load(self, names, sources):
        """Register all blocks of the page, then analyse them together."""
        for name, source in zip(names, sources):
            self.order.append(name)
            cleaned = self.prog.add_block(name, source)
            self._remember(name, cleaned)
        self.prog.analyze()

    def _remember(self, filename, text):
        linecache.cache["<py %s>" % filename] = (len(text), None, text.splitlines(True), "<py %s>" % filename)

    # ---- running -----------------------------------------------------------
    def sync_ids(self):
        """Every element with an id becomes a variable with that name."""
        for el in js.document.querySelectorAll("[id]"):
            for name in {el.id, el.id.replace("-", "_")}:
                if name.isidentifier() and not keyword.iskeyword(name):
                    old = self.G.get(name)
                    if old is None or isinstance(old, Element):
                        self.G[name] = Element(el)

    async def _prepare(self, name):
        tree = self.prog.trees.get(name)
        if tree is None:
            return
        wanted = C.imports_of(tree)
        if "tensorflow" in wanted:
            await _UI.ensureTF()
            try:                                  # so that tensor.numpy() returns a real NumPy array
                import pyodide_js
                await pyodide_js.loadPackage("numpy")
            except Exception:
                pass
            if "tensorflow" not in sys.modules or not hasattr(sys.modules["tensorflow"], "_PYTML_BRIDGE"):
                import types
                bridge = types.ModuleType("tensorflow")
                exec(compile(str(_UI.tfSource()), "<pytml tensorflow>", "exec"), bridge.__dict__)
                sys.modules["tensorflow"] = bridge
            wanted.discard("tensorflow")
        if wanted:
            try:
                import pyodide_js
                await pyodide_js.loadPackagesFromImports(self.prog.sources[name])
            except Exception:
                pass
            import importlib.util
            for module in sorted(wanted):
                try:
                    found = importlib.util.find_spec(module) is not None
                except Exception:
                    found = True
                if not found:
                    try:
                        import micropip
                        _UI.status("Installing %s ..." % module)
                        await micropip.install(module)
                    except Exception:
                        pass
                    finally:
                        _UI.status("")
        if "matplotlib" in wanted:
            _setup_matplotlib()

    async def _run(self, name, code_factory):
        try:
            await self._prepare(name)
            code = code_factory()
            self.sync_ids()
            result = eval(code, self.G)
            if inspect.isawaitable(result):
                await result
        except BaseException as exc:          # noqa: BLE001 - shown to the user
            _report(exc, self.G)
        finally:
            _UI.refresh()

    def run_block(self, name):
        return asyncio.ensure_future(self._run(name, lambda: self.prog.compile_block(name)))

    def run_attribute(self, event_name, source, jsevent):
        """Run the code of an attribute such as py-click="add_one"."""
        return asyncio.ensure_future(self._run_attribute(event_name, source, jsevent))

    async def _run_attribute(self, event_name, source, jsevent):
        try:
            self.sync_ids()
            self.G["event"] = Event(jsevent)
            text = source.strip()
            fn = self.G.get(text) if text.isidentifier() else None
            if callable(fn) and not isinstance(fn, type):
                result = fn(self.G["event"]) if _accepts_arg(fn) else fn()
            else:
                key = (event_name, text)
                code = self.snippets.get(key)
                if code is None:
                    filename = "py-" + event_name
                    code = self.prog.compile_snippet(filename, text)
                    self._remember(filename, self.prog.sources[filename])
                    self.snippets[key] = code
                result = eval(code, self.G)
            if inspect.isawaitable(result):
                await result
        except BaseException as exc:          # noqa: BLE001
            _report(exc, self.G)
        finally:
            _UI.refresh()


RUNTIME = Runtime()
