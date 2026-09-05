# Dependencies and asset optimization

What the generated code expects to be installed, and how assets are prepared.

## Common dependencies

Install only what the selected implementation uses:

```bash
# Motion for React
npm i motion

# Core R3F
npm i three @react-three/fiber @react-three/drei

# WebGL postprocessing only
npm i @react-three/postprocessing

# Scroll storytelling
npm i gsap lenis

# Camera damping
npm i maath

# Development profiling
npm i -D r3f-perf leva
```

For `/verify`, probe the host-neutral adapter first:

```bash
node scripts/verify-browser.mjs --probe
node scripts/verify-browser.mjs \
  --url http://127.0.0.1:3000 \
  --out output/playwright/verify/manual
```

For a project that declares interaction checkpoints, `--checkpoints <manifest>`
switches the adapter to checkpoint capture mode: it captures every declared
checkpoint (hover before/during/after, click before/peak/recovered, scroll at
declared normalized progress, focus before/during/after, keyboard and touch
before/peak/recovered, loading, ready, failure, and — only when the manifest
declares them — audio locked/enabled/muted/returning) under deterministic
mode into `checkpoints/<checkpoint-id>.png`, with timestamp-free metadata in
`checkpoints.json` and a status summary in `checkpoints-summary.json`. The
manifest is the project's declaration (`interaction-checkpoints.schema.json`,
bound by `core-rules/references/determinism.md` §7); the adapter implements
only generic drivers — pointer move/down/up, Tab and Enter/Space, a held touch
tap, and the declared audio gesture/control/storage surfaces — and exits 1 on
any failed checkpoint, 2 when deterministic mode is not resolved. Keyboard and
touch peaks wait for the same declared outcome state as the click peak, and
audio entries run only when sound is declared: a silent deliverable captures
no audio state, and unlock, mute persistence, and the voice limit are recorded
as evidence when audio checkpoints do run.

Two capture sets are comparable offline with the root-only comparator
(`templates/runtime/compare-baselines.mjs`): pass a
committed baseline directory and a candidate run directory with
`--baseline`/`--candidate`, optionally a comparison declaration
(`baseline-comparison.schema.json`, `--declaration`) that names pixel masks
and tolerances, and an `--out` directory. It classifies every difference
into structural regression, perceptual difference, expected dynamic
variation, or nondeterministic content; a deterministic mismatch outside
every declared mask stays a perceptual difference and is never routed into a
dynamic bucket. The comparison refuses to run (exit 2, `UNAVAILABLE`) when
either side lacks deterministic capture metadata, and writes diff PNGs plus
`comparison.json`, whose statement labels every score as evidence, never an
aesthetic verdict, taste, or approval.

For a runnable target with the shared immersive telemetry surface, the same
output directory also contains `performance-summary.json`: a timestamp-free
comparison of the declared three-gate budget with the fixed warm sample window,
first meaningful frame, and transfer completed before that marker. The top-level
`status` carries the launch-gate result; `comparison.status` reports only the
three budget gates. The summary also records separate browser, GPU, and telemetry
capabilities plus distinct resource-load, shader-compile, long-frame, and
context-loss evidence. What each status value means and obliges is defined once,
in `skills/core-rules/references/verification-status.md`.

Run the committed offline PASS/FAIL/UNAVAILABLE regression matrix from the
repository root with:

```bash
node --test tests/immersive/telemetry/ip-03c-status.test.mjs
```

The fixture matrix is evidence for status handling only; it is not a substitute
for a real browser capture.

The adapter accepts an explicit CLI, a compatible Codex wrapper, a CLI on
`PATH`, or the npm CLI only after the required session, `run-code`, and
screenshot capabilities pass. An explicit `WDU_PLAYWRIGHT_CLI` path overrides
fallback discovery; if it is missing, the probe reports the capability as
missing instead of silently selecting another backend. If no compatible CLI
exists, use the host’s native browser automation. A URL capture
still writes a non-empty `performance-summary.json` and `capture.json` when the
browser CLI is unavailable.

For an explicit plan/contract with no executable target, report
`NOT_APPLICABLE (plan-only)` and define the future capture matrix.

## Asset optimization

Inspect and validate before and after:

```bash
npx @gltf-transform/cli inspect input.glb
npx @gltf-transform/cli validate input.glb
npx @gltf-transform/cli optimize input.glb optimized.glb \
  --compress draco \
  --texture-compress webp
npx @gltf-transform/cli uastc optimized.glb optimized-ktx2.glb
npx @gltf-transform/cli validate optimized-ktx2.glb
```

Choose ETC1S or UASTC from texture content and quality needs. Do not blindly stack Blender Draco, glTF Transform, gltfpack, and `gltfjsx --transform`.
