# Scene State and Clock

Two of the six owners from `canvas-first-architecture` §3, in the order they are
built: the clock first, because every system reads it, then the state machine,
because it decides what runs.

## The clock

One loop drives the frame. Systems read its values and start no timer of their
own.

```js
const clock = {
  elapsed: 0,   // seconds since start, excluding paused time
  delta: 0,     // seconds since the previous frame, clamped
  ratio: 1,     // delta measured against the target step
  frame: 0,
}

const TARGET_STEP = 1 / 60
const MAX_STEP = 1 / 20 // a longer gap is a stall, not slow motion

function tick(now) {
  const raw = (now - previous) / 1000
  previous = now
  clock.delta = Math.min(raw, MAX_STEP)
  clock.ratio = clock.delta / TARGET_STEP
  clock.elapsed += clock.delta
  clock.frame += 1
}
```

Three properties matter more than the exact shape:

- **Delta is clamped.** A tab returning from the background reports a gap of
  seconds. Unclamped, every spring overshoots, every scrub jumps, and physics
  explodes on the first visible frame.
- **`ratio` is published, not recomputed.** It is the input to the
  frame-rate-independent interpolation `motion-system` owns. Systems that derive
  it themselves drift apart from each other.
- **Paused time does not accumulate.** On `document.hidden` or offscreen, stop
  the loop and leave `elapsed` where it was. `3d-runtime-quality` owns the pause
  trigger; the clock only honors it.

A fixed-step accumulator is worth its complexity for a simulation whose result
must not depend on frame rate — cloth, contact-based physics, anything the
poster frame has to reproduce. Interpolated visuals do not need one.

## Determinism

A poster frame, a verification screenshot, and a bug report all need the same
scene to produce the same image. When reproducible dynamic capture is in scope,
read `core-rules/references/determinism.md` before implementing this clock or any
random source. Its injected-time, named-seed, camera-station, and stable-frame
rules are the capture contract; the `tick(now)` example above is not permission
for scene code to call a wall clock directly.

Seed any per-frame randomness from a named generator rather than `Math.random`,
and derive noise from `clock.elapsed` instead of from a call counter. Systems that
skip a frame then still agree.

## The state machine

A section is a state with a name and an entry condition. It is not a scroll
offset, and it is not a boolean per system.

```js
const machine = {
  current: 'intro',
  transition: null, // { from, to, progress } while one is running
}
```

Rules that keep it from decaying into a set of flags:

1. **Only the machine starts a transition.** A system that wants one requests
   it; the machine accepts or rejects. Two systems cannot both be mid-transition.
2. **A transition is a function of `(from, to)`.** A single `goToSection(id)`
   that reads the same fade for every pair produces the mechanical feel
   `immersive-3d` §4 rules out.
3. **Entry conditions are explicit.** Assets loaded, previous transition
   settled, tier resolved. A state entered before its assets arrive is the
   pop-in `loading-choreography` exists to prevent.
4. **Guards, not races.** Rapid input during a transition either queues one
   target or is dropped. Never both.
5. **The DOM mirror follows the machine.** One subscriber updates the parallel
   layer and the URL; systems do not each write their own DOM.

## System lifecycle

Register every system once and give it the same five hooks. Order the update
explicitly rather than by registration order.

```
init(context)        once, before the first frame
activate(state)      when a state that needs it becomes current
update(clock)        per frame, only while active
deactivate(state)    when leaving
dispose()            on teardown, releasing GPU resources
```

Update order that avoids a one-frame lag between cause and effect:

```
input → state machine → camera rig → simulation → animation → render graph
```

A system reading a value produced later in the same order sees the previous
frame's value. That is acceptable for a trailing effect and wrong for a camera,
so state the exceptions rather than discovering them as jitter.

## Teardown

A state that owns exclusive assets disposes them on exit; a state that shares
them does not. Decide which at registration, because deciding at teardown
produces either a leak or a black object on re-entry. `r3f-patterns` owns
disposal mechanics for React-managed resources.
