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

Use these defaults unless the brief or existing system implies otherwise:

- `DESIGN_VARIANCE: 7` — asymmetrical, but composed.
- `MOTION_INTENSITY: 6` — expressive, not distracting.
- `VISUAL_DENSITY: 4` — spacious, not empty.

Treat them as decisions for the current task, not values to write into this skill.

## 2. Reconnaissance before code

1. Identify purpose, audience, verified content/claims, primary action, and device context.
2. Inspect `package.json`; verify framework, React, Tailwind, and installed libraries.
3. Read existing tokens, `DESIGN.md`, brand assets, and component conventions.
4. Preserve user functionality and content unless the request explicitly changes them.
5. Select one primary direction. Add a secondary influence only when its role is explicit, such as “Swiss grid, editorial typography.”

## 3. Minimal skill routing

Read only what the task needs:

- Style exploration is explicitly requested, or neither brand/system nor
  functional product cues provide a usable direction → `style-directions`.
  A direction the briefing already names is an input, not a request to explore:
  apply it from the briefing. A clear product context or named palette alone
  does not require the skill either.
- Content hierarchy, claims, CTAs, state copy, or localization changes → `content-design`.
- **Any user-visible copy is written, rewritten, or audited → `anti-slop`.** This
  gate is independent of `content-design`: a hero headline, a section subhead, a
  button label, an empty state, or demo data still needs the tell catalogue even
  when the claim ledger was not otherwise in scope. Non-English output loads the
  matching locale annex in addition.
  A plan-only or contract-only deliverable does not suspend this gate. Deciding
  what a headline, subhead, CTA, label, or state message will say is writing
  copy, whether the answer ships as a rendered line or as a row in a content
  contract. "No code" limits the format of the output, not the tells in it.
- Output looks machine-made, or an existing page is audited for it → `anti-slop`
  design tells.
- Colors must be selected or audited → `color-palettes`.
- Font family, license/loading, language coverage, detailed type scale, or
  wrapping behavior must be selected, changed, or audited → `typography`.
  Generic content/layout hierarchy alone does not activate it.
- Full page, signature section, or multi-region layout crosses viewports → [references/responsive-recomposition.md](references/responsive-recomposition.md).
- Motion is requested, already present, or selected as part of the direction → `motion-system`; then use the working-profile intensity to calibrate it.
- A concrete hero, card, form, navigation, or overlay recipe is explicitly
  needed and not already decided by the existing system/layout contract →
  `component-patterns`. Generic page or dashboard planning alone does not
  activate it.
- A component owns async data, validation, mutation, or interactive state → `ui-states`.
- 3D, WebGL, WebGPU, shaders, Three.js, or R3F → `immersive-3d`, then `3d-art-direction`, `3d-runtime-quality`, and only the relevant implementation sub-skill.

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
exception: `3d-art-direction` and `3d-runtime-quality` are mandatory, followed
by only the implementation layers the scene actually needs.

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
- Never make essential information or functionality canvas-only.

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

- Create a clear visual focal point and reading order.
- Use one dominant action color; secondary palette colors may be decorative or semantic when the chosen direction defines them.
- Use semantic design tokens rather than scattered literal values.
- Recompose asymmetrical desktop layouts intentionally on mobile; use the responsive reference for priority, source order, replacement, reframing, and interaction changes.
- Prefer whitespace, dividers, and grouping before adding cards.

## 7. Pre-flight

Check only applicable items:

- [ ] Existing stack and design system were inspected.
- [ ] Primary direction and any scoped secondary influence are explicit.
- [ ] Content hierarchy, claim evidence, and main action are clear.
- [ ] Shipped copy has zero Tier-1 slop tells, clears the specificity floor, and
      was linted rather than self-assessed.
- [ ] Wide, portrait, and narrow compositions have an explicit priority/crop/interaction contract where applicable.
- [ ] Async/interactive components cover their applicable states.
- [ ] Focus, keyboard, contrast, touch, and reduced-motion behavior are present.
- [ ] Motion has one timing owner per subtree and no `transition: all`.
- [ ] External assets and fonts have valid sources/licenses; factual claims map to evidence.
- [ ] Relevant locale expansion, formatting, script coverage, and RTL behavior were tested.
- [ ] 3D work has an art-direction contract, budget, fallback, alternative content, and stable quality tiers.

Fix failed applicable checks before delivery.

## 8. Output

For build tasks, provide:

1. Direction and rationale in one or two sentences.
2. Required install commands only when dependencies are missing.
3. Working implementation.
4. Applicable state/accessibility notes.
5. The smallest useful set of customization hooks.

For audits or explanations, report evidence instead of dumping replacement code.
