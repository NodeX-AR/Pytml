// Test helper: runs a real HTML page through pytml.js using jsdom (a fake browser)
// and the real Pyodide from npm.  No network needed for core Python.
import { JSDOM } from 'jsdom';
import { loadPyodide } from 'pyodide';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pytmlSource = fs.readFileSync(path.join(root, 'pytml.js'), 'utf8');
let shared = null;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getPyodide() {
  if (!shared) shared = await loadPyodide();
  return shared;
}

// Make the jsdom window the global scope, because Python's `js` module is Node's globalThis.
export async function runPage(html, { extraGlobals = {} } = {}) {
  const dom = new JSDOM(html, { url: 'https://example.test/', pretendToBeVisual: true });
  const win = dom.window;
  for (const key of ['document', 'location', 'navigator', 'HTMLElement', 'Node']) {
    Object.defineProperty(globalThis, key, { value: win[key], configurable: true, writable: true });
  }
  globalThis.window = globalThis;
  globalThis.dispatchEvent = () => true;
  globalThis.alert = (m) => { (globalThis.__alerts ||= []).push(String(m)); };
  globalThis.fetch = async (url) => {
    if (String(url).includes('/api/count')) throw new Error('offline');
    const body = globalThis.__fakeFetch && globalThis.__fakeFetch[url];
    if (body === undefined) return { ok: false, status: 404 };
    return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
  };
  Object.assign(globalThis, extraGlobals);
  const pyodide = await getPyodide();
  globalThis.loadPyodide = async () => pyodide;
  globalThis.PYTML_CONFIG = { indexURL: 'unused/' };
  delete globalThis.pytml;
  new Function(pytmlSource).call(globalThis);
  if (win.document.readyState === 'loading') {
    await new Promise((r) => win.document.addEventListener('DOMContentLoaded', r));
  }
  const doc = win.document;
  const api = {
    doc, win,
    text: () => (doc.getElementById('pytml-output') || { textContent: '' }).textContent,
    async until(fn, what = 'condition', ms = 15000) {
      const start = Date.now();
      for (;;) {
        const v = fn();
        if (v) return v;
        if (Date.now() - start > ms) throw new Error('timeout waiting for ' + what + '\nOUTPUT:\n' + api.text());
        await sleep(20);
      }
    },
    async type(text, selector = '.pytml-ask input') {
      const input = await api.until(() => doc.querySelector(selector), 'input box');
      input.value = text;
      input.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    },
    async clickText(label) {
      const b = await api.until(() => [...doc.querySelectorAll('button')].find((x) => x.textContent === label), 'button ' + label);
      b.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    },
    click(el) { el.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); },
    async finished(ms = 15000) { await api.until(() => globalThis.pytml && globalThis.pytml.done, 'page to finish', ms); },
  };
  return api;
}
