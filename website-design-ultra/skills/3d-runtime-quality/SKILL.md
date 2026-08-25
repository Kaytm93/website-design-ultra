---
name: 3d-runtime-quality
description: Design and implement stable runtime quality for Three.js, R3F, WebGL, or WebGPU scenes. Use for Poster, Low, Medium, and High tiers; adaptive shadows, LOD, postprocessing, particles, DPR, frame-time monitoring, offscreen pause, thermal slowdown, or quality hysteresis without visible oscillation.
---

# 3D Runtime Quality

Preserve the visual statement from `3d-art-direction` within the budget from `immersive-3d`. Treat quality as one central state machine, not as a collection of independent auto-optimizations.

## Runtime contract

Define before implementation. The block below is the schema, not the values.
The versioned project budget and shared renderer/controller/verifier evidence
surface live in [references/telemetry-contract.md](references/telemetry-contract.md),
[references/telemetry-schema.json](references/telemetry-schema.json), and the
verifier protocol in [references/telemetry-collection.md](references/telemetry-collection.md).
Copy the repository-root `references/immersive-telemetry.ts` reference into a project; do not infer a
frame-time threshold from fps or promote context counters into universal gates.
The copyable zero-dependency mechanism for tier transitions, DPR steps,
hysteresis, offscreen pause, and thermal backoff is the repository-root
`references/quality-controller.ts`; it owns no quality values — those stay in
`references/tier-matrix.md` and this skill.
`initial-tier` and the window lengths are one filled example; the concrete
Poster, Low, Medium, and High profiles live in
[references/tier-matrix.md](references/tier-matrix.md), and `immersive-3d` §3
points here for exactly those numbers. A contract filled from this block alone
carries no tier definitions at all.

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

Derive the initial tier from conservative signals, but correct it only from measured runtime. Never use user agent, `deviceMemory`, `hardwareConcurrency`, or DPR alone as a source of truth.

## Workflow

A step that names a reference requires it before that step can be answered.
Answering the step from this file alone leaves it unfilled.

1. Set the overall budget in `immersive-3d`.
2. Define concrete Poster/Low/Medium/High profiles. Read [references/tier-matrix.md](references/tier-matrix.md).
3. Assign one quality owner and a fixed degradation order.
4. Measure frame time after warm-up; ignore asset compile, resize, background tabs, and navigation.
5. Change at most one step per decision and prevent oscillation with hysteresis, cooldown, and session persistence. Read [references/adaptive-runtime.md](references/adaptive-runtime.md).
6. Pause render loop, mixer, controls, particles, and measurement in the offscreen or hidden state.
7. Check every tier in a real browser on desktop, mobile, reduced motion, and
   poster/fallback. Use the capability-checked `scripts/verify-browser.mjs`
   adapter from the plugin, or real host browser automation with the same state
   matrix. A slash command or a Codex path is not a prerequisite.

With a runnable target, the mandatory step ends in `PASS`, `FAIL`, or
`UNAVAILABLE`. `UNAVAILABLE` applies when the required browser, GPU, or telemetry
capability is missing, or the target cannot be reached. Run build/typecheck plus
static poster, DOM, and reduced-motion checks, hand over the experience explicitly
as **unverified**, and leave the launch gate open. These checks do not replace
visual or telemetry verification.
For a pure plan/contract without a runnable target, use `NOT_APPLICABLE
(plan-only)` plus the planned capture matrix; as soon as an implementation runs,
the check becomes the launch gate.

## Quality ownership

- Store `tier` centrally; derive DPR, shadows, LOD, PostFX, particles, and render loop from it.
- Avoid multiple adaptive systems that change DPR or effects at the same time.
- Switch expensive shader/PostFX variants rarely, because material recompiles can themselves cause stutter.
- Do not change camera, brand color, tone-mapping curve, or content order between tiers.
- Use poster as a real state: do not mount the canvas, or stop it completely.

## Degradation order

Choose the order by subject and document it. A sensible starting point:

1. reduce non-content particles and secondary PostFX,
2. lower shadow resolution/update frequency or switch to blob/baked,
3. lower DPR in small steps,
4. reduce LOD and material complexity,
5. switch to poster when interaction or stability would otherwise become unreliable.

When a `render-graph` chain is present, its declared pass-level order supplies
steps 1 and 2. This controller decides the tier; the chain decides which pass
that tier drops and at which resolution scale. Two systems deciding that
independently is the oscillation this skill exists to prevent.

Never remove the DOM alternative, selection states, or CTA functionality.

## Output

Deliver:

1. the tier matrix,
2. measurement windows, thresholds, cooldown, and persistence,
3. offscreen/visibility behavior,
4. the renderer-specific PostFX decision,
5. the poster/fallback path and verification artifacts,
6. verification status, backend, and on `UNAVAILABLE` or `NOT_APPLICABLE` the
   open capture matrix.

## Check

- [ ] Poster, Low, Medium, and High have explicit values.
- [ ] One owner controls DPR, shadows, LOD, PostFX, and particles.
- [ ] Upgrades take longer than downgrades; a cooldown prevents oscillation.
- [ ] Warm-up, resize, and hidden time do not distort the measurement.
- [ ] Offscreen and `document.hidden` pause render work.
- [ ] Reduced motion stops nonessential movement independently of the quality tier.
- [ ] Poster and DOM alternative stay functional and art-directed.
- [ ] Without real browser artifacts, neither `PASS` nor launch readiness is claimed.
