# TODO — Immersive Production Layer

> **Status: closed.** Tier 0 shipped in 1.10.0, Tier 1 in 1.11.0, Tier 2 in
> 1.12.0, Tier 3 plus the definition-of-done closure in 2.0.0, and the evidence
> audit in 2.0.1. The checkboxes below were never ticked and are kept as the
> plan they were. Per-task state lives in
> `automation/immersive-production-v2/QUEUE.md`, which reports 36 of 36 tasks
> checked and 0 open, asserted by `test_chain_driver.py`. Every
> definition-of-done line is linked to the fixture, commit or run that proves
> it in `automation/immersive-production-v2/IP-11D-EVIDENCE.md`.
>
> **One line is still open.** "Two generated immersive fixtures pass install,
> build, runtime, keyboard, mobile, reduced-motion and fallback checks" reads
> UNVERIFIED. Both offline fixture suites pass on a clean checkout, but the
> live `immersive-evaluation` job exceeded its own 45-minute budget on `main`
> at `e5a1ea0` and `a9b432c` and was cancelled, and a cancelled run is not a
> pass. The per-fixture shard matrix in `f303b67` is the fix. The line moves to
> PASS when a green `immersive-evaluation-gate` run exists and is named in the
> evidence index.
>
> Deferred on purpose, and recorded in §"Not doing": `vite-three-canvas` until
> the first starter has been used on two unrelated projects, publishing the
> quality controller to npm until two consumers exist, and a general VDB
> exporter until two unrelated assets use the format.


**Branch:** `proposal/immersive-production-v2`
**Baseline:** 1.9.1 (`b5474cc`)
**Thesis:** a budget nothing reads back is not a budget.

`immersive-3d/SKILL.md` §3 declares the numbers already: under 100 draw calls on
desktop and under 50 on mobile, under 500k visible triangles and under 150k,
textures capped at 2048, a frame-time target matched to the display. It calls
itself the single source of truth. `scripts/verify-browser.mjs` writes six PNGs
and a `capture.json` that records which files it wrote. It reads none of those
numbers back. Every immersive contract in this plugin is currently self-reported,
which is the one thing `anti-slop` refuses to accept from generated copy.

That asymmetry orders this list.

## Where this list comes from

Two independent reviews of 1.9.x, merged.

- **Claude** — gap analysis against igloo.inc and mesh3d.gallery. Argued that the
  missing layer is measurement, iteration, and a source for geometry, and that
  the plugin needs no further guidance skills.
- **GPT-5.6 Sol** — *Immersive Production Layer for Website Design Ultra 2.0*.
  Argued that the missing layer is executable: starters, reusable runtime
  packages, dynamic verification, and buildable evaluations.

Every item below is tagged with where it came from. `[BOTH]` means two reviews
that did not see each other arrived at the same finding, which is the strongest
signal in this document. `[GPT]` and `[CLAUDE]` mark the items only one review
raised, and those need more scrutiny, not less.

Items are ordered by what unblocks what, not by value. Tier 0 exists because
every artifact produced in Tier 1 and Tier 2 is unreadable without it.

---

## Tier 0 — Preconditions

Nothing further is measurable until these three land. Together they are one
release.

### T0.1 Determinism contract `[CLAUDE]`

Two captures of the same scene are currently never comparable: the clock runs
free, no generator is seeded, and the camera lands wherever the last frame left
it. Every screenshot the proposal adds in T1.3 inherits that problem, and the
"expected dynamic variation" bucket in a visual diff becomes undecidable rather
than difficult.

- [ ] Define `WDU_DETERMINISTIC` as a documented runtime flag, not a convention.
- [ ] Scene clock is injectable. `performance.now()` is not read directly by
      scene code under the flag.
- [ ] Every random source takes a seed. Particles, noise offsets, scatter,
      procedural placement.
- [ ] Named camera stations, addressable by id, in place of "wherever the scroll
      is".
