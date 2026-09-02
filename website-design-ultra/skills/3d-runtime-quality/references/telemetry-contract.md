# Immersive telemetry contract

Version 1 of the immersive telemetry surface is the one document shared by the
renderer, the quality controller, and the verifier. The formal JSON Schema is
`telemetry-schema.json`. The zero-dependency TypeScript reference that a project
copies ships with the plugin as `templates/runtime/immersive-telemetry.ts`; it
validates the same shape without becoming an npm package.

This reference is reached after `immersive-3d` has justified a shipped 3D
experience and `3d-runtime-quality` owns runtime adaptation. It does not
activate canvas-first architecture, render-graph, loading choreography, audio,
or any other advanced add-on. Ordinary 2D work and an ordinary 3D hero do not
start those modules.

## Versioned document shape

Every document has exactly these top-level fields:

```text
schemaVersion: 1
surface: wdu.immersive-telemetry
deviceProfile: the declared browser, renderer, viewport, scale factor, and network
budget: project-owned frame target and exactly three gate declarations
runtime: renderer, quality, frame, error, and context-loss evidence
```

`deviceProfile` is required even when the project uses a conservative target.
It identifies the conditions under which a budget is meaningful. Every measured
quantity is an object with both `value` and `unit`; a bare number is invalid.
The supported units are `fps`, `ms`, `bytes`, `count`, `frames`, `css-px`, and
`ratio`.

A frame-rate target never silently becomes a frame-time threshold. A project
must write both values and a non-empty `justification`, for example:

```json
"frameTarget": {
  "rate": { "value": 30, "unit": "fps" },
  "frameTime": { "value": 33, "unit": "ms" },
  "justification": "30 fps is the declared target for the mid-range device profile; 33 ms is the explicit project ceiling."
}
```

The schema has no defaults for a device, frame rate, duration, transfer size,
or gate threshold. Missing units, a missing device profile, and an fps-only
budget are validation failures rather than invitations to infer a value.

## The three universal gate classes

`budget.gates` is an array of exactly three entries. Their class names are
versioned and exhaustive:

1. `warm-gpu-frame-time` — declares explicit millisecond targets for both the
   warm-sample median and p95, plus a warm-up count and a measured-window count
   in `frames`. The warm window excludes asset/shader warm-up and other samples
   the project declares out of scope.
2. `first-meaningful-frame` — declares the stable-frame marker, an explicit
   target in `ms`, and the comparison. The marker is the boundary for the
   meaningful frame, not an arbitrary screenshot timeout.
3. `transfer-before-first-meaningful-frame` — declares the boundary as
   `first-meaningful-frame` and an explicit transfer target in `bytes`.

The schema rejects a fourth class, including a `long-frame-count` or
`context-loss` class. Those values are evidence and must not become universal
release gates by appearing in `budget.gates`.

## Runtime ownership

The `runtime` object is a read surface, not a second budget. Each owner writes
only its fields:

- The renderer reports `frame.warmGpu.samples`, the derived observed median and
  p95 when available, `frame.longFrameCount`, `renderer.api`, the five
  `renderer.counters` values, resource/shader/runtime `errors`, and
  `contextLoss.count` plus event evidence. The counter units are `ms`, `count`,
  or `frames` as appropriate.
- The quality controller reports one active `quality.tier` (`poster`, `low`,
  `medium`, or `high`) and its capped `quality.dpr` as a `ratio`. It remains the
  one owner of tier-derived runtime settings.
- The verifier reads the declared `deviceProfile` and `budget` together with
  this runtime surface. It invokes the project-owned
  `window.__WDU_IMMERSIVE_TELEMETRY__` collection method, recalculates the fixed
  warm window, and emits `performance-summary.json`. The collection protocol,
  marker boundary, raw `renderer.info` preservation, and timestamp-free output
  are specified in [references/telemetry-collection.md](telemetry-collection.md).
  It may report gate results only for the three declared classes above.

Before the meaningful frame exists, `firstMeaningfulFrame.observed` and
`transfer.observed` may be `null`. That is an incomplete observation, not a
passing result. Errors and context loss remain inspectable evidence even when
zero; a zero context-loss count is still represented with `{ "unit": "count" }`.

## Example and fixture coverage

The source-repository fixture at
`repo:tests/immersive/telemetry/fixtures/valid-30fps.json` demonstrates a complete
30 fps / 33 ms declaration, all three gates, renderer counters, the Medium tier,
DPR, empty errors, and zero context loss. The accompanying Node test exercises
that fixture and negative cases for missing units, missing device profile,
an fps-derived implicit threshold, and a fourth gate class.

This contract does not measure GPU time, calculate percentiles, or emit
`performance-summary.json`; those are verifier responsibilities. The verifier's
IP-03C status layer consumes the same error/context fields and adds explicit
browser, GPU, and telemetry capability evidence without changing the three gate
classes or adding a hidden threshold.
