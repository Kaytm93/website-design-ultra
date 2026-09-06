---
name: vanilla-three-production
description: Ship a production Three.js scene without React — hand-wired lifecycle, pause reasons, context-loss fallback, disposal, and a runnable Vite starter. Use only when the deliverable is plain HTML, an embed, a single file, or a non-React host and scene code is actually being written. A React or Next project, a plan, or an art-direction answer does not activate this skill.
---

# Vanilla Three.js Production

React carries five things for an R3F scene. Without it, nothing does, and a
scene that drops one still runs — which is why this is a skill and not a note.
`immersive-3d` owns justification, budget and fallback; `3d-art-direction` owns
the image; `3d-runtime-quality` owns tiers. This owns the wiring underneath.

## The five React was doing

State each before scene code. Every one has a named owner in the deliverable.

```yaml
run-state: "the single state; which reasons pause it"
pause-reasons: "document.hidden | offscreen | context-lost — all three, separately"
reduced-motion: "matchMedia listener, not a one-time read"
dom-fallback: "the layer already in the document that becomes visible on loss"
disposal: "geometries, materials, textures, renderer, listeners, observers"
```

Collapsing the pause reasons into one boolean is the failure that ships: a scene
returning from a hidden tab resumes while still scrolled out of view. One state,
three reasons, and only the absence of all three resumes.

## Copy, do not rewrite

`repo:starters/vite-three-canvas/` is the runnable baseline and passes the same
CI gate as the R3F starter. Start with
`repo:starters/vite-three-canvas/src/lifecycle.ts`: every browser API it needs
is injected, so the state machine is verifiable in Node without a browser, and
its cases are already written.

`references/production-modules.md` names each module, what it owns, and the one
thing that goes wrong when it is dropped.

## Non-negotiables

Pin an exact Three version and verify each API against it. Drive one loop with
`requestAnimationFrame` or `setAnimationLoop` — never two. Set
`outputColorSpace` and tone mapping once, before the first draw. Cap DPR at 2,
1.5 on a coarse pointer, and take the cap from pointer capability rather than
viewport width. Keep the heading, primary action and copy in the document, so a
missing renderer is a `catch` that reveals the poster rather than a second code
path.

## When to use R3F instead

The decision is the host, not the complexity. A React or Next application uses
`r3f-patterns`: hand-wiring inside a component tree means fighting reconciliation
for effects React already sequences. Plain HTML, an embed, a single file, or a
non-React host uses this skill. Neither is the lesser path, and a scene is not
"too complex for vanilla" — it is either inside a React tree or it is not.

## Check

- [ ] The `run-state` contract is filled and each pause reason is separate.
- [ ] Exactly one animation loop exists, and it exits on the run state.
- [ ] The reduced-motion query is observed, and the listener is removed on teardown.
- [ ] The DOM layer is in the document before any script runs.
- [ ] Renderer construction failure reveals the poster instead of throwing.
- [ ] Every allocated GPU resource is released, and every listener and observer
      is removed.
- [ ] The Three version is exact, and the type package matches it.
- [ ] DPR is capped from pointer capability, not from viewport width.
