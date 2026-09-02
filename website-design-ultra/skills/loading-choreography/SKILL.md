---
name: loading-choreography
description: Design the sequence from first byte to first interactive frame — asset manifest, priority buckets, a progress readout backed by a real signal, off-thread decode, shader warm-up, the skip path, and the failure path. Use only when the first meaningful frame depends on assets that cannot arrive in one request. A single model behind Suspense, a hero image, or a font swap does not activate this skill.
---

# Loading Choreography

Use loading as a designed state when the first meaningful frame needs several
ordered assets, costly decode, an art-directed arrival, or later-section assets
that must not pop in. One model behind Suspense, a poster, or a font swap stays in
`r3f-patterns`/`core-rules`.

## First-frame contract

Fill before implementation; the block is a schema, not defaults.

```yaml
first-meaningful-frame: "what is on screen, and what it says"
critical-bucket: "assets without which that frame is wrong"
near-bucket: "needed by the first interaction"
deferred-buckets: "per later section, fetched on approach"
progress-source: "weighted asset completion"
progress-display: "percentage | state label | indeterminate"
intro-motion: "declared duration, or none"
skip-path: "control, keyboard target, returning-visitor behavior"
reduced-motion-path: "what replaces the intro"
failure-path: "per bucket, with a timeout"
warm-up: "which materials compile before the reveal"
```

Read [references/manifest-and-buckets.md](references/manifest-and-buckets.md) for
manifest/buckets and [references/warmup-and-first-frame.md](references/warmup-and-first-frame.md)
for compile, upload, reveal, and measurement.

## Rules and workflow

A percentage reports completed declared weight or known decoded bytes; without a
real signal use a state label. Never substitute unweighted counts, fake 90%, or a
fixed timeline for progress. Declare intro duration separately.

Nothing renders before its bucket completes. Decode off-thread when supported;
warm materials before reveal. The intro is visibly keyboard-skippable, not replayed
for a returning visitor in the session, and reduced motion goes directly to its
end state. Every bucket times out to the art-directed poster route from
`immersive-3d` §5. Keep the DOM alternative present during loading.

1. Name the first frame and its critical assets.
2. Sort near/deferred buckets and choose source/display together.
3. Implement warm-up, skip, reduced motion, failure, and DOM paths together.
4. Measure first meaningful frame on throttled network and a mid-range device.

Compression and per-asset budgets go to `3d-asset-pipeline`; tier ownership goes
to `3d-runtime-quality`; scene state to `canvas-first-architecture`; sound to
`spatial-audio`; copy to `content-design` then `anti-slop`.

## Check

- [ ] The first meaningful frame is named, and the critical bucket contains only
      what it needs.
- [ ] `progress-source` is a real signal, and the display matches it.
- [ ] No fabricated percentage, and no fixed timeline pretending to measure.
- [ ] Decode runs off the main thread wherever the format allows.
- [ ] Materials compile before the reveal, and the first interactive frame does
      not stutter.
- [ ] Skip, returning-visitor, and reduced-motion paths all work by keyboard.
- [ ] Every bucket has a timeout and a declared failure path.
- [ ] Time to first meaningful frame was measured under throttling and reported.
