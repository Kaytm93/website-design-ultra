# Immersive Production Layer — Fresh-Agent Queue

This is the machine-readable coordination surface for
`chain_driver.py`. `TODO.md` remains the product authority; this queue only
splits that proposal into implementation-sized units.

## Queue protocol

- Run exactly one PR group at a time with `python3 chain_driver.py --pr N`.
- One unchecked item is one fresh Hermes chat and one implementation commit.
- A child may mark only its own item `[x]`; it may not reorder or rewrite later
  tasks.
- Items are serial. `Depends on` identifiers must already be checked before an
  item can run.
- A PR group stops when its own items are checked. Review and merge that PR
  before starting the next group from the updated target branch.
- A passing build is not browser evidence. GPU/browser unavailability is
  `UNAVAILABLE`, never `PASS`, and leaves the applicable task unchecked.
- `TODO.md` may be changed only when implementation evidence changes a claim or
  acceptance criterion. It is not a progress checklist.

## PR 1 — Proposal and distribution decision

- [x] `IP-01A` **Record the proposal and distribution boundary** — Commit the merged 1.9.1 review and accept the root-monorepo/plugin-subdirectory boundary.
  - **Depends on:** none
  - **Deliver:** `TODO.md` and `docs/adr/ADR-011-immersive-production-distribution.md`.
  - **Acceptance:** The ADR keeps starters, lab, implementation fixtures, and automation outside `website-design-ultra/`; marketplace installation remains scoped to the plugin directory.
  - **Verify:** Review paths and run both strict plugin validations before the first root-only executable project lands.

- [x] `IP-01B` **Ship the fresh-agent implementation plan** — Add a PR-scoped queue, non-resumed rules-isolated Hermes driver, tests, and operating instructions.
  - **Depends on:** IP-01A
  - **Deliver:** `automation/immersive-production-v2/`.
  - **Acceptance:** Unit tests cover queue parsing and checked dependency closure, noncontiguous PR rejection, exact byte-level queue transitions, dry-run prompt construction, empty-response detection, commit ancestry, and linked-worktree Git paths. Branch/remote preflight, subprocess timeout/retry, and commit/push readback are specified fail-closed and require a live canary before PR 2; they are not claimed as unit-tested here.
  - **Verify:** `python3 -m unittest automation/immersive-production-v2/test_chain_driver.py` and `python3 automation/immersive-production-v2/chain_driver.py --check`.

## PR 2 — Determinism contract and reference implementation

- [x] `IP-02A` **Define the deterministic runtime contract** — Make `WDU_DETERMINISTIC`, injectable time, stable seeds, named camera stations, and `data-wdu-ready` normative and routable.
  - **Depends on:** IP-01B
  - **Read first:** `TODO.md` T0.1; `website-design-ultra/skills/core-rules/SKILL.md`; `website-design-ultra/skills/canvas-first-architecture/references/scene-state-and-clock.md`; `website-design-ultra/commands/verify.md`.
  - **Deliver:** `website-design-ultra/skills/core-rules/references/determinism.md`, minimal routing updates, and validator bindings.
  - **Acceptance:** Scene code has no direct `performance.now()` path while deterministic mode is active; every stochastic subsystem receives a named seed; ready means the first stable frame, not a timeout.
  - **Verify:** `node website-design-ultra/scripts/validate-content.mjs` and `node website-design-ultra/scripts/run-forward-tests.mjs --dry-run`.

- [x] `IP-02B` **Implement the copyable determinism runtime** — Add one zero-dependency TypeScript module for the injectable clock, seeded PRNG streams, camera-station lookup, and stable-frame marker.
  - **Depends on:** IP-02A
  - **Deliver:** A root-only copied reference implementation and isolated tests; do not publish a package.
  - **Acceptance:** Same seed and clock produce the same sequence; subsystem streams do not change when an unrelated stream is added; unknown station ids fail explicitly; production mode still uses the live clock.
  - **Verify:** Run the module's unit/type tests plus `node website-design-ultra/scripts/validate-content.mjs`.

