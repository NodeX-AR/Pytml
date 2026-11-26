import { boot, PYODIDE_DIR } from './harness.mjs';
import fs from 'node:fs';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

const BASE = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
const MIME = { '.wasm': 'application/wasm', '.json': 'application/json', '.zip': 'application/zip' };

class FakeCache {
  constructor() { this.map = new Map(); }
  async match(req) { const k = typeof req === 'string' ? req : req.url; const e = this.map.get(k); return e ? new Response(e.body.slice(0), { status: e.status, headers: e.headers }) : undefined; }
  async put(req, res) { const k = typeof req === 'string' ? req : req.url; const body = await res.arrayBuffer(); this.map.set(k, { body, status: res.status, headers: [...res.headers.entries()] }); }
  async keys() { return [...this.map.keys()].map(url => ({ url })); }
}
class FakeCaches {
  constructor() { this.stores = new Map(); this.failOpen = false; }
  async open(n) { if (this.failOpen) throw new DOMException('denied', 'SecurityError'); if (!this.stores.has(n)) this.stores.set(n, new FakeCache()); return this.stores.get(n); }
  async keys() { return [...this.stores.keys()]; }
  async delete(n) { return this.stores.delete(n); }
}

function network() {
  const log = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.href || input.url;
    log.push({ url, method: init?.method || 'GET' });
    if (!url.startsWith(BASE)) return new Response('nope', { status: 404 });
    const file = url.slice(BASE.length).split('?')[0];
    const p = PYODIDE_DIR + file;
    if (!fs.existsSync(p)) return new Response('missing', { status: 404 });
    const ext = file.slice(file.lastIndexOf('.'));
    return new Response(fs.readFileSync(p), { status: 200, headers: { 'content-type': MIME[ext] || 'application/octet-stream' } });
  };
  return log;
}

// Pyodide (node build) reads wasm + asm.mjs from disk; lock + stdlib come through fetch.
const viaFetch = (o) => ({ stdLibURL: o.indexURL + 'python_stdlib.zip' });
const hits = (log, f) => log.filter(e => e.url === BASE + f).length;
const html = `<py1>print("booted", 6*7)</py1>`;
const pillText = [];
const mk = (caches, config) => (e) => {
  e.window.caches = caches; e.window.Response = Response; e.window.DOMException = DOMException;
  const real = e.window.loadPyodide;
  e.window.loadPyodide = (o) => { pillText.push(e.document.querySelector('.pytml-boot-pill')?.textContent || ''); return real(o); };
};

const caches = new FakeCaches();
// an old version cache should be cleaned up
await caches.open('pytml-pyodide-0.0.1');
await caches.open('someone-elses-cache');

// ---- 1. cold boot ----
let log = network();
let env = await boot({ html, setup: mk(caches), pyodideOpts: viaFetch });
ok(env.output().includes('booted 42'), 'cold boot runs Python');
ok(hits(log, 'python_stdlib.zip') === 1, 'cold boot downloads stdlib once');
await new Promise(r => setTimeout(r, 200));
const store = caches.stores.get('pytml-pyodide-314.0.7');
ok(store && store.map.has(BASE + 'python_stdlib.zip'), 'stdlib stored in Cache Storage after first load');
ok(!caches.stores.has('pytml-pyodide-0.0.1'), 'old Pyodide-version cache removed');
ok(caches.stores.has('someone-elses-cache'), 'unrelated caches untouched');
ok(env.window.Pytml.cache.stats.stored >= 1, 'stats.stored counted ' + env.window.Pytml.cache.stats.stored);
ok(env.window.pytml.cacheWarm === false, 'first boot reports cold');
ok(/first visit/.test(pillText.at(-1)), 'cold boot pill explains first-visit download: "' + pillText.at(-1) + '"');
const msg = 'unused';
env.close();

// ---- 2. warm boot (new page, same storage) ----
log = network();
env = await boot({ html, setup: mk(caches), pyodideOpts: viaFetch });
ok(env.output().includes('booted 42'), 'warm boot runs Python from cached bytes');
ok(hits(log, 'python_stdlib.zip') === 0, 'warm boot makes ZERO network requests for cached stdlib');
ok(env.window.Pytml.cache.stats.hits >= 1, 'stats.hits counted ' + env.window.Pytml.cache.stats.hits);
env.close();

