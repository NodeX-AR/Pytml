// Every example in /examples is run for real (jsdom + Pyodide) and driven like a user would.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPage } from './helpers.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'examples');
const load = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

test('hello.html', async () => {
  const p = await runPage(load('hello.html'));
  await p.type('Ada');
  await p.finished();
  assert.match(p.text(), /Hello, Ada!/);
});

test('calculator.html (input + pick)', async () => {
  const p = await runPage(load('calculator.html'));
  await p.type('12');
  await p.clickText('*');
  await p.until(() => p.doc.querySelector('.pytml-ask input'), 'second number box');
  await p.type('3');
  await p.finished();
  assert.match(p.text(), /12 \* 3 = 36/);
});

test('keypad-calculator.html (wait_for loop + element ids)', async () => {
  const p = await runPage(load('keypad-calculator.html'));
  const press = async (label) => {
    const b = [...p.doc.querySelectorAll('.key')].find((k) => k.textContent === label);
    await p.until(() => true);
    p.click(b);
  };
  const screen = p.doc.getElementById('screen');
  for (const k of ['1', '2', '+', '3']) { await new Promise((r) => setTimeout(r, 150)); await press(k); }
  await p.until(() => screen.value === '12+3', 'typed expression');
  await new Promise((r) => setTimeout(r, 150));
  await press('=');
  await p.until(() => screen.value === '15', 'result 15');
});

test('counter.html (py-click functions + attribute code)', async () => {
  const p = await runPage(load('counter.html'));
  await p.finished();
  const [plus, minus, reset] = p.doc.querySelectorAll('button');
  const n = p.doc.getElementById('number');
  p.click(plus); await p.until(() => n.textContent === '1', '1');
  p.click(plus); await p.until(() => n.textContent === '2', '2');
  p.click(minus); await p.until(() => n.textContent === '1', 'back to 1');
  p.click(reset); await p.until(() => n.textContent === '0', 'reset');
});

test('greeting-form.html', async () => {
  const p = await runPage(load('greeting-form.html'));
  await p.finished();
  const msg = p.doc.getElementById('message');
  p.click(p.doc.querySelector('button'));
  await p.until(() => /type your name/.test(msg.textContent), 'empty warning');
  p.doc.getElementById('name').value = 'Lin';
  p.click(p.doc.querySelector('button'));
  await p.until(() => /Hello, Lin!/.test(msg.textContent), 'greeting');
  assert.equal(p.doc.getElementById('name').value, '');
});

test('quiz.html (function with pick inside)', async () => {
  const p = await runPage(load('quiz.html'));
  await p.clickText('Paris');
  await p.until(() => p.text().includes('Correct!'), 'first answer');
  await p.clickText('6');
  await p.until(() => p.text().includes('2 + 2'), 'second question echo');
  await p.clickText('(1, 2)');
  await p.finished();
  assert.match(p.text(), /No, the answer is \[1, 2\]\./);
  assert.match(p.text(), /Your score: 2\/3/);
});

test('timer.html (sleep inside a loop)', async () => {
  const p = await runPage(load('timer.html').replace('range(10, -1, -1)', 'range(2, -1, -1)').replace('sleep(1)', 'sleep(0.05)'));
  await p.until(() => true);
  await new Promise((r) => setTimeout(r, 300));
  p.click(p.doc.getElementById('start'));
  await p.until(() => p.doc.getElementById('clock').textContent === 'Time is up!', 'countdown end');
  assert.equal(p.doc.getElementById('start').disabled, true);
});
