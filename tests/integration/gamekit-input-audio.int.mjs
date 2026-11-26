import { boot } from './harness.mjs';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const env = await boot({
  html: `<div id="btn" style="width:50px;height:50px"></div><div id="pad"></div><div id="stick"></div><py1>x=1</py1>`,
  setup: (e) => {
    e.window.Image = class { set src(v) { this._s = v; this.width = 64; this.height = 16; setTimeout(() => v.includes('bad') ? this.onerror?.() : this.onload?.(), 5); } };
    globalThis.fetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) });
  }
});
const run = async (c) => { try { return await env.py(c); } catch (e) { fails++; console.log('EXC', c.slice(0, 70), '\n', String(e).slice(-500)); } };
const js = (v) => (v && v.toJs) ? v.toJs({ dict_converter: Object.fromEntries }) : v;

// ---- loop ----
await run(`from pytml import loop, controls, keys, gamepad
calls=[]; renders=[0]
def update(dt): calls.append(dt)
def draw(): renders[0]+=1
lp = loop(update, render=draw)`);
await env.frames(12);
ok(await run(`len(calls) >= 5`) === true, 'loop ticks via requestAnimationFrame');
ok(await run(`max(calls) <= 0.1 and min(calls) > 0`) === true, 'dt in seconds and clamped');
ok(await run(`renders[0] == len(calls)`) === true, 'render called every frame');
await run(`lp.pause(); n=len(calls)`); await env.frames(5);
ok(await run(`len(calls)==n`) === true, 'pause stops updates');
await run(`lp.resume()`); await env.frames(5);
ok(await run(`len(calls)>n`) === true, 'resume continues');
await run(`lp.stop(); n=len(calls)`); await env.frames(5);
ok(await run(`len(calls)==n and not lp.running`) === true, 'stop halts loop');

// zero-arg, decorator, async update
await run(`z=[0]
@loop
def tick(): z[0]+=1
az=[0]
async def aupd(dt): az[0]+=1
l3 = loop(aupd)`);
await env.frames(8);
ok(await run(`z[0]>2`) === true, 'zero-arg update works as @loop decorator');
ok(await run(`az[0]>2`) === true, 'async update supported');
await run(`tick.stop(); l3.stop()`);

// fixed timestep
await run(`fx=[]
l4 = loop(lambda dt: fx.append(dt), fixed=1/120)`);
await env.frames(10);
ok(await run(`len(fx)>=6 and all(abs(d-1/120)<1e-9 for d in fx)`) === true, 'fixed timestep calls with constant dt');
await run(`l4.stop()`);

// fps cap
await run(`cap=[]
l5 = loop(lambda dt: cap.append(dt), fps=10)`);
await env.frames(30); // ~600ms+
const capN = await run(`len(cap)`);
ok(capN >= 3 && capN <= 9, 'fps cap limits updates (' + capN + ' in ~0.6s)');
await run(`l5.stop()`);

// error in update stops loop and shows error
await run(`def boom(dt): raise RuntimeError('kaboom')\nl6 = loop(boom)`);
await env.frames(6);
ok(await run(`l6.running`) === false, 'loop stops on exception');
ok(env.output().includes('kaboom'), 'exception message shown in page output');

// ---- controls: keyboard ----
await run(`controls.unbind()
controls.bind('jump','space','pad:a').bind('left','left','a','pad:lx-')
log=[]
def upd(dt):
    log.append((controls.pressed('jump'), controls.down('jump'), controls.released('jump'), controls.axis('left','left')))
l7 = loop(upd)`);
await env.frames(3);
env.key('keydown', 'Space');
await env.frames(4);
env.key('keyup', 'Space');
await env.frames(4);
const log = js(await run(`log`)).map(x => Array.from(x));
const pressedFrames = log.filter(x => x[0]).length, downFrames = log.filter(x => x[1]).length, relFrames = log.filter(x => x[2]).length;
ok(pressedFrames === 1, 'controls.pressed fires exactly once (' + pressedFrames + ')');
ok(downFrames >= 2, 'controls.down while held');
ok(relFrames === 1, 'controls.released fires exactly once (' + relFrames + ')');

// ---- controls: gamepad ----
const mkPad = (btn = {}, axes = [0, 0, 0, 0]) => ({ connected: true, id: 'Test Pad (Standard)', index: 0, mapping: 'standard', buttons: Array.from({ length: 17 }, (_, i) => ({ value: btn[i] || 0 })), axes });
await run(`log.clear()`);
env.pads[0] = mkPad();
await env.frames(3);
env.pads[0] = mkPad({ 0: 1 });
await env.frames(4);
env.pads[0] = mkPad();
await env.frames(3);
const log2 = js(await run(`log`)).map(x => Array.from(x));
ok(log2.filter(x => x[0]).length === 1, 'pad:a mapped to jump, pressed once');
ok(log2.filter(x => x[2]).length === 1, 'pad:a release edge once');
env.pads[0] = mkPad({}, [-0.9, 0, 0, 0]);
await env.frames(4);
ok(await run(`controls.down('left') and controls.axis('left','left') < -0.5 + 1`) === true, 'pad:lx- stick maps to left');
env.pads[0] = mkPad({}, [-0.1, 0.05, 0, 0]);
await env.frames(3);
ok(await run(`not controls.down('left')`) === true, 'stick inside dead zone ignored');
const pr = js(await run(`p=gamepad(0)\n[p.connected, p.id, p.left_stick[0], p.axis('lx'), p.down('a'), p.button('lt')]`));
ok(pr[0] === true && pr[1].includes('Test Pad') && pr[3] === 0 && pr[4] === false, 'Gamepad object state ' + JSON.stringify(pr));
env.pads[0] = null; await env.frames(3);
ok(await run(`gamepad(0).connected`) === false, 'disconnect detected');
try { await env.py(`gamepad(0).button('nope')`); ok(false, 'bad button name raises'); } catch (e) { ok(String(e).includes('Unknown gamepad button'), 'bad button name gives helpful error'); }
await run(`l7.stop()`);

