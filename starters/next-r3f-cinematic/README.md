# next-r3f-cinematic

A technical fixture: a server-rendered Next.js page around a client-only React
Three Fiber canvas leaf, with explicit runtime ownership boundaries.

Visual development is paused. The page, crystal, lighting and posters are test
inputs, not design examples for new websites. Reuse technical mechanisms as
needed and derive new visuals from the project's brief. Functional, accessibility,
fallback and performance maintenance continues.

This project lives outside the installed plugin payload by design
(`docs/adr/ADR-011-immersive-production-distribution.md`): skills reference it
by repository path and version, and it is never copied into
`website-design-ultra/`.

## Pinned matrix

Exact versions, recorded in `package.json` and `package-lock.json`:

| Package              | Version  |
| -------------------- | -------- |
| Next.js              | 15.5.24  |
| React                | 19.2.8   |
| three                | 0.185.1  |
| @react-three/fiber   | 9.7.0    |
| TypeScript           | 5.9.3    |
| Node.js              | >= 22.18 (native type stripping for tests) |

There is intentionally no `@react-three/drei` in the matrix: its convenience
helpers fetch assets over the network, and this scaffold must install, build,
and render offline.

## Quickstart

```bash
npm ci          # exact locked install
npm run dev     # live mode, wall clock
npm run typecheck
npm test
npm run build
```

## Capture entry point

Deterministic capture resolves the runtime flag per request at the application
boundary, so the same production build serves both modes:

```bash
npm run build
WDU_DETERMINISTIC=1 WDU_STATION=hero-wide npm run start
```

- `WDU_DETERMINISTIC=1` is the only value that enables deterministic mode.
  Unset and every other value select live mode.
- `WDU_STATION` names the camera station applied before the stable-frame
  sequence. Unknown ids fail explicitly; there is no fallback to the first
  station. `hero-portrait` is the named portrait composition.
- `WDU_REDUCED_MOTION=1` is the only value that selects the reduced-motion
  capture state (IP-05C): the hero holds its seeded static pose, the motion
  control is locked, and the capture state is recorded as
  `html[data-wdu-motion="reduced"]`.
- The resolved mode is recorded on the document root as
  `html[data-wdu-mode="deterministic"]`.
- Readiness is `html[data-wdu-ready="true"]`, set only after the stable frame
  (frame 12) renders with the station applied, the manifest resolved, and the
  named streams initialized. In deterministic mode the render loop then
  freezes, so the canvas keeps presenting exactly the stable frame and
  captures are byte-identical. Readiness is removed on station change, on
  context loss, and on unmount.

The page is `force-dynamic` so the mode is never baked into a static page at
build time; the copy is still server-rendered into the initial HTML on every
request.

## Posters

The poster is what a visitor sees while the canvas loads, at the poster quality
tier, and after a lost WebGL context. It is a capture of this scene, taken
through the capture entry point above — not a drawing of it:

```bash
npm run capture:poster
```

The script builds the starter, serves it once per variant with
`WDU_DETERMINISTIC=1` and that variant's `WDU_STATION`, waits for
`html[data-wdu-ready="true"]`, screenshots the canvas, and writes each file's
SHA-256 and capture record into `lib/asset-manifest.json`. `npm test` compares
the declared hash against the bytes on disk, so a poster edited by hand fails
rather than drifts.

| Variant | Station | Size | Why that size |
| --- | --- | --- | --- |
| `poster-desktop.png` | `hero-wide` | 1200x676 | `.scene-frame` is 1104x560 on a desktop and 720x399 on a tablet; 16:9 covers both. |
| `poster-portrait.png` | `hero-portrait` | 1000x1001 | On a phone the frame is 342x320 — very nearly square. "Portrait" names the device, not the shape. |

`.scene-poster` fills the frame with `object-fit: cover`, so a poster whose
aspect ratio disagrees with the frame is simply cropped away.

