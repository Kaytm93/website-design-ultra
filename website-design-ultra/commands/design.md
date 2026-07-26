---
description: Builds a website, landing page, or component according to the website-design-ultra rules and loads only the design skills the briefing actually needs.
---

# /design

You will build a website, landing page, or UI component.

If the briefing calls for 3D, WebGL, a scene, or an immersive experience → use `/immersive` instead of `/design`.

## Workflow

1. **Reconnaissance** — If inside a repo: read `package.json` for a stack check (React/Next, Tailwind v3/v4, existing UI library). If `DESIGN.md` or `tokens.css` exists: respect it.

2. **Content contract** — When hierarchy or copy is built or changed, load `content-design`. Fix promise, mechanism, evidence, objections, primary action, and unknown facts; do not invent claims.

3. **Choose a direction** — Load `style-directions` only for explicitly
   requested style exploration, or when neither brand/system nor functional
   product cues provide a workable direction and that decision materially
   changes the output. A functionally well-described product, a dashboard, or a
   named palette does not activate the skill automatically. Choose from the
   briefing and the existing system, not from forced variation.

4. **Palette and type** — Load `color-palettes` only when colors are chosen or
   changed. Load `typography` only when font family, license/loading, language
   coverage, a detailed type scale, or wrapping is chosen, changed, or audited;
   generic content/layout hierarchy alone does not activate the skill. Inside
   each skill, read only the matching reference family. For every font file,
   check license/embedding and a free alternative.

5. **Responsive art direction** — For full pages or signature sections, load the responsive recomposition reference from `core-rules`. Define wide, portrait, and narrow each with focus, order, crop/media, CTA, density, and interaction model.

6. **Motion profile** — Load `motion-system` only when motion is requested, already present, or part of the chosen direction. Then use `MOTION_INTENSITY` to calibrate it and load only the selected runtime reference.

7. **Choose a pattern** — Load `component-patterns` only when the briefing calls
   for a concrete hero, card, form, nav, or overlay recipe that is not already
   decided by the existing system and layout contract. Generic page, landing
   page, or dashboard planning alone does not activate the skill. Load at most
   the matching pattern reference.

8. **States** — Load `ui-states` only for components with data, mutation, validation, or interaction. Implement the states the applicability matrix marks as relevant, and use `content-design` for any new state copy.

   Treat routing pointers as selection, not as a recursive load instruction.
   Keep an internal ledger of the skills/references actually read and do not
   load a sibling reference “just in case”.

9. **Output format**:
   - 1–2 sentences of direction rationale
   - Content/claim contract with unknowns marked
   - Wide/portrait/narrow recomposition for pages and signature sections
   - `npm install ...` if libraries are needed
   - Working code
   - Short note on relevant states/accessibility
   - Customization hooks (which CSS vars / Tailwind vars are easy to change)

   If the user explicitly asks only for a plan, contract, wireframe, or explanation: deliver the same decisions without install commands and working code. Do not invent a build mandate.

10. **Verification** — When the app is runnable, use the capability-checked
    adapter from `scripts/verify-browser.mjs` or a real host browser capability
    following the state contract in `/verify`. Inspect desktop, mobile, and
    reduced motion; for 3D also the fallback. When both are missing, report
    `UNAVAILABLE` and hand over **unverified**; never claim `PASS` from a build
    or a code review. For an explicit plan/contract without a runnable target,
    report `NOT_APPLICABLE (plan-only)` and define only the later capture
    matrix; that is not a launch assessment.

## Arguments

Whatever the user types after `/design` is the briefing. Examples:
- `/design landing page for an AI code editor`
- `/design dashboard hero, dark mode, minimal`
- `/design portfolio site, editorial style`

If nothing is given: ask — what are we building? What is the context?

## Pre-flight check before output

Mandatory: load `core-rules` and check only the applicable items. Fix every ✗ before delivering.
