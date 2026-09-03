# wdu-procedural-crystal — IP-10C fixture

The second immersive-evaluation fixture for the website-design-ultra production
layer. It proves that the J-C4 JavaScript crystal-growth source GLB passes
through the existing `3d-asset-pipeline` unchanged, lands as a committed
Draco-compressed GLB, decodes through a local Draco decoder (no CDN, no runtime
fetch), and survives the same evaluation gates the product-hero fixture does.

## Fixture surface

- `app/` — server-rendered page that resolves WDU_DETERMINISTIC, WDU_STATION
  and WDU_REDUCED_MOTION per request and renders the canvas through
  `next/dynamic` so the R3F module is client-only.
- `components/` — ActivationControl, CameraRig, ContextLossGate,
  ModelErrorBoundary, MotionControl, Poster, ProductModel, QualityRuntime,
  SceneCanvas, SceneClient, SceneErrorBoundary, SceneRuntime, ClientCanvas.
- `lib/` — runtime-config, determinism-runtime (clock + PRNG + station
  lookup + stable-frame marker), camera-stations, motion-preference,
  immersive-telemetry + budget + device-profile, telemetry-surface,
  quality-config + quality-controller, scene-config, asset-manifest.json,
  interaction-checkpoints.json.
- `public/` — brand-mark.svg, poster-desktop.svg, poster-portrait.svg,
  /model/procedural-crystal.glb (committed, Draco-compressed),
  /draco/draco_decoder.{js,wasm} + draco_wasm_wrapper.js (committed,
  pinned via three@0.185.1 in package-lock.json).
- `reports/model/` — pre-inspect.txt, pre-validate.log, post-inspect.txt,
  post-validate.log, summary.json — every raw pipeline artifact plus a
  committed structured summary.
- `scripts/build-model.mjs` — the documented pipeline driver; it consumes the
  JS-generated raw GLB without changing the existing handoff.
- `tests/*.test.mjs` — fixture-structure, model, runtime, telemetry-surface
  offline tests.

## Pipeline contract

```
inspect (raw)   → reports/model/pre-inspect.txt
validate (raw)  → reports/model/pre-validate.log
optimize        → public/model/procedural-crystal.glb
                  (--compress draco --texture-compress false)
inspect (opt)   → reports/model/post-inspect.txt
validate (opt)  → reports/model/post-validate.log
summary         → reports/model/summary.json
```

The optimize command is the canonical command from
`procedural-generation/recipe.json`. Both the recipe and the durable report
must record `--compress draco --texture-compress false` (texture-free asset,
one optimize invocation).

## Run the pipeline

```
npm ci
node scripts/build-model.mjs
npm run build
WDU_DETERMINISTIC=1 npm run start
node tests/immersive/evaluation/run-implementation-evaluation.mjs \
  --fixture procedural-crystal --out /tmp/wdu-procedural-crystal
```

## Fixture verification gate

The committed `reports/model/summary.json` plus the four raw
inspect/validate logs are the durable evidence the verifier reads back. The
procedural-generation `test_handoff.py` parses the OPTIMIZED GLB (not the
generator's pre-export counts), confirms the Draco extension is declared,
and asserts the budget gate readings against the desktop/mobile budgets.

`UNAVAILABLE` is never `PASS` — when Blender or the glTF CLI is missing, the
verifier exits 2 and the queue item stays unchecked.