// ---- 3. preload() warms all three core files, status() reports ready ----
const c2 = new FakeCaches();
log = network();
env = await boot({ html: '<p>landing page, no python</p>', waitReady: false, setup: mk(c2) });
const done = await env.window.Pytml.cache.preload();
ok(done === true, 'preload() resolves true');
ok(['pyodide-lock.json', 'python_stdlib.zip', 'pyodide.asm.wasm'].every(f => hits(log, f) === 1), 'preload fetched lock, stdlib and wasm');
const st = await env.window.Pytml.cache.status();
ok(st.ready === true && st.entries.length === 3 && st.supported, 'status(): ready with 3 entries');
const wasm = c2.stores.get('pytml-pyodide-314.0.7').map.get(BASE + 'pyodide.asm.wasm');
ok(wasm && wasm.headers.some(([k, v]) => k === 'content-type' && v === 'application/wasm'), 'wasm keeps Content-Type: application/wasm (needed for streaming compile)');
log.length = 0;
const again = await env.window.fetch(BASE + 'pyodide.asm.wasm');
ok(again.headers.get('content-type') === 'application/wasm' && log.length === 0, 'cached wasm served with no network');
ok((await again.arrayBuffer()).byteLength === fs.statSync(PYODIDE_DIR + 'pyodide.asm.wasm').size, 'cached wasm bytes identical to original');
// bypass rules
log.length = 0;
await env.window.fetch(BASE + 'pyodide-lock.json', { method: 'POST' }); 
await env.window.fetch(BASE + 'pyodide-lock.json', { headers: { Range: 'bytes=0-9' } });
await env.window.fetch('https://example.com/other.wasm');
await env.window.fetch(BASE + 'pyodide.asm.mjs');
ok(log.length === 4, 'POST, Range, foreign URLs and .mjs loaders bypass the cache (' + log.length + ' network calls)');
ok(!c2.stores.get('pytml-pyodide-314.0.7').map.has(BASE + 'pyodide.asm.mjs'), '.mjs never stored');
// a failed download is not cached
const before = c2.stores.get('pytml-pyodide-314.0.7').map.size;
await env.window.fetch(BASE + 'not-there.json');
ok(c2.stores.get('pytml-pyodide-314.0.7').map.size === before, '404 responses are not cached');
// clear()
ok(await env.window.Pytml.cache.clear() === true && c2.stores.size === 0, 'clear() deletes Pytml caches');
env.close();

// ---- 4. warm detection drives the boot message ----
const c3 = new FakeCaches();
network();
let e0 = await boot({ html: '<p>x</p>', waitReady: false, setup: mk(c3) });
await e0.window.Pytml.cache.preload(); e0.close();
network();
env = await boot({ html, setup: mk(c3), pyodideOpts: viaFetch });
ok(env.window.pytml.cacheWarm === true, 'cacheWarm=true when all core files are cached');
ok(/from cache/.test(pillText.at(-1)), 'warm boot pill says starting from cache: "' + pillText.at(-1) + '"');
env.close();

// ---- 5. opt-out ----
const c4 = new FakeCaches();
log = network();
env = await boot({ html, setup: mk(c4), config: { cache: false }, pyodideOpts: viaFetch });
ok(env.output().includes('booted 42') && c4.stores.size === 0, 'PytmlConfig {cache:false} -> nothing cached, still boots');
env.close();
const c5 = new FakeCaches();
log = network();
env = await boot({ html, setup: (e) => { mk(c5)(e); }, config: { cache: 'off' }, pyodideOpts: viaFetch });
ok(c5.stores.size === 0, "'off' string also disables");
env.close();

// ---- 6. graceful fallback when Cache Storage is unusable (file://, private mode, sandboxed) ----
const c6 = new FakeCaches(); c6.failOpen = true;
log = network();
env = await boot({ html, setup: mk(c6), pyodideOpts: viaFetch });
ok(env.output().includes('booted 42') && hits(log, 'python_stdlib.zip') === 1, 'caches.open() throwing -> falls back to network, page still works');
env.close();
// no Cache API at all
log = network();
env = await boot({ html, setup: (e) => { e.window.Response = Response; }, pyodideOpts: viaFetch });
ok(env.output().includes('booted 42'), 'no CacheStorage at all -> still works');
ok((await env.window.Pytml.cache.status()).supported === false, 'status().supported=false');
env.close();

// ---- 7. data attributes ----
const c7 = new FakeCaches();
network();
env = await boot({ html, setup: (e) => { mk(c7)(e); }, config: { persist: true }, pyodideOpts: viaFetch, });
env.close();

// ---- 8. data-cache attribute via <script> tag ----
{
  for (const [attr, expectCached] of [['data-cache="off"', false], ['data-cache', true]]) {
    const c = new FakeCaches(); network();
    const e = await boot({ html: html, setup: (en) => {
      mk(c)(en);
      // emulate document.currentScript for the evaluated runtime
      const tag = en.document.createElement('script'); for (const a of attr.split(' ')) { const [k, v] = a.split('='); tag.setAttribute(k, v ? v.replace(/"/g, '') : ''); }
      Object.defineProperty(en.document, 'currentScript', { value: tag, configurable: true });
    }, pyodideOpts: viaFetch });
    await new Promise(r => setTimeout(r, 100));
    ok((c.stores.size > 0) === expectCached, `<script ${attr}> -> cache ${expectCached ? 'on' : 'off'}`);
    e.close();
  }
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