// ---- touch controls ----
await run(`from pytml import touch_button, dpad
b = touch_button('btn', label='A')
d = dpad('pad')`);
const btn = env.document.getElementById('btn'), pad = env.document.getElementById('pad');
ok(btn.classList.contains('pytml-touch-button') && btn.textContent === 'A', 'touch_button styled + labeled');
ok(pad.querySelectorAll('.pytml-dpad-arrow').length === 4, 'dpad builds 4 arrows');
pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 150, height: 150 });
ok(await run(`b.down`) === false, 'button up initially');
btn.dispatchEvent(new env.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
ok(await run(`b.down`) === true && btn.classList.contains('pytml-down'), 'button down after pointerdown');
btn.dispatchEvent(new env.window.MouseEvent('pointerup', { bubbles: true }));
ok(await run(`b.down`) === false, 'button up after pointerup');
pad.dispatchEvent(new env.window.MouseEvent('pointerdown', { clientX: 140, clientY: 20, bubbles: true, cancelable: true }));
const dv = js(await run(`[d.right, d.up, d.left, d.down, d.x, d.y]`));
ok(JSON.stringify(dv) === '[true,true,false,false,1,-1]', 'dpad top-right = right+up ' + JSON.stringify(dv));
await run(`controls.unbind(); controls.bind('r','touch:pad.right'); controls.bind('fire','touch:btn')`);
ok(await run(`controls.down('r') and not controls.down('fire')`) === true, 'touch:id.part sources feed controls');
pad.dispatchEvent(new env.window.MouseEvent('pointerup', { bubbles: true }));
ok(await run(`not d.right`) === true, 'dpad releases');

// ---- joystick source ----
await run(`from pytml import joystick\nj = joystick('stick')`);
env.window.pytmlInstance._joystickState.get(env.document.getElementById('stick')).x = 0.8;
await run(`controls.unbind(); controls.bind('ml','stick:stick.right')`);
ok(await run(`controls.down('ml') and abs(controls.value('ml')-0.8)<1e-9`) === true, 'stick:id.right reads analog joystick');

// ---- audio ----
env.audioLog.length = 0;
await run(`from pytml import sfx, beep, audio, load_sound
sfx.play('coin')
sfx.jump()
beep(880, 50, 'sine')
sfx.play('explosion', 0.4)`);
const starts = env.audioLog.filter(e => /\.start$/.test(e[0])).length;
ok(starts >= 6, 'synth plays voices (' + starts + ' starts)');
ok(js(await run(`sfx.names`)).includes('coin'), 'sfx.names lists presets');
try { await env.py(`sfx.play('nope')`); ok(false, 'unknown sfx raises'); } catch (e) { ok(String(e).includes('Unknown sound effect'), 'unknown sfx gives helpful error'); }
await run(`audio.volume = 0.3; audio.muted = True`);
ok(env.window.pytmlInstance.audio.master.gain.value === 0, 'mute silences master gain');
await run(`audio.muted = False`);
ok(Math.abs(env.window.pytmlInstance.audio.master.gain.value - 0.3) < 1e-9, 'unmute restores volume');
await run(`snd = await load_sound('jump.wav', 0.8)\nh = snd.play(volume=0.5, rate=1.2, pan=-1)\nh.stop()`);
ok(env.window.pytmlInstance.audio.buffers.has('jump.wav'), 'load_sound decodes into buffer and plays');

// ---- images / sprites ----
await run(`from pytml import Canvas, load_image, load_images, SpriteSheet, Animation
img = await load_image('sheet.png')
imgs = await load_images({'a':'a.png','b':'b.png'})
sheet = SpriteSheet(img, 16, 16)
off = Canvas.create(100, 100)
anim = Animation(sheet, [0,1,2,3], fps=10)
anim.update(0.25)
anim.draw(off, 5, 6, flip_x=True)
sheet.draw(off, 3, 0, 0)`);
ok(js(await run(`[img.width, img.height, sheet.columns, sheet.count, anim.index, sorted(imgs)]`)).join() === '64,16,4,4,2,a,b', 'image + spritesheet metrics');
const last = env.ctxs[env.ctxs.length - 1].__calls.filter(c => c[0] === 'drawImage');
ok(last.length === 2 && last[0][2] === 32 && last[0][3] === 0 && last[1][2] === 48, 'animation draws correct frame rectangle ' + JSON.stringify(last.map(c => c.slice(2, 4))));
try { await env.py(`await load_image('bad.png')`); ok(false, 'bad image rejects'); } catch (e) { ok(String(e).includes('Could not load image'), 'bad image gives helpful error'); }

// ---- fullscreen / vibrate ----
env.window.navigator.vibrate = () => true;
ok(await run(`from pytml import vibrate\nvibrate([100,50,100])`) === true, 'vibrate pattern');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
env.close(); process.exit(fails ? 1 : 0);