- [x] `IP-02C` **Prove byte-identical deterministic capture** — Add one minimal fixture and a two-run comparator whose acceptance condition is identical PNG bytes.
  - **Depends on:** IP-02B
  - **Deliver:** Root-only deterministic fixture, capture runner, committed expected metadata, and CI hook.
  - **Acceptance:** Two clean runs of the same commit and declared device profile hash the compared PNGs identically; mismatch reports both hashes and keeps the gate red.
  - **Verify:** Run the comparator twice. Browser unavailability must report `UNAVAILABLE` and must not check this item.

## PR 3 — Frame telemetry in the verifier

- [x] `IP-03A` **Define one budget and telemetry surface** — Specify the project-declared budget shape and the runtime surface shared by renderer, quality controller, and verifier.
  - **Depends on:** IP-02C
  - **Read first:** `TODO.md` T0.2; `website-design-ultra/skills/immersive-3d/SKILL.md` §3; `website-design-ultra/skills/3d-runtime-quality/`.
  - **Deliver:** A versioned schema/reference for device profile, frame target, first meaningful frame, transfer boundary, renderer counters, quality tier, DPR, errors, and context loss.
  - **Acceptance:** The schema has exactly three gate classes—warm GPU frame median/p95, first meaningful frame, and transfer before that frame. Context counters remain evidence, not new universal gates.
  - **Verify:** Schema fixtures accept a justified 30fps/33ms budget and reject missing units, missing device profile, or an invented implicit threshold.

- [x] `IP-03B` **Collect telemetry and emit performance-summary.json** — Extend `verify-browser.mjs` to warm up, sample, read the shared surface, and compare observations with the declared project budget.
  - **Depends on:** IP-03A
  - **Deliver:** Deterministic JSON output with observed values, budget values, comparison result, evidence source, and explicit unavailable fields.
  - **Acceptance:** Median and p95 are calculated from a fixed declared window; transfer stops at the meaningful-frame marker; `renderer.info` context is preserved; timestamps do not make deterministic artifacts incomparable.
  - **Verify:** Unit fixtures for calculations plus a real fixture capture from IP-02C.

- [x] `IP-03C` **Harden telemetry failures and capability status** — Capture resource failures, shader errors, context loss, long frames, and missing GPU/browser paths without false passes.
  - **Depends on:** IP-03B
  - **Deliver:** Regression fixtures for PASS, FAIL, and UNAVAILABLE plus command/README updates.
  - **Acceptance:** Missing GPU, missing browser CLI, missing telemetry surface, shader compile failure, and context loss each have distinct evidence; unavailable execution never becomes PASS or an empty summary.
  - **Verify:** `node website-design-ultra/scripts/verify-browser.mjs --probe`, targeted offline fixtures, content validation, and forward dry-run.

## PR 4 — Reference intake

- [x] `IP-04A` **Add the negatively gated reference-intake skill** — Route six-to-ten frames plus a written token block before `3d-art-direction`.
  - **Depends on:** IP-03C
  - **Deliver:** `website-design-ultra/skills/reference-intake/SKILL.md` and one-level references/templates for traceable extraction.
  - **Acceptance:** Every art-direction field cites a source frame or is `unknown`; the poster target precedes scene code; a named direction with no reference material does not activate the skill.
  - **Verify:** Update exact skill-count and routing bindings, then run content validation and forward dry-run.

- [x] `IP-04B` **Make reference intake reproducible offline** — Add fixtures and a validator for exported PNG/SVG plus token blocks, with the free Figma REST path as optional acceleration only.
  - **Depends on:** IP-04A
  - **Deliver:** Valid/invalid intake fixtures, trace validator, and credential-safe REST instructions or script that outputs the required offline artifacts.
  - **Acceptance:** No paid seat, Dev Mode, MCP, browser login, or live Figma session is required. Missing evidence remains unknown. Tokens are never committed and personal-token expiry is documented.
  - **Verify:** Offline fixture tests and one negative forward case proving that text-only named art direction does not load `reference-intake`.

