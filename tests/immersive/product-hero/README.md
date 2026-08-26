# wdu-product-hero

The website-design-ultra immersive evaluation fixture (IP-07A): an R3F
product hero that installs, builds, and loads offline, exercising one
optimized model, semantic DOM copy, portrait reframe, poster, reduced motion,
and the shared quality and telemetry surfaces.

This project lives outside the installed plugin payload by design
(`docs/adr/ADR-011-immersive-production-distribution.md`): it is a root-only
evaluation fixture, independent from the forward routing suite under
`website-design-ultra/tests/forward/`.

## What it evaluates

The subject is the Orbit One portable speaker: a lathe body, a grille band, a
copper control ring, an LED, and a base — five authored materials merged to
two by the model pipeline, 3,122 visible triangles, two draw calls. That is
far below the `immersive-3d` §3 desktop budget of 100 draw calls and 500k
visible triangles, and the fixture reports the three telemetry gates against
its declared budget on every capture.

## Pinned matrix

Exact versions, recorded in `package.json` and `package-lock.json`:

| Package              | Version  |
| -------------------- | -------- |
| Next.js              | 15.5.24  |
| React                | 19.2.8   |
| three                | 0.185.1  |
| @react-three/fiber   | 9.7.0    |
| @gltf-transform/cli  | 4.4.2    |
| meshoptimizer        | 1.2.0    |
| TypeScript           | 5.9.3    |
| Node.js              | >= 22.18 (native type stripping for tests) |

There is intentionally no `@react-three/drei` in the matrix: its convenience
helpers fetch assets over the network, and this fixture must install, build,
and render offline.

## Quickstart

```bash
npm ci          # exact locked install
npm run dev     # live mode, wall clock
npm run typecheck
npm test
npm run build
```

## The one optimized model

`public/model/orbit-one.glb` is the runtime asset. It is produced by the
documented pipeline — `scripts/build-model.mjs` runs inspect, validate,
optimize, inspect, validate with the pinned `gltf-transform` CLI — and the
raw export plus every report is reproducible:

```bash
npm run model:generate   # exports the raw GLB to .wdu-model-source/ (gitignored)
npm run model:pipeline   # inspect -> validate -> optimize --compress meshopt -> inspect -> validate
```

Pipeline decisions, recorded in `reports/model/summary.json`:

- **Geometry codec: EXT_meshopt_compression.** The skill's rule is to choose
  compression from decode cost. The fixture model is primitive-scale: Draco
  would commit about 1.5 MB of WASM decoder to save a few dozen kilobytes,
  while meshopt decodes with three's bundled JS module, which Next bundles
  into the client chunk — no decoder file is fetched at runtime.
- **No KTX2 pass.** The model carries no authored textures. The optimize
  pipeline's palette transform creates two 32x4 px palette textures (122 B
  and 117 B) when it merges the five authored materials into two; both stay
  far below the 2048 px cap.
- **Validation is exit-0 clean** on the raw and optimized assets; the
  validator's information note about EXT_meshopt_compression is coverage
  notice, not an error. Runtime decode is proven end-to-end: the ready marker
  gates on the model, so every passing capture is evidence the meshopt GLB
  actually decoded and rendered.

## Capture entry point

Deterministic capture resolves the runtime flag per request at the
application boundary, so the same production build serves both modes:

```bash
npm run build
WDU_DETERMINISTIC=1 npm run start
```

- `WDU_DETERMINISTIC=1` is the only value that enables deterministic mode.
  Unset and every other value select live mode.
- `WDU_STATION` names the camera station applied before the stable-frame
  sequence. Unknown ids fail explicitly; there is no fallback to the first
  station. `hero-portrait` is the named portrait reframe.
- `WDU_REDUCED_MOTION=1` is the only value that selects the reduced-motion
  capture state: the product holds its seeded static pose, the motion
  control is locked, and the capture state is recorded as
  `html[data-wdu-motion="reduced"]`.
- The resolved mode is recorded on the document root as
  `html[data-wdu-mode="deterministic"]`.
