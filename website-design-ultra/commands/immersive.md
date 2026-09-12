---
description: Builds an immersive 3D scene or website according to the website-design-ultra rules — selects the stack layer, sets the perf budget, and delivers runnable code with fallbacks.
argument-hint: [briefing, e.g. "3D product hero, dark, scroll-driven"]
---

# /immersive

Build an immersive 3D experience. `immersive-3d` owns the rules; this command
owns the order and shape of the answer. Read `core-rules` §3/§4 once for routing
and invariants; reuse them if loaded. Other task classes do not apply; an owner
reference read does not reload its owner.

## Workflow

1. **Justification and page ownership** — `immersive-3d` Gate and ownership.
   If 3D carries no statement, point to `/design`.
2. **Reconnaissance** — Inside a repo, read `package.json` instead of assuming
   the stack.

   **Evidence gates** — Each fires on supplied material, never on a topic, and
   finishes its ledger before scene code. Six to ten exported PNG/SVG frames
   plus a written token block → `reference-intake`; a live 3D reference URL
   *and* an explicit runtime-recon request → `site-reconnaissance`. A mood label
   or screenshot fires neither.
3. **Art direction** — `3d-art-direction`, as a contract.
4. **Content and copy** — `content-design` for the claim. `anti-slop` the
   moment any user-visible line is written, plan-only included: deciding what
   a line says is writing it.
5. **Stack** — `immersive-3d` Mandatory stack. One base layer, only when code is
   written. Each add-on needs a stated requirement before it loads.
6. **Direction and colors** — `style-directions` only when unclear.
   `color-palettes` only for page or component tokens; scene color output and
   tone mapping belong to `3d-art-direction`.
7. **Responsive contract (REQUIRED)** — Read
   `core-rules/references/responsive-recomposition.md`. A scene crosses
   viewports by definition, so this is not conditional and the canvas is not
   exempt: name what the portrait shot drops or reframes.
8. **Budget and tiers** — `immersive-3d` Budget and anti-slop, with
   `3d-runtime-quality`.
9. **Fallbacks (MANDATORY)** — `immersive-3d` Fallback and handoff.
10. **Interaction** — `r3f-interaction` as soon as the visitor can click or drag
    the scene; every canvas action needs a DOM equivalent. A scene the visitor
    only watches skips this step. For a pointer-driven scene, answer the six
    questions in `r3f-interaction/references/touch-and-gestures.md` as six
    entries, not one sentence about "touch support".
11. **Pre-flight** — Check the selected contracts and the already-read
    invariants. Do not reload `core-rules`.
12. **Render verification** — `scripts/verify-browser.mjs` or real host browser
    automation with the `/verify` state matrix. Inspect the images. An
    implemented scene finishes with `target-comparison.json` and its Diff-PNG;
    plan-only or out-of-scope runs finish `NOT_APPLICABLE (reason)`;
    unavailability stays `UNAVAILABLE` and unverified.

## Output format

1. Why 3D is justified, the base layer, the direction
2. The contracts: reference trace and poster target when supplied, the
   site-recon ledger when its gate fires, the claim, art direction for desktop,
   portrait and poster
3. Wide, portrait, and narrow recomposition of the page
4. Install commands or import map
5. Working code carrying the declared fallbacks
6. Budget plus the tier table
7. For interactive scenes: the keyboard solution and all six touch answers as
   separate entries
8. Verification status, backend, and artifact folder, per step 12
9. Customization hooks

Plan-only briefs deliver the contracts, tiers and fallbacks without install
commands or code, add interaction states only when the scene takes input, name
the poster target and the first look-loop iteration the build will measure, and
set verification to `NOT_APPLICABLE (plan-only)`.

## Arguments

Whatever follows `/immersive` is the briefing, e.g. `3D product hero, dark, slow
drift`. If nothing is given, ask briefly: what, which context, scroll-driven
yes/no, clickable yes/no?
