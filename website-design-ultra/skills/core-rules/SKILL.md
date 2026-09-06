---
name: core-rules
description: Master workflow for website and frontend design. Use for websites, landing pages, heroes, dashboards, portfolios, UI layouts, React, HTML, CSS, Tailwind, premium interfaces, responsive art direction, and any 3D/WebGL/WebGPU experience. Enforces reconnaissance, content truth, accessibility, performance, anti-slop rules, and minimal skill routing.
---

# Website Design — Core Rules

Build coherent, production-ready interfaces. Apply the rule hierarchy below in order.

## Rule hierarchy

1. **Invariants:** correctness, accessibility, performance, existing brand/system constraints.
2. **Defaults:** the anti-slop and composition guidance in this skill.
3. **Direction exceptions:** a selected style may override a default, never an invariant. State the reason once.

This hierarchy resolves apparent conflicts. Example: off-black is the default; true black is valid when a Swiss, Apple-dark, Y2K, or Neo-Memphis direction explicitly needs it and contrast remains valid.

## 1. Working profile

Defaults unless the brief or system implies otherwise. Each names what verifies
it; an unverified value is decoration and gets deleted.

| Value | Default | Verified by |
|---|---|---|
| `DESIGN_VARIANCE` | 7 / asymmetrical, composed | ≥ 2 deliberate grid breaks per page, plus the ≤ 60% uniformity budget in `anti-slop` design tells |
| `MOTION_INTENSITY` | 6 / expressive, not loud | the profile and duration table in `motion-system` |
| `VISUAL_DENSITY` | 4 / spacious, not empty | `space-scale` and `section-padding` in the direction token block; at 4, hero padding ≥ 2× CTA |

Task decisions, not values to edit here. Lowering one lowers its check: state the
new number, keep the artifact.

## 2. Reconnaissance before code

1. Identify purpose, audience, verified content/claims, primary action, and device context.
2. Inspect `package.json`; verify framework, React, Tailwind, and installed libraries.
3. Read existing tokens, `DESIGN.md`, brand assets, and component conventions.
4. Preserve user functionality and content unless the request explicitly changes them.
5. Select one primary direction. Add a secondary influence only when its role is explicit, such as “Swiss grid, editorial typography.”

## 3. Minimal skill routing

Read only what the task needs. A row fires on its gate, not on the topic.

| Gate | Load |
|---|---|
| Any user-visible copy is written, rewritten, or audited | `anti-slop`, plus the locale annex for non-English |
| Output looks machine-made, or a page is audited for it | `anti-slop` design tells |
| Content hierarchy, claims, CTAs, state copy, or localization change | `content-design` |
| Style exploration is requested, or no brand, system, or product cue yields a direction | `style-directions` |
| Colors are selected or audited | `color-palettes` |
| Font family, license/loading, language coverage, type scale, or wrapping changes | `typography` |
| A page, signature section, or multi-region layout crosses viewports | `references/composition-contract.md` and `references/responsive-recomposition.md` |
| A runnable scene needs reproducible dynamic capture, a visual baseline, a poster/checkpoint frame, or deterministic bug reproduction | `references/determinism.md` |
| Motion is requested, already present, or part of the direction | `motion-system`, calibrated by `MOTION_INTENSITY` |
| A hero, card, form, navigation, or overlay recipe is still undecided | `component-patterns` |
| A component owns async data, validation, mutation, or interactive state | `ui-states` |
| A 3D brief supplies six to ten exported PNG and SVG frames plus a written token block | `reference-intake`, before `3d-art-direction` |
| 3D, WebGL, WebGPU, shaders, Three.js, or R3F | `immersive-3d`; if the reference gate fired, `reference-intake`; then `3d-art-direction` and `3d-runtime-quality`, then one implementation sub-skill |
| A 3D brief needs thousands of particles carrying state across frames, a spatial field, trails, or a morph between targets | `gpu-particle-systems`, behind `immersive-3d` |
| A 3D brief needs geometry produced from parameters or grown algorithmically instead of imported | `procedural-3d`, before `3d-asset-pipeline` |
| A public live 3D reference URL is supplied with an explicit runtime-reconnaissance request | `site-reconnaissance`, behind `immersive-3d` |

Six clarifications the table cannot carry:

- **The copy gate is independent of `content-design`.** A headline, subhead,
  button label, empty state, or demo string needs the tell catalogue even when
  the claim ledger was out of scope. Plan-only and contract-only deliverables
  included: deciding what a line says is writing it, whatever format ships it.
- **A named direction is an input, not a request to explore.** Apply it from the
  briefing; a clear product context or a named palette does not activate
  `style-directions` either.
- **The determinism gate is evidence-scoped.** Read
  `references/determinism.md` for reproducible dynamic capture or scene bug
  reproduction. Ordinary 2D work, an ordinary 3D hero, and a plan without a
  runnable capture target do not activate it.
- **The reference gate requires both artifacts.** A named direction, style label,
  or text-only 3D briefing without the six-to-ten-frame set and written token
  block does not activate `reference-intake`.
- **The site-reconnaissance gate requires runtime evidence.** A public URL and an
  explicit implementation-reconnaissance request are required; a screenshot
  alone, ordinary 2D audit, or ordinary 3D hero does not activate it.