- [ ] A `data-wdu-ready` marker fires after first stable frame, replacing the
      "one short stabilization beat" the `/verify` command currently allows.
- [ ] Two runs of the same commit produce byte-identical PNGs for at least one
      fixture. This is the acceptance test for the whole tier.

Owner: new `references/determinism.md` under `core-rules`, plus a starter
implementation. Verification cannot be trusted before this exists.

### T0.2 Frame telemetry in the verifier `[BOTH]`

`verify-browser.mjs` photographs states. It does not measure them. The numbers
the plugin already declares are not collected on any code path.

Gate on three numbers. Report the rest as context.

- [ ] **Gate:** GPU frame time after warm-up — median and p95 — on a declared
      device profile.
- [ ] **Gate:** time to first meaningful frame.
- [ ] **Gate:** transfer size before that frame.
- [ ] Context: draw calls, visible triangles, textures, geometries, programs
      from `renderer.info`.
- [ ] Context: long-frame count in a fixed window, active quality tier, DPR.
- [ ] Context: failed resources, shader compile errors, context-loss events.
- [ ] `performance-summary.json` compares observed values against the project's
      declared budget from `immersive-3d` §3. It does not invent a universal
      threshold: a justified 30fps target passes at 33ms.
- [ ] An unavailable GPU or browser reports `UNAVAILABLE`, never `PASS`. This is
      already the ADR-010 contract and it must extend to the new numbers.

Both reviews found this independently. GPT proposed a longer capture list;
Claude proposed three gate numbers. Merged: three gates, the rest as evidence.

### T0.3 Visual contract intake `[BOTH — merged]`

The art-direction contract and the composition contract are filled from a
briefing, which means from adjectives. Camera height, focal length, light
direction, contrast range and material density are readable from an image and
not from a word.

GPT treated Figma as a cost boundary. Claude treated reference intake as the
missing pipeline stage. The merge is that Figma is the input format of that
stage, and the interface is exported frames plus a written token block.

- [ ] New skill `reference-intake`, running before `3d-art-direction`, not
      beside it.
- [ ] Input: six to ten reference frames plus a token block. Output: a filled
      art-direction contract with each field traced to the frame it came from.
- [ ] A field with no supporting frame is recorded as unknown, in the same shape
      `content-design` already uses for an unverified claim.
- [ ] Poster frame becomes a target rather than a fallback: it is produced
      before scene code, and "done" is the live frame held against it.
- [ ] Required input is PNG, SVG and a written token block. Everything else is
      optional acceleration that must produce those same two artifacts.
- [ ] Negative gate in the description: a briefing with a named direction and no
      reference material does not activate this skill.

**Figma boundary, verified 2026-08-24, corrected after review.** The first
version of this item banned the Figma API outright. That was wrong, and the
correction changes the recommendation rather than softening it.

Five interfaces reach a Figma file. Ranked by what a skill should depend on:

| Interface | Cost | Structured | Reproducible | Depend on it |
|---|---|---|---|---|
| Exported PNG/SVG plus a written token block | free | no, pixels | yes, offline and in CI | **required input** |
| REST API with a personal access token | free | yes, document tree and rendered frames | yes, scriptable | **optional path** |
| Plugin API, local development plugin | free | yes, richest access | no, needs an open session | one-off dumps only |
| Browser automation driving figma.com | free | no | no | no |
| Dev Mode MCP | paid seat | yes | yes | no |

The REST API is the correction. `GET /v1/files/:key`, `/v1/files/:key/nodes` and
`GET /v1/images/:key` each require only the `file_content:read` scope and state
no plan requirement, so a personal access token on Starter returns the document
tree as JSON and renders any frame to PNG, JPG, SVG or PDF. Personal tokens
expire after at most 90 days and are a credential, which is why this is the
optional path and not the required input. Plan access tokens, the
non-expiring organization variant, are Organization and Enterprise only.

