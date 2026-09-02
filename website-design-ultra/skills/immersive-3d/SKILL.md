---
name: immersive-3d
description: Master workflow for immersive 3D websites. Use for 3D heroes, product viewers, WebGL, WebGPU, Three.js, R3F, shaders, Spline, or scroll-driven scenes. Decides whether 3D is justified, establishes art direction, selects the renderer/stack, sets budgets, quality and fallbacks, then routes only to the needed 3D sub-skill.
---

# Immersive 3D — Master

Build immersive 3D web experiences at Awwwards level. This layer applies in addition to `core-rules`. 3D here is not an effect toy but structure: depth, motion with meaning, interaction.

## 1. Decision: is 3D worth it at all?

Before building anything, check — use 3D only when it carries a statement:

- **Yes:** making a product graspable in space, telling abstract data or an idea spatially, a brand hero with real impact, a scroll-driven story, a configurable 3D viewer.
- **No (→ stay with 2D/CSS/Motion):** pure decoration, a rotating cube "because 3D", text that also works flat. In that case route back to `motion-system`/`component-patterns`.

If 3D is justified: commit, define the shot, and select ONE stack layer.

### Who owns the page

One further fork, decided at the same moment. Does the document still own the
page's headings, links, and sections, or does the scene? Almost always the
document, and then nothing more is needed here.

When the canvas is the page — full viewport, sections as scene states, no DOM
page behind it — the experience needs an architecture and an accessibility
mechanism this file does not carry. Load `canvas-first-architecture` and answer
its gate first. A 3D hero above a normal page is not that case.

### Reference evidence gate

Before the art-direction layer, inspect the supplied artifacts rather than the
direction name. When the 3D brief includes six to ten exported PNG and SVG
reference frames plus a written token block, load `reference-intake` before
`3d-art-direction`. It produces the traced contract and poster target before
scene code. A named direction or mood label without that material skips this
gate and proceeds directly to the normal art-direction contract.

## 2. Mandatory layers and stack

Load for every shipped 3D experience:

- `3d-art-direction` for camera/FOV, composition, light, material hierarchy, tone mapping, mobile reframing, and spatial typography.
- `3d-runtime-quality` for Poster/Low/Medium/High tiers, adaptive quality, hysteresis, and offscreen pause.

### Base stack layer — implementation only

Select exactly one, and only when code is actually being written. A plan, a
contract, or an art-direction answer names the stack in prose and loads no
implementation skill. "Plan a 3D hero" is not an instruction to load
`r3f-patterns`.

| Situation | Choice | Load skill |
|---|---|---|
| React/Next project, production, complex scene | **React Three Fiber + drei** | `r3f-patterns` |
| Quick demo / single-file HTML / embed / Cowork preview | **Vanilla Three.js** | contract in §6; no sample scene ships here |

**Default when unclear:** React project → R3F. Plain HTML demo → Vanilla Three.js.

### Add-on layers — one decision each

Add-ons are neither alternatives to the base layer nor a checklist to work
through. Load one only when the brief already requires the capability it names,
and state that requirement before loading it. A scene that could plausibly use
an add-on does not activate it, and needing one add-on says nothing about the
others.

| The brief requires | Add | Load skill |
|---|---|---|
| A custom look: gradients, organic deformation, WebGPU node materials | TSL/GLSL shader | `shaders-tsl` |
| The experience is told through scrolling | Lenis/ScrollTrigger/ScrollControls | `scroll-immersion` |
| Meshes the user clicks, hovers, inspects, or configures | R3F events + camera rig | `r3f-interaction` |
| Custom models or textures that must be prepared first | Blender/Spline → glTF | `3d-asset-pipeline` |
| Passes that read what earlier passes wrote, or more than two effects whose order matters | multi-pass render chain | `render-graph` |
| A first frame that depends on staged assets, or an art-directed arrival | manifest and loading sequence | `loading-choreography` |
| The experience plays sound | audio graph, unlock gesture, opt-out | `spatial-audio` |
| Thousands of particles carrying per-particle state across frames, driven by a field, a trail, or a morph between targets | GPU simulation in textures | `gpu-particle-systems` |
| The geometry itself has to be produced from parameters or grown algorithmically, not imported | generator before the asset path | `procedural-3d`, then `3d-asset-pipeline` |
| A public live 3D reference URL is supplied and the brief explicitly requests implementation reconnaissance | bundle/network/runtime evidence ledger | `site-reconnaissance` |

**Renderer:** WebGLRenderer is the mature default. Select WebGPURenderer only when TSL/WebGPU/node features justify the additional effort; compatible features can fall back to WebGL2. Renderer-specific limits and postprocessing live in `shaders-tsl`.

## 3. Performance budget — SINGLE SOURCE OF TRUTH (mandatory, define before building)

Immersive does not mean heavy. Set a budget and monitor it:

- **Draw calls:** < 100 (desktop), < 50 (mobile) — use instancing instead of many meshes
- **Triangles:** < 500k visible (desktop), < 150k (mobile)
- **Textures:** max 2048px, compressed (KTX2/Basis); HDRIs ≤ 2k
- **Geometry/material:** memoize, never recreate per frame
- **Assets:** compress ahead of time (Draco/meshopt) and preload — never pop-in
- **Dev tool:** keep `r3f-perf` open in the R3F tree; in vanilla, log `renderer.info`
- **DPR:** `dpr={[1, 2]}` (R3F) — never uncapped; mobile 1–1.5
- **Frame time:** set a target matching the display (for example ≤16.7ms for 60fps); check drops, not only the average
- **Quality tiers:** concrete values and stable adaptation go to `3d-runtime-quality`
- **Lifecycle:** pause the render loop when the scene is offscreen or `document.hidden`

