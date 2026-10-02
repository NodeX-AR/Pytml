import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile('src/pytml-runtime.js', 'utf8');


test('Pytml pins Pyodide 0.314.0.7', () => {
  assert.match(src, /PYODIDE_VERSION = '0\.314\.0\.7'/);
  assert.match(src, /cdn\.jsdelivr\.net\/pyodide\/v\$\{PYODIDE_VERSION\}\/full/);
});

test('the requested fast boot preloads Pyodide before DOMContentLoaded', () => {
  assert.match(src, /preconnect\(\);/);
  assert.match(src, /preloadPyodideScript\(\);/);
  assert.match(src, /pyodide\.asm\.wasm/);
  assert.match(src, /script\.async = true/);
});

test('boot locks interactive controls while Python loads', () => {
  assert.match(src, /html\.pytml-booting button/);
  assert.match(src, /html\.pytml-booting input/);
  assert.match(src, /pytml-boot-pill/);
  assert.match(src, /Python failed to load\. Refresh to retry/);
});

test('numbered Python blocks and inline UI preprocessor are present', () => {
  assert.match(src, /const PY_BLOCK = \/\^py\(\?:\\d\+\)\?\$\/i;/);
  assert.match(src, /const PY_INLINE_UI = \/\^\(btn\|input\|txt\)\(\\d\+\)\$\/i;/);
  assert.match(src, /preprocessPythonBlock\(el\)/);
  assert.match(src, /createElement\(kind === 'btn' \? 'button'/);
  assert.match(src, /insertBefore\(fragment, el\)/);
  assert.match(src, /node\.remove\(\)/);
});

test('inline UI supports btn1 through btn99 and beyond', () => {
  const match = src.match(/const PY_INLINE_UI = (\/[^;]+;)/);
  assert.ok(match);
  assert.match(match[1], /\\d\+/);
});


test('async Python event callbacks are scheduled instead of left as un-awaited coroutines', () => {
  assert.match(src, /inspect\.isawaitable\(result\)/);
  assert.match(src, /asyncio\.ensure_future\(result\)/);
});

test('the UI preprocessor does not use textContent as the source parser', () => {
  assert.match(src, /if \(child\.nodeType === Node\.TEXT_NODE\)/);
  assert.match(src, /code \+= child\.nodeValue \|\| ''/);
  assert.match(src, /code: processed\.code/);
});

test('normal DOM bindings, events, input(), joystick, and micropip remain available', () => {
  for (const token of [
    '_bind_all_dom', 'builtins.input = _pytml_input', 'addEventListener',
    'normalizeEvent', 'joystick', 'gamepads()', 'micropip.install'
  ]) assert.match(src, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('Python AST input transform compiles the AST directly', () => {
  assert.match(src, /ast\.fix_missing_locations\(tree\)/);
  assert.match(src, /compile\(tree, "<pytml>", "exec", flags=ast\.PyCF_ALLOW_TOP_LEVEL_AWAIT\)/);
  assert.doesNotMatch(src, /ast\.unparse\(tree\)/);
});

test('visible output is lazy and no persistent status blob is styled', () => {
  assert.match(src, /createOutputContainer\(\)/);
  assert.doesNotMatch(src, /\.pytml-status\{/);
  assert.doesNotMatch(src, /bottom:16px/);
});

test('calculator uses inline numbered buttons and not ordinary external calculator buttons', async () => {
  const html = await readFile('examples/calculator.html', 'utf8');
  assert.match(html, /<py1>/);
  assert.equal((html.match(/<btn\d+>/g) || []).length, 14);
  assert.doesNotMatch(html, /<button\b/);
  assert.match(html, /btn1\.on\("click"/);
});

test('demo gallery links to multiple runnable demos', async () => {
  const html = await readFile('demo.html', 'utf8');
  for (const page of ['calculator.html', 'counter.html', 'greeting.html', 'joystick.html', 'packages.html']) {
    assert.match(html, new RegExp(`examples/${page}`));
  }
});