Pass `--skip-build` to reuse an existing `.next`. The script needs a Playwright
CLI: `WDU_PLAYWRIGHT_CLI`, one on `PATH`, or `npx`. Without one it reports
`CAPTURE_POSTER: UNAVAILABLE` and exits 2, leaving the committed posters alone —
an unavailable browser is not a reason to ship a blank frame.

The bytes are not reproducible across machines. A GPU renders them, and a macOS
Metal backend, a CI software rasterizer, and the next Chromium release disagree
about antialiasing edges. The poster is therefore a committed artifact with a
recorded provenance, on the same footing as any other rendered asset here.

## Interaction checkpoints (IP-06A)

The project owns its interaction capture declaration:
`lib/interaction-checkpoints.json` (schema:
`website-design-ultra/skills/core-rules/references/interaction-checkpoints.schema.json`,
validator: `references/interaction-checkpoints.ts`, copied byte-identical into
`lib/interaction-checkpoints.ts`). It declares:

- hover before/during/after and click before/peak/recovered on the hero, driven
  through a deterministic pointer target (`[data-wdu-pointer-target]`, a 2x2 px
  capture anchor projected near the crystal's front-facing lower facet),
- scroll at declared normalized progress (0, 0.5, 1),
- loading (`?wdu-loading=1`, the declared loading capture state that holds
  asset readiness so the composed poster surface stays visible
  deterministically), ready (the stable-frame marker), and failure (forced
  WebGL context loss through `WEBGL_lose_context`).

### Keyboard, touch, and focus (IP-06B)

The manifest additionally declares focus before/during/after and keyboard and
touch before/peak/recovered, all targeting the activation control
(`[data-wdu-activation-target]`, the "Press the hero" button in the DOM
controls). Keyboard (Tab to the control, Enter to press) and touch (a held
tap through the browser's touch input pipeline) reach the same product
outcome as pointer input: the peak entries declare the identical
`html[data-wdu-pointer="pressed"]` state condition as the click peak, and
the hero pose that results is the same pressed pose. Focus-visible is
recorded on the document root (`html[data-wdu-focus]`), and the during
condition is the control's own `:focus-visible` state.

The starter ships no sound, so it declares no audio checkpoints — audio tests
never run for this silent deliverable. The interaction fixture suite
(`tests/immersive/interaction-capture/verify-interaction-fixtures.mjs`) runs
the verifier against both this manifest and the sound-present fixture, and
asserts that the silent side captures zero audio entries while the sound side
observes unlock, mute persistence, and the voice limit.

The pointer interaction is real product behaviour: hovering lifts the hero
(scale 1.03 plus an emissive lift), pressing compresses it (scale 0.97). The
state is written synchronously in the pointer handler, readiness is invalidated
as a capture-state change without resuming the frozen clock, and the ready
marker re-sets on the next rendered frame — so the captured pose is a pure
function of the frozen clock and the declared state, never of input timing.

Capture every declared checkpoint twice and compare stable states:

```bash
npm run build
node ../../tests/immersive/interaction-capture/compare-checkpoints.mjs \
  --out /tmp/wdu-ip06a-comparison
```

or, once built, with an explicit empty output directory:

```bash
npm run verify:ip06a -- --out /tmp/wdu-ip06a-comparison
```

The npm script passes arguments through to the comparator; `--out` is required
so a run never overwrites evidence from an earlier capture. The comparator starts the server with
`WDU_DETERMINISTIC=1`, runs the plugin verifier twice with
`--checkpoints lib/interaction-checkpoints.json`, and requires byte-identical
PNGs per checkpoint id plus identical timestamp-free metadata
(`checkpoints.json`). A browser or deterministic-mode gap is `UNAVAILABLE`,
never a pass.

## Ownership boundaries

These are enforced by `tests/structure.test.mjs` and are part of the scaffold
contract, not conventions:

- **One camera owner.** `components/CameraRig.tsx` is the only component that
  writes camera position, target, or field of view. It applies the selected
  `CameraStation` idempotently before every render.
- **One clock.** `components/SceneRuntime.tsx` is the only `createClock` call
  site. It ticks once per rendered frame (priority 0) and evaluates the
  stable-frame marker after the visible render (priority -1). Scene code
  contains no `performance.now()` or `Date.now()` path.
- **One asset manifest.** `lib/asset-manifest.json` is the single declared
  list of runtime assets. It includes the header mark, both posters, the
  procedural crystal model, the local HDRI, and the local Draco decoder files.
- **Wired determinism.** `lib/determinism-runtime.ts` is a byte-identical copy
  of the repository reference `references/determinism-runtime.ts` (IP-02B) and
  `tests/runtime.test.mjs` fails if the copies drift. The root seed is
  `next-r3f-cinematic-v1`; the hero rotation phase reads the named
  `hero-motion` stream.
- **One quality owner.** `lib/quality-controller.ts` is a byte-identical copy
  of the repository reference `references/quality-controller.ts` (IP-05B): a
  zero-dependency controller that owns Poster/Low/Medium/High transitions, DPR
  steps, hysteresis, offscreen pause, and thermal backoff. It is created at
  exactly one site (`SceneRuntime`) with time injected from the scene clock,
  so in deterministic mode its decisions are a pure function of the fixed-step
  clock and the declared frame-time input. `QualityRuntime` is the only
  component that writes pixel ratio (`gl.setPixelRatio`) or pauses the render
  loop (`setFrameloop`); the Canvas carries no `dpr` prop. The controller
  holds no values: every number is filled from `lib/quality-config.ts`, which
  declares the project's tier matrix and hysteresis windows from the
  `3d-runtime-quality` skill (tier-matrix.md, adaptive-runtime.md). The
  controller reports the IP-03 telemetry slice through `qualityState()` —
  `{ tier, dpr: { value, unit: 'ratio' } }` — and fires `onChange` only when
  the tier or DPR actually changes, never per frame.

## Scene systems and the injected clock

`SceneRuntime` creates the clock, the seeded stream root, and the ready marker
once per mount. `CameraRig` runs at priority 0 (child registration order puts
it before the tick; it does not read time). The clock ticks at priority 0,
`HeroObject` reads `clock.elapsed` at priority 1, and the marker check runs at
priority -1, after the visible render. Every speed is per-second, so motion is
frame-rate independent in both modes.

In live mode the station control (DOM, outside the canvas) switches named
stations. In deterministic mode the control is locked: input must not move the
camera during the stable-frame sequence.

## Scope of this scaffold

This is the IP-05A/IP-05B/IP-05C scaffold plus the IP-06A/IP-06B/IP-06C
interaction-capture and comparison layers. The quality controller
(Poster/Low/Medium/High, IP-05B) is implemented and wired as the single
quality owner. The fallback and lifecycle contracts (IP-05C) are implemented
in this tree: the desktop and portrait posters captured from the scene, the
motion control with WDU_REDUCED_MOTION capture state, context-loss recovery
through a DOM restore action, the named hero-portrait station, and disposal
wiring with a diagnostic handle (`globalThis.__WDU_CINEMATIC__`) for
lifecycle resource assertions. The interaction checkpoints (IP-06A) are
declared in `lib/interaction-checkpoints.json` with real pointer behaviour on
the hero and a two-run byte-identical comparison through the plugin verifier.
IP-06B adds generic keyboard, touch, and focus-visible drivers plus a
sound-present fixture that records unlock, mute persistence, and voice-limit
evidence while the silent starter declares no audio checkpoints. IP-06C adds
an optional baseline comparator with structural, perceptual, expected-dynamic,
and nondeterministic-content classes; it never renders a score as an aesthetic
verdict.
The automated IP-05C verification driver
(`scripts/verify-ip05c.mjs`) is a later queue item's work; until it lands,
the browser evidence for those contracts is the manual matrix documented in
the queue item.

## License

MIT, matching the repository root. Part of the website-design-ultra immersive
production layer.