## PR 5 — next-r3f-cinematic and quality controller

- [x] `IP-05A` **Scaffold the single Next/R3F cinematic starter** — Add the root-only TypeScript starter with a pinned React/R3F/Three matrix and a server-rendered page around a client-only Canvas leaf.
  - **Depends on:** IP-04B
  - **Deliver:** `starters/next-r3f-cinematic/` with real semantic DOM copy, exact lockfile, one camera owner, one clock, one asset manifest, and wired determinism.
  - **Acceptance:** A fresh checkout installs and builds; the page is not made wholly client-rendered; no Vite starter or particle template is introduced.
  - **Verify:** Clean install, typecheck, tests, production build, and strict root/plugin validation.

- [ ] `IP-05B` **Implement the copied quality controller** — Add one heavily commented zero-runtime-dependency file owning Poster/Low/Medium/High transitions, DPR steps, hysteresis, offscreen pause, and thermal backoff.
  - **Depends on:** IP-05A
  - **Deliver:** Copyable controller plus tests and starter integration; values remain owned by `3d-runtime-quality`.
  - **Acceptance:** The controller exposes the IP-03 telemetry surface, has one transition owner, avoids per-frame React state, and does not become an npm package.
  - **Verify:** Unit tests cover hysteresis, cooldown, visibility, thermal downgrade, recovery, and deterministic mode.

- [ ] `IP-05C` **Complete starter fallback and lifecycle contracts** — Add art-directed poster, reduced motion, context-loss recovery, portrait composition, disposal, and route-transition checks.
  - **Depends on:** IP-05B
  - **Deliver:** Visible motion control where needed and semantic content/controls outside Canvas.
  - **Acceptance:** Fallback is composed rather than blank; reduced motion remains useful; context loss reveals the poster and DOM action; repeated mount/unmount does not grow GPU resources.
  - **Verify:** Build, keyboard test, portrait capture, reduced-motion pair, forced context-loss capture, and lifecycle resource assertions.

- [ ] `IP-05D` **Extend self-lint to executable root surfaces** — Lint starter and future lab copy without treating `NO-COPY` as success.
  - **Depends on:** IP-05C
  - **Deliver:** `validate-content.mjs` root-surface discovery, one starter copy fixture, and explicit exclusions for generated/vendor output.
  - **Acceptance:** Real starter copy is linted; placeholder copy fails; a lab route with deliberately no copy is declared structurally rather than hidden behind exit code 2.
  - **Verify:** Copy regression suite, content validation, and strict root/plugin validation.

## PR 6 — Interaction capture and comparison

- [ ] `IP-06A` **Declare and capture interaction checkpoints** — Add a project-owned checkpoint manifest for normalized scroll, hover, click, loading, ready, and failure states.
  - **Depends on:** IP-05D
  - **Deliver:** Schema, starter declaration, verifier support, and deterministic filenames tied to checkpoint ids.
  - **Acceptance:** Hover has before/during/after; click has before/peak/recovered; scroll uses declared normalized progress; no checkpoint is hardcoded in the verifier.
  - **Verify:** Capture all declared starter checkpoints twice under deterministic mode and compare stable states.

- [ ] `IP-06B` **Exercise keyboard, touch, focus, and optional audio states** — Extend dynamic verification to focus-visible, keyboard activation, touch alternatives, and conditional sound behavior.
  - **Depends on:** IP-06A
  - **Deliver:** Input drivers and state evidence for loading/ready/failure plus audio locked/enabled/muted/returning only when sound is declared.
  - **Acceptance:** Keyboard and touch reach the same product outcome as pointer input; audio tests do not run for silent deliverables; unlock, mute persistence, and voice limit are observable when they do run.
  - **Verify:** Interaction fixture suite with sound both absent and present.

- [ ] `IP-06C` **Add optional baseline comparison without aesthetic verdicts** — Classify structural regression, perceptual difference, expected dynamic variation, and nondeterministic content.
  - **Depends on:** IP-06B
  - **Deliver:** Diff artifacts and a report that labels its score as evidence, never taste or approval.
  - **Acceptance:** Deterministic mismatch is not routed into the dynamic bucket; unsupported comparison is unavailable; the report names masks/tolerances and their source.
  - **Verify:** Fixtures for each class and a negative test showing comparison refuses to run without deterministic capture metadata.

