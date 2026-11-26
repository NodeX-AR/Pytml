# Pytml Game Kit

New in Pytml 2.6. Import what you need from `pytml`; the kit is compiled the first time you use any of it, so pages that don't use it pay nothing.

```python
from pytml import Canvas, loop, controls, sfx
```

## Game loop

```python
@loop                       # or: lp = loop(update, render=draw, fixed=1/60, fps=60)
def update(dt):             # dt = seconds since the last frame (clamped to max_dt=0.1)
    ...
```

`loop(update, render=None, fixed=None, fps=None, max_dt=0.1)` returns a `Loop`.

- `update` may take `dt` or no arguments, and may be `async`.
- `fixed=1/60` calls `update(1/60)` as many times as needed per frame (at most 8) and calls `render()` once. `loop.alpha` is the leftover fraction, for interpolation.
- `fps=30` caps the update rate.
- Methods: `start()`, `stop()`, `pause()`, `resume()`, `toggle_pause()`. Info: `running`, `paused`, `time`, `frame`, `fps`.
- A paused loop does not poll input, so unpause from a button or your own DOM event, or keep a `paused` flag inside `update` as the Space Shooter demo does.
- If `update` raises, the loop stops and the traceback is shown on the page.

## Keyboard: `keys`

Keys are physical positions (`KeyboardEvent.code`), so WASD works on every layout.

| Call | Meaning |
| --- | --- |
| `keys.down("a", "left")` | any of these keys is held |
| `keys.pressed("space")` | went down this frame |
| `keys.released("space")` | went up this frame |
| `keys.axis("left", "right")` | -1, 0 or 1 |

Names: single letters and digits, `left right up down space enter escape tab shift ctrl alt backspace`, or any exact code such as `KeyW` or `Numpad1`. Arrows and Space do not scroll the page while you play (not inside text fields). Turn that off with `keys.prevent_scroll = False`. Held keys are released when the window loses focus.

## Gamepad

```python
pad = gamepad(0)
pad.connected, pad.id
pad.down("a"), pad.pressed("a"), pad.released("a"), pad.button("rt")   # button() is analog 0..1
pad.axis("lx"), pad.left_stick, pad.right_stick                        # dead zone removed
pad.rumble(300, strong=1.0, weak=0.5)                                  # Chrome / Edge
```

Buttons: `a b x y lb rb lt rt back start ls rs up down left right home` (aliases `cross circle square triangle l1 r1 l2 r2 select options`). Set `pad.deadzone` (default 0.15). `pressed`/`released` need a running `loop`. `connected_gamepads()`, `on_gamepad_connected(cb)` and `on_gamepad_disconnected(cb)` are available; browsers only report a pad after its first button press.

## One set of controls: `controls`

```python
controls.use_defaults()                       # left/right/up/down, action, cancel, pause
controls.bind("jump", "space", "up", "pad:a", "touch:jump_btn")
controls.bind("left", "left", "a", "pad:left", "pad:lx-", "touch:dpad.left", "stick:move.left")

controls.down("jump"); controls.pressed("jump"); controls.released("jump")
controls.axis("left", "right")                # -1..1, analog aware
controls.vector()                             # Vec2, diagonals are not faster
controls.value("left")                        # 0..1
```

| Source | Meaning |
| --- | --- |
| `"space"`, `"a"`, `"ArrowLeft"` | keyboard |
| `"pad:a"`, `"pad:left"` | gamepad button on any connected pad |
| `"pad:lx-"`, `"pad:ry+"` | stick direction (`lx ly rx ry`) |
| `"touch:id"` | a `touch_button("id")` |
| `"touch:id.left"` | a `dpad("id")` direction |
| `"stick:id.left"` | a `joystick("id")` direction |

An action counts as down at 0.5 strength (`controls.threshold`). `pressed` and `released` need a running `loop`.

## On-screen controls

```python
dpad("dpad")                    # <div id="dpad"></div>, builds four arrows (8-way)
touch_button("fire", "FIRE")    # <div id="fire"></div>
```

