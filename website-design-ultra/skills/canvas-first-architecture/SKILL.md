---
name: canvas-first-architecture
description: Structure an experience where the canvas is the page rather than a component on it — full-viewport scenes with in-canvas sections, one scene state machine, one clock, one asset manifest, and the DOM layer that keeps the result reachable. Use only when the document no longer owns the page's headings, links, and sections. A 3D hero above a normal page, a product viewer, or a pinned scroll scene does not activate this skill.
---

# Canvas-First Architecture

A canvas that owns the page has to supply the structure a document normally
provides: named sections, one owner per axis, a declared asset order, and a
reachable surface. This layer applies in addition to `immersive-3d` and does not
replace its budget, fallback, or art-direction contracts.

## 1. Gate

Answer all three questions before loading anything else. One answer in the right
column ends this skill.

| Question | Canvas-first | Not this skill |
|---|---|---|
| Who owns headings, links, and sections? | the scene | the document → `immersive-3d` alone |
| What happens when the visitor moves between sections? | a scene state change | a route or an anchor → `scroll-immersion` |
| How many independent systems read the same frame? | five or more | one or two → `r3f-patterns` |

A 3D hero above a normal page, a product viewer, and a pinned scroll section all
sit in the right column. Canvas-first is a smaller category than it appears, and
choosing it buys an accessibility contract that a DOM page receives for free.

State the answers in the deliverable. A build that arrives here without them
took the expensive architecture by accident.

## 2. Compensation contract — mandatory

`core-rules` §4 keeps its invariant: essential information and functionality are
never canvas-only. Canvas-first does not suspend that rule, it changes how the
rule is met. Fill this block before scene code. The block is the schema; an
unfilled field is a blocked launch rather than a detail to settle later.

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

Two fields have owners elsewhere and are filled from there rather than restated:
`poster-route` from `immersive-3d` §5, and `audio-opt-out` from `spatial-audio`
when the experience ships sound.

Read [references/parallel-dom-layer.md](references/parallel-dom-layer.md) to
implement `dom-parallel-layer`, `focus-model`, and `input-parity`. The remaining
fields are decisions rather than techniques and are settled in this file.

## 3. One owner per axis

Canvas-first apps fail by accumulation rather than by a single mistake: two
systems write the camera, three read a stale delta, four decide independently
whether they are visible. Name one owner per axis; everything else reads.

| Axis | Owner | Everyone else |
|---|---|---|
| Time | one clock publishing elapsed, delta, and frame ratio | reads it, and starts no second timer |
| Section state | one state machine | subscribes, and never infers state from scroll position |
| Camera | one rig per state | requests a target and lets the rig resolve conflicts |
| Assets | one manifest | requests by id, and never fetches directly |
| Input | one router emitting normalized events | receives, and adds no competing listener |
| Quality | the `3d-runtime-quality` controller | reads the tier |

Read [references/scene-state-and-clock.md](references/scene-state-and-clock.md)
when the state machine or the clock is implemented. Frame-rate-independent
interpolation belongs to `motion-system`, which owns it for every render loop.

## 4. What stays out of the canvas

Drawing these into the scene removes a browser behavior no scene reimplements,
and the loss is invisible in a screenshot:

- The page's own text. Selection, find-in-page, machine translation, and the
  reader's font size all stop at the canvas boundary.
- The primary action. A painted button has no focus order, no forced-colors
  rendering, and no role for assistive technology.
- Form input of any kind, a single email field included.
- Legal, pricing, and contact information.
- Anything a search engine or a link preview has to read.

Decorative type, readouts that repeat a DOM value, and labels bound to a spatial
object may live in the scene. `3d-art-direction` owns that split; this file only
fixes which side is not open to negotiation.

## 5. Workflow

1. Answer the §1 gate and record it.
2. Fill the §2 contract. Leave the two delegated fields to their owners.
3. Name the six owners from §3 before writing systems that need them.
4. Declare sections as states with entry conditions, not as scroll offsets.
5. Build the DOM parallel layer in the same commit as the first section, never
   as a later pass. Retrofitting it is a rewrite of the input router.
6. Take the budget from `immersive-3d` §3, including its second budget class,
   and the tiers from `3d-runtime-quality`.
7. Verify against the `immersive-3d` §8 launch gate, plus one keyboard-only run
   through every section.

## 6. Routing

- Multi-pass chain, buffers, grading → **`render-graph`**
- Manifest, buckets, progress, warm-up → **`loading-choreography`**
- Sound layers, unlock gesture, mixing → **`spatial-audio`**
- Camera, light, materials, tone mapping, poster frame → **`3d-art-direction`**
- Tiers, adaptation, offscreen pause → **`3d-runtime-quality`**
- React implementation of the scene → **`r3f-patterns`**
- Scroll as the section driver → **`scroll-immersion`**

## Check

- [ ] The §1 gate was answered, and the answer is in the deliverable.
- [ ] Every §2 field is filled or delegated to its named owner.
- [ ] Each §3 axis has exactly one writer.
- [ ] Sections are named states with entry conditions.
- [ ] The DOM parallel layer exists, and a keyboard-only run reaches every
      section and every action.
- [ ] Nothing from §4 is painted into the scene.
- [ ] Deep links resolve to a section, and a shared link restores it.
- [ ] The poster route renders the statement without a canvas.