## PR 7 — First buildable implementation evaluation and CI

- [ ] `IP-07A` **Build the R3F product-hero evaluation fixture** — Exercise one optimized model, semantic DOM, portrait reframe, poster, reduced motion, and the shared quality/telemetry surfaces.
  - **Depends on:** IP-06C
  - **Deliver:** Root-only `tests/immersive/` fixture independent from the forward routing suite.
  - **Acceptance:** Clean install/build/load succeeds without reconstructing architecture or fetching undeclared assets at runtime.
  - **Verify:** Exact-lockfile install, build, runtime smoke, model validation, and static capture.

- [ ] `IP-07B` **Implement the immersive evaluation runner** — Assert build, runtime, keyboard, mobile, reduced motion, fallback, interaction checkpoints, and all three telemetry gates.
  - **Depends on:** IP-07A
  - **Deliver:** Runner with structured result and stated time/cost, kept separate from `run-forward-tests.mjs`.
  - **Acceptance:** Every assertion links evidence; a missing capture cannot be replaced by a build pass; failed resources and console/shader errors fail the applicable case.
  - **Verify:** One deliberate failing fixture per gate plus the green product hero.

- [ ] `IP-07C` **Wire immersive evaluation into CI without silent skips** — Cache dependencies/browser binaries while preserving ADR-010 status semantics.
  - **Depends on:** IP-07B
  - **Deliver:** CI job, artifacts, retention, and explicit GPU/browser capability result.
  - **Acceptance:** Browser or GPU unavailability marks the suite unverified and prevents release readiness; runner output states duration and any external cost.
  - **Verify:** CI syntax, strict plugin validations, offline forward fixtures, and an archived live evaluation artifact set.

## PR 8 — Lab harness

- [ ] `IP-08A` **Create the root-only shader/particle lab harness** — Use one route per experiment with no application router, layout, or marketing copy.
  - **Depends on:** IP-07C
  - **Deliver:** `lab/` with sub-second shader hot reload, uniform controls, deterministic capture, and textual compile errors.
  - **Acceptance:** A syntax error returns source/line diagnostics instead of a blank canvas; lab dependencies and lockfile stay outside the plugin tree.
  - **Verify:** Clean install/build, measured edit-to-update under one second, compile-error fixture, and deterministic capture.

## PR 9 — Foundational shader module group

- [ ] `IP-08B` **Add foundational shader modules** — Implement simplex/value/curl noise, Fresnel, iridescence, and dissolve.
  - **Depends on:** IP-08A
  - **Deliver:** Modules plus manifest entries for renderer support, cost class, reduced-motion behavior, color space, and visual fixture.
  - **Acceptance:** Overdraw and dissolve edge width are bounded; seeds are stable; there is no combined “apply all effects” export.
  - **Verify:** Compile on declared WebGL2/WebGPU paths, deterministic fixtures, and telemetry budget evidence.

## PR 10 — Transition and interaction shader module group

- [ ] `IP-08C` **Add transition and interaction shader modules** — Implement frosted transition/displacement mask, capped chromatic offset, click shockwave, and flow-field deformation.
  - **Depends on:** IP-08B
  - **Acceptance:** Every amplitude/radius has a hard cap; time is frame-rate independent; reduced motion has a deliberate representation; modules compose only when explicitly selected.
  - **Verify:** Manifest validation, compile fixtures, deterministic interaction checkpoints, and cost-class evidence.

## PR 11 — Media and post shader module group

- [ ] `IP-08D` **Add media and post shader modules** — Implement video texture states, render-graph-compatible LUT placement, and frame-rate-independent film grain.
  - **Depends on:** IP-08C
  - **Acceptance:** Video has locked/loading/playing/failure/fallback states; LUT color-space assumptions are explicit; grain does not change with display frame rate; SDF/MSDF remains deferred to `IP-11A` in PR 14.
  - **Verify:** Failure fixtures, reduced-motion behavior, WebGL2/WebGPU matrix, and no “apply all” path.

