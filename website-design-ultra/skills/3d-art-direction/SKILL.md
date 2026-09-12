---
name: 3d-art-direction
description: Direct the visual language of a web 3D scene. Use for camera and FOV choices, cinematic composition, lighting dramaturgy, material hierarchy, color management, tone mapping, mobile reframing, spatial typography, or a deliberate poster frame before implementing Three.js, R3F, WebGL, or WebGPU.
---

# 3D Art Direction

Define a reproducible image before choosing technique. `immersive-3d` owns
justification/budget, `3d-runtime-quality` owns runtime tiers, and
`reference-intake` precedes it when its gate fired.

Repository proof pages, starter heroes and posters are technical fixtures, not
visual defaults or look-loop targets. Reuse runtime mechanisms; design the page,
subject, camera and materials from the brief, project assets and references.

## Art-direction contract

Fix these decisions before scene code. This is the schema, not a set of defaults;
when reference intake ran, every leaf needs a `source-frame` or stays `unknown`.

```yaml
visual-thesis: "Which statement does the space carry?"
hero-subject: "Primary object and recognizable silhouette"
camera:
  framing: "close | medium | wide"
  fov: 38
  position: [0, 0.2, 5.4]
  target: [0, 0.1, 0]
  near-far: [0.1, 40]
composition:
  subject-anchor: "right-center"
  dom-safe-area: "left 42%"
lighting: "soft top-left key, cool rim, restrained fill"
material-order: "hero > functional secondary > accent > environment"
color-output: "Linear-sRGB work, sRGB output"
tone-mapping: "installed-renderer mapping + locked exposure"
mobile-reframe: "portrait shot, closer camera, text above canvas"
spatial-type: "DOM-first; one decorative world label"
poster-frame: "same silhouette and message as live scene"
```

Justify deviations in the contract rather than scattered components.

## Workflow

1. If intake ran, inspect its poster target, citations, contradictions, and
   unknowns; do not answer a reference-dependent field from this file alone.
2. State the thesis and what must be recognizable after two seconds.
3. Fix silhouette, camera/FOV/target, negative space, and DOM safe area using
   [references/camera-and-composition.md](references/camera-and-composition.md).
4. Stage light, material roles, color space, tone mapping, and exposure with
   [references/light-material-and-tone.md](references/light-material-and-tone.md).
5. Choose DOM, `<Html>`, `<Text>`, or rare `<Text3D>` per text layer using
   [references/spatial-typography.md](references/spatial-typography.md).
6. Design a distinct portrait shot, then choose a poster from the same image.
7. Hand quality hooks to `3d-runtime-quality` without changing visual ranking.


## Look-loop: live frame against the poster target

A poster is a target, not proof that the live scene matches it. Once scene code
exists, capture the live hero frame in the declared desktop shot and run
`verify-browser.mjs --target <poster-target.png>` against it. The verifier
writes `target-comparison.json` and `target-diff.png` beside the capture. Name
one changed decision per round, keep an iteration log, and treat a correction as
better only when the measured distance falls — read
[references/look-loop.md](references/look-loop.md) before the first iteration.

An implemented scene cannot finish with an unmeasured look claim. `/immersive`
ends with the comparison artifact, or with `NOT_APPLICABLE` and a concrete
plan-only or out-of-scope reason — a plan still names its poster target and the
first iteration the build will measure. Ordinary 2D work and an ordinary 3D hero
do not load an advanced module merely because this procedure exists.

## Invariants and output

One camera source writes each state. Reframe with FOV, distance, and scale rather
than FOV alone; keep near/far no larger than the needed space. Use light as
hierarchy with at most one dynamic shadow owner. Reserve transmission, emission,
clearcoat, and iridescence for accents. Manage exposure and tone mapping once.
Meaningful text remains in the DOM and in poster/fallback states.

Deliver the thesis, completed contract, desktop/portrait/poster compositions,
light/material roles, changeable camera/light/exposure/type hooks, and intake
ledger/target when applicable.

## Check

- [ ] FOV, camera distance, target point, and safe area are explicit.
- [ ] Desktop and mobile have different, intentional shots.
- [ ] Light guides the eye and has at most one primary shadow owner.
- [ ] Materials form a clear visual ranking.
- [ ] Color spaces, tone mapping, and exposure are fixed.
- [ ] Spatial text stays readable and semantically present in the DOM.
- [ ] Poster, reduced motion, and the live scene tell the same statement.
- [ ] An implemented scene records at least one target comparison iteration with
      `target-comparison.json` and `target-diff.png`, or states a concrete
      `NOT_APPLICABLE` reason.
- [ ] When `reference-intake` ran, every field still cites a source frame or is
      `unknown`, and the poster target existed before scene code.
