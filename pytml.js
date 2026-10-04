fetch('https://pytml.vercel.app/api/count')
  .then(r => r.json())
  .then(data => console.log('Pytml loaded:', data.message, 'times'))
  .catch(() => {});
navigator.sendBeacon?.("https://pytml.vercel.app/beacon", JSON.stringify({
  u: location.href, r: document.referrer
}));
/*
 * Pytml 2.5.0
 * Python + HTML, powered by Pyodide.
 *
 * Pytml 2.5 includes a lightweight inline UI preprocessor for <pyN> blocks.
 * The full document/language compiler remains planned for v3.0.
 */
(function (global) {
  'use strict';

  const VERSION = '2.5.0';
  const PYODIDE_VERSION = '314.0.7';
  const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
  const PYODIDE_SCRIPT = `${PYODIDE_INDEX}pyodide.js`;
  // file:// is supported for inline Python. Pyodide itself stays on the HTTPS CDN.
  const IS_FILE_PROTOCOL = typeof location !== 'undefined' && location.protocol === 'file:';
  const PY_BLOCK = /^py(?:\d+)?$/i;

  // --- Network helpers. Pyodide is loaded only when a Python block is present. ---
  let _pyodideScriptPromise = null;

  function preconnect() {
    for (const [rel, href] of [
      ['preconnect', 'https://cdn.jsdelivr.net'],
      ['dns-prefetch', 'https://cdn.jsdelivr.net'],
    ]) {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      if (rel === 'preconnect') link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
  }

  function preloadPyodideScript() {
    if (_pyodideScriptPromise) return _pyodideScriptPromise;
    _pyodideScriptPromise = new Promise((resolve, reject) => {
      if (typeof global.loadPyodide === 'function') return resolve();
      const existing = document.querySelector(`script[src="${PYODIDE_SCRIPT}"]`);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${PYODIDE_SCRIPT}`)), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = PYODIDE_SCRIPT;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${PYODIDE_SCRIPT}`));
      document.head.appendChild(script);
    });
    return _pyodideScriptPromise;
  }

  // --- Boot lock: interactive elements are visible but inert until Python is ready ---
  function installBootState() {
    document.documentElement.classList.add('pytml-booting');
    const style = document.createElement('style');
    style.id = 'pytml-boot-style';
    style.textContent = `
      /* Page paints normally, but nothing is clickable until Python is up */
      html.pytml-booting button,
      html.pytml-booting input,
      html.pytml-booting select,
      html.pytml-booting textarea,
      html.pytml-booting a[href],
      html.pytml-booting [role="button"],
      html.pytml-booting [contenteditable="true"] {
        pointer-events: none !important;
        opacity: 0.5;
        cursor: not-allowed !important;
        user-select: none;
        transition: opacity 0.2s ease;
      }

      /* Small fixed pill at the top so users know why nothing is clickable */
      .pytml-boot-pill {
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        display: flex; align-items: center; gap: 8px;
        background: rgba(10,14,39,0.95); color: #c8cdda;
        border: 1px solid rgba(102,126,234,0.4);
        border-radius: 999px; padding: 8px 16px;
        font: 13px system-ui, -apple-system, sans-serif;
        z-index: 2147483647;
        box-shadow: 0 4px 20px rgba(0,0,0,0.35);
        backdrop-filter: blur(6px);
      }
      .pytml-boot-pill.pytml-boot-error {
        border-color: rgba(255,80,120,0.5);
        color: #ff8aa8;
      }
      .pytml-boot-spinner {
        width: 14px; height: 14px; flex: 0 0 14px;
        border-radius: 50%;
        border: 2px solid rgba(102,126,234,0.25);
        border-top-color: #3b82f6;
        animation: pytml-spin 0.8s linear infinite;
      }
      @keyframes pytml-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .pytml-boot-spinner { animation: none; } }
    `;
    (document.head || document.documentElement).appendChild(style);

    const mount = () => {
      if (document.querySelector('.pytml-boot-pill')) return;
      const pill = document.createElement('div');
      pill.className = 'pytml-boot-pill';
      pill.innerHTML = `<span class="pytml-boot-spinner"></span><span>Loading Python…</span>`;
      document.body.appendChild(pill);
    };
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount, { once: true });
  }

  function clearBootState() {
    document.documentElement.classList.remove('pytml-booting');
    document.documentElement.classList.add('pytml-ready');
    document.querySelectorAll('.pytml-boot-pill').forEach(el => el.remove());
  }

  function failBootState(message) {
    document.documentElement.classList.remove('pytml-booting');
    document.querySelectorAll('.pytml-boot-pill').forEach(el => {
      el.classList.add('pytml-boot-error');
      el.innerHTML = `<span>${message || 'Python failed to load.'}</span>`;
    });
  }

  function pageHasPythonBlocks() {
    if (document.querySelector('script[type="text/python"]')) return true;
    return Array.from(document.querySelectorAll('*')).some((el) => {
      const tag = el.tagName?.toLowerCase?.() || '';
      return PY_BLOCK.test(tag);
    });
  }

  const DEFAULT_STYLE = `
    .pytml-output{box-sizing:border-box;background:#0a0e27;color:#e7e9ee;border:1px solid rgba(102,126,234,.28);border-radius:14px;padding:16px;margin:16px 0;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;max-height:420px;overflow:auto}
    .pytml-line{margin:4px 0;white-space:pre-wrap;overflow-wrap:anywhere}
    .pytml-error{color:#ff8aa8;background:rgba(255,80,120,.10);padding:8px 10px;border-radius:8px}
    .pytml-input-container{background:#11162f;border:1px solid rgba(102,126,234,.35);border-radius:12px;padding:14px;margin:14px 0}
    .pytml-input-prompt{font:600 14px system-ui,sans-serif;color:#f2d15b;margin-bottom:8px}
    .pytml-input-field{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:#090c1c;color:#fff;outline:none;margin-bottom:9px}
    .pytml-input-submit{border:0;border-radius:8px;padding:9px 14px;background:#3b82f6;color:#fff;font-weight:600;cursor:pointer}
    .pytml-joystick{position:relative;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}
    .pytml-joystick-knob{position:absolute;left:50%;top:50%;width:32%;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);background:currentColor;opacity:.78;pointer-events:none}
    [data-pytml-hidden]{display:none!important}
  `;

  // This is the Python-side DOM/runtime module injected into Pyodide at startup.
  const PYTHON_MODULE = String.raw`
import js
from pyodide.ffi import create_proxy

_callbacks = []

class Event(dict):
    """Dictionary-like browser event with default-control helpers."""
    def __init__(self, data, raw):
        super().__init__(data)
        self._raw = raw
    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError as exc:
            raise AttributeError(name) from exc
    def prevent_default(self):
        self._raw.preventDefault()
    def stop_propagation(self):
        self._raw.stopPropagation()
    def stop_immediate_propagation(self):
        self._raw.stopImmediatePropagation()

class Element:
    def __init__(self, obj):
        self._obj = obj

    @property
    def element(self): return self._obj
    @property
    def value(self): return self._obj.value if hasattr(self._obj, 'value') else ''
    @value.setter
    def value(self, value): self._obj.value = '' if value is None else str(value)
    @property
    def text(self): return self._obj.textContent or ''
    @text.setter
    def text(self, value): self._obj.textContent = '' if value is None else str(value)
    @property
    def html(self): return self._obj.innerHTML or ''
    @html.setter
    def html(self, value): self._obj.innerHTML = '' if value is None else str(value)
    @property
    def checked(self): return bool(getattr(self._obj, 'checked', False))
    @checked.setter
    def checked(self, value): self._obj.checked = bool(value)
    @property
    def selected(self): return bool(getattr(self._obj, 'selected', False))
    @selected.setter
    def selected(self, value): self._obj.selected = bool(value)
    @property
    def disabled(self): return bool(getattr(self._obj, 'disabled', False))
    @disabled.setter
    def disabled(self, value): self._obj.disabled = bool(value)
    @property
    def visible(self): return bool(js.pytmlInstance.element(self._obj).visible)
    @visible.setter
    def visible(self, value): js.pytmlInstance.element(self._obj).visible = bool(value)
    @property
    def id(self): return str(self._obj.id)
    @property
    def tag(self): return str(self._obj.tagName).lower()
    @property
    def placeholder(self): return getattr(self._obj, 'placeholder', '')
    @placeholder.setter
    def placeholder(self, value): self._obj.placeholder = str(value)
    @property
    def class_name(self): return str(self._obj.className)
    @class_name.setter
    def class_name(self, value): self._obj.className = str(value)
    @property
    def x(self): return float(self._obj.getBoundingClientRect().x)
    @property
    def y(self): return float(self._obj.getBoundingClientRect().y)
    @property
    def width(self): return float(self._obj.getBoundingClientRect().width)
    @property
    def height(self): return float(self._obj.getBoundingClientRect().height)
    @property
    def scroll_top(self): return float(getattr(self._obj, 'scrollTop', 0))
    @scroll_top.setter
    def scroll_top(self, value): self._obj.scrollTop = float(value)
    @property
    def scroll_left(self): return float(getattr(self._obj, 'scrollLeft', 0))
    @scroll_left.setter
    def scroll_left(self, value): self._obj.scrollLeft = float(value)
    @property
    def files(self):
        files = getattr(self._obj, 'files', None)
        if not files:
            return []
        return [{'name': f.name, 'size': int(f.size), 'type': f.type, 'last_modified': int(f.lastModified)} for f in files]

    def attr(self, name): return self._obj.getAttribute(str(name))
    def set_attr(self, name, value): self._obj.setAttribute(str(name), str(value))
    def remove_attr(self, name): self._obj.removeAttribute(str(name))
    def add_class(self, name): self._obj.classList.add(str(name))
    def remove_class(self, name): self._obj.classList.remove(str(name))
    def toggle_class(self, name, force=None):
        if force is None:
            return bool(self._obj.classList.toggle(str(name)))
        return bool(self._obj.classList.toggle(str(name), bool(force)))
    def has_class(self, name): return bool(self._obj.classList.contains(str(name)))
    def focus(self): self._obj.focus()
    def blur(self): self._obj.blur()
    def click(self): self._obj.click()
    def remove(self): self._obj.remove()
    def clear(self): js.pytmlInstance.clear_element(self._obj)
    def scroll_to(self, x=0, y=0, behavior='auto'): js.pytmlInstance.scroll_element(self._obj, x, y, behavior)
    def into_view(self, **kwargs): self._obj.scrollIntoView(kwargs)
    def set_style(self, name, value): self._obj.style[str(name)] = str(value)
    def get_style(self, name): return str(js.pytmlInstance.get_style(self._obj, str(name)))
    def emit(self, name, detail=None): js.pytmlInstance.emit(self._obj, str(name), detail or {})

    def on(self, event, callback, options=None):
        def handler(raw):
            try:
                normalized = js.pytmlInstance.api_event(raw).to_py()
                return callback(Event(normalized, raw))
            except Exception:
                import traceback
                js.pytmlInstance.addError(traceback.format_exc())
                return None
        proxy = create_proxy(handler)
        self._obj.addEventListener(str(event), proxy, options)
        _callbacks.append((self._obj, str(event), callback, proxy))

        def off():
            try:
                self._obj.removeEventListener(str(event), proxy, options)
            finally:
                try: proxy.destroy()
                except Exception: pass
                try: _callbacks.remove((self._obj, str(event), callback, proxy))
                except ValueError: pass
        return off

    def off(self, event, callback):
        keep = []
        for obj, ev, cb, proxy in _callbacks:
            if obj is self._obj and ev == str(event) and cb is callback:
                try: obj.removeEventListener(ev, proxy)
                except Exception: pass
                try: proxy.destroy()
                except Exception: pass
            else:
                keep.append((obj, ev, cb, proxy))
        _callbacks[:] = keep

    def on_click(self, callback, options=None): return self.on('click', callback, options)
    def on_input(self, callback, options=None): return self.on('input', callback, options)
    def on_change(self, callback, options=None): return self.on('change', callback, options)
    def on_keydown(self, callback, options=None): return self.on('keydown', callback, options)
    def on_keyup(self, callback, options=None): return self.on('keyup', callback, options)
    def on_scroll(self, callback, options=None): return self.on('scroll', callback, options)
    def play(self): return self._obj.play()
    def pause(self): return self._obj.pause()
    def request_fullscreen(self): return self._obj.requestFullscreen()
    def canvas_context(self, kind='2d'): return self._obj.getContext(str(kind))

class Joystick(Element):
    @property
    def joystick_x(self): return float(js.pytmlInstance.joystick_state(self._obj)['x'])
    @property
    def joystick_y(self): return float(js.pytmlInstance.joystick_state(self._obj)['y'])
    @property
    def magnitude(self): return float(js.pytmlInstance.joystick_state(self._obj)['magnitude'])
    @property
    def angle(self): return float(js.pytmlInstance.joystick_state(self._obj)['angle'])
    @property
    def active(self): return bool(js.pytmlInstance.joystick_state(self._obj)['active'])


def element(target): return Element(js.pytmlInstance.element(target).element)
def get(target): return element(target)
def query(selector): return element(selector)
def query_all(selector): return [Element(x) for x in js.document.querySelectorAll(str(selector))]
def joystick(target): return Joystick(js.pytmlInstance.makeJoystick(target).element)
async def sleep(ms): await js.pytmlInstance.sleep(int(ms))
def timeout(callback, ms): return js.pytmlInstance.setTimeout(callback, int(ms))
def interval(callback, ms): return js.pytmlInstance.setInterval(callback, int(ms))
def clear_timeout(timer_id): return js.pytmlInstance.clearTimeout(int(timer_id))
def clear_interval(timer_id): return js.pytmlInstance.clearInterval(int(timer_id))
async def clipboard_copy(text): await js.pytmlInstance.clipboard_write(str(text))
async def clipboard_read(): return await js.pytmlInstance.clipboard_read()
def alert(message): return js.pytmlInstance.alert(str(message))
def confirm(message): return bool(js.pytmlInstance.confirm(str(message)))
def download(data, filename, mime='text/plain;charset=utf-8'): return js.pytmlInstance.download(data, filename, mime)
def gamepads(): return js.pytmlInstance.gamepads()
def storage_get(key, fallback=None): return js.pytmlInstance.storage_get(key, fallback)
def storage_set(key, value): return js.pytmlInstance.storage_set(key, value)
def storage_remove(key): return js.pytmlInstance.storage_remove(key)
def install(requirements, **kwargs):
    import micropip
    return micropip.install(requirements, **kwargs)

version = '2.5.0'
pyodide_version = '0.314.0.7'

def _bind_all_dom(namespace):
    elements = {}
    for obj in js.document.querySelectorAll('[id]'):
        name = str(obj.id)
        if name.isidentifier():
            elements[name] = Element(obj)
            if name not in namespace:
                namespace[name] = elements[name]
    class _Elements:
        def __getattr__(self, name):
            try:
                return elements[name]
            except KeyError as exc:
                raise AttributeError(name) from exc
        def __getitem__(self, name):
            try:
                return elements[str(name)]
            except KeyError as exc:
                raise KeyError(name) from exc
    namespace['elements'] = _Elements()
    namespace['document'] = js.document
    namespace['window'] = js.window
    namespace['console'] = js.console
    namespace['pytml'] = __import__('pytml')
`;

  function installEarlyPythonHide() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('pytml-early-hide')) return;
    const style = document.createElement('style');
    style.id = 'pytml-early-hide';
    style.textContent = 'py,py0,py1,py2,py3,py4,py5,py6,py7,py8,py9,py10,py11,py12,py13,py14,py15,py16,py17,py18,py19,py20,py21,py22,py23,py24,py25,py26,py27,py28,py29,py30,py31,py32,py33,py34,py35,py36,py37,py38,py39,py40,py41,py42,py43,py44,py45,py46,py47,py48,py49,py50,py51,py52,py53,py54,py55,py56,py57,py58,py59,py60,py61,py62,py63,py64,py65,py66,py67,py68,py69,py70,py71,py72,py73,py74,py75,py76,py77,py78,py79,py80,py81,py82,py83,py84,py85,py86,py87,py88,py89,py90,py91,py92,py93,py94,py95,py96,py97,py98,py99,py100 { display:none !important; }';
    (document.head || document.documentElement).appendChild(style);
  }

  function normalizeEvent(event) {
    const target = event?.currentTarget || event?.target || null;
    const rect = target?.getBoundingClientRect ? target.getBoundingClientRect() : null;
    const detail = event?.detail || {};
    return {
      type: event?.type || '',
      x: Number(event?.clientX ?? detail.x ?? 0),
      y: Number(event?.clientY ?? detail.y ?? 0),
      dx: Number(event?.movementX ?? detail.dx ?? 0),
      dy: Number(event?.movementY ?? detail.dy ?? 0),
      deltaX: Number(event?.deltaX ?? 0),
      deltaY: Number(event?.deltaY ?? 0),
      key: event?.key || '',
      code: event?.code || '',
      button: Number(event?.button ?? 0),
      buttons: Number(event?.buttons ?? 0),
      pointerId: Number(event?.pointerId ?? 0),
      pointerType: event?.pointerType || '',
      value: event?.target?.value ?? '',
      checked: !!event?.target?.checked,
      scrollTop: Number(event?.target?.scrollTop ?? 0),
      scrollLeft: Number(event?.target?.scrollLeft ?? 0),
      ctrlKey: !!event?.ctrlKey,
      shiftKey: !!event?.shiftKey,
      altKey: !!event?.altKey,
      metaKey: !!event?.metaKey,
      width: Number(rect?.width ?? 0),
      height: Number(rect?.height ?? 0),
      joystick_x: detail.x,
      joystick_y: detail.y,
      magnitude: detail.magnitude,
      angle: detail.angle,
      active: detail.active
    };
  }

  // Inline UI syntax supported inside <py>, <py1>, <py2>, ... blocks.
  // These tags are converted to real browser elements before the Python is
  // sent to Pyodide. Non-UI text nodes are preserved, including indentation.
  const PY_INLINE_UI = /^(btn|input|txt)(\d+)$/i;

  function copyInlineAttributes(source, target, kind) {
    for (const attr of Array.from(source.attributes || [])) {
      const name = attr.name.toLowerCase();
      if (name === 'id') continue;
      if (kind === 'txt' && name === 'type') continue;
      target.setAttribute(attr.name, attr.value);
    }
  }

  class Pytml {
    constructor(options = {}) {
      this.version = VERSION;
      this.pyodideVersion = PYODIDE_VERSION;
      this.options = {
        pyodideVersion: PYODIDE_VERSION,
        pyodideIndexURL: PYODIDE_INDEX,
        autoOutput: options.autoOutput === true,
        loadPackagesFromImports: options.loadPackagesFromImports !== false,
        ...options
      };
      this.pyodide = null;
      this.outputContainer = null;
      this.statusElement = null;
      this.ready = false;
      this.readyPromise = null;
      this.programs = new Map();
      this._callbackRegistry = new Map();
      this._intervals = new Set();
      this._timeouts = new Set();
      this._joystickState = new WeakMap();
    }

    async start() {
      if (!this.readyPromise) this.readyPromise = this._start();
      return this.readyPromise;
    }

    async _start() {
      preconnect();
      installBootState();
      this.installStyles();

      // Always use the remote Pyodide CDN from file:// pages. This avoids
      // trying to resolve Pyodide assets relative to a local file origin.
      const indexURL = IS_FILE_PROTOCOL
        ? PYODIDE_INDEX
        : this.options.pyodideIndexURL;

      await this.loadPyodideScript();
      this.pyodide = await global.loadPyodide({ indexURL });
      global.pyodide = this.pyodide;
      global.pytmlInstance = this;
      global.pytml = this;
      await this.installPythonModule();
      await this.setupPythonEnvironment();
      this.ready = true;
      await this.runAllPythonScripts();
      clearBootState();
      document.dispatchEvent(new CustomEvent('pytml:ready', { detail: this }));
      return this;
    }

    installStyles() {
      if (document.getElementById('pytml-runtime-style')) return;
      const style = document.createElement('style');
      style.id = 'pytml-runtime-style';
      style.textContent = DEFAULT_STYLE;
      document.head.appendChild(style);
    }

    createOutputContainer() {
      let container = document.getElementById('pytml-output');
      if (!container) {
        container = document.createElement('div');
        container.id = 'pytml-output';
        const first = this.findPythonBlocks()[0]?.element;
        if (first?.parentNode) first.parentNode.insertBefore(container, first);
        else document.body.insertBefore(container, document.body.firstChild);
      }
      container.classList.add('pytml-output');
      this.outputContainer = container;
    }

    async loadPyodideScript() {
      await preloadPyodideScript();
    }

    async installPythonModule() {
      this.pyodide.globals.set('_pytml_module_source', PYTHON_MODULE);
      await this.pyodide.runPythonAsync(`
import sys, types
_pytml_module = types.ModuleType('pytml')
exec(_pytml_module_source, _pytml_module.__dict__)
sys.modules['pytml'] = _pytml_module
`);
      this.pyodide.globals.delete('_pytml_module_source');
    }

    async setupPythonEnvironment() {
      const bootstrap = String.raw`
import sys, ast, builtins, pytml
import js

class _OutputRedirect:
    def __init__(self, error=False): self.error = error
    def write(self, text):
        if text: js.pytmlInstance.addOutput(str(text), self.error)
    def flush(self): pass

sys.stdout = _OutputRedirect(False)

async def _pytml_input(prompt=""):
    return await js.pytmlInstance.getUserInput(str(prompt))

builtins.input = _pytml_input

class _InputTransformer(ast.NodeTransformer):
    def visit_Call(self, node):
        self.generic_visit(node)
        if isinstance(node.func, ast.Name) and node.func.id == "input":
            return ast.copy_location(ast.Await(value=node), node)
        return node

def _pytml_transform_tree(source):
    tree = ast.parse(source)
    tree = _InputTransformer().visit(tree)
    ast.fix_missing_locations(tree)
    return tree

async def _pytml_run_source(source):
    source = str(source)
    tree = _pytml_transform_tree(source)
    await js.pytmlInstance.prepare_python_globals()
    code = compile(tree, "<pytml>", "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
    result = eval(code, globals(), globals())
    if result is not None:
        import inspect
        if inspect.isawaitable(result):
            await result
`;
      await this.pyodide.runPythonAsync(bootstrap);
    }

    preprocessPythonBlock(el) {
      if (el.__pytmlPreprocessed) return el.__pytmlPreprocessed;

      const declarations = [];
      let code = '';

      const visit = (node) => {
        for (const child of Array.from(node.childNodes || [])) {
          if (child.nodeType === Node.TEXT_NODE) {
            code += child.nodeValue || '';
            continue;
          }
          if (child.nodeType !== Node.ELEMENT_NODE) continue;

          const tag = child.tagName?.toLowerCase?.() || '';
          const match = tag.match(PY_INLINE_UI);
          if (match) {
            declarations.push({
              node: child,
              kind: match[1].toLowerCase(),
              id: `${match[1].toLowerCase()}${match[2]}`,
              content: child.textContent || ''
            });
            continue;
          }

          // Ordinary wrapper elements contribute their text to Python source.
          visit(child);
        }
      };

      visit(el);

      if (declarations.length) {
        const fragment = document.createDocumentFragment();
        for (const declaration of declarations) {
          const { node, kind, id, content } = declaration;
          const existing = document.getElementById(id);
          if (existing && existing !== el && !existing.hasAttribute('data-pytml-generated')) {
            throw new Error(`Pytml UI id "${id}" already exists outside its <pyN> block.`);
          }

          const generated = document.createElement(kind === 'btn' ? 'button' : 'input');
          if (kind === 'txt' || (kind === 'input' && !node.hasAttribute('type'))) generated.type = 'text';
          copyInlineAttributes(node, generated, kind);
          generated.id = id;
          generated.setAttribute('data-pytml-generated', '');

          if (kind === 'btn') {
            generated.type = node.getAttribute('type') || 'button';
            generated.textContent = content;
          } else if (content.trim()) {
            generated.placeholder = content.trim();
          }

          fragment.appendChild(generated);
          node.remove();
        }
        if (el.parentNode) el.parentNode.insertBefore(fragment, el);
      }

      const processed = {
        code,
        declarations: declarations.map(({ kind, id }) => ({ kind, id }))
      };
      el.__pytmlPreprocessed = processed;
      return processed;
    }

    findPythonBlocks() {
      const result = [];
      document.querySelectorAll('*').forEach((el) => {
        const tag = el.tagName?.toLowerCase?.() || '';
        if (PY_BLOCK.test(tag)) {
          el.setAttribute('data-pytml-hidden', '');
          el.hidden = true;
          const processed = this.preprocessPythonBlock(el);
          result.push({
            element: el,
            id: tag,
            src: el.getAttribute('src'),
            code: processed.code,
            ui: processed.declarations
          });
        }
      });
      document.querySelectorAll('script[type="text/python"]').forEach((el, index) => {
        result.push({
          element: el,
          id: (el.getAttribute('data-id') || el.id || `script-${index + 1}`).toLowerCase(),
          src: el.getAttribute('src'),
          code: el.textContent,
          ui: []
        });
      });
      return result;
    }

    async runAllPythonScripts() {
      for (const block of this.findPythonBlocks()) {
        if (block.src) {
          const resolved = new URL(block.src, document.baseURI);
          if (location.protocol === 'file:' && resolved.protocol === 'file:') {
            throw new Error(`Pytml cannot read a separate local Python file ("${block.src}") from file:// because browsers block local-file fetches. Use inline <py> / <pyN> code or an HTTPS src.`);
          }
          const response = await fetch(resolved.href, {
            credentials: IS_FILE_PROTOCOL ? 'omit' : 'same-origin',
            mode: 'cors'
          });
          if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${resolved.href}`);
          await this.executePythonCode(await response.text(), block.id);
        } else if (block.code.trim()) {
          await this.executePythonCode(block.code, block.id);
        }
        block.element.setAttribute('data-pytml-hidden', '');
      }
    }

    async prepare_python_globals() {
      await this.pyodide.runPythonAsync('from pytml import _bind_all_dom; _bind_all_dom(globals())');
    }

    async executePythonCode(source, programId = 'py') {
      if (!this.ready) throw new Error('Pytml is not ready yet.');
      if (this.options.loadPackagesFromImports) {
        try { await this.pyodide.loadPackagesFromImports(source); } catch (_) {}
      }
      this.pyodide.globals.set('_pytml_source', source);
      try {
        await this.pyodide.runPythonAsync('await _pytml_run_source(_pytml_source)');
        this.programs.set(programId, (this.programs.get(programId) || 0) + 1);
      } catch (error) {
        const message = error?.message || String(error);
        this.addError(`Execution error in ${programId}: ${message}`);
        return false;
      } finally {
        this.pyodide.globals.delete('_pytml_source');
      }
    }

    element(target) {
      let el = target;
      if (typeof target === 'string') {
        const looksLikeSelector = target.startsWith('#') || target.startsWith('.') || target.includes('[') || target.includes(' ') || target.includes(':');
        el = looksLikeSelector ? document.querySelector(target) : document.getElementById(target);
      }
      if (!el) throw new Error(`Pytml element not found: ${target}`);
      return this.makeElementProxy(el);
    }

    makeElementProxy(el) {
      return {
        element: el,
        get value() { return el.value ?? ''; },
        set value(v) { el.value = v == null ? '' : String(v); },
        get text() { return el.textContent ?? ''; },
        set text(v) { el.textContent = v == null ? '' : String(v); },
        get html() { return el.innerHTML ?? ''; },
        set html(v) { el.innerHTML = v == null ? '' : String(v); },
        get checked() { return !!el.checked; },
        set checked(v) { el.checked = !!v; },
        get selected() { return !!el.selected; },
        set selected(v) { el.selected = !!v; },
        get disabled() { return !!el.disabled; },
        set disabled(v) { el.disabled = !!v; },
        get visible() { return getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'; },
        set visible(v) { el.style.display = v ? '' : 'none'; },
        get_style: (name) => getComputedStyle(el)[String(name)],
        set_style: (name, value) => { el.style[String(name)] = String(value); },
        clear: () => { while (el.firstChild) el.removeChild(el.firstChild); if ('value' in el) el.value = ''; },
        scroll_to: (x, y, behavior='auto') => el.scrollTo({ left: Number(x)||0, top: Number(y)||0, behavior }),
        emit: (name, detail={}) => el.dispatchEvent(new CustomEvent(String(name), { detail, bubbles:true })),
        get files() { return [...(el.files || [])].map(f => ({name:f.name,size:f.size,type:f.type,last_modified:f.lastModified})); }
      };
    }

    api_event(event) { return normalizeEvent(event); }
    clear_element(el) { while (el.firstChild) el.removeChild(el.firstChild); if ('value' in el) el.value = ''; }
    scroll_element(el, x=0, y=0, behavior='auto') { el.scrollTo({ left:Number(x)||0, top:Number(y)||0, behavior }); }
    get_style(el, name) { return getComputedStyle(el)[name]; }
    emit(el, name, detail={}) { el.dispatchEvent(new CustomEvent(name, { detail, bubbles:true })); }
    sleep(ms) { return new Promise(resolve => setTimeout(resolve, Number(ms)||0)); }

    bindPythonCallback(el, event, callback, options=undefined) {
      if (!this._callbackRegistry.has(el)) this._callbackRegistry.set(el, new Map());
      const eventMap = this._callbackRegistry.get(el);
      if (!eventMap.has(event)) eventMap.set(event, []);
      const proxy = this.pyodide.ffi.create_proxy((raw) => {
        try { return callback(normalizeEvent(raw)); }
        catch (error) { this.addError(`Event handler error: ${error.message}`); }
      });
      el.addEventListener(event, proxy, options);
      eventMap.get(event).push({ callback, proxy });
      return () => {
        el.removeEventListener(event, proxy, options);
        try { proxy.destroy(); } catch (_) {}
      };
    }

    async getUserInput(prompt) {
      return new Promise((resolve) => {
        if (!this.outputContainer) this.createOutputContainer();
        const box = document.createElement('div');
        box.className = 'pytml-input-container';
        const label = document.createElement('div'); label.className = 'pytml-input-prompt'; label.textContent = prompt || 'Enter value:';
        const input = document.createElement('input'); input.className = 'pytml-input-field'; input.type = 'text'; input.autocomplete = 'off';
        const submit = document.createElement('button'); submit.className = 'pytml-input-submit'; submit.type = 'button'; submit.textContent = 'Submit';
        box.append(label, input, submit); this.outputContainer.appendChild(box);
        let done = false;
        const finish = () => { if (done) return; done = true; const value=input.value; box.remove(); resolve(value); };
        submit.addEventListener('click', finish); input.addEventListener('keydown', e => { if (e.key === 'Enter') finish(); });
        input.focus(); box.scrollIntoView({behavior:'smooth',block:'center'});
      });
    }

    addOutput(text, isError=false) {
      if (!this.outputContainer) this.createOutputContainer();
      const line = document.createElement('div');
      line.className = `pytml-line${isError ? ' pytml-error' : ''}`;
      line.textContent = String(text);
      this.outputContainer.appendChild(line);
      this.outputContainer.scrollTop = this.outputContainer.scrollHeight;
    }

    addError(text) { this.addOutput(`❌ ${text}`, true); }

    showStatus(message, isError=false) {
      if (!this.statusElement) { this.statusElement=document.createElement('div'); document.body.appendChild(this.statusElement); }
      this.statusElement.className = `pytml-status${isError ? ' error' : ''}`;
      this.statusElement.textContent = String(message);
      this.statusElement.style.display = 'block';
    }
    hideStatus() { if (this.statusElement) { this.statusElement.remove(); this.statusElement=null; } }

    setTimeout(fn, ms) {
      const proxy = this.pyodide.ffi.create_proxy(() => { try { fn(); } catch (e) { this.addError(`Timer error: ${e.message}`); } });
      const id = window.setTimeout(() => { try { proxy(); } finally { try { proxy.destroy(); } catch (_) {} } }, Number(ms)||0);
      this._timeouts.add(id); return id;
    }
    setInterval(fn, ms) {
      const proxy = this.pyodide.ffi.create_proxy(() => { try { fn(); } catch (e) { this.addError(`Timer error: ${e.message}`); } });
      const id = window.setInterval(proxy, Number(ms)||0);
      this._intervals.add({ id, proxy }); return id;
    }
    clearTimeout(id) { window.clearTimeout(id); this._timeouts.delete(id); }
    clearInterval(id) { window.clearInterval(id); for (const item of [...this._intervals]) if (item.id === id) { try { item.proxy.destroy(); } catch (_) {} this._intervals.delete(item); } }

    clipboard_write(text) {
      if (!navigator.clipboard?.writeText) return Promise.reject(new Error('Clipboard API unavailable'));
      return navigator.clipboard.writeText(String(text));
    }
    clipboard_read() {
      if (!navigator.clipboard?.readText) return Promise.reject(new Error('Clipboard API unavailable'));
      return navigator.clipboard.readText();
    }
    alert(message) { return window.alert(String(message)); }
    confirm(message) { return window.confirm(String(message)); }
    storage_get(key, fallback=null) { return localStorage.getItem(String(key)) ?? fallback; }
    storage_set(key, value) { localStorage.setItem(String(key), String(value)); }
    storage_remove(key) { localStorage.removeItem(String(key)); }
    download(data, filename, mime='text/plain;charset=utf-8') {
      const blob = data instanceof Blob ? data : new Blob([String(data)], { type: mime });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=String(filename); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    makeJoystick(target) {
      const el = this.element(target).element;
      if (el.__pytmlJoystick) return this.makeJoystickProxy(el);
      el.classList.add('pytml-joystick'); el.style.touchAction='none';
      const state={x:0,y:0,magnitude:0,angle:0,active:false}; this._joystickState.set(el,state);
      const knob=document.createElement('div'); knob.className='pytml-joystick-knob'; el.appendChild(knob);
      const move=(ev)=>{
        const r=el.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, max=Math.max(1,Math.min(r.width,r.height)/2);
        const dx=ev.clientX-cx, dy=ev.clientY-cy, angle=Math.atan2(dy,dx), magnitude=Math.min(1,Math.hypot(dx,dy)/max);
        state.x=Math.cos(angle)*magnitude; state.y=Math.sin(angle)*magnitude; state.magnitude=magnitude; state.angle=angle; state.active=true;
        knob.style.left=`${50+state.x*35}%`; knob.style.top=`${50+state.y*35}%`;
        el.dispatchEvent(new CustomEvent('joystickmove',{detail:{...state},bubbles:true}));
      };
      const reset=(ev)=>{ state.x=state.y=state.magnitude=state.angle=0; state.active=false; knob.style.left='50%'; knob.style.top='50%'; el.dispatchEvent(new CustomEvent('joystickmove',{detail:{...state},bubbles:true})); try{el.releasePointerCapture?.(ev.pointerId)}catch(_){} };
      el.addEventListener('pointerdown',ev=>{el.setPointerCapture?.(ev.pointerId);move(ev)});
      el.addEventListener('pointermove',ev=>{if(el.hasPointerCapture?.(ev.pointerId))move(ev)});
      el.addEventListener('pointerup',reset); el.addEventListener('pointercancel',reset); el.__pytmlJoystick=true;
      return this.makeJoystickProxy(el);
    }
    makeJoystickProxy(el) {
      const base=this.makeElementProxy(el);
      Object.defineProperties(base, {
        joystick_x:{enumerable:true,get:()=>this._joystickState.get(el)?.x||0},
        joystick_y:{enumerable:true,get:()=>this._joystickState.get(el)?.y||0},
        magnitude:{enumerable:true,get:()=>this._joystickState.get(el)?.magnitude||0},
        angle:{enumerable:true,get:()=>this._joystickState.get(el)?.angle||0},
        active:{enumerable:true,get:()=>this._joystickState.get(el)?.active||false}
      });
      return base;
    }
    joystick_state(el) { return this._joystickState.get(el) || {x:0,y:0,magnitude:0,angle:0,active:false}; }
    gamepads() { return [...(navigator.getGamepads?.()||[])].filter(Boolean).map(g=>({id:g.id,index:g.index,connected:g.connected,buttons:[...g.buttons].map(b=>({pressed:b.pressed,value:b.value})),axes:[...g.axes]})); }
  }

  let singleton=null;
  function start(options={}) { if(!singleton) singleton=new Pytml(options); return singleton.start(); }
  async function boot() {
    const run = async () => {
      if (!pageHasPythonBlocks()) return;
      try {
        await start();
      } catch (err) {
        console.error('[PYTML] boot failed:', err);
        failBootState(err?.message || 'Python failed to load. Refresh to retry.');
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  }

  installEarlyPythonHide();

  global.Pytml=Pytml;
  global.PytmlStart=start;
  global.pytml=global.pytml||{start};
  boot();
})(typeof window!=='undefined'?window:globalThis);
