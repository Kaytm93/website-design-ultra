# The vanilla production modules

Each module in `starters/vite-three-canvas/src/` and the one thing that breaks
when it is dropped. Copy them; do not re-derive them.

## `lifecycle.ts` — the state machine

Owns the single run state and the three independent reasons that pause it. Every
browser API it touches is injected, so the transitions are verifiable in Node
without a browser or a WebGL context.

**Dropped:** the scene keeps rendering in a hidden tab, or resumes from a hidden
tab while still scrolled out of view. Both burn frames nobody sees, and both are
invisible in development because a developer watching the page is never in
either state.

## `scene.ts` — the only Three.js import

Owns the renderer, one camera, one clock, one disposal path. Keeping it the only
module that imports Three is what lets everything else be tested in Node.

**Dropped:** color management and tone mapping get set in several places and
disagree; disposal ends up partial, and a remounted scene leaks a renderer per
mount.

## `scene-config.ts` — the capture contract

Every value the capture depends on, declared once: seed, step, stable frame,
rotation speed, DPR ceilings, geometry parameters. Inlining any of them into
scene code means a capture that cannot be reproduced from the file.

**Dropped:** two captures of the same commit differ and nothing says why.

## `camera-stations.ts` — named compositions

A station id is public capture metadata. A verifier asks for a station by name
and the shot is applied in full; adding one is an intentional contract change.

**Dropped:** the portrait variant becomes the landscape shot cropped, which
loses the subject at the aspect ratios phones actually use.

## `hero-geometry.ts` — geometry from a seed

Returns a plain `Float32Array` triangle soup with flat per-face normals and no
Three.js import, so determinism is asserted directly rather than inferred from a
constructed mesh.

**Dropped:** the scene needs an asset, and the starter now has a loading path to
get wrong before it has demonstrated anything else.

## `quality-controller.ts`, `determinism-runtime.ts` — shared with R3F

Byte-identical copies of the repository references, asserted by both starters'
test suites. The mechanism is shared; only the mounting differs. The controller
owns the tier and the DPR — the scene applies what it is told and decides
nothing.

**Dropped:** a second adaptation policy appears next to the first and the two
fight, usually as a DPR that oscillates under load.

## `capture-poster.mjs` — posters from the scene

Builds, serves, and photographs each station, then records the SHA-256,
dimensions, station and browser in the asset manifest.

**Dropped:** the poster becomes a drawing of what someone remembers the scene
looking like, and it drifts further with every scene change because nothing ties
the two together.