- Readiness is `html[data-wdu-ready="true"]`, set only after the stable frame
  (frame 12) renders with the station applied, the manifest resolved, the
  model loaded, and the named streams initialized. In deterministic mode the
  render loop then freezes, so the canvas keeps presenting exactly the stable
  frame and captures are byte-identical.

The page is `force-dynamic` so the mode is never baked into a static page at
build time; the copy is still server-rendered into the initial HTML on every
request.

## Fixture driver

```bash
npm run verify:fixture -- --out /tmp/wdu-product-hero
```

`scripts/verify-fixture.mjs` runs the plugin verifier
(`website-design-ultra/scripts/verify-browser.mjs`, standard mode) against
the built fixture in three deterministic server configurations:

1. `WDU_DETERMINISTIC=1` — the desktop/mobile/reduced/fallback capture matrix
   plus the telemetry gates,
2. `WDU_DETERMINISTIC=1 WDU_REDUCED_MOTION=1` — the reduced-motion capture
   state,
3. `WDU_DETERMINISTIC=1 WDU_STATION=hero-portrait` — the portrait reframe.

Every run must exit 0, write the full artifact set (desktop, mobile, reduced
pair, fallback, snapshot, console log, performance summary), report PASS on
all three budget gates, and observe a first meaningful frame — which requires
the model to have loaded. A browser or deterministic-mode gap is
`UNAVAILABLE`, never a pass. The driver states its duration and artifact
directory in the final report.

## Shared telemetry surface

The fixture implements the runtime side of the IP-03 surface:
`window.__WDU_IMMERSIVE_TELEMETRY__` exposes `read()`, `collect()`, and
`rendererInfo()` in the shape the plugin verifier drives. The document
validates against the copied reference schema `lib/immersive-telemetry.ts`
(byte-identical to `references/immersive-telemetry.ts`, drift-tested), and
the budget declaration in `lib/budget-declaration.ts` states the three gates
with written justifications:

- warm GPU frame time — median and p95 at or under the declared 16.7 ms
  target after 60 warm-up frames over a 120-frame window;
- first meaningful frame — `html[data-wdu-ready="true"]` within 5 s;
- transfer before that marker — at most 3 MB of committed local assets.

One sample source: `QualityRuntime` feeds the same `clock.delta` to the
quality controller and the telemetry sampler once per rendered frame. In
deterministic mode the fixed 1/60 s step is the declared frame-time input, so
the document is byte-identical across runs; live mode reports measured
deltas. The quality slice (`tier`, `dpr`) comes from the copied controller's
`qualityState()` — this fixture never decides quality itself.

## Ownership boundaries

Enforced by `tests/structure.test.mjs`, part of the fixture contract:

- **One camera owner.** `components/CameraRig.tsx` is the only component
  that writes camera position, target, or field of view.
- **One clock.** `components/SceneRuntime.tsx` is the only `createClock`
  call site. Scene code contains no `performance.now()` or `Date.now()` path.
- **One asset manifest.** `lib/asset-manifest.json` is the single declared
  list of runtime assets: the brand mark, the two posters, and the model.
  The fixture fetches nothing it does not declare.
- **Wired determinism.** `lib/determinism-runtime.ts`, `lib/quality-controller.ts`,
  and `lib/immersive-telemetry.ts` are byte-identical copies of the repository
  references; `tests/runtime.test.mjs` fails if the copies drift.
- **One quality owner.** `lib/quality-controller.ts` owns Poster/Low/Medium/
  High transitions and DPR steps; `QualityRuntime` is the only site that
  writes pixel ratio or pauses the render loop, and the Canvas carries no
  `dpr` prop.
- **Readiness gates on the model.** `ProductModel` reports load completion
  through `markAssetsReady`; the ready marker cannot fire before the
  optimized GLB decoded and rendered.

## Scope

This is the IP-07A deliverable: the buildable fixture plus its install,
build, model-validation, runtime-smoke, and static-capture evidence. The
assertion runner (keyboard, mobile quality, interaction checkpoints,
deliberate failure fixtures) is the next queue item, IP-07B, and stays out of
this tree.

## License

MIT, matching the repository root. Part of the website-design-ultra immersive
production layer.
