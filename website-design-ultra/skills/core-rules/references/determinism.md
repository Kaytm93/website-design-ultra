# Deterministic Runtime Contract

Use this contract when a runnable dynamic scene must reproduce a capture, poster
frame, interaction checkpoint, or bug. It is a capture-evidence leaf, not part of
ordinary 2D work or an ordinary 3D-hero plan.

## 1. Activation and boundary

`WDU_DETERMINISTIC=1` is the only value that enables deterministic mode. An
unset variable and every other value select live mode. Resolve the flag once at
the application boundary and inject the resolved mode into the scene runtime;
scene systems must not read process environment or infer the mode from a host,
route name, test runner, or browser capability.

A local verifier passes the flag to the project's existing start or preview
command. A deployed target needs a project-declared capture entry point that
resolves to the same runtime input. If that entry point is absent, deterministic
capture is unavailable; a verifier must not create an undocumented query switch.

Record the resolved mode with capture metadata. A run that requested the flag
but cannot show that deterministic mode was selected is not deterministic
evidence.

## 2. Filled contract before scene code

Declare one block per runnable scene. Values below show the shape, not defaults
to copy without a project decision.

```yaml
deterministic-runtime:
  mode-input: "WDU_DETERMINISTIC=1"
  clock-source: "injected fixed-step clock"
  step-seconds: 0.016666666666666666
  root-seed: "fixture-or-project-stable value"
  seed-names:
    particles: "particles"
    noise-offsets: "noise-offsets"
    scatter: "scatter"
    procedural-placement: "procedural-placement"
  camera-stations:
    hero-wide:
      position: [0, 1.2, 4.8]
      target: [0, 0.8, 0]
      projection: "perspective"
      fov: 35
      scene-state: "hero"
  initial-camera-station: "hero-wide"
  stable-frame: 12
  ready-marker: 'html[data-wdu-ready="true"]'
```

Every `seed-name` and camera-station id is public capture metadata. Change one
only when intentionally changing the capture contract; a cosmetic label is not
a reason to invalidate every baseline.

## 3. Injectable time

Scene code reads one injected clock with `elapsed`, `delta`, `ratio`, and `frame`.
The live clock adapter may read `performance.now()` at its outer boundary. The
deterministic adapter advances from the declared step and frame index and never
delegates to the live adapter. No scene system reads `performance.now()`,
`Date.now()`, a request-animation-frame timestamp, audio time, or a library ticker
to create a second time path while deterministic mode is active.

Pause and resume decisions still belong to the runtime-quality owner. Paused time
does not accumulate. A simulation that needs fixed sub-steps consumes them from
the injected clock; it does not start its own timer. The clock rules in
`canvas-first-architecture/references/scene-state-and-clock.md` remain the shape
for elapsed time, clamping, ratio, and lifecycle.

## 4. Named stochastic streams

Every stochastic subsystem receives a named seed derived from the root seed and
its stable subsystem name. At minimum this applies to particles, noise offsets,
scatter, and procedural placement. Scene code does not call `Math.random()` in
deterministic mode and does not share one mutable generator across subsystems.

Names create stream isolation: adding `background-dust` must not change the
sequence for `product-scatter`. A subsystem may derive child streams by adding a
stable local name, such as `particles/spawn` and `particles/lifetime`; it may not
derive them from registration order, object identity, a timestamp, or the number
of random calls made elsewhere.

Record the root seed and the sorted seed-name list with each capture. An unnamed
random source is a contract failure even when two local runs happen to look
similar.

## 5. Named camera stations

A camera station is an id mapped to a complete reproducible shot: position,
target or orientation, projection, field of view or orthographic scale, and the
scene or timeline state that owns the shot. The capture entry point accepts a
station id before scene initialization. It never approximates a station by
scrolling, dragging controls, or restoring the previous session.

Unknown station ids fail explicitly and keep readiness unset. Do not fall back to
the first station. Controls may remain interactive in live mode; deterministic
mode applies the selected station before the stable-frame sequence and prevents
input or persisted state from moving it during capture.

## 6. First stable frame and readiness

The marker is absent at boot and whenever a station, seed, critical asset, or
capture state changes. Set `data-wdu-ready="true"` on the document root only
after all of these are true:

1. critical fonts, images, models, and required shader/material warm-up resolved;
2. the selected camera station and declared scene/timeline state were applied;
3. every stochastic subsystem was initialized from its named seed;
4. the injected clock reached the declared stable frame; and
5. that frame completed its visible render.

The render owner sets the marker after drawing that frame, not when a timer,
asset callback, or framework mount fires. A later invalidation removes the
marker before work starts and sets it again only after a new stable frame.

A verifier waits for `html[data-wdu-ready="true"]`. Its timeout bounds the wait
and reports failure; the timeout itself never changes the marker and never counts
as ready. For a target outside this contract, the verifier may use its existing
font, asset, and application readiness checks, but it must not claim deterministic
capture.

## 7. Evidence checklist

Before calling a dynamic capture deterministic, verify:

- [ ] Requested and resolved modes both report `WDU_DETERMINISTIC=1`.
- [ ] Scene systems receive the injected clock and have no direct wall-clock path.
- [ ] The root seed and sorted seed-name list are recorded, with no unnamed random
      source.
- [ ] The requested camera-station id exists and its complete shot was applied.
- [ ] The ready marker appeared only after the first stable frame rendered.
- [ ] A readiness timeout remains a failure rather than a substitute signal.

The copyable runtime and byte-identical two-run fixture are separate executable
tasks. This reference defines their contract and does not claim those later gates
have passed.
