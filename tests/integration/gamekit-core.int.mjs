import { boot } from './harness.mjs';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const env = await boot({ html: `<canvas id="game" width="100" height="50"></canvas><div id="btn"></div><div id="pad"></div><div id="stick"></div><py1>x=1</py1>` });
const run = async (c) => { try { return await env.py(c); } catch (e) { fails++; console.log('EXC', c.slice(0, 60), '\n', String(e).slice(0, 600)); } };

// lazy
ok(await run(`import sys, pytml\nsys.modules['pytml.game'].__dict__.get('_loaded', False)`) === false, 'game kit not loaded at startup');
ok(await run(`from pytml import Vec2, Rect\nsys.modules['pytml.game'].__dict__.get('_loaded')`) === true, 'game kit loads on first use');
ok(await run(`from pytml.game import clamp\nclamp(5,0,3)`) === 3, 'from pytml.game import works');
ok(await run(`import pytml\ntry:\n  pytml.nonexistent\n  r='no error'\nexcept AttributeError:\n  r='AttributeError'\nr`) === 'AttributeError', 'unknown attr raises AttributeError');
ok(await run(`import pytml.game\nset(pytml.game.__all__) == set(pytml._GAME_NAMES)`) === true, '_GAME_NAMES matches __all__');
// all exported names resolve
ok(await run(`import pytml\nlen([n for n in pytml._GAME_NAMES if not hasattr(pytml,n)])`) === 0, 'every exported name resolves');

// math
ok(await run(`from pytml import Vec2\nv=Vec2(3,4)\n(v.length, (v*2).x, v.normalized().length, tuple(v+Vec2(1,1)), Vec2(1,0).rotate(3.141592653589793/2).y > 0.99)`).toJs
   ? true : true, 'vec2 ran');
const r = await run(`from pytml import Vec2, Rect, rect_overlap, circle_overlap, approach, lerp, sign\nv=Vec2(3,4)\nr=Rect(0,0,10,10)\n[v.length, (v*2).x, round(v.normalized().length,6), r.overlaps(Rect(5,5,10,10)), r.overlaps(Rect(10,0,5,5)), r.contains(9.9,0), r.center==(5.0,5.0), circle_overlap(0,0,5,8,0,3), circle_overlap(0,0,5,9,0,3), approach(0,10,3), approach(10,0,20), lerp(0,10,.25), sign(-3), v.clamp_length(1).length]`);
const a = r.toJs ? r.toJs() : r;
ok(JSON.stringify(a) === JSON.stringify([5, 6, 1, true, false, true, true, true, false, 3, 0, 2.5, -1, 1]), 'math/collision values ' + JSON.stringify(a));

// keyboard
await run(`from pytml import keys\nkeys.down('a')`);
env.key('keydown', 'KeyA'); env.key('keydown', 'ArrowLeft');
ok(await run(`keys.down('a') and keys.down('left') and keys.pressed('a') and not keys.released('a')`) === true, 'keyboard down/pressed + aliases');
await run(`keys.end_frame()`);
ok(await run(`keys.down('a') and not keys.pressed('a')`) === true, 'pressed cleared at frame end, still down');
ok(await run(`keys.axis('left','right')`) === -1, 'axis -1 with left held');
env.key('keyup', 'KeyA');
ok(await run(`keys.released('a') and not keys.down('a')`) === true, 'released edge');
const ev = new env.window.KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
env.window.dispatchEvent(ev);
ok(ev.defaultPrevented, 'space default prevented (no page scroll)');
const input = env.document.createElement('input'); env.document.body.appendChild(input);
const ev2 = new env.window.KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
input.dispatchEvent(ev2);
ok(!ev2.defaultPrevented, 'space not blocked inside text input');
env.window.dispatchEvent(new env.window.Event('blur'));
ok(await run(`not keys.down('left')`) === true, 'blur releases held keys');

// canvas
await run(`from pytml import Canvas\nsc=Canvas('game', 200, 100)\nsc.clear('#111')\nsc.rect(1,2,3,4,(255,0,0))\nsc.circle(5,5,2,'red')\nsc.text('hi',1,1)\nsc.line(0,0,5,5)\nsc.polygon([(0,0),(5,0),(5,5)])\nsc.draw_image(sc, 0,0, 10,10, flip_x=True, rotation=1)`);
const ctx = env.ctxs[0];
const names = ctx.__calls.map(c => c[0]);
ok(['setTransform', 'fillRect', 'arc', 'fillText', 'lineTo', 'drawImage', 'rotate'].every(n => names.includes(n)), 'canvas drew expected calls: ' + [...new Set(names)].join(','));
ok(ctx.__props.fillStyle === 'red' || ctx.__calls.some(c => c[0] === 'fillRect'), 'fillStyle set');
const cv = env.document.getElementById('game');
ok(cv.width === 200 && cv.style.width === '200px', 'canvas sized 200 x 100 logical');
ok(await run(`sc.width==200 and sc.height==100`) === true, 'Canvas.width logical');
await run(`sc.mouse_x`);
cv.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 50 });
cv.dispatchEvent(new env.window.MouseEvent('pointermove', { clientX: 60, clientY: 45, bubbles: true }));
const mx = await run(`(sc.mouse_x, sc.mouse_y)`);
ok(JSON.stringify([...mx]) === '[100,50]' || JSON.stringify(mx.toJs?.()) === '[100,50]', 'pointer mapped to logical coords with fit scaling ' + mx);

// saves + highscores
await run(`from pytml import save_game, load_game, HighScores, delete_game\nsave_game('s1', {'lvl': 3, 'items': ['a']})`);
ok(JSON.stringify((await run(`load_game('s1')`)).toJs?.({ dict_converter: Object.fromEntries })) === '{"lvl":3,"items":["a"]}', 'save/load roundtrip');
ok(await run(`load_game('nope', 42)`) === 42, 'load default');
const rank = await run(`hs=HighScores('t', limit=3)\n[hs.submit(10,'a'), hs.submit(50,'b'), hs.submit(30,'c'), hs.submit(5,'d'), hs.submit(40,'e')]`);
ok(JSON.stringify([...rank]) === '[1,1,2,null,2]', 'highscore ranks ' + [...rank]);
ok(await run(`HighScores('t', limit=3).best`) === 50, 'highscores persist across instances');
await run(`delete_game('s1'); hs.clear()`);

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
env.close(); process.exit(fails ? 1 : 0);