## PR 12 — GPU particles and cinematic timeline

- [ ] `IP-09A` **Add the negatively gated GPU-particle-systems skill** — Activate only for thousands of particles, persistent simulation, fields, trails, or volume morphing.
  - **Depends on:** IP-08D
  - **Deliver:** Skill/reference contract plus one lab experiment for ping-pong state textures, stable spawn/reset, normalized pointer field, and click impulse.
  - **Acceptance:** Decorative dust remains in `r3f-patterns`; counts stay owned by `3d-runtime-quality`; WebGL2/WebGPU support is explicit.
  - **Verify:** Content validation, forward negative gate, deterministic simulation fixture, and renderer matrix.

- [ ] `IP-09B` **Prove particle interaction and resource stability** — Exercise hover displacement, one recovering click pulse, shape morphing, and mobile quality reduction.
  - **Depends on:** IP-09A
  - **Acceptance:** No per-particle React state or per-frame allocation; two morph targets do not grow GPU resources; poster/reduced-motion preserve the subject.
  - **Verify:** Interaction captures, resource counters before/after morph cycles, mobile count/DPR evidence, and deterministic reset hashes.

- [ ] `IP-09C` **Implement and validate one cinematic timeline** — Coordinate DOM, camera, scene, material, sound, and loading tracks without a second clock.
  - **Depends on:** IP-09B
  - **Deliver:** Normalized schema, property-owner validator, portrait choreography, checkpoint ids, and starter/lab integration.
  - **Acceptance:** Two writers for one property are rejected; every track has one owner; declared checkpoint ids feed PR 6 capture directly.
  - **Verify:** Conflicting-owner fixture, portrait-required fixture, deterministic seek tests, and interaction capture by timeline checkpoint id.

## PR 13 — Procedural 3D, generated fixture, and volume gate

- [ ] `IP-10A` **Add the procedural-3d skill and costed catalogue** — Place geometry generation before the existing asset pipeline.
  - **Depends on:** IP-09C
  - **Deliver:** Negatively gated skill plus crystal growth, Voronoi, marching cubes, curl noise, and L-system references with cost models.
  - **Acceptance:** Blender is the baseline; Houdini is only an interchange contract for justified volume/simulation cases; no second inspect/optimize pipeline is created.
  - **Verify:** Content validation, routing/negative-forward fixtures, and explicit handoff to `3d-asset-pipeline`.

- [ ] `IP-10B` **Build a deterministic reversible Blender generator** — Generate one named-collection asset from recorded Geometry Nodes/script inputs and a stable seed.
  - **Depends on:** IP-10A
  - **Deliver:** Reversible script, source `.blend` or reproducible source recipe, pre-export geometry/material statistics, and automated GLB export.
  - **Acceptance:** Source and web output are separate; rerun with the same seed preserves measured topology/material statistics; no hidden Houdini dependency.
  - **Verify:** Headless Blender generation/export twice and compare declared statistics/hashes where binary determinism is supported.

- [ ] `IP-10C` **Pass the generated asset through the existing pipeline unchanged** — Use inspect/validate/optimize rather than forking it.
  - **Depends on:** IP-10B
  - **Deliver:** Generated fixture, optimized web output, before/after reports, license/provenance metadata, and integration in the second immersive evaluation fixture.
  - **Acceptance:** Existing pipeline commands pass unchanged; optimized asset stays within declared desktop/mobile budgets; fallback does not depend on GLB decode.
  - **Verify:** glTF inspect/validate/optimize/validate, fixture build/runtime, telemetry, and lifecycle resource checks.

