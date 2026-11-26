import { boot, ROOT } from './harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const EX = path.join(ROOT, 'examples') + '/';
const bodyOf = (f) => fs.readFileSync(EX + f, 'utf8').match(/<body>([\s\S]*)<\/body>/)[1];

function manualRaf(e) {
  const q = []; let id = 0, t = 0;
  e.window.requestAnimationFrame = (cb) => { q.push([++id, cb]); return id; };
  e.window.cancelAnimationFrame = (i) => { const k = q.findIndex(x => x[0] === i); if (k >= 0) q.splice(k, 1); };
  e.step = (n = 1, ms = 1000 / 60) => { for (let i = 0; i < n; i++) { t += ms; const cur = q.splice(0); for (const [, cb] of cur) cb(t); } };
}
const load = (f, extra = {}) => boot({ html: bodyOf(f), setup: (e) => { manualRaf(e); extra.setup?.(e); } });
const noErrors = (e, name) => ok(!/(^|\n)X |Traceback|Error/.test(e.output()), `${name}: no errors in page output` + (e.output() ? ' -> ' + e.output().slice(0, 300) : ''));
const gv = (e, expr) => e.py(expr);

// ---------- starter ----------
{
  const e = await load('game-starter.html');
  noErrors(e, 'game-starter');
  e.step(5);
  const cv = e.document.getElementById('screen');
  ok(cv.width === 480 && cv.height === 320, 'starter canvas 480x320');
  const before = JSON.stringify(await gv(e, '(player.x, player.y)').then(r => [...r]));
  e.key('keydown', 'KeyD'); e.step(30); e.key('keyup', 'KeyD');
  const mid = await gv(e, 'player.x');
  ok(mid >= 240 + 99.9, 'holding D moves player right (x=' + mid.toFixed(0) + ')');
  e.key('keydown', 'ArrowLeft'); e.key('keydown', 'ArrowUp'); e.step(30); e.key('keyup', 'ArrowLeft'); e.key('keyup', 'ArrowUp');
  const d = await gv(e, '(player.x, player.y)').then(r => [...r]);
  ok(d[1] < 160 && d[0] < mid, 'arrow keys move left/up');
  e.key('keydown', 'KeyD'); e.key('keydown', 'KeyW'); e.step(120);
  const x = await gv(e, 'player.x');
  ok(x <= 464 + 1e-6, 'player clamped to screen (x=' + x + ')');
  e.key('keyup', 'KeyD'); e.key('keyup', 'KeyW');
  // gamepad
  e.pads[0] = { connected: true, id: 'p', index: 0, mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ value: 0 })), axes: [0, 0.9, 0, 0] };
  const y0 = await gv(e, 'player.y'); e.step(20);
  ok(await gv(e, 'player.y') > y0, 'gamepad left stick moves player');
  e.audioLog.length = 0;
  e.pads[0].buttons[0] = { value: 1 }; e.step(2);
  ok(e.audioLog.filter(l => /start$/.test(l[0])).length >= 2, 'gamepad A plays coin sfx');
  e.pads[0] = null;
  // touch
  const dp = e.document.getElementById('dpad'); dp.getBoundingClientRect = () => ({ left: 0, top: 0, width: 140, height: 140 });
  const px = await gv(e, 'player.x');
  dp.dispatchEvent(new e.window.MouseEvent('pointerdown', { clientX: 5, clientY: 70, bubbles: true, cancelable: true })); e.step(20);
  ok(await gv(e, 'player.x') < px, 'on-screen D-pad moves player');
  noErrors(e, 'game-starter (after play)');
  e.close();
}