Browser automation is the weakest free option for this job, not the strongest.
Figma renders its design surface as a C++/WebAssembly application drawing into a
single canvas, WebGPU today and WebGL before it. The surrounding panels are DOM
and readable; the design itself is pixels with no node tree behind it. An agent
driving figma.com can click, export and photograph, and cannot read a fill, a
text style or a layer name off the canvas. It also needs a logged-in session,
which removes it from CI. Use it to produce exports, never as the interface a
skill declares.

Plan limits for the record: Starter is 3 design files, 3 pages per file, 1
project and 30 days of version history, with unlimited drafts that do not count
against the file cap. Dev Mode requires a paid seat, and the Figma MCP server
runs through Dev Mode.

---

## Tier 1 — Executable foundation

The plugin describes an architecture that every run then rebuilds slightly
differently. This tier turns the contracts into something an agent copies rather
than reconstructs.

### T1.1 One starter `[GPT — scoped down]`

GPT proposed three: `next-r3f-cinematic`, `vite-three-canvas`, `gpu-particle-lab`.
Ship one and let it earn the second.

- [ ] `next-r3f-cinematic` only. TypeScript, pinned React/R3F/Three matrix.
- [ ] Client-only Canvas boundary that does not make the page client-rendered.
- [ ] Semantic DOM copy and controls outside the Canvas.
- [ ] Art-directed poster plus context-loss path.
- [ ] Reduced-motion handling with a visible motion control where the scene
      needs one.
- [ ] One quality controller, one camera owner, one clock, one asset manifest.
- [ ] Disposal and route-transition checks.
- [ ] Ships with the T0.1 determinism flag wired, or it is not merged.
- [ ] `vite-three-canvas` is deferred until `next-r3f-cinematic` has been used on
      two unrelated projects.

### T1.2 Quality controller as a copied reference, not a package `[GPT — corrected]`

GPT proposed `packages/quality-controller/`. A Claude Code plugin is installed by
copying its tree, and a skill cannot import from a sibling package — the agent
copies the file. That changes how it must be written.

- [ ] Zero runtime dependencies, single file, heavily commented, written to be
      pasted.
- [ ] Owns Poster/Low/Medium/High, DPR steps, hysteresis, offscreen pause,
      thermal backoff. Values stay in `3d-runtime-quality`; this is the
      mechanism, not the matrix.
- [ ] Exposes the counters T0.2 reads. The controller and the verifier share one
      surface.
- [ ] Do not publish to npm before two projects use the copied version.

### T1.3 Interaction capture `[GPT]`

Static screenshots never exercise the signature behaviour. A hover field, a
click pulse, a camera path and a scroll transition are the product.

- [ ] Scroll checkpoints at declared normalized progress values.
- [ ] Hover before, during, after.
- [ ] Click before, peak, recovered.
- [ ] Focus-visible and keyboard activation.
- [ ] Touch alternative.
- [ ] Loading, ready, failure.
- [ ] Audio locked, enabled, muted, returning session — only when the deliverable
      ships sound.
- [ ] Checkpoints are declared by the project, not hardcoded in the script.
- [ ] Requires T0.1. Without a frozen clock these images are not comparable
      across runs and the artifacts are decorative.

### T1.4 One implementation evaluation `[GPT]`

The forward suite proves routing. It does not prove that generated code installs,
builds, runs and survives a pointer. Keep both suites, keep them separate.

- [ ] Fixture: R3F product hero. Install, build, load one optimized model,
      semantic DOM, portrait reframe, poster, reduced motion.
- [ ] Asserts build, runtime, keyboard, static capture, and the three T0.2 gates.
- [ ] CI caches dependencies and browser binaries and never silently skips.
      Unavailable GPU reports the suite unverified.
- [ ] Cost is stated in the runner output, as `run-forward-tests.mjs` already
      does.

---

## Tier 2 — Visual language

### T2.1 One lab, not two `[BOTH — merged]`

