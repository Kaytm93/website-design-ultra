# Poster, Low, Medium, and High Tiers

## Starting matrix

Use these values as a conservative starting point and tighten them for the budget of the concrete scene.

| Control | Poster | Low | Medium | High |
|---|---|---|---|---|
| Canvas | not mounted or stopped | active | active | active |
| DPR | image at CSS resolution | 1.0 | 1.0–1.5 | 1.0–2.0, capped |
| Shadows | baked into the poster | blob/baked, no dynamic maps | one tight 1024 key shadow | one tight 2048 key shadow |
| LOD | rendered poster asset | lowest acceptable LOD | medium LOD | high LOD in the foreground |
| PostFX | contained in the poster | off; tone/output stays correct | motivated base effect only | selective, renderer-compatible chain |
| Particles | static or none | 0–100 | up to roughly 500 | up to roughly 1500, instanced |
| Antialias | poster export | off or cheapest renderer path | renderer/DPR dependent | only when the frame budget holds |
| Idle motion | none | minimal, optional 30fps strategy | full core motion | full core motion |

Do not apply particle counts blindly. Overdraw, particle size, material, sorting, and screen coverage are often more expensive than the raw count.

## Adaptive shadows

- Use at most one primary dynamic shadow light as the default.
- Fit the shadow frustum tightly to the visible shot.
- Update static shadow maps only after relevant movement.
- Use Low with blob, contact, or baked shadow when ground contact matters more than exact geometry.
- Enable CSM, multiple cascades, or multiple shadow lights only with a demonstrated image gain and a measured budget.
- Keep light direction and shadow character consistent across all tiers.

## LOD

- Generate LODs offline when the silhouette or material count can be simplified substantially.
- Choose transitions by screen-space size or camera distance per shot; do not use universal distances.
- Apply hysteresis at LOD boundaries too.
- Preload the next likely LOD without loading all large variants at first paint.
- Avoid simultaneous LOD and quality jumps when they pop visibly.

## PostFX

- Keep tone mapping and output color space correct at every tier.
- Disable chromatic aberration, DoF, SSAO/SSGI, glitch, large blurs, and nonessential fullscreen passes first.
- Preserve bloom only for motivated emission; reduce resolution/radius/iteration count before removing it entirely when it carries the material hierarchy.
- With `WebGLRenderer`, use only compatible WebGL composer passes.
- With `WebGPURenderer`, use exclusively the node/TSL-based chain and check the WebGL2 fallback column in `shaders-tsl`.

## DPR

- Always cap DPR; never render with an unchecked `devicePixelRatio`.
- Change DPR in small steps, for example 0.25, instead of jumping between 1 and 2.
- Measure GPU frame time again after every change.
- Do not confuse CSS size and render buffer size.
- Keep UI/DOM text outside the canvas sharp even when canvas DPR drops.

## Poster

- Produce separate desktop and portrait posters from the `3d-art-direction` contract.
- Use `<picture>`/responsive sources and reserve the final aspect ratio.
- Keep headline, description, CTA, and states in the DOM.
- Switch to poster on context loss, missing renderer, repeated crashes, or persistently unusable frame time.
