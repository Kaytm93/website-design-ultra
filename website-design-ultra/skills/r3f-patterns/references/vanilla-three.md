# Vanilla Three.js production baseline

A plain HTML, embed, or quick demo is exempt from React tooling, not from the
`immersive-3d` budget, fallback, and lifecycle contracts. Hold it to the same
production bar:

- Pin the exact Three.js version in the import map and verify each API against it.
- Drive the loop with `renderer.setAnimationLoop`; cap DPR at 2 (mobile 1–1.5)
  and enable damping on controls.
- Set `outputColorSpace` and take tone-mapping choices from `3d-art-direction`.
- Apply the fallback and handoff contract from `immersive-3d` unchanged. Without
  React, wire the `matchMedia` listener, a DOM layer outside the canvas that is
  visible on context loss, and an `IntersectionObserver` yourself.
- Stop the loop on `document.hidden` and when the canvas leaves the viewport;
  restart deliberately instead of remounting.
- Dispose geometries, materials, textures, and the renderer when the demo is
  removed.

No sample scene ships here. A copied demo that omits fallback, pause, or the DOM
alternative is the failure this contract prevents. For production or complex
scenes, use `r3f-patterns` for the React integration layer.
