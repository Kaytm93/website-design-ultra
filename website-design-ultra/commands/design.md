---
description: Builds a website, landing page, or component according to the website-design-ultra rules and loads only the design skills the briefing actually needs.
---

# /design

Build a website, landing page, or UI component. `core-rules` owns the gates;
this command owns the order and the shape of the answer. For 3D, WebGL, or a
scene, use `/immersive` instead.

## Workflow

1. **Reconnaissance** — Inside a repo, read `package.json` for the stack, and
   respect an existing `DESIGN.md` or `tokens.css`.
2. **Content contract** — `content-design` when hierarchy or copy is built or
   changed. Do not invent claims; mark unknowns.

   **Copy form** — `anti-slop` and its prose reference the moment any
   user-visible line is written. Independent of step 2, and a plan-only brief
   does not suspend it: deciding what a headline, CTA, or state message says
   is writing it. Add the locale annex for non-English.
3. **Direction** — `style-directions` only for requested exploration, or when
   no brand, system, or product cue yields a direction. A direction the
   briefing names is an input, not a request to explore.

   **Divergence before commitment** — For a page or signature section, name
   three variants before choosing, whether or not `style-directions` loaded.
   One line each: direction, signature move, first screen. They must differ in
   composition, not in palette alone. Then choose and say what the other two
   lose. Skip it only for a single component or a system that already declares
   its direction, and say which decision made that unnecessary.
4. **Palette and type** — `color-palettes` only when colors are chosen.
   `typography` only when family, licensing, language coverage, a type scale,
   or wrapping is decided; generic hierarchy does not activate it. Check the
   license and a free alternative for every font file.
5. **Composition** — For full pages and signature sections, read
   `core-rules/references/composition-contract.md` for what must survive every
   viewport, then `core-rules/references/responsive-recomposition.md` for the
   wide, portrait, and narrow shots.
6. **Motion** — `motion-system` only when motion is requested, present, or
   part of the direction. Calibrate with `MOTION_INTENSITY`.
7. **Pattern** — `component-patterns` only for a concrete recipe the system
   has not already decided.
8. **States** — `ui-states` only for components with data, mutation,
   validation, or interaction.
9. **Verification** — `scripts/verify-browser.mjs` or real host browser
   automation following `/verify`. Inspect desktop, mobile, reduced motion.

## Output format

- 1–2 sentences of rationale, naming the two rejected variants
- Content and claim contract, unknowns marked
- Copy-lint result: tier counts and the command that produced it
- Composition contract and the three viewport shots, for pages and sections
- Install commands if needed, then working code
- Relevant states and accessibility
- Customization hooks

For a plan, contract, wireframe, or explanation: the same decisions without
install commands or code. Do not invent a build mandate.

## Arguments

Whatever follows `/design` is the briefing. Examples:
- `/design landing page for an AI code editor`
- `/design dashboard hero, dark mode, minimal`
- `/design portfolio site, editorial style`

If nothing is given: ask what we are building and in which context.

## Pre-flight

Load `core-rules` §7 and fix every ✗ before delivering.
