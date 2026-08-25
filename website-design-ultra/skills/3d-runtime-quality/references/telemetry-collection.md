# Immersive telemetry collection

`verify-browser.mjs` reads the project-owned surface from
`window.__WDU_IMMERSIVE_TELEMETRY__`. `window.__WDU_TELEMETRY__` is accepted as a
compatibility alias. The global is not itself the schema document: it may carry
methods and raw renderer evidence in addition to the versioned document returned
by `read()`.

## Shared surface

A project exposes this minimal shape:

```js
window.__WDU_IMMERSIVE_TELEMETRY__ = {
  read() {
    return telemetryDocument
  },
  async collect({ warmupFrames, sampleWindow }) {
    // Exclude exactly warmupFrames, then publish exactly sampleWindow samples.
    // Return or update the same document that read() returns.
  },
  rendererInfo: renderer.info,
}
```

`read()` returns the IP-03A telemetry document. `collect()` is called once after
page settling. It owns the warm-up and sample boundary; the verifier does not
pad, trim, infer, or replace a short sample window. The verifier recomputes `runtime.frame.warmGpu.median` and `p95` from the
published samples. Median uses the middle value (or the mean of the two middle
values for an even window); p95 uses the deterministic nearest-rank
`ceil(sampleCount × 0.95)` value. Stale precomputed values cannot hide a
mismatch.

`rendererInfo` is optional raw `renderer.info` evidence. It stays outside the
IP-03A document because Three's `memory`, `render`, and `programs` fields are
renderer-specific. The verifier preserves this object verbatim in the summary
and separately preserves the normalized `runtime.renderer.counters` values.

A surface without `collect()` may expose an already-completed runtime snapshot;
that path is labelled `surface-snapshot` in the evidence. It still must contain
exactly the declared sample-window count to produce median and p95. Missing or
short data is `UNAVAILABLE`, never a pass.

## Meaningful-frame and transfer boundary

The document's `runtime.frame.firstMeaningfulFrame.observed` is a duration from
navigation start to the declared marker, not a wall-clock timestamp. When
resource timing entries exist, the verifier includes only entries whose
`responseEnd` is at or before that duration. Entries finishing afterward are
counted as ignored evidence and never enter `transfer.observed`. If no usable
resource timing is exposed, the verifier uses the surface's already-bounded
transfer value; a missing value remains explicitly unavailable.

The transfer gate is always compared against the declared
`transfer-before-first-meaningful-frame` budget. No whole-page transfer total or
arbitrary screenshot timeout may substitute for the marker boundary.

## Deterministic summary

The verifier writes `performance-summary.json` beside the visual artifacts. It
contains the device profile and budget, observed quantities, the three gate
comparisons, evidence source, raw renderer context, quality/error/context-loss
context, and an `unavailable` object with a stable reason for every missing
field. The summary intentionally contains no `generatedAt`, `timeOrigin`, wall
clock, process id, output path, or raw request timestamp. Its JSON key order and
measurement window are stable; observed measurements remain real browser data,
not synthetic constants.

The overall result is `PASS` only when all three declared gate comparisons pass,
`FAIL` when any gate fails, and `UNAVAILABLE` when no gate fails but one or more
required observations cannot be read. Renderer counters, long-frame count,
quality, errors, and context loss remain evidence in this PR; they do not become
additional universal gates.
