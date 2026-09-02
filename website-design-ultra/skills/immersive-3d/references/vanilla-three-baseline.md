# Vanilla Three.js baseline

A single-file demo is exempt from build tooling, not from the `immersive-3d`
performance and fallback contracts. Hold it to the same contract:

- Pin an exact Three version in the import map and verify every API against it.
- Drive the loop with `renderer.setAnimationLoop`, cap DPR at 2 (mobile 1–1.5),
  and enable damping on any controls.
- Set `outputColorSpace` and take the tone-mapping choice from
  `3d-art-direction`.
- Apply `immersive-3d` §5 unchanged. Without React the same five rules need
  hand-written wiring: a `matchMedia` listener, a DOM layer outside the canvas
  that becomes visible on context loss, and an `IntersectionObserver`.
- Stop the loop on `document.hidden` and when the canvas leaves the viewport;
  restart deliberately instead of remounting.
- Dispose geometries, materials, textures, and the renderer when the demo is
  removed.

No sample scene ships here. A copied demo that omits fallback, pause, or the DOM
alternative is the failure this contract prevents. For production or complex
scenes, use `r3f-patterns`.
