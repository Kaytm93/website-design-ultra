---
name: 3d-art-direction
description: Direct the visual language of a web 3D scene. Use for camera and FOV choices, cinematic composition, lighting dramaturgy, material hierarchy, color management, tone mapping, mobile reframing, spatial typography, or a deliberate poster frame before implementing Three.js, R3F, WebGL, or WebGPU.
---

# 3D Art Direction

Define a reproducible image first, then the technique. Use `immersive-3d` for
justification and budget, `3d-runtime-quality` for runtime tiers, and this skill
as the visual single source of truth. When its evidence gate fired,
`reference-intake` is the predecessor: read its traced ledger and poster target
before selecting values here.

## Art-direction contract

Fix exactly these decisions before writing scene code. The block below is the
schema, not the values. `fov: 38` is one filled example, not a default to
reuse; the ranges each key must be chosen from live in the references. A
contract filled from this block alone is unfilled rather than shortened, and a
plan or contract-only answer is exactly where that shortcut is tempting.

When `reference-intake` preceded this skill, keep its trace ledger attached to
the contract. Every leaf below retains a `source-frame` citation or remains
`unknown`; a written token or direction name never repairs missing visual
evidence.

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

Justify deviations inside the contract instead of hiding them in scattered components.

## Workflow

A step that names a reference requires it before that step can be answered.
Answering the step from this file alone leaves it unfilled.

1. If `reference-intake` ran, inspect its poster target, citations,
   contradictions, and `unknown` fields before choosing a reference below.
2. State a visual thesis and determine what must be recognizable after two seconds.
3. Fix camera, FOV, target point, silhouette, negative space, and DOM safe area. Read [references/camera-and-composition.md](references/camera-and-composition.md).
4. Stage light, material roles, color space, tone mapping, and exposure together. Read [references/light-material-and-tone.md](references/light-material-and-tone.md).
5. For every text layer, decide between semantic DOM, `<Html>`, `<Text>`, and the rare `<Text3D>`. Read [references/spatial-typography.md](references/spatial-typography.md).
6. Design at least one dedicated portrait shot; do not merely scale the desktop scene.
7. Choose the poster frame from the same composition. It may read as a deliberate key visual, never as a loading error.
8. Hand measurable quality hooks to `3d-runtime-quality` without changing the visual ranking of the scene.

## Look-loop: live frame against the poster target

A poster is a target, not proof that the live scene matches it. After scene code
exists, run the smallest reproducible loop:

1. Capture the live hero frame in the declared desktop shot.
2. Run `verify-browser.mjs --target <poster-target.png>` against that frame. The
   verifier writes `target-comparison.json` and `target-diff.png` beside the
   capture; the report records the target, live-frame hashes, dimensions, score,
   tolerance, and iteration label.
3. Treat the score and Diff-PNG as evidence of visual change, never as an
   aesthetic verdict. Name the changed decision (for example key-light
   direction), make one correction, and capture again.
4. Keep a short iteration log: `iteration`, changed decision, score, diff
   artifact, and the reason for the next correction. A correction is better only
   when its measured distance to the target decreases; do not claim improvement
   from prose alone.

An implemented scene cannot finish with an unmeasured look claim. `/immersive`
ends with the comparison artifact, or with `NOT_APPLICABLE` and a concrete
plan-only or out-of-scope reason; browser/GPU/tool unavailability remains
`UNAVAILABLE` and unverified. Ordinary 2D work and an ordinary 3D hero do not
load an advanced immersive module merely because this evidence procedure exists.

## Invariants

- Keep exactly one camera source per state. Scroll, controls, and focus rig must not write simultaneously.
- On responsive changes, adjust FOV, distance, and object scale deliberately; do not use FOV as a substitute for composition.
- Limit `near`/`far` to the space actually needed in order to preserve depth precision.
- Use light as hierarchy: only the most important light may require dynamic shadows by default.
- Avoid equally loud materials. Transmission, strong emission, clearcoat, and iridescence are accents.
- Manage exposure and tone mapping in one place. Do not compensate for a wrong pipeline with arbitrary material colors.
- Keep meaningful text in the DOM and retain it in the poster/fallback state.

## Output

Deliver:

1. the visual thesis in one sentence,
2. the completed art-direction contract,
3. desktop, portrait, and poster composition,
4. light and material roles,
5. the smallest changeable hooks for camera, light, exposure, and spatial typography,
6. when reference intake ran, the source-frame ledger and poster target it
   produced before scene code.

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
