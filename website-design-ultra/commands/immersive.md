---
description: Builds an immersive 3D scene or website according to the website-design-ultra rules — selects the stack layer, sets the perf budget, and delivers runnable code with fallbacks.
argument-hint: [briefing, e.g. "3D product hero, dark, scroll-driven"]
---

# /immersive

You will build an immersive 3D experience (hero, scene, viewer, or scroll-driven story).

## Workflow

1. **Justification** — Load `immersive-3d`. Check first: does 3D carry a statement here? If not → say so honestly and point to `/design` (2D).

2. **Reconnaissance** — If inside a repo: read `package.json` (React/Next? Tailwind v3/v4? three/R3F already installed?). Do not assume the stack, verify it.

3. **Fix the art direction** — Load `3d-art-direction`. Define FOV/camera, composition/safe area, lighting dramaturgy, material ranking, tone mapping, portrait reframe, spatial typography, and poster shot as a contract.

4. **Content contract** — When headline, claim, proof, CTA, hotspot, or configurator copy is created, load `content-design`. The DOM statement and the canvas staging must carry the same evidenced claim.

5. **Choose and commit to a stack layer** (from `immersive-3d` §2):
   - React project/production → React Three Fiber → load `r3f-patterns`
   - Single-file HTML/demo → Vanilla Three.js (pattern from `immersive-3d`)
   - Custom look/gradients/WebGPU → additionally `shaders-tsl`
   - Scroll-driven → additionally `scroll-immersion`
   - Clickable/hoverable, hotspots, configurator, camera on click, animation clips, 3D text → additionally `r3f-interaction`
   - Custom models/textures → `3d-asset-pipeline`

6. **Direction, colors, and responsive page contract** — Load `style-directions` only when the direction is unclear, and `color-palettes` only when colors are chosen. For the page, define wide/portrait/narrow priority, DOM order, canvas crop, and interaction changes with the responsive recomposition reference from `core-rules`.

7. **Set perf budget and runtime tiers** — `immersive-3d` §3 plus `3d-runtime-quality`: Poster/Low/Medium/High, adaptive shadows/LOD/PostFX/particles/DPR, hysteresis, and offscreen pause.

8. **Fallbacks (MANDATORY)** — Work through `immersive-3d` §5: reduced motion, art-directed poster when WebGL/WebGPU is missing, lazy load, Suspense + preload.

9. **Interaction and input parity** — As soon as the scene is clickable or draggable: load `r3f-interaction`. Every canvas action needs a DOM equivalent. For touch, additionally define drag threshold, pinch/zoom, pointer capture, `touch-action`, hover fallback, and cancellation.

10. **Pre-flight** — Load `core-rules` and check the applicable items including evidenced claims, responsive contract, art-direction contract, 3D budget, renderer compatibility, DOM alternative, and stable quality tiers.

11. **Render verification** — When the app runs locally, execute the
    capability-checked adapter `scripts/verify-browser.mjs` or a real host
    browser automation with the state matrix from `/verify`. Actually inspect
    desktop, mobile, reduced motion, and fallback. With a runnable target the
    step always ends in `PASS`, `FAIL`, or `UNAVAILABLE`; without images, `PASS`
    is forbidden. On `UNAVAILABLE`, deliver static build/fallback evidence, mark
    the result **unverified**, and keep the launch gate open.

## Output format

1. One sentence: why 3D is justified + the selected stack layer + direction
2. Content/claim contract plus art-direction contract for desktop, portrait, and poster
3. Wide/portrait/narrow recomposition of the page
4. `npm install …` (R3F) or importmap (vanilla)
5. Working code with reduced-motion, DOM, and 2D fallback
6. Perf budget plus Poster/Low/Medium/High table
7. For interactive scenes: keyboard, touch, and cancellation solution
8. Verification status (`PASS | FAIL | UNAVAILABLE | NOT_APPLICABLE`), backend, and
   artifact folder; on `UNAVAILABLE` the open manual capture matrix
9. Customization hooks (colors, light, exposure, motion intensity, camera distance)

If the user explicitly asks only for a plan or contract: deliver the applicable
contracts, tiers, fallbacks, and interaction states without install commands or
working code. Set verification to `NOT_APPLICABLE (plan-only/no executable
target)` and deliver the planned capture matrix; do not use `UNAVAILABLE` for
that.

## Arguments

Whatever follows `/immersive` is the briefing. Examples:
- `/immersive 3D product hero, dark, slow drift`
- `/immersive scroll-driven story, 3 scenes, camera travels through`
- `/immersive product configurator with hotspots, 3 variants`
- `/immersive WebGPU shader background, organic gradient`

If nothing is given: ask briefly — what, which context, scroll-driven yes/no, clickable yes/no?

## Never

- Ship 3D as pure decoration without a statement (prefer 2D).
- Ship against `immersive-3d` §4 (anti-slop 3D) or §5 (mandatory fallbacks).
- Ship a clickable scene without a keyboard equivalent (`r3f-interaction` §2).
- Allow more than one timing source to write the same camera, property, or scroll position (`core-rules`).