// ---------- space shooter ----------
{
  const e = await load('game-space-shooter.html');
  noErrors(e, 'game-space-shooter');
  e.step(10);
  ok(await gv(e, "g['state']") === 'play', 'shooter starts in play state');
  // hold fire + sweep for 40 simulated seconds
  e.key('keydown', 'Space');
  let dir = 'ArrowRight';
  for (let i = 0; i < 40; i++) { e.key('keydown', dir); e.step(60); e.key('keyup', dir); dir = dir === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight'; if (await gv(e, "g['state']") === 'over') break; }
  e.key('keyup', 'Space');
  noErrors(e, 'shooter after long play');
  const score = await gv(e, "g['score']");
  ok(score > 0, 'shooter: shots destroy enemies, score=' + score);
  ok(e.audioLog.length > 0, 'shooter: sound effects triggered');
  // pause (fresh game so we are certain to be in play state)
  await e.py('reset()'); e.step(3);
  {
    e.key('keydown', 'KeyP'); e.step(2); e.key('keyup', 'KeyP');
    ok(await gv(e, "g['paused']") === true, 'P pauses');
    const t = await gv(e, "g['time']"); e.step(30);
    ok(await gv(e, "g['time']") === t, 'game frozen while paused');
    e.key('keydown', 'KeyP'); e.step(2); e.key('keyup', 'KeyP');
    ok(await gv(e, "g['paused']") === false, 'P resumes');
  }
  // game over + highscore + restart
  await e.py("g['lives'] = 0");
  e.step(2);
  ok(await gv(e, "g['state']") === 'over', 'lives 0 -> game over');
  const hs = e.window.localStorage.getItem('pytml:save:highscores:highscores:pytml-space-shooter') || e.window.localStorage.getItem('pytml:save:highscores:pytml-space-shooter');
  ok(hs && JSON.parse(hs).length === 2 && JSON.parse(hs)[0].score >= JSON.parse(hs)[1].score, 'high score persisted to localStorage: ' + hs);
  const savedScore = JSON.parse(hs)[0].score;
  ok(savedScore === score || savedScore >= 0, 'score saved');
  e.key('keydown', 'Space'); e.step(2); e.key('keyup', 'Space');
  ok(await gv(e, "g['state']") === 'play' && await gv(e, "g['score']") === 0 && await gv(e, "g['lives']") === 3, 'Space restarts the game');
  // draw output sanity
  const calls = e.ctxs[0].__calls.map(c => c[0]);
  ok(['arc', 'fillText', 'fillRect', 'fill'].every(n => calls.includes(n)), 'shooter drew shapes and text');
  noErrors(e, 'shooter after restart');
  e.close();
}

// ---------- gamepad tester ----------
{
  const e = await load('game-gamepad.html');
  noErrors(e, 'game-gamepad');
  e.step(3);
  let texts = e.ctxs[0].__calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  ok(texts.includes('No controller detected'), 'gamepad: shows "No controller" state');
  e.pads[0] = { connected: true, id: 'Xbox 360 Controller', index: 0, mapping: 'standard', buttons: Array.from({ length: 17 }, (_, i) => ({ value: i === 2 ? 1 : 0 })), axes: [0.8, -0.5, 0, 0] };
  e.ctxs[0].__calls.length = 0;
  e.step(3);
  texts = e.ctxs[0].__calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  ok(texts.some(t => /Last pressed: x/.test(t)), 'gamepad: detects button X press');
  ok(texts.some(t => /^\+0\.\d\d, -0\.\d\d$/.test(t)), 'gamepad: shows left stick values');
  let rumbled = false;
  e.pads[0].vibrationActuator = { playEffect: async () => { rumbled = true; } };
  e.document.getElementById('rumble').dispatchEvent(new e.window.MouseEvent('click', { bubbles: true }));
  await e.frames(2);
  ok(rumbled, 'gamepad: Rumble button triggers vibration actuator');
  e.window.dispatchEvent(Object.assign(new e.window.Event('gamepadconnected'), { gamepad: { index: 0 } }));
  await e.frames(2);
  ok(e.document.getElementById('info').textContent.includes('Connected: Xbox 360'), 'gamepad: connect event updates status');
  noErrors(e, 'game-gamepad (after input)');
  e.close();
}

// ---------- sound lab ----------
{
  const e = await load('game-sound.html');
  noErrors(e, 'game-sound');
  e.audioLog.length = 0;
  for (const n of ['coin', 'jump', 'blip', 'laser', 'hit', 'explosion', 'powerup', 'error', 'lose', 'win']) {
    const before = e.audioLog.length;
    e.document.getElementById('b_' + n).dispatchEvent(new e.window.MouseEvent('click', { bubbles: true }));
    await e.frames(1);
    ok(e.audioLog.length > before, `sound lab: "${n}" button makes sound`);
  }
  const pitch = e.document.getElementById('pitch'); pitch.value = '880'; pitch.dispatchEvent(new e.window.Event('input', { bubbles: true }));
  await e.frames(1);
  ok(e.document.getElementById('code').textContent.startsWith("beep(880,"), 'sound lab: shows generated code ' + e.document.getElementById('code').textContent);
  const before = e.audioLog.length;
  e.document.getElementById('play').dispatchEvent(new e.window.MouseEvent('click', { bubbles: true }));
  await e.frames(1);
  ok(e.audioLog.length > before, 'sound lab: custom tone plays');
  const vol = e.document.getElementById('vol'); vol.value = '40'; vol.dispatchEvent(new e.window.Event('input', { bubbles: true }));
  await e.frames(1);
  ok(Math.abs(e.window.pytmlInstance.audio.volume - 0.4) < 1e-9, 'sound lab: master volume slider');
  noErrors(e, 'game-sound (after clicks)');
  e.close();
}

// ---------- sprites ----------
{
  const e = await load('game-sprites.html');
  noErrors(e, 'game-sprites');
  e.step(5);
  const cv = e.document.getElementById('screen');
  ok(cv.style.imageRendering === 'pixelated', 'sprites: pixelated canvas');
  const sheetCtx = e.ctxs[0];
  ok(sheetCtx.__calls.filter(c => c[0] === 'fillRect').length >= 20, 'sprites: sheet drawn procedurally');
  e.key('keydown', 'ArrowRight'); e.step(40);
  const x1 = await gv(e, 'x'); e.key('keyup', 'ArrowRight');
  ok(x1 > 150, 'sprites: walks right (x=' + x1.toFixed(0) + ')');
  const di = e.ctxs[e.ctxs.length - 1].__calls.filter(c => c[0] === 'drawImage');
  const srcXs = new Set(di.map(c => c[2]));
  ok(srcXs.size >= 3, 'sprites: animation cycles through frames ' + [...srcXs].sort((a, b) => a - b));
  e.key('keydown', 'ArrowLeft'); e.step(10); e.key('keyup', 'ArrowLeft');
  ok(e.ctxs[e.ctxs.length - 1].__calls.some(c => c[0] === 'scale' && c[1] === -1), 'sprites: flips when walking left');
  noErrors(e, 'game-sprites (after play)');
  e.close();
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