Claude asked for a shader lab: one quad, hot reload under a second, compile
errors routed back into the session. GPT asked for a GPU particle lab with
deterministic seeds and screenshot checkpoints. These are the same harness with
two experiment types.

- [ ] `lab/` with one route per experiment, no layout, no copy, no router.
- [ ] Hot reload under one second. A full Next build per shader edit is the
      failure mode this removes.
- [ ] Uniform controls and a compile-error channel that returns text, not a blank
      canvas.
- [ ] Deterministic capture from T0.1 for every experiment.
- [ ] Lives outside the installed plugin tree — see T4.1.

### T2.2 Shader modules `[GPT]`

Each module declares renderer support, cost class, reduced-motion behaviour,
colour-space assumptions and a visual fixture. No module list without those five
fields.

- [ ] Noise primitives: simplex, value, curl.
- [ ] Fresnel and iridescence with bounded overdraw.
- [ ] Dissolve with stable edge width.
- [ ] Frosted transition and displacement mask.
- [ ] Chromatic offset with a hard amplitude cap.
- [ ] Click shockwave.
- [ ] Flow-field deformation.
- [ ] SDF/MSDF text sampling — shared with T3.2.
- [ ] Video texture with explicit playback and failure state.
- [ ] LUT placement compatible with `render-graph`.
- [ ] Frame-rate-independent film grain.
- [ ] **No "apply all effects" path.** A project selects the minimum chain that
      carries its visual thesis. This is the anti-slop rule applied to shaders.

### T2.3 GPU particle systems `[GPT]`

New skill, negatively gated: thousands of particles, persistent simulation state,
fields, trails or volume morphing. A decorative dust layer stays in
`r3f-patterns` and does not activate this.

- [ ] State texture format, precision, ping-pong ownership.
- [ ] Spawn and reset behaviour, stable seeding.
- [ ] Pointer field in normalized scene coordinates.
- [ ] Click impulse with radius, falloff, recovery.
- [ ] Morph targets in buffers or textures, no per-frame reallocation.
- [ ] Counts per tier owned by `3d-runtime-quality`, not duplicated here.
- [ ] Poster and reduced-motion representation that is a composition, not a blank
      canvas.
- [ ] WebGL2 and WebGPU matrix, maintained the way `shaders-tsl` maintains its
      feature matrix.

Acceptance: hover displaces a field with no per-particle React state; click
produces one pulse and returns to a stable state; two shapes morph without GPU
resource growth; mobile reduces count and DPR without changing the subject.

### T2.4 Cinematic timeline `[GPT]`

One normalized timeline coordinating DOM, camera, scene state, materials, sound
and loading, without introducing a second clock.

- [ ] Schema: master source, range, tracks with an owner per property,
      checkpoints with ids and progress values.
- [ ] **Validator rejects two writers for the same property.** This is the
      existing one-owner-per-axis rule from `canvas-first-architecture`, made
      executable.
- [ ] Separate portrait choreography required when the art-direction contract
      declares one.
- [ ] Checkpoint ids feed T1.3 directly. The timeline is where scroll captures
      get their progress values.

---

## Tier 3 — The differentiator

GPT placed procedural work in Phase 4 and said it should not block 2.0. That is
the wrong order for this repository's stated ambition. The reference site's own
explanation of its result is that a growth algorithm replaced a modelled asset,
and that a custom volume format replaced a texture. Shipping the production layer
without any of that ships reliability without difference.

Move a minimal version forward. Keep the research gate.

### T3.1 Procedural geometry `[BOTH]`

`3d-asset-pipeline` begins at `inspect input.glb`. Where `input.glb` comes from is
unanswered in the whole plugin.

- [ ] New skill `procedural-3d`, sitting before `3d-asset-pipeline`.
- [ ] Algorithm catalogue with a cost model each: crystal growth, Voronoi,
      marching cubes, curl noise, L-systems.
