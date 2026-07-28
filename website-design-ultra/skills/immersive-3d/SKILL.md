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

## 4. Anti-slop for 3D — SINGLE SOURCE OF TRUTH (extends `core-rules` §4)

- No endlessly rotating default cube or torus knot as a hero.
- No aimless particle sparkle without a link to the content.
- The color prohibitions from `core-rules` §4 apply unchanged to 3D materials and shaders.
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
- Read `prefers-reduced-motion` and react to changes: no idle motion, auto
  rotation, or scroll scrub while it is set.
- Keep statement, heading, and primary action in the DOM outside the canvas, and
  reveal that content when WebGL is unavailable or the context is lost.
- Stop the loop on `document.hidden` and when the canvas leaves the viewport;
  restart deliberately instead of remounting.
- Dispose geometries, materials, textures, and the renderer when the demo is
  removed.

No sample scene ships in this skill on purpose. A copied demo that omits the
fallback, the pause, or the DOM alternative is exactly the failure §5 exists to
prevent, and a hero example is the code most likely to be copied unchanged.

For production or complex scenes → `r3f-patterns`.

## 7. Routing

- Camera, light, materials, tone mapping, mobile shot, spatial typography → **`3d-art-direction`**
- Tiers, adaptive shadows/LOD/PostFX/particles/DPR, hysteresis, offscreen pause → **`3d-runtime-quality`**
- React production → **`r3f-patterns`**
- Shader / custom material / WebGPU → **`shaders-tsl`**
- Scroll-driven story → **`scroll-immersion`**
- Click/hover interaction, hotspots, configurator, animation clips, 3D text → **`r3f-interaction`**
- Custom models/textures → **`3d-asset-pipeline`**
- Before every output: walk the `core-rules` pre-flight plus the 3D budget from section 3.

## 8. Browser verification and launch gate

Check a runnable experience with the capability-checked
`scripts/verify-browser.mjs` adapter from the plugin, or with real host browser
automation. Photograph desktop, mobile, reduced motion, and the disabled GPU
fallback, and inspect the images.

With a runnable target the result is `PASS`, `FAIL`, or `UNAVAILABLE`. When
neither the adapter nor a host browser is available, deliver static
build/fallback evidence, mark the result **unverified**, and leave the launch
gate open. A missing slash command, a missing Codex path, or a successful build
must never lead to a claimed `PASS`.

For an explicit plan/contract without a runnable target, use `NOT_APPLICABLE
(plan-only)` plus the planned capture matrix. That is not a launch assessment;
with the first runnable build the browser check becomes mandatory.

## 9. Output format (in addition to core-rules)

1. One sentence: why 3D is justified here plus the selected stack layer
2. Art-direction contract with desktop, portrait, and poster shot
3. `npm install …` (R3F) or importmap (vanilla)
4. Working code with reduced-motion, DOM, and 2D fallback
5. Perf budget plus Poster/Low/Medium/High matrix
6. Customization hooks (colors, light, exposure, intensity, camera distance)
7. Verification status, backend, and artifacts or the open capture matrix
