import { JSDOM } from 'jsdom';
import { loadPyodide } from 'pyodide';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../..');
// Real Pyodide (from the npm devDependency) runs inside jsdom, so these tests execute the
// actual Python, not mocks. Set PYTML_RUNTIME=pytml.min.js to test the minified build.
export const PYODIDE_DIR = path.dirname(fileURLToPath(import.meta.resolve('pyodide'))) + '/';
export const RUNTIME = path.resolve(ROOT, process.env.PYTML_RUNTIME || 'src/pytml-runtime.js');

export function fakeCtx() {
  const calls = [];
  const props = {};
  const ctx = new Proxy({}, {
    get(_, k) {
      if (k === 'then' || typeof k === 'symbol') return undefined;
      if (k === '__calls') return calls;
      if (k === '__props') return props;
      if (k === 'measureText') return (s) => ({ width: String(s).length * 8 });
      if (k in props) return props[k];
      return (...a) => { calls.push([String(k), ...a]); };
    },
    set(_, k, v) { props[k] = v; return true; }
  });
  return ctx;
}

export function fakeAudio(window) {
  const log = [];
  const param = () => ({ value: 0, setValueAtTime: (...a) => log.push(['setValueAtTime', ...a]), linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = (type) => ({ type, connect() {}, start: (...a) => log.push([type + '.start', ...a]), stop() {}, gain: param(), frequency: param(), playbackRate: param(), pan: param(), buffer: null, loop: false, getChannelData: () => new Float32Array(44100) });
  class AC {
    constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'suspended'; this.destination = {}; log.push(['new AudioContext']); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createGain() { return node('gain'); }
    createOscillator() { return node('osc'); }
    createBufferSource() { return node('buf'); }
    createBiquadFilter() { return node('filter'); }
    createStereoPanner() { return node('pan'); }
    createBuffer() { return node('buffer'); }
    decodeAudioData(data, ok) { const b = { duration: 1 }; ok && ok(b); return Promise.resolve(b); }
  }
  window.AudioContext = AC;
  return log;
}

export async function boot({ html = '', waitReady = true, config = null, setup = null, pyodideOpts = null, scriptPrefix = '' } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://game.test/'
  });
  const { window } = dom;
  const env = { dom, window, document: window.document, pads: [null, null, null, null], audioLog: fakeAudio(window), ctxs: [], loadOpts: null };
  window.HTMLCanvasElement.prototype.getContext = function () { if (!this.__ctx) { this.__ctx = fakeCtx(); env.ctxs.push(this.__ctx); } return this.__ctx; };
  Object.defineProperty(window.navigator, 'getGamepads', { value: () => env.pads, configurable: true });
  if (config) window.PytmlConfig = config;
  window.fetch = undefined; delete window.fetch;
  // The Pyodide node build calls the process-wide fetch; make window.fetch an alias of it.
  Object.defineProperty(window, 'fetch', { get: () => globalThis.fetch, set: (v) => { globalThis.fetch = v; }, configurable: true });
  window.loadPyodide = async (opts) => {
    env.loadOpts = opts;
    const extra = pyodideOpts ? pyodideOpts(opts) : {};
    return loadPyodide({ indexURL: PYODIDE_DIR, jsglobals: window, ...extra });
  };
  if (setup) setup(env);
  const src = fs.readFileSync(RUNTIME, 'utf8');
  const ready = new Promise((resolve, reject) => {
    window.document.addEventListener('pytml:ready', () => resolve(), { once: true });
    setTimeout(() => reject(new Error('timeout waiting for pytml:ready. Output: ' + env.output())), 120000);
  });
  env.output = () => (window.document.getElementById('pytml-output')?.textContent || '').trim();
  window.eval(src);
  if (waitReady) await ready;
  env.py = (code) => window.pyodide.runPythonAsync(code);
  env.frames = async (n = 1) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 20)); };
  env.key = (type, code) => window.dispatchEvent(new window.KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
  env.close = () => window.close();
  return env;
}