- [ ] Blender baseline: reversible scripts on named collections, Geometry Nodes
      inputs recorded as a contract, deterministic seed, geometry and material
      statistics before export, `.blend` source separate from web output.
- [ ] Automated GLB export handing off to the existing inspect/validate/optimize
      path. Do not fork that pipeline.
- [ ] One fixture: a generated asset that passes the existing pipeline unchanged.
- [ ] Houdini is described as an interchange contract, never as a dependency.
      It is justified only for volume, simulation or procedural systems that are
      materially harder in Blender.

### T3.2 Shader-driven UI `[BOTH]`

Text rendered in the canvas with effects driven by uniform offsets, with the
semantic interface staying in the DOM.

- [ ] MSDF atlas generation, glyph metrics, line breaking, licensing.
- [ ] DOM-to-canvas alignment.
- [ ] Scramble, glitch and dissolve as uniform-driven offsets.
- [ ] Pointer and focus state mirrored from the DOM, never invented in the
      canvas.
- [ ] Search, selection, translation and screen-reader path preserved.
- [ ] **Prohibited in canvas-only form:** primary actions, forms, legal copy,
      pricing. GPT's prohibition list; adopt it verbatim.

### T3.3 Volume research gate `[GPT — keep as written]`

- [ ] Define the source representation before choosing a format.
- [ ] Measure slice textures, sparse points and a packed custom format against
      each other: decode time, transfer size, GPU memory.
- [ ] Keep a conventional point-target fallback.
- [ ] Do not ship or announce a general VDB exporter until two unrelated assets
      use the format successfully.

This is the best-disciplined item in either proposal. It is the shape every other
research claim in this repository should take.

---

## Tier 4 — Decisions that block the tiers above

### T4.1 Distribution decision `[CLAUDE — objection]`

GPT's tree puts `templates/`, `packages/`, `lab/` and `tests/immersive/` inside a
repository whose plugin directory is copied on every marketplace install. The
plugin is 1.1 MB today. Starters with lockfiles and fixtures are tens of MB, and
an install would carry all of it.

Decide before T1.1 is written, not after:

- [ ] **Option A** — monorepo, plugin stays one subdirectory, starters live
      outside it, marketplace continues to point at `website-design-ultra/`.
- [ ] **Option B** — second repository `website-design-ultra-starters`, skills
      reference it by name and version.
- [ ] Whichever is chosen, `plugin validate . --strict` in CI must still pass on
      both the root and the plugin directory, as `validate.yml` does now.

Recommendation: Option A. The starters need to move in lockstep with the skills
that describe them, and a second repository makes version skew silent.

### T4.2 Lint the plugin's own new surfaces `[CLAUDE]`

Every starter ships copy. A plugin whose central claim is a deterministic copy
linter cannot ship starters that were never linted.

- [ ] `validate-content.mjs` extends its self-lint to templates and lab routes.
- [ ] Starter copy is real copy, not placeholder. The extractor already reads
      JSX/TSX, and `NO-COPY` is exit code 2, not a pass.
- [ ] Add one starter fixture to `tests/copy/`.

### T4.3 Version discipline `[CLAUDE — objection]`

`release.mjs --strict` requires every changelog section to anchor on a resolvable
tag, and 1.6.6 replaced outcome language with verifiable capability. Naming this
2.0 before any of it exists is the same defect in the version number.

- [ ] Ship as 1.10, 1.11, 1.12. One tier per minor.
- [ ] 2.0 is declared when the definition of done below actually passes, and the
      changelog section for it names which fixtures proved it.

### T4.4 Baseline comparison `[GPT]`

- [ ] Optional diff separating structural regression, perceptual difference,
      expected dynamic variation and non-deterministic content.
- [ ] A difference score is evidence. It is never an aesthetic verdict, and the
      report must say so in its own output.
- [ ] Requires T0.1. Without determinism the fourth bucket swallows everything.

### T4.5 Audio behaviour automation `[GPT]`

