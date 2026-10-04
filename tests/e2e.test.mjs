import test from 'node:test';
import assert from 'node:assert/strict';
import { runPage } from './helpers.mjs';

const page = (body) => `<!DOCTYPE html><html><head></head><body>${body}</body></html>`;

test('hello world prints', async () => {
  const p = await runPage(page('<py>print("Hello", 1+1)</py>'));
  await p.finished();
  assert.match(p.text(), /Hello 2/);
});

test('input() works at top level and inside functions of another block', async () => {
  const p = await runPage(page(`
    <py>
def ask_number(msg):
    return int(input(msg))
    </py>
    <py2>
a = ask_number("first? ")
b = ask_number("second? ")
print("sum is", a + b)
    </py2>`));
  await p.type('4');
  await p.until(() => p.text().includes('second?') && p.doc.querySelector('.pytml-ask input'), 'second prompt');
  await p.type('5');
  await p.finished();
  assert.match(p.text(), /sum is 9/);
});

test('pick() and wait_for() with element ids as variables', async () => {
  const p = await runPage(page(`
    <button id="go">Go</button> <button class="num">7</button>
    <py>
op = pick("+", "-", prompt="operator?")
print("chosen", op)
ev = wait_for(".num")
print("clicked", ev.text)
wait_for(go)
print("go clicked", type(go).__name__)
    </py>`));
  await p.clickText('-');
  await p.until(() => p.text().includes('chosen -'), 'pick result');
  p.click(p.doc.querySelector('.num'));
  await p.until(() => p.text().includes('clicked 7'), 'wait_for result');
  p.click(p.doc.getElementById('go'));
  await p.finished();
  assert.match(p.text(), /go clicked Element/);
});

test('py-click calls a function, changes elements, supports async code', async () => {
  const p = await runPage(page(`
    <button id="b" py-click="add">Add</button>
    <button id="r" py-click="count = 0; show_count()">Reset</button>
    <span id="out">0</span>
    <py>
count = 0
def show_count():
    out.text = count
def add(event):
    global count
    count += 1
    show_count()
    </py>`));
  await p.finished();
  const out = p.doc.getElementById('out');
  p.click(p.doc.getElementById('b'));
  await p.until(() => out.textContent === '1', 'count 1');
  p.click(p.doc.getElementById('b'));
  await p.until(() => out.textContent === '2', 'count 2');
  p.click(p.doc.getElementById('r'));
  await p.until(() => out.textContent === '0', 'reset');
});

test('sleep() does not block; time.sleep is rewritten', async () => {
  const p = await runPage(page(`<py>
import time
from time import sleep
t = time.time()
time.sleep(0.2)
sleep(0.1)
print("slept", time.time() - t > 0.25)
</py>`));
  await p.finished();
  assert.match(p.text(), /slept True/);
});

test('errors are readable and have a hint, later blocks still run', async () => {
  const p = await runPage(page(`
    <py>
x = 10
print(y)
    </py>
    <py>print("second block ok")</py>`));
  await p.finished();
  const t = p.text();
  assert.match(t, /block 1, line 2/);
  assert.match(t, /print\(y\)/);
  assert.match(t, /NameError/);
  assert.match(t, /Hint:/);
  assert.match(t, /second block ok/);
});

test('syntax errors are reported with a hint', async () => {
  const p = await runPage(page('<py>if True\n    print(1)</py>'));
  await p.finished();
  assert.match(p.text(), /SyntaxError/);
  assert.match(p.text(), /colon/);
});

test('methods that wait are awaited (maybe-await) and callbacks may be async', async () => {
  const p = await runPage(page(`
    <button id="ask" py-click="Game().play()">Play</button>
    <py>
class Game:
    def play(self):
        name = input("name? ")
        print("hello", name)
    </py>`));
  await p.finished();
  p.click(p.doc.getElementById('ask'));
  await p.type('Zed');
  await p.until(() => p.text().includes('hello Zed'), 'greeting');
});

test('fetch_json and fetch_text helpers', async () => {
  globalThis.__fakeFetch = { '/data.json': '{"a": [1, 2, 3]}', '/t.txt': 'hi there' };
  const p = await runPage(page(`<py>
d = fetch_json("/data.json")
print(sum(d["a"]), fetch_text("/t.txt"))
</py>`));
  await p.finished();
  assert.match(p.text(), /6 hi there/);
});

test('v2 pages keep working: demo.html + script.py', async () => {
  const fs = await import('node:fs');
  globalThis.__fakeFetch = { 'script.py': fs.readFileSync(new URL('../script.py', import.meta.url), 'utf8') };
  const p = await runPage(fs.readFileSync(new URL('../demo.html', import.meta.url), 'utf8'));
  await p.type('Sam');
  await p.until(() => p.doc.querySelector('.pytml-ask input') && p.text().includes('age'), 'age prompt');
  await p.type('15');
  await p.finished();
  assert.match(p.text(), /Hello Sam, you are 15 years old!/);
});

test('pip-style library detection does not break plain pages and unknown modules explain themselves', async () => {
  const p = await runPage(page('<py>import json, math\nprint(json.dumps({"a": math.floor(2.5)}))\nimport not_a_real_module_xyz\n</py>'));
  await p.finished();
  assert.match(p.text(), /\{"a": 2\}/);
  assert.match(p.text(), /ModuleNotFoundError/);
  assert.match(p.text(), /Hint:/);
});
