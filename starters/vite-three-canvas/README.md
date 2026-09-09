# vite-three-canvas

A Vite + Three.js scene held to the same budget, fallback and lifecycle contract
as `next-r3f-cinematic`, with no framework between the DOM and the renderer.

It exists because the plugin routes plain-HTML and embed work to a vanilla path,
and a path with no runnable reference is a path nobody can check. The claim
`immersive-3d` makes — that the vanilla layer is a production peer of R3F rather
than a lesser option — is only worth making if both starters pass the same
gates. The shared static gate runs in CI. The portable-starter job separately checks
real Chromium rendering of freshly exported projects.

## Run it

```bash
npm ci
npm run dev            # http://localhost:5173
npm run verify         # typecheck + tests + build, the gate CI runs
npm run capture:poster # re-render both posters from the scene
```

## What it demonstrates

The vanilla contract in `r3f-patterns/references/vanilla-three.md` lists six
obligations React would otherwise carry. Each has a home here and a test in
`tests/contract.test.mjs`:

| Obligation | Where it lives |
| --- | --- |
| Pinned Three version, APIs verified against it | `package.json`, asserted exact |
| Capped DPR, damped controls, one animation loop | `src/scene-config.ts`, `src/main.ts` |
| `outputColorSpace` and tone mapping set once | `src/scene.ts`, before the first draw |
| `matchMedia`, DOM layer on context loss, `IntersectionObserver` | `src/lifecycle.ts` |
| Loop stops on `document.hidden` and offscreen | `src/lifecycle.ts` |
| Geometries, materials, textures, renderer disposed | `src/scene.ts` `dispose()` |

The part worth copying is `src/lifecycle.ts`. Three independent reasons pause a
scene: hidden tab, offscreen canvas, lost context. Collapsing them into one
boolean is the bug that ships: a scene returning from a hidden tab resumes
while still scrolled out of view and burns frames nobody sees. One state, three
reasons, and only their absence resumes.

## The DOM layer is the page

`index.html` carries the heading, the copy and both controls. They render before
any script runs and stay in the document once the canvas mounts. The canvas is
an upgrade of that page; it never becomes the page. A run with no WebGL leaves
the poster visible and changes nothing else — that path is a `catch` around
renderer construction, not a separate code path to keep in sync.

## The hero is generated, not loaded

`src/hero-geometry.ts` builds the shard cluster from `ROOT_SEED`. Same seed,
same bytes, which is what makes a deterministic capture of this page mean
something. It also means the starter fetches nothing, so there is no loading
path to get wrong before the contract has been demonstrated, and no binary in
the diff.

It is deliberately neither a torus knot nor a default cube. A starter is the
code most likely to be copied unchanged, so the shape it hands over has to be
one worth keeping.

## Posters are captures, not drawings

`npm run capture:poster` builds, serves, and photographs the scene from each
named station. A hand-drawn poster becomes a picture of what someone remembers
the scene looking like, and the two drift. `src/asset-manifest.json` records
each poster's SHA-256, dimensions, station and the browser that drew it; the
test suite fails on a poster edited by hand.

The two variants are separate compositions. `hero-wide` frames the cluster for a
landscape crop; `hero-portrait` pulls back and aims higher for a tall one. The
portrait poster is not the landscape one cropped, and a test asserts it.

## How this differs from `next-r3f-cinematic`

Not in rigor. In three things the stacks genuinely force:

- **The capture station is a query parameter**, not an environment variable
  resolved per request. This page has no server to resolve one at a request
  boundary.
- **There is no server-rendered pass**, so first paint is `index.html` plus its
  inline stylesheet rather than a server-rendered React tree.
- **The interaction-checkpoint and cinematic-timeline suites are not wired
  here.** Those exercise the R3F starter's camera choreography, which this
  scene does not have. Adding a timeline to this starter would mean adding a
  second clock, and one clock per scene is the rule the other starter also
  keeps.

`src/quality-controller.ts` and `src/determinism-runtime.ts` are byte-identical
copies of the repository references, asserted by the test suite in both
starters. The mechanism is shared; only the mounting differs.

## Runtime lifecycle

`src/frame-loop.ts` cancels queued frames on pause and schedules one frame at a
time. Reduced motion and deterministic mode stop scheduling after readiness;
resize and explicit controls invalidate the image. Context restoration draws
again before the poster is hidden. Page-cache suspension preserves the scene;
final teardown removes all owned listeners and observers.
