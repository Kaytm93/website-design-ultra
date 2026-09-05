---
name: 3d-runtime-quality
description: Design and implement stable runtime quality for Three.js, R3F, WebGL, or WebGPU scenes. Use for Poster, Low, Medium, and High tiers; adaptive shadows, LOD, postprocessing, particles, DPR, frame-time monitoring, offscreen pause, thermal slowdown, or quality hysteresis without visible oscillation.
---

# 3D Runtime Quality

Keep the visual statement from `3d-art-direction` inside the budget from
`immersive-3d`. One controller owns quality; it is not a pile of independent
auto-optimizers.

## Runtime contract

Define before implementation. Values below are an example; concrete profiles live
in [references/tier-matrix.md](references/tier-matrix.md). The shared telemetry
surface is in [references/telemetry-contract.md](references/telemetry-contract.md),
[references/telemetry-schema.json](references/telemetry-schema.json), and
[references/telemetry-collection.md](references/telemetry-collection.md). Copy
the zero-dependency controller from `templates/runtime/quality-controller.ts`.

```yaml
initial-tier: "medium"
available-tiers: [poster, low, medium, high]
target-frame-ms: 16.7
degrade-window-ms: 2000
upgrade-window-ms: 8000
cooldown-ms: 10000
session-persistence: true
pause-when: [offscreen, document-hidden]
quality-owner: "QualityController"
```

Do not infer truth from user agent, memory, cores, or DPR alone; correct from
measured runtime. Report `PASS`, `FAIL`, `UNAVAILABLE`, or `NOT_APPLICABLE` as
`core-rules/references/verification-status.md` defines them.

## Workflow

1. Take the scene budget from `immersive-3d`.
2. Fill Poster/Low/Medium/High in `references/tier-matrix.md`.
3. Assign one owner and a fixed degradation order.
4. Measure frame time after warm-up, excluding compile, resize, hidden time, and
   navigation; retain the three telemetry gates and context as evidence.
5. Change one step at a time with hysteresis, cooldown, and persistence. Read
   [references/adaptive-runtime.md](references/adaptive-runtime.md).
6. Pause render, mixer, controls, particles, and measurement offscreen/hidden.
7. Check desktop, mobile, reduced motion, poster, and fallback in a real browser
   with `scripts/verify-browser.mjs` as the launch gate; unavailable hardware
   stays unverified.

## Ownership and degradation

Store `tier` centrally and derive DPR, shadows, LOD, PostFX, particles, and loop
state from it. Do not alter camera, brand color, tone mapping, or content order
between tiers. Use poster as a real no-canvas state and keep the DOM alternative.
A suitable subject-specific order is: secondary particles/PostFX, shadow cost,
small DPR steps, LOD/material complexity, then poster. A `render-graph` supplies
pass-level order; this controller alone decides the tier.

Deliver the matrix, thresholds/windows/cooldown/persistence, pause behavior,
renderer-specific PostFX choice, fallback artifacts, and honest verification
status including the open capture matrix whenever status requires it.

## Check

- [ ] Poster, Low, Medium, and High have explicit values.
- [ ] One owner controls DPR, shadows, LOD, PostFX, and particles.
- [ ] Upgrades take longer than downgrades; a cooldown prevents oscillation.
- [ ] Warm-up, resize, and hidden time do not distort the measurement.
- [ ] Offscreen and `document.hidden` pause render work.
- [ ] Reduced motion stops nonessential movement independently of the quality tier.
- [ ] Poster and DOM alternative stay functional and art-directed.
- [ ] Without real browser artifacts, neither `PASS` nor launch readiness is claimed.
