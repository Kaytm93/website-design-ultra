---
description: Builds an immersive 3D scene or website according to the website-design-ultra rules — selects the stack layer, sets the perf budget, and delivers runnable code with fallbacks.
argument-hint: [briefing, e.g. "3D product hero, dark, scroll-driven"]
---

# /immersive

You will build an immersive 3D experience (hero, scene, viewer, or scroll-driven story).

## Workflow

1. **Justification** — Load `immersive-3d`. Check first: does 3D carry a statement here? If not → say so honestly and point to `/design` (2D).

   **Who owns the page** — Second question, same step. Does the document still
   own the headings, links, and sections, or does the scene? Almost always the
   document, and then this is a normal 3D build. Only when the canvas *is* the
   page — full viewport, sections as scene states, no DOM page behind it — load
   `canvas-first-architecture` and answer its gate before continuing. A 3D hero
   above a normal page is not that case, and neither is a pinned scroll scene.

2. **Reconnaissance** — If inside a repo: read `package.json` (React/Next? Tailwind v3/v4? three/R3F already installed?). Do not assume the stack, verify it.

   **Reference evidence gate (conditional, before step 3)** — When and only when
   the briefing supplies six to ten exported PNG and SVG frames plus a
   written token block, load `reference-intake`. Complete its traced ledger and
   poster target before scene code, then hand both to `3d-art-direction`. A named
   direction or text-only mood brief without those artifacts does not load it.

3. **Fix the art direction** — Load `3d-art-direction`. Define FOV/camera, composition/safe area, lighting dramaturgy, material ranking, tone mapping, portrait reframe, spatial typography, and poster shot as a contract.

4. **Content contract** — When headline, claim, proof, CTA, hotspot, or configurator copy is created, load `content-design`. The DOM statement and the canvas staging must carry the same evidenced claim.

   **Copy form** — As soon as any user-visible line is written, load `anti-slop`
   and its prose reference. A 3D brief does not suspend this gate: a hero
   headline, a hotspot label, a fallback message, or a configurator option name
   is user-visible copy. Neither does a plan-only brief: deciding what those
   lines will say is writing them, and "without writing code" limits the format
   of the deliverable, not the tells inside it. Add the locale annex for
   non-English output. `§4` of `immersive-3d` covers the scene, not the words
   in it.

5. **Choose and commit to a stack layer** (from `immersive-3d` §2). Base layer:
   exactly one, and only when code is actually written.
   - React project/production → React Three Fiber → load `r3f-patterns`
   - Single-file HTML/demo → Vanilla Three.js (pattern from `immersive-3d`, no extra skill)
   - A plan, contract, or art-direction answer names the base layer in prose and
     loads no implementation skill.

   Add-ons are separate decisions, each loaded only when the brief already
   requires that capability and the requirement is stated:
   - Custom look/gradients/WebGPU → `shaders-tsl`
   - Scroll-driven → `scroll-immersion`
   - Clickable/hoverable, hotspots, configurator, camera on click, animation clips, 3D text → `r3f-interaction`
   - Custom models/textures that must be prepared first → `3d-asset-pipeline`
   - Passes that read what earlier passes wrote, or more than two effects whose
     order matters → `render-graph`. One bloom does not.
   - A first frame that depends on staged assets, or an art-directed arrival →
     `loading-choreography`. One model behind Suspense does not.
   - The brief says the experience plays sound → `spatial-audio`. A scene that
     would suit sound does not.

6. **Direction and colors** — Load `style-directions` only when the direction is unclear, and `color-palettes` only when colors are chosen.

7. **Responsive contract (REQUIRED)** — Read the responsive recomposition
   reference from `core-rules` before defining the composition. A 3D hero or
   scene that appears on a page crosses viewports by definition, so this is not
   one of the conditional loads in step 6. Define wide, portrait, and narrow
   each with priority, DOM order, canvas crop, CTA, and interaction model. The
   canvas is not exempt: name what the portrait shot drops or reframes.

8. **Set perf budget and runtime tiers** — `immersive-3d` §3 plus `3d-runtime-quality`: Poster/Low/Medium/High, adaptive shadows/LOD/PostFX/particles/DPR, hysteresis, and offscreen pause.

9. **Fallbacks (MANDATORY)** — Work through `immersive-3d` §5: reduced motion, art-directed poster when WebGL/WebGPU is missing, lazy load, Suspense + preload.

10. **Interaction and input parity** — As soon as the scene is clickable or
    draggable: load `r3f-interaction`. Every canvas action needs a DOM
    equivalent.

    **Touch (REQUIRED for any pointer-driven scene)** — Answer all six
    separately and report them as six entries, not as one sentence about
    "touch support". A scene that omits one of these ships a gesture the
    browser or another handler will steal:

    1. Drag threshold — the distance that separates a tap from a drag.
    2. Pinch/zoom — the gesture owner and the clamped zoom range.
    3. Pointer capture — where `setPointerCapture` is taken and released.
    4. `touch-action` — the exact value on the canvas and why.
    5. Hover fallback — what replaces hover-only information on touch.
    6. Cancellation — the `pointercancel` and capture-loss recovery path.

11. **Pre-flight** — Load `core-rules` and check the applicable items including evidenced claims, responsive contract, art-direction contract, 3D budget, renderer compatibility, DOM alternative, and stable quality tiers.

12. **Render verification** — When the app runs locally, execute the
    capability-checked adapter `scripts/verify-browser.mjs` or a real host
    browser automation with the state matrix from `/verify`. Actually inspect
    desktop, mobile, reduced motion, and fallback. Report the outcome with the
    four values `core-rules/references/verification-status.md` defines; without
    inspected images there is no pass.

## Output format

1. One sentence: why 3D is justified + the selected stack layer + direction
2. When supplied, reference-intake trace and poster target; then the content/claim contract plus art-direction contract for desktop, portrait, and poster
3. Wide/portrait/narrow recomposition of the page
4. `npm install …` (R3F) or importmap (vanilla)
5. Working code with reduced-motion, DOM, and 2D fallback
6. Perf budget plus Poster/Low/Medium/High table
7. For interactive scenes: the keyboard solution, plus all six touch answers
   from step 10 as separate entries — drag threshold, pinch/zoom, pointer
   capture, `touch-action`, hover fallback, cancellation
8. Verification status, backend, and artifact folder; when the status obliges
   a capture matrix, the open matrix
9. Customization hooks (colors, light, exposure, motion intensity, camera distance)

If the user explicitly asks only for a plan or contract: deliver the applicable
contracts, tiers, fallbacks, and interaction states without install commands or
working code, and set verification to `NOT_APPLICABLE (plan-only)`.

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
