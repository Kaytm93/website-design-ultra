---
name: canvas-first-architecture
description: Structure an experience where the canvas is the page rather than a component on it — full-viewport scenes with in-canvas sections, one scene state machine, one clock, one asset manifest, and the DOM layer that keeps the result reachable. Use only when the document no longer owns the page's headings, links, and sections. A 3D hero above a normal page, a product viewer, or a pinned scroll scene does not activate this skill.
---

# Canvas-First Architecture

Use this layer only when the scene owns headings, links, and sections, section
movement changes scene state, and five or more systems read the same frame. A
3D hero above a DOM page, product viewer, or pinned scroll section stays on the
normal 3D path. State the answers before loading more modules.

## Compensation contract

Fill before scene code. This schema keeps essential information and functionality
out of canvas-only UI; `poster-route` is filled by `immersive-3d` §5 and
audio by `spatial-audio` when sound ships.

```yaml
canvas-scope: "full-viewport | full-page with DOM chrome"
dom-parallel-layer: "which headings, links, and controls exist as real DOM"
focus-model: "how focus enters the scene, moves inside it, and leaves"
section-contract: "named states, their DOM equivalents, their entry conditions"
deep-link-model: "URL per section, restore behavior, share target"
motion-opt-out: "reduced-motion state plus the visible control"
audio-opt-out: "default state, control, persistence"
poster-route: "the path taken when WebGL is unavailable"
input-parity: "keyboard and touch equivalent for every pointer gesture"
```

Read [references/parallel-dom-layer.md](references/parallel-dom-layer.md) for the
DOM, focus, and input fields. Read [references/scene-state-and-clock.md](references/scene-state-and-clock.md)
when implementing the state machine or clock.

## Ownership and exclusions

Name one owner per axis: one clock; one section state machine; one camera rig per
state; one asset manifest; one normalized input router; and the
`3d-runtime-quality` controller. Everyone else reads. The page's text, primary
action, forms, legal/pricing/contact copy, and search/link-preview content stay
in the DOM. Decorative type and readouts may mirror DOM values.

1. Answer the gate and contract.
2. Name owners, sections, entry conditions, deep links, and input parity.
3. Build the DOM parallel layer in the same commit as the first section.
4. Use budgets/tier/fallback from `immersive-3d` and `3d-runtime-quality`.
5. Verify every section and action keyboard-only, including the poster route.

## Routing and prohibition

Multi-pass → `render-graph`; staged assets → `loading-choreography`; sound →
`spatial-audio`; camera/light/type → `3d-art-direction`; tiers/pause →
`3d-runtime-quality`; React → `r3f-patterns`; scroll → `scroll-immersion`.

The four canvas-only categories are `primary-action`, `form`, `legal-copy`, and
`pricing`. Each rendered surface declares `domTwinSelector` and optional
`canvasSurfaceSelector`; validate with `templates/runtime/canvas-only-prohibition.ts`
and keep the overlay decorative (`aria-hidden`, `pointer-events:none`, or
`data-wdu-canvas-decorative`). A missing twin is a violation, not a silent pass.

The validator runs statically via `validateDeclaration(declaration, root)` and
at runtime via `createProhibitionObserver(declaration, root)`; both share one
surface and one violation vocabulary. The full category list, signature shape,
and validator wiring live in `references/prohibition-list.md`.

## Check

- [ ] The §1 gate was answered, and the answer is in the deliverable.
- [ ] Every §2 field is filled or delegated to its named owner.
- [ ] Each §3 axis has exactly one writer.
- [ ] Sections are named states with entry conditions.
- [ ] The DOM parallel layer exists, and a keyboard-only run reaches every
      section and every action.
- [ ] Nothing from §4 is painted into the scene.
- [ ] Every §4 category has a validator declaration that returns `isPassing: true`
      against the rendered DOM, with the four categories enumerated and the
      canvas overlay either absent or decorated (aria-hidden / pointer-events:none
      / `data-wdu-canvas-decorative` wrapper).
- [ ] Deep links resolve to a section, and a shared link restores it.
- [ ] The poster route renders the statement without a canvas.
