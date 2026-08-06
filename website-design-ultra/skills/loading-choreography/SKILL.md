---
name: loading-choreography
description: Design the sequence from first byte to first interactive frame — asset manifest, priority buckets, a progress readout backed by a real signal, off-thread decode, shader warm-up, the skip path, and the failure path. Use only when the first meaningful frame depends on assets that cannot arrive in one request. A single model behind Suspense, a hero image, or a font swap does not activate this skill.
---

# Loading Choreography

On an experience that cannot render its first frame from the initial response,
loading is the first thing the visitor sees and the first thing that can lose
them. Treat it as a designed state with a contract, not as a spinner in front of
the real work.

## 1. Gate

Load this skill when at least one is true:

- The first meaningful frame needs several assets, and their order matters.
- Decode or transcode cost is large enough to block the main thread.
- The arrival is art-directed: an intro, a reveal, a staged assembly.
- Sections beyond the first need assets that must not arrive as pop-in.

One model behind a Suspense boundary, a poster image, and a font swap are all
covered by `r3f-patterns` and `core-rules` and stop here.

## 2. First-frame contract

Fill before implementation. The block is the schema; the values below are one
filled example.

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

Read [references/manifest-and-buckets.md](references/manifest-and-buckets.md) to
build the manifest and the buckets, and
[references/warmup-and-first-frame.md](references/warmup-and-first-frame.md)
before the reveal is implemented.

## 3. Progress is a claim

`content-design` bans invented numbers in copy. A progress readout is a number
in the interface, and the rule does not change because it animates.

- A percentage requires a real signal: completed weight against declared total
  weight, or decoded bytes against a known total. Declare which.
- Byte-based progress needs a length the server actually sends. Compressed and
  chunked responses often do not, so a byte readout that silently falls back to
  asset counting is reporting a different quantity than it claims.
- Unweighted asset counting jumps, because a 900 KB texture and a 4 KB shader
  each count as one. Weight the manifest or do not show a percentage.
- No signal means no percentage. A state label — loading, decoding, preparing —
  is honest and reads better than a fabricated number.
- A bar that eases to 90 percent and waits is invented data. So is a fixed
  timeline that ignores the network entirely.

A designed intro with a declared duration is a different thing and is
legitimate: it says how long the arrival takes, not how much has loaded. Declare
its duration in the contract, and never let it drive the number.

## 4. Invariants

- **Nothing renders before its bucket completes.** A state entered early is the
  pop-in this skill exists to remove.
- **Decode happens off the main thread** where the format allows it. A frozen
  progress indicator during transcode is worse than a slower honest one.
- **Materials compile before the reveal.** A scene that finishes loading and
  then stutters for half a second did not finish loading.
- **The intro is skippable**, by a visible control that is also a keyboard
  target, and is not replayed for a returning visitor within the same session.
- **Reduced motion replaces the intro rather than accelerating it.** The
  declared end state renders directly.
- **Every bucket has a failure path.** A missing or undecodable asset degrades
  to the poster route from `immersive-3d` §5. An indicator that waits forever is
  a failure state without a message.
- **The DOM alternative is present during loading**, not injected after it.
  A visitor on a slow connection, and every crawler, sees only this phase.

## 5. Workflow

1. Name the first meaningful frame in one sentence, then list only the assets it
   actually requires.
2. Sort everything else into near and deferred buckets. Read
   [references/manifest-and-buckets.md](references/manifest-and-buckets.md).
3. Choose `progress-source` and `progress-display` together, under §3.
4. Move decode off the main thread where the format supports it.
5. Warm up materials and upload textures before the reveal. Read
   [references/warmup-and-first-frame.md](references/warmup-and-first-frame.md).
6. Implement the skip, reduced-motion, and failure paths in the same pass as the
   intro, never afterwards.
7. Measure time to first meaningful frame on a throttled connection and on a
   mid-range device, and report both numbers.

## 6. Routing

- Manifest shape, buckets, decode, transport → **[references/manifest-and-buckets.md](references/manifest-and-buckets.md)**
- Compile warm-up, texture upload, reveal, measurement → **[references/warmup-and-first-frame.md](references/warmup-and-first-frame.md)**
- Compression, formats, per-asset budgets → **`3d-asset-pipeline`**
- Poster route and the overall budget → **`immersive-3d`**
- Which tier loads which bucket → **`3d-runtime-quality`**
- Intro as a scene state → **`canvas-first-architecture`**
- Loading and progress copy → **`content-design`**, then **`anti-slop`**
- Sound during the intro and its unlock gesture → **`spatial-audio`**

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
