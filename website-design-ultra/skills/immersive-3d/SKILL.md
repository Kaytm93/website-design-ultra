---
name: immersive-3d
description: Master workflow for immersive 3D websites. Use for 3D heroes, product viewers, WebGL, WebGPU, Three.js, R3F, shaders, Spline, or scroll-driven scenes. Decides whether 3D is justified, establishes art direction, selects the renderer/stack, sets budgets, quality and fallbacks, then routes only to the needed 3D sub-skill.
---

# Immersive 3D — Master

Use 3D when depth carries the product statement: a graspable object, spatial data,
a brand hero, scroll story, or configurable viewer. Pure decoration, a rotating
cube, and flat text stay in `motion-system` or `component-patterns`.

## Gate and ownership

If the document still owns headings, links, and sections, use the normal 3D path.
Only a full-viewport experience whose scene owns those structures loads
`canvas-first-architecture`; a hero, viewer, or pinned section does not.
If six to ten PNG/SVG reference frames and a written token block are supplied,
load `reference-intake` before `3d-art-direction`; a direction name alone skips it.

## Mandatory stack

Every shipped scene loads:

- `3d-art-direction` — camera, composition, light, materials, tone mapping,
  mobile shot, and spatial type.
- `3d-runtime-quality` — Poster/Low/Medium/High, adaptation, hysteresis, and
  offscreen pause.

Select exactly one implementation layer only when writing code:

| Situation | Layer |
|---|---|
| React/Next production scene | `r3f-patterns` (R3F + drei) |
| Plain HTML, embed, or quick demo | `references/vanilla-three-baseline.md` |

When unclear, React means R3F and plain HTML means Vanilla Three.js. WebGL is the
mature default; use WebGPU only for a concrete TSL/compute benefit and preserve
the compatible WebGL2 fallback.

### Budget class

A full-canvas experience also reports first meaningful frame, time to interactive,
peak GPU memory, and transfer before reveal; per-frame ceilings still apply.

## Add-on gates

Load an add-on only when its condition is already in the brief; possible use is
not activation and add-ons are not a checklist:

- custom material, deformation, or node look → `shaders-tsl`;
- scroll is the story → `scroll-immersion`;
- click, hover, inspection, or configuration → `r3f-interaction`;
- custom model/texture preparation → `3d-asset-pipeline`;
- passes read earlier buffers or ordered effects exceed two → `render-graph`;
- staged assets or an art-directed arrival → `loading-choreography`;
- sound ships → `spatial-audio`;
- thousands of particles with persistent state, field, trails, or morph →
  `gpu-particle-systems`;
- parameter-generated or algorithmically grown geometry → `procedural-3d`,
  then `3d-asset-pipeline`.

## Budget and anti-slop

Declare before building: under 100 desktop / 50 mobile draw calls, under 500k /
150k visible triangles, textures no larger than 2048px, compressed assets, HDRI
at most 2k, capped DPR (`[1,2]` R3F; 1–1.5 mobile), and a display-matched frame
time target such as 16.7 ms. Memoize resources, monitor `renderer.info` or
`r3f-perf`, and pause the loop when hidden or offscreen. Full-canvas work also
reports first meaningful frame, time to interactive, peak GPU memory, and transfer
before reveal. Quality values belong to `3d-runtime-quality`.

No default cube/torus hero, aimless sparkle, rigid mechanical loop, or equally
loud material hierarchy. Camera, light, material, and tone mapping follow the
art-direction contract.

## Fallback and handoff

Reduced motion disables auto motion and scrub and shows a still/frozen scene.
Unavailable or low-end WebGL/WebGPU shows the art-directed poster tier; loading
uses Suspense/preload without a white flash; the semantic DOM statement, heading,
CTA, and states remain available. Lazy-load the canvas with viewport detection.
Read the Vanilla baseline reference for non-React wiring.

Route camera/light/material/type to `3d-art-direction`, tiers/DPR/LOD/PostFX and
pause to `3d-runtime-quality`, and run the `core-rules` pre-flight plus the
capability-checked `scripts/verify-browser.mjs` launch gate. Report why 3D is
justified, the selected layer, contract, budget/tier matrix, fallback, and
verification status (`PASS`, `FAIL`, `UNAVAILABLE`, or `NOT_APPLICABLE`).
