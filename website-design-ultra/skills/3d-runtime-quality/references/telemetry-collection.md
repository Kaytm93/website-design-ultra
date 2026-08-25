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

The adapter probes the declared renderer path independently of the surface. It
records `webgpu`, `webgl2`, and `webgl` context evidence and marks `gpu` as
`UNAVAILABLE` only when no usable GPU API can be created; a declared path that
is absent while another usable path exists remains explicit evidence. A present
global is not GPU evidence. The browser CLI is a separate capability checked
before capture; an explicit `WDU_PLAYWRIGHT_CLI` path overrides discovery, so a
missing explicit path cannot silently fall through to another backend.

The summary carries three capability records — `browser`, `gpu`, and
`telemetry` — each with `AVAILABLE` or `UNAVAILABLE`, a reason when unavailable,
and the evidence that produced the decision. A missing surface, failed
collection, missing GPU, or missing browser CLI leaves the summary non-passing
and records the same distinction in `unavailable`.

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
comparisons, capability status, evidence source, raw renderer context, quality,
long-frame/error/context-loss context, a `failureEvidence` block, and an
`unavailable` object with a stable reason for every missing field. The summary
intentionally contains no `generatedAt`, `timeOrigin`, wall clock, process id,
output path, or raw request timestamp. Its JSON key order and measurement window
are stable; observed measurements remain real browser data, not synthetic
constants.

`comparison.status` is only the result of the three declared budget gates.
The top-level `status` is the launch-gate result: it is `PASS` only when all
three comparisons pass, all browser/GPU/telemetry capabilities are available,
and no resource-load error, shader-compile error, runtime error, or context-loss
event is reported. A failed gate or runtime failure is `FAIL`; a missing
capability or required measurement is `UNAVAILABLE`. Long-frame count is
explicitly captured in `failureEvidence.longFrames` as context rather than
inventing a fourth universal budget gate. Neither unavailable capability nor a
missing summary can be reported as `PASS`.
