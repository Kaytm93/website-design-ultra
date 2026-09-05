---
name: core-rules
description: Route pages, components, UI audits and 3D work by task scope. Preserve accessibility, content truth, performance and existing design constraints; select only applicable contracts.
---

# Website Design — Core Rules

## 1. Task class

- **Page/section:** §2–§4 and §7. Profile and composition live in
  `references/composition-contract.md`.
- **Tweak:** command route and §4/§7; inherit direction, palette, type and pattern.
- **3D:** §3/§4 once, then `immersive-3d`; no owner reload at handoff/pre-flight.
- **Audit/copy/plan:** only requested evidence or decisions; no implied code task.

Invariants outrank defaults. Direction exceptions need a reason and preserve
correctness, accessibility and the brief. Visual defaults live in
`anti-slop/references/design-tells.md`.

## 2. Reconnaissance

Identify audience, verified claims, primary action and devices. Before code,
inspect `package.json`, versions, tokens, `DESIGN.md`, assets and conventions.
Preserve functionality/content; use the existing direction or choose from evidence.

## 3. Minimal skill routing

A gate fires on a concrete decision, not on a topic. Load only selected files.

| Gate | Load |
|---|---|
| User-visible copy is written or audited, including plan-only lines | `anti-slop` prose reference; locale annex for non-English |
| Visual composition is created or audited | `anti-slop` design tells |
| Hierarchy, claims, CTAs, state copy or localization change | `content-design` |
| Style exploration requested, or no brand/system/product cue gives a direction | `style-directions` |
| Colors selected or audited | `color-palettes` |
| Font family, license/loading, language coverage, type scale or wrapping changes | `typography` |
| Page or signature section crosses viewports | `references/composition-contract.md` and `references/responsive-recomposition.md` |
| Reproducible dynamic capture, visual baseline, runnable poster/checkpoint or scene bug reproduction | `references/determinism.md` |
| Motion requested, present or part of the direction | `motion-system` |
| Hero, card, form, navigation or overlay recipe still undecided | `component-patterns` |
| Async, validation, mutation or interaction behavior is designed/changed | `ui-states` |
| 3D brief supplies six to ten exported PNG/SVG frames plus a written token block | `reference-intake`, before `3d-art-direction` |
| 3D, WebGL, WebGPU, shaders, Three.js or R3F | `immersive-3d`; its mandatory art/quality skills and only needed implementation layers |
| Thousands of particles with persistent state, fields, trails or morphing | `gpu-particle-systems`, behind `immersive-3d` |
| Geometry generated from parameters or algorithmic growth | `procedural-3d`, before `3d-asset-pipeline` |
| Live 3D reference URL plus an explicit runtime-recon request | `site-reconnaissance`, behind `immersive-3d` |

Copy and claims gates are independent. Copy-only edits to a state label do not
activate `ui-states`; its gate requires behavior or transition decisions. Named direction is input, not exploration.
Generic content/layout hierarchy activates no font or recipe choice. Ordinary
heroes/plans skip determinism without runnable capture. Text-only briefs skip
reference intake.

### Routing protocol

Cross-skill mentions are selection pointers, not recursive dependencies. Decide
before reading; load each selected SKILL.md once, then only its relevant
references. Do not reread owners or load siblings for context. An owner reference
can be read directly without reloading its skill. Keep a file ledger; provider
access traces, not a self-declared route, prove what loaded.
Target four domain skills and one reference per family in 2D; independent
requirements justify more. 3D follows its master.

## 4. Invariants

- Preserve semantic HTML, keyboard access, visible focus, readable contrast and
  meaningful alternative content. Read [references/accessibility.md](references/accessibility.md)
  when defining those behaviors, touch targets or reduced motion explicitly.
- Respect `prefers-reduced-motion`; pause persistent motion when required.
- Essential content and actions must remain accessible outside canvas.
  `canvas-first-architecture` specifies the parallel DOM mechanism, not an exemption.
- Animate transform/opacity where possible; justify other properties. Avoid
  `transition: all`, layout animation with a transform equivalent, render-loop
  React state and unbounded DPR. Keep will-change local and brief.
- Pause perpetual work offscreen/hidden. Use `min-height: 100dvh` for mobile heroes.
- Verify versions before choosing APIs; clean up effects and subscriptions.
  Keep interaction in small client leaves and one motion clock per subtree,
  with explicit boundaries and one scroll/camera timing owner. Prefer Grid.
- Preserve verified facts. Never invent proof, testimonials or precision.
  Use project assets first; label prototype placeholders. Preserve semantic tokens.

## 7. Pre-flight and output

Use the already-read rules; this check does not trigger another read.

- [ ] Stack, system, tokens and content were inspected before code changes.
- [ ] Each loaded skill maps to a fired gate and each fired gate was handled.
- [ ] Direction exceptions override defaults only, with a reason stated once.
- [ ] Applicable checks of the selected skills passed; fix failed items.

Builds deliver rationale, needed installs, code, states/accessibility and useful
customization hooks. Audits report evidence; plans report decisions. Status:
`references/verification-status.md`.