Both expose live state (`d.left`, `d.x`, `b.down`). The default look uses zero-specificity CSS (`:where(...)`), so any CSS you write wins. To show them only on phones: `@media (pointer: coarse) { .touch { display: flex } }`.

## Canvas

```python
screen = Canvas("screen", 480, 320, pixelated=False, fit=False, hidpi=True)
screen.clear("#111")                              # or clear() to make it transparent
screen.rect(x, y, w, h, color, fill=True, line_width=1)
screen.circle(x, y, r, color)      screen.line(x1, y1, x2, y2, color, width)
screen.polygon([(0, 0), (10, 0), (5, 9)], color)
screen.text("Hi", x, y, color="#fff", size=16, align="left", baseline="top", bold=False)
screen.draw_image(img, x, y, w=None, h=None, src=(sx, sy, sw, sh), flip_x=False, rotation=0, alpha=1)
screen.save(); screen.translate(x, y); screen.rotate(rad); screen.scale(s); screen.restore()
screen.mouse_x, screen.mouse_y, screen.mouse_down       # in logical coordinates, even when scaled
screen.ctx                                             # raw CanvasRenderingContext2D
```

Colors are CSS strings or tuples `(r, g, b)` / `(r, g, b, a)`. `pixelated=True` gives crisp pixel art. `fit=True` scales the canvas down to fit its container while keeping the aspect ratio. `Canvas.create(w, h)` makes an off-screen canvas you can draw on and use as a sprite source.

## Images and sprites

```python
hero = await load_image("hero.png")
assets = await load_images({"hero": "hero.png", "tiles": "tiles.png"})
sheet = SpriteSheet(hero, 16, 16)              # frame size, optional margin= and spacing=
walk = Animation(sheet, [0, 1, 2, 3], fps=8)   # loop=False to play once
walk.update(dt); walk.draw(screen, x, y, 64, 64, flip_x=True)
sheet.draw(screen, 5, x, y)                    # draw frame 5
```

Images can come from any URL the page can load, including relative paths on `file://` pages. Pass `cors=True` only if you need to read pixels back; it requires the server to send CORS headers.

## Sound

```python
sfx.play("coin")      # coin jump blip laser hit explosion powerup error lose win
beep(880, 120, "square", volume=0.25, slide=-300)
jump = await load_sound("jump.wav");  jump.play(volume=1, rate=1.0, pan=0)   # overlapping plays are fine
song = music("theme.mp3", loop=True, volume=0.6);  song.play()
audio.volume = 0.5;  audio.muted = True
```

Browsers keep audio silent until the first click, tap or key press; Pytml resumes it on that first gesture. `load_sound` uses Web Audio and falls back to `<audio>` if `fetch` is not possible (for example on `file://`).

## Math and collisions

`Vec2(x, y)` supports `+ - * /`, `length`, `normalized()`, `dot`, `rotate`, `lerp`, `distance_to`, `clamp_length`, `Vec2.from_angle`.
`Rect(x, y, w, h)` has `right bottom centerx centery center`, `overlaps(other)`, `contains(px, py)`, `move(dx, dy)`, `inflate`, `copy`.
Functions: `rect_overlap`, `circle_overlap`, `clamp`, `lerp`, `sign`, `distance`, `approach`.

## Saving

```python
save_game("slot1", {"level": 3})               # any JSON-friendly value, stored in localStorage
load_game("slot1", default={})
delete_game("slot1")

scores = HighScores("my-game", limit=10)       # lower_is_better=True for race times
rank = scores.submit(1200, "AR")               # 1 = new best, None = did not make the table
scores.best; scores.top(5)
```

Saves are per browser and per site.

## Fullscreen and vibration

```python
await fullscreen()              # call from a click or key handler
await exit_fullscreen()
vibrate(80); vibrate([100, 50, 100])
```

## Publishing

A Pytml game is one static HTML file, so any static host works (GitHub Pages, Netlify, Vercel and similar).