- [ ] `IP-10D` **Execute the volume representation research gate** — Compare slice textures, sparse points, and one packed format before choosing any general exporter.
  - **Depends on:** IP-10C
  - **Deliver:** Reproducible benchmark inputs/results for decode time, transfer size, and GPU memory plus a conventional point fallback.
  - **Acceptance:** Source representation is declared first; no generic VDB exporter is shipped or announced; any recommendation is scoped to measured assets.
  - **Verify:** Benchmark reproducibility and a report that stays inconclusive when evidence does not establish a winner.

## PR 14 — Shader-driven UI and definition-of-done closure

- [ ] `IP-11A` **Implement the SDF/MSDF text foundation** — Generate a licensed atlas with glyph metrics, line breaking, renderer assumptions, and deterministic fixtures.
  - **Depends on:** IP-10D
  - **Deliver:** Shared shader module/lab experiment plus license and Unicode-coverage metadata.
  - **Acceptance:** Atlas generation is reproducible; unsupported glyphs fail visibly; color space and cost class are declared; primary semantics remain outside Canvas.
  - **Verify:** Atlas generation tests, line-break fixtures, license checks, and deterministic visual capture.

- [ ] `IP-11B` **Align DOM semantics with shader-driven text effects** — Mirror DOM layout, pointer, focus, and activation into canvas uniforms for scramble, glitch, and dissolve.
  - **Depends on:** IP-11A
  - **Acceptance:** Canvas never invents interaction state; resizing/reflow preserves alignment; one normalized timeline owns effect time; search, selection, translation, and screen-reader paths remain DOM-native.
  - **Verify:** Keyboard/focus/pointer parity, portrait reflow, localization fixture, reduced motion, and deterministic interaction captures.

- [ ] `IP-11C` **Enforce the canvas-only prohibition list** — Make primary actions, forms, legal copy, and pricing impossible to ship only in the canvas.
  - **Depends on:** IP-11B
  - **Deliver:** Static/runtime validator fixtures plus documentation and forward negative gates.
  - **Acceptance:** Each prohibited surface fails when its semantic DOM counterpart is absent; decorative duplicate canvas text may remain hidden from accessibility APIs.
  - **Verify:** One failing fixture per prohibited category and one passing mirrored-interface fixture.

- [ ] `IP-11D` **Close the immersive production definition of done** — Run two generated fixtures through install, build, runtime, keyboard, mobile, reduced-motion, fallback, interaction, and telemetry gates.
  - **Depends on:** IP-11C
  - **Deliver:** Evidence index linking captures, performance summaries, generated-asset provenance, CI runs, and every `TODO.md` definition-of-done line.
  - **Acceptance:** Byte-identical fixture proven; three budget gates reported; one procedural asset uses the unchanged asset pipeline; unavailable execution is not a pass; ordinary 2D and 3D-hero forward cases still forbid advanced add-ons; no paid design tool is required.
  - **Verify:** Full strict validation, copy suite, forward dry-run/live evidence where available, both immersive evaluations, deterministic comparator, and artifact manifest integrity.

## Manual release gates

These are deliberate operator gates, not fresh-agent queue items:

1. **1.10 = Tier 0 only.** Cut it only after PR 4 is merged and every T0.1–T0.3
   acceptance gate is evidenced. Do not include Tier 1 implementation in 1.10.
2. **1.11 = Tier 1 only.** Cut it only after PR 7 is merged and every T1.1–T1.4
   acceptance gate is evidenced. Do not include Tier 2 implementation in 1.11.
3. **1.12 = Tier 2 only.** Cut it only after PR 12 is merged and every T2.1–T2.4
   acceptance gate is evidenced. Do not include Tier 3 implementation in 1.12.
4. **2.0 = Tier 3 plus closure.** Do not call any branch, tag, or changelog
   section “2.0” before PRs 13–14 are merged and `IP-11D` passes every
   definition-of-done line with linked fixture evidence.
5. Every 1.10/1.11/1.12/2.0 release must resolve to a real tag, and its changelog
   section must name the fixtures that proved that version's capability.
6. After every PR group, inspect the pushed commit(s), CI artifacts, queue diff,
   and declared unavailable capabilities before merge.
7. Start the next PR group from the merged target branch, never from an
   unreviewed predecessor branch.