### Budget class

The numbers above describe the component class: a scene inside a page that also
carries DOM content. A full-canvas experience trades initial load against the
experience and is measured differently. Declare that explicitly rather than
exceeding the component numbers quietly:

- **Time to first meaningful frame** and **time to interactive scene**, both
  measured under throttling on a mid-range device.
- **Peak GPU memory**, render targets included.
- **Total transfer before the reveal**, reported separately from the transfer
  for the whole experience.
- The per-frame ceilings above still apply unchanged. A larger asset set buys a
  longer load, never a heavier frame.

`canvas-first-architecture` decides whether this class applies at all,
`loading-choreography` owns the staged arrival, and `render-graph` owns the
render-target share of the memory number.

## 4. Anti-slop for 3D — SINGLE SOURCE OF TRUTH (extends `core-rules` §5)

- No endlessly rotating default cube or torus knot as a hero.
- No aimless particle sparkle without a link to the content.
- The color prohibitions from `core-rules` §5 apply unchanged to 3D materials and shaders.
- Motion must be non-rigid: soft easing curves, inertia/damping, subtle perpetual idle motion (breathing, drifting) instead of mechanical loops.
- Light, camera, material, and tone mapping follow the contract from `3d-art-direction`.
- Camera transitions use restrained damping/inertia. No abrupt snapping.

## 5. Mandatory fallbacks — SINGLE SOURCE OF TRUTH for 3D (accessibility and robustness)

```tsx
import { useReducedMotion } from 'motion/react';
const reduce = useReducedMotion();
// reduce === true → idle/auto rotation and scroll scrub OFF,
// show a static hero image or a frozen scene.
```

- `prefers-reduced-motion`: all auto animations/scrubs off, deliver a static still.
- WebGL/WebGPU unavailable or low-end: 2D fallback as the art-directed poster tier from `3d-runtime-quality` instead of an empty canvas.
- Lazy load: load the 3D canvas only when in the viewport (`IntersectionObserver` / dynamic import).
- Loading: Suspense fallback + preload (see `r3f-patterns`), never a white flash.
- Alternative content: statement, heading, CTA, and interactive states stay available in the DOM.

## 6. Vanilla Three.js baseline (demo, single file, embed)

A single-file demo is exempt from build tooling, not from §3 and §5. Hold it to
the same contract:

- Pin an exact Three version in the import map and verify every API against it.
- Drive the loop with `renderer.setAnimationLoop`, cap DPR at 2 (mobile 1–1.5),
  and enable damping on any controls.
- Set `outputColorSpace` and take the tone-mapping choice from `3d-art-direction`.
- Apply §5 unchanged. Without React the same five rules need hand-written
  wiring: a `matchMedia` listener, a DOM layer outside the canvas that becomes
  visible on context loss, and an `IntersectionObserver`.
- Stop the loop on `document.hidden` and when the canvas leaves the viewport;
  restart deliberately instead of remounting.
- Dispose geometries, materials, textures, and the renderer when the demo is
  removed.

No sample scene ships in this skill on purpose. A copied demo that omits the
fallback, the pause, or the DOM alternative is exactly the failure §5 exists to
prevent, and a hero example is the code most likely to be copied unchanged.

For production or complex scenes → `r3f-patterns`.

## 7. Routing

- Six to ten exported PNG and SVG frames plus a written token block → **`reference-intake` before `3d-art-direction`**
- Camera, light, materials, tone mapping, mobile shot, spatial typography → **`3d-art-direction`**
- Tiers, adaptive shadows/LOD/PostFX/particles/DPR, hysteresis, offscreen pause → **`3d-runtime-quality`**
- React production → **`r3f-patterns`**
- Shader / custom material / WebGPU → **`shaders-tsl`**
- Scroll-driven story → **`scroll-immersion`**
- Click/hover interaction, hotspots, configurator, animation clips, 3D text → **`r3f-interaction`**
- Custom models/textures → **`3d-asset-pipeline`**
- The canvas is the page → **`canvas-first-architecture`**
- Multi-pass chain, buffers, grading → **`render-graph`**
- Manifest, buckets, progress, warm-up → **`loading-choreography`**
- Sound → **`spatial-audio`**
- Thousands of particles with persistent state, a field, trails, or a morph → **`gpu-particle-systems`**
- Geometry generated from parameters or grown → **`procedural-3d`**, then **`3d-asset-pipeline`**
- Public live 3D reference URL plus explicit runtime-reconnaissance request → **`site-reconnaissance`**; a screenshot alone does not activate it
- Before every output: walk the `core-rules` pre-flight plus the 3D budget from section 3.

## 8. Browser verification and launch gate

Check a runnable experience with the capability-checked
`scripts/verify-browser.mjs` adapter from the plugin, or with real host browser
automation. Photograph desktop, mobile, reduced motion, and the disabled GPU
fallback, and inspect the images.

Report the outcome with the four values `core-rules/references/verification-status.md`
defines. That file owns when each applies and what each one obliges.

## 9. Output format (in addition to core-rules)

1. One sentence: why 3D is justified here plus the selected stack layer
2. When the evidence gate fired, traced reference intake and poster target; then the art-direction contract with desktop, portrait, and poster shot
3. `npm install …` (R3F) or importmap (vanilla)
4. Working code with reduced-motion, DOM, and 2D fallback
5. Perf budget plus Poster/Low/Medium/High matrix
6. Customization hooks (colors, light, exposure, intensity, camera distance)
7. Verification status, backend, and artifacts or the open capture matrix