- **Two gates fire on a concrete decision, never on a topic.**
  Generic content/layout hierarchy does not activate `typography`; generic page
  or dashboard planning does not activate `component-patterns`. Both need a
  choice the existing system has not already made.

Do not load every design skill by default.

### Routing protocol

Treat cross-skill mentions as one-way selection pointers, not recursive
dependencies:

1. Decide the task gate before reading a child skill.
2. Load each selected `SKILL.md` once.
3. Let that skill select its references; read no sibling reference “for context”.
4. Do not follow a child’s back-reference to an already loaded owner.
5. Do not load a skill merely because another skill names its single source of
   truth; load it only when the current task needs that contract.

For ordinary 2D work, target at most four domain skills beyond `core-rules` and
one reference per selected family. More is valid only when independent user
requirements activate independent contracts. The 3D master is the documented
exception: when the evidence gate fires, `reference-intake` runs first;
`3d-art-direction` and `3d-runtime-quality` remain mandatory, followed by only
the implementation layers the scene actually needs.

Keep an internal routing ledger of selected skills and references. Provider
access traces in the forward suite are authoritative; a self-reported route is
not proof that Progressive Disclosure worked.

## 4. Invariants

### Accessibility

Summarised here, specified in
[references/accessibility.md](references/accessibility.md). Read that file when
the deliverable has to state focus, keyboard, contrast, touch-target, or
reduced-motion behavior rather than merely inherit it. It belongs to this skill
because these are invariants of every page.

- Preserve semantic HTML, keyboard access, visible focus, readable contrast, and meaningful alternative content.
- Respect `prefers-reduced-motion`; moving content that persists must also be pausable when required.
- Never make essential information or functionality canvas-only. An experience
  where the canvas is the page meets this through a declared parallel DOM layer,
  specified in `canvas-first-architecture`. That is a mechanism for satisfying
  the invariant, not an exemption from it.

### Performance

- Animate `transform` and `opacity`; name any additional animated property deliberately.
- Avoid `transition: all`, render-loop React state, and unbounded DPR.
- Use `will-change` briefly and locally.
- Pause perpetual work when offscreen or when the document is hidden.
- Use `min-height: 100dvh` rather than `100vh` for full-height mobile heroes.

### Engineering

- Verify package versions before choosing APIs.
- Keep interactive code in small client leaves; clean up effects and subscriptions.
- Use one motion clock per subtree. Different libraries may coexist only behind explicit component boundaries with one owner for scroll/camera timing.
- Prefer Grid over width calculations.

## 5. Anti-slop defaults

The full tell catalogue, the Tier-1/2/3 model, the register profiles, the
protect list, and the copy linter live in `anti-slop`. This section keeps only
the standing design defaults; do not restate them there.

These are defaults, not universal prohibitions:

- Avoid generic centered marketing heroes, equal three-card rows, card containers around every block, and arbitrary glass panels.
- Avoid default AI purple/pink gradients, uncontrolled neon glow, and unrelated accent colors.
- Prefer off-black over pure black unless the selected direction defines an exception.
- Prefer distinctive, licensed or open fonts; do not use Inter/Roboto/Arial/system-ui as a premium display default. See `typography` for allowed body use and fallbacks.
- Avoid invented company claims, fake testimonials, fake precision, placeholder brand names, and vague copy. Use `content-design` for the claim ledger and approved placeholders.
- Use project assets first. Use deterministic placeholder imagery only for prototypes and label it as placeholder content.
- Do not use custom cursors. Native `cursor: pointer` is fine.
- Do not animate layout properties when an equivalent transform solution exists.

## 6. Composition defaults

Full pages and signature sections declare their composition before layout code,
in [references/composition-contract.md](references/composition-contract.md), and
recompose it across viewports with
[references/responsive-recomposition.md](references/responsive-recomposition.md).
The defaults below apply to everything smaller.

- Create a clear visual focal point and reading order.
- Use one dominant action color; secondary palette colors may be decorative or semantic when the chosen direction defines them.
- Use semantic design tokens rather than scattered literal values.
- Recompose asymmetrical desktop layouts intentionally on mobile; use the responsive reference for priority, source order, replacement, reframing, and interaction changes.
- Prefer whitespace, dividers, and grouping before adding cards.

## 7. Pre-flight

Every loaded skill carries its own Check list. Restating them here produced a
second copy that drifts, so this pre-flight keeps only the four items no other
skill owns:

- [ ] The existing stack, design system, tokens, and content were inspected
      before any code was written.
- [ ] Every §3 gate that fired was loaded, and every loaded skill maps back to a
      gate. The routing ledger names both directions.
- [ ] Every direction exception overrode a default and never an invariant, and
      each was stated once with its reason.
- [ ] The Check list of every loaded skill ran. A skill that no gate selected has
      no applicable check — that is the routing decision, not an omission.

Fix failed items before delivery.

## 8. Output

For build tasks, provide:

1. Direction and rationale in one or two sentences.
2. Required install commands only when dependencies are missing.
3. Working implementation.
4. Applicable state/accessibility notes.
5. The smallest useful set of customization hooks.

For audits or explanations, report evidence instead of dumping replacement code.