- [ ] Unlock gesture, mute, persistence across a returning session, voice limit.
- [ ] Runs only when the deliverable ships sound, matching the existing
      `spatial-audio` gate.

---

## Not doing

Recorded so the same ideas do not return without new evidence.

- **Three starters at once.** One, used twice, then the second.
- **`packages/` published to npm.** A plugin distributes by copy. Publish after
  two consumers exist, not before.
- **A `gpu-particle-lab` template.** It is a lab. It belongs in `lab/` with the
  shader experiments — same harness, two experiment types.
- **Figma MCP or Dev Mode as a dependency.** Paid. The free REST API returns
  the same document tree, and exported frames carry the rest.
- **Browser automation as the declared Figma interface.** The design surface is
  a WebAssembly canvas, so an agent driving it reads pixels rather than nodes,
  and it cannot run without a logged-in session. See T0.3.
- **A generic VDB exporter as a shipped capability.** See T3.3.
- **A 2.0 label before the definition of done passes.** See T4.3.
- **More guidance skills with no executable half.** The plugin has 21. The gap in
  1.9.1 is not a missing rule.

---

## Pull-request sequence

Small enough that each one's measurements constrain the next.

| PR | Contents | Tier |
|---|---|---|
| 1 | This document, plus the T4.1 distribution decision | 4 |
| 2 | Determinism contract and reference implementation | 0 |
| 3 | Frame telemetry in `verify-browser.mjs` | 0 |
| 4 | `reference-intake` skill | 0 |
| 5 | `next-r3f-cinematic` and the quality controller | 1 |
| 6 | Interaction capture | 1 |
| 7 | First implementation evaluation and CI | 1 |
| 8 | `lab/` harness | 2 |
| 9 | Foundational shader module group | 2 |
| 10 | Transition and interaction shader module group | 2 |
| 11 | Media and post shader module group | 2 |
| 12 | Particle systems and cinematic timeline | 2 |
| 13 | `procedural-3d`, one generated fixture, and volume research gate | 3 |
| 14 | Shader-driven UI and definition-of-done closure | 3 |

Do not open a combined 2.0 pull request.

## Definition of done

- [ ] Two runs of one fixture produce byte-identical captures.
- [ ] Every immersive result reports the three gate numbers against its declared
      budget.
- [ ] A fresh agent run scaffolds and builds the starter without reconstructing
      the architecture.
- [ ] The starter ships DOM content, poster, reduced motion, context-loss and
      mobile composition.
- [ ] Browser verification exercises declared scroll and interaction
      checkpoints.
- [ ] Two generated immersive fixtures pass install, build, runtime, keyboard,
      mobile, reduced-motion and fallback checks.
- [ ] One asset in one fixture was generated procedurally and passed the existing
      asset pipeline unchanged.
- [ ] CI never converts unavailable GPU or browser execution into a pass.
- [ ] Advanced modules stay negatively gated for ordinary 2D and 3D-hero work,
      and both existing 3D forward cases still forbid the add-on files.
- [ ] No paid external design tool is required at any step.

## Sources

- Awwwards, *Igloo Inc: Case Study* — stack, DCC tools, VDB exporter, loading
  strategy, sound.
- WebGPU.com, *Igloo Inc: Crystal Growth Algorithms, Shader-Driven UI, and Volume
  Data*.
- mesh3d.gallery, curated by Majo Puterka.
- Figma plan data verified 2026-08-24: Starter is 3 design files, 3 pages per
  file, 1 project, 30 days of version history, unlimited drafts; Dev Mode
  requires a paid seat.
- Figma developer documentation, REST API authentication, plan access tokens and
  file endpoints: `file_content:read` on the file, nodes and images endpoints,
  with no stated plan requirement.
- Figma engineering, *Building a professional design tool on the web* and *Figma
  Rendering: Powered by WebGPU*: the design surface is a WebAssembly application
  drawing into one canvas.
- This repository at `b5474cc`, read directly for every claim about 1.9.1.
