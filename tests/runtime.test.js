import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { minify } from '../tools/minify.mjs';

const src = await readFile('src/pytml-runtime.js', 'utf8');


test('Pytml is version 2.6.0 and pins Pyodide 314.0.7', () => {
  assert.match(src, /VERSION = '2\.6\.0'/);
  assert.match(src, /^version = '2\.6\.0'$/m);
  assert.match(src, /PYODIDE_VERSION = '314\.0\.7'/);
  assert.match(src, /cdn\.jsdelivr\.net\/pyodide\/v\$\{PYODIDE_VERSION\}\/full/);
});

test('Pyodide boot is deferred until the page contains Python blocks', () => {
  assert.match(src, /preconnect\(\);/);
  assert.match(src, /function pageHasPythonBlocks\(\)/);
  // Without Python blocks nothing boots; the only thing allowed is the opt-in cache preload.
  assert.match(src, /if \(!pageHasPythonBlocks\(\)\) \{[\s\S]*?CONFIG\.preload === true[\s\S]*?return;\s*\}/);
  assert.match(src, /document\.addEventListener\('DOMContentLoaded', run, \{ once: true \}\)/);
  // The wasm is never loaded eagerly: only named in the cache's core-file list.
  const code = src.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
  assert.equal((code.match(/pyodide\.asm\.wasm/g) || []).length, 1);
  assert.match(src, /CORE_FILES = \['pyodide-lock\.json', 'python_stdlib\.zip', 'pyodide\.asm\.wasm'\]/);
  assert.match(src, /script\.async = true/);
});

test('distribution bundles are generated from the runtime source', async () => {
  const minified = minify(src);

  for (const path of ['pytml.js', 'dist/pytml.js']) {
    assert.equal(await readFile(path, 'utf8'), src);
  }
  for (const path of ['pytml.min.js', 'dist/pytml.min.js']) {
    assert.equal(await readFile(path, 'utf8'), minified);
  }
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
  for (const page of ['calculator.html', 'counter.html', 'greeting.html', 'joystick.html', 'packages.html', 'game-starter.html', 'game-space-shooter.html', 'game-gamepad.html', 'game-sound.html', 'game-sprites.html']) {
    assert.match(html, new RegExp(`examples/${page}`));
  }
});


test('minifier keeps Python indentation inside embedded modules', async () => {
  const minified = await readFile('pytml.min.js', 'utf8');
  assert.match(minified, /^class Element:\n    def __init__\(self, obj\):\n        self\._obj = obj$/m);
  assert.match(minified, /^class Canvas\(_pytml\.Element\):\n    """/m);
  assert.doesNotMatch(minified, /^def __init__/m);
});

test('persistent Pyodide cache is wired into boot with safe fallbacks', () => {
  assert.match(src, /const CACHE_PREFIX = 'pytml-pyodide-'/);
  assert.match(src, /caches\.open\(CACHE_NAME\)/);
  assert.match(src, /global\.fetch = async function pytmlCachedFetch/);
  assert.match(src, /installPyodideCache\(indexURL\)/);
  assert.match(src, /\\\.\(mjs\|js\)/); // loader scripts are never intercepted
  assert.match(src, /Pytml\.cache = PytmlCache/);
  for (const method of ['status', 'clear', 'preload', 'persist']) {
    assert.match(src, new RegExp(`async ${method}\\(`));
  }
  for (const flag of ['data-cache', 'data-persist', 'data-preload'].map((s) => s.replace('data-', ''))) {
    assert.ok(src.includes(`['cache', 'persist', 'preload']`) && flag);
  }
});

test('Game Kit is embedded and loaded lazily', () => {
  assert.match(src, /const GAME_MODULE = String\.raw`"""Pytml Game Kit/);
  assert.match(src, /_pytml_module\._install_game\(_pytml_game_source\)/);
  assert.match(src, /class _LazyGame\(_types\.ModuleType\)/);
  assert.match(src, /sys\.modules\['pytml\.game'\]|_sys\.modules\['pytml\.game'\]/);
  const names = src.match(/_GAME_NAMES = frozenset\((\[[^\]]+\])\)/)[1];
  for (const name of ['Canvas', 'loop', 'controls', 'keys', 'gamepad', 'sfx', 'SpriteSheet', 'Animation', 'HighScores', 'dpad', 'touch_button', 'Vec2', 'Rect']) {
    assert.ok(names.includes(`'${name}'`), `${name} should be exported`);
  }
});

test('embedded Python never contains characters that break String.raw templates', () => {
  const game = src.match(/const GAME_MODULE = String\.raw`([\s\S]*?)`;/)[1];
  assert.ok(!game.includes('${'));
  assert.ok(!game.includes('`'));
});

test('load_image does not force CORS, so local and non-CORS images load', () => {
  assert.doesNotMatch(src, /^\s*img\.crossOrigin = 'anonymous';/m);
  assert.match(src, /if \(cors\) img\.crossOrigin = 'anonymous'/);
});
