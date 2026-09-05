# IP-11D — Definition-of-Done Evidence Index

This index links every line in `TODO.md` §"Definition of done" to the
fixture, commit, or run that proves it. It is the closure deliverable for
the immersive production layer. Each line is annotated with the evidence
type (fixture / commit / capability) and the verdict reported by that
evidence.

## Line-by-line evidence

| TODO.md definition-of-done line | Evidence | Verdict |
|---|---|---|
| Two runs of one fixture produce byte-identical captures. | `tests/immersive/deterministic-capture/compare-captures.mjs` renders `fixture.html` twice under `WDU_DETERMINISTIC` on the declared device profile and compares the sha256 of `capture.png` against the committed `expected-metadata.json`, whose acceptance field is literally `byte-identical-png-bytes`. The CI job `deterministic-capture` in `.github/workflows/validate.yml` runs it against pinned Chromium (playwright 1.62.1) and reports success on `main` at `a9b432c` (run 33326025652). `tests/immersive/deterministic-capture/capture-comparator.test.mjs` covers the comparator offline. | PASS (browser-gated; a host without Chromium reports UNAVAILABLE, never PASS) |
| Every immersive result reports the three gate numbers against its declared budget. | `website-design-ultra/scripts/verify-browser.mjs` writes a `performance-summary.json` with three gates: warm GPU frame median/p95, first meaningful frame, transfer before that frame. The schema is bound by `website-design-ultra/scripts/run-forward-tests.mjs --dry-run` and the offline fixtures at `tests/immersive/telemetry/ip-03c-status.test.mjs`. | PASS (capability-gated; reports `UNAVAILABLE` when GPU or browser is missing, never `PASS`) |
| A fresh agent run scaffolds and builds the starter without reconstructing the architecture. | `automation/immersive-production-v2/QUEUE.md` §PR 5 records `IP-05A` (scaffold), `IP-05B` (quality controller), `IP-05C` (fallback + lifecycle), `IP-05D` (self-lint). The starter tree is `starters/next-r3f-cinematic/` with `package.json`, `tsconfig.json`, lockfile, semantic DOM copy outside the Canvas, art-directed poster, reduced-motion branch, context-loss path, and one quality controller. `tests/immersive/product-hero/` exercises the same architecture without re-deriving it. | PASS |
| The starter ships DOM content, poster, reduced motion, context-loss and mobile composition. | `starters/next-r3f-cinematic/app/page.tsx` mounts a Canvas-only scene with semantic DOM copy (`<header>`, `<nav>`, `<footer>`) outside the Canvas; `starters/next-r3f-cinematic/components/Poster.tsx` is the art-directed poster; `starters/next-r3f-cinematic/lib/motion-preference.ts` is the reduced-motion branch; `starters/next-r3f-cinematic/components/ContextLossGate.tsx` handles the context-loss recovery; portrait reframe is exercised in `starters/next-r3f-cinematic/lib/scene-config.ts`. | PASS |
| Browser verification exercises declared scroll and interaction checkpoints. | `tests/immersive/interaction-capture/interaction-checkpoints.test.ts` and `tests/immersive/interaction-capture/verify-interaction-fixtures.mjs` exercise the declared checkpoint manifest (`scroll`, `hover`, `click`, `focus`, `keyboard`, `touch`, `loading`, `ready`, `failure`). The `compare-baselines.mjs` companion classifies each captured diff into structural regression, perceptual difference, expected dynamic variation, or nondeterministic content. | PASS |
| Two generated immersive fixtures pass install, build, runtime, keyboard, mobile, reduced-motion and fallback checks. | Both fixtures exist (`tests/immersive/product-hero/`, `tests/immersive/procedural-crystal/`) and their offline suites pass on a clean checkout. The live `immersive-evaluation` shards completed on branch `fix/wdu-audit-input-verification` at `48b1fb8` in GitHub Actions run `33987042986`: `product-hero` and `procedural-crystal` each report `PASS` for build, runtime, interaction checkpoints, keyboard, mobile, reduced-motion, fallback, and all three telemetry gates; the aggregate `immersive-evaluation-gate` is also `success`. | **PASS (browser-gated; run 33987042986)** |
| *(supporting, not a definition-of-done line)* Encoder artefacts reproduce across clean runs. | `volume_research/scripts/reproduce.sh` runs `volume_research/benchmark.py` twice against `volume_research/source-representation.json` (declared id `crystal-fog-density-32`) and reports `REPRODUCIBILITY PASS` for the structured fields and `BYTE-LEVEL REPRODUCIBILITY PASS` for the encoded artefacts (slice PNGs, `packed.wduv`, `points.glb`). This is encoder determinism, not a rendered scene capture: the script never opens a browser, so it cannot stand in for the byte-identical capture line above. | PASS |
| One asset in one fixture was generated procedurally and passed the existing asset pipeline unchanged. | `procedural-generation/` produces `tests/immersive/procedural-crystal/public/model/procedural-crystal-raw.glb` from a deterministic Blender generator (`procedural-generation/generator.py`). The IP-10C commit `df8dc18` "pass generated crystal through existing 3d-asset-pipeline" runs the existing `inspect / validate / optimize / validate` path with `gltf-transform` and `procedural-crystal/scripts/build-model.mjs`. The optimised asset (`procedural-crystal.glb`, 6.36 KB) ships inside the same fixture. | PASS |
| CI never converts unavailable GPU or browser execution into a pass. | `website-design-ultra/scripts/verify-browser.mjs --probe` reports `UNAVAILABLE` and exits non-zero when no compatible browser is on `PATH` (per ADR-010). The forward runner `run-forward-tests.mjs` reports `UNAVAILABLE` for missing CLIs and supports `--require-live` for CI gating. The `validate-content.mjs` replays the offline forward fixtures under `--dry-run` and never synthesises a `PASS` for the live case. | PASS |
| Advanced modules stay negatively gated for ordinary 2D and 3D-hero work, and both existing 3D forward cases still forbid the add-on files. | `website-design-ultra/tests/forward/cases.json` `forbiddenFiles` lists the add-on skill/references for every case; the `3d-hero` and `named-direction-no-references` cases forbid `canvas-first-architecture`, `render-graph`, `loading-choreography`, `spatial-audio`, `gpu-particle-systems`, `procedural-3d`, and `reference-intake`. `validate-content.mjs` binds the gating language in every add-on `SKILL.md` description. | PASS |
| No paid external design tool is required at any step. | `procedural-generation/README.md` documents the deterministic Blender generator with zero paid dependency. `volume_research/` is a self-contained benchmark with numpy + PIL only. `tests/immersive/reference-intake/` accepts free REST-API tokens with personal-token expiry (max 90 days); no Dev Mode / MCP / paid seat is required (per TODO.md "Figma boundary" §0.3). | PASS |

## Repository state at the closure commit (IP-11C, `104dae3`)

This block records the state when the index was first written. It predates
the 2.0.0 release commit and the three evidence-audit fixes, which is why
it still reports manifest version 1.9.1. The re-verification below is the
current record.

```
$ git log --oneline -5
104dae3 feat(prohibition): enforce the canvas-only prohibition list (IP-11C)
360edf0 feat(lab): align DOM semantics with shader-driven text effects (IP-11B)
c39f3e9 feat(lab): add the SDF/MSDF text foundation (IP-11A)
177da08 feat(volume): execute the volume representation research gate (IP-10D)
df8dc18 feat(pipeline): pass generated crystal through existing 3d-asset-pipeline (IP-10C)
```

```
$ python3 automation/immersive-production-v2/chain_driver.py --check
QUEUE_OK tasks=35 checked=35 open=0
```

```
$ node website-design-ultra/scripts/validate-content.mjs
Validation passed: ... manifest version 1.9.1   # at 104dae3, before the release bump
```

```
$ node website-design-ultra/scripts/lint-copy.mjs --self
LINT: PASS — ... tier1 0, tier2 0, tier3 0
```

```
$ node website-design-ultra/scripts/run-forward-tests.mjs --dry-run
... (offline replay of recorded traces, no model usage)
```

```
$ python3 -m unittest automation/immersive-production-v2/test_chain_driver.py
Ran 13 tests in 0.27s — OK
```

```
$ cd lab && npm test
# tests 147
# pass 147
# fail 0
```

## Re-verification on a clean checkout

Every command below was run against a fresh clone of `main` at `a9b432c`
(node 22.23.2, python 3.10.12, no GPU, Chromium not installed locally).
Only observed output is recorded. A capability that was unavailable is
named as unavailable and is not counted as a pass.

```
$ node website-design-ultra/scripts/validate-content.mjs
Validation passed: root starter copy: next-r3f-cinematic (3 surface(s), 16 file(s)),
root lab surfaces declared copy-free: lab (75 source file(s)), 24 skills,
7 negative-gated skills, 6 commands, 20 palettes / 282 state contrast checks,
12 direction token blocks, 1 composited glass palette, 85 bound anti-slop terms,
20 copy-lint regression cases, manifest version 2.0.0

$ node website-design-ultra/scripts/lint-copy.mjs --self
LINT: PASS — 87 file(s), locale auto → en, profile docs, tier1 0, tier2 0, tier3 0

$ node website-design-ultra/scripts/release.mjs
Release gate PASS: plugin website-design-ultra 2.0.0,
26/26 changelog sections anchored, tree cc2147e2615b (144 files), working tree clean

$ node website-design-ultra/scripts/run-forward-tests.mjs --dry-run   # 7 cases replayed
$ node website-design-ultra/scripts/verify-browser.mjs --probe
VERIFY_RUNTIME: READY capability=browser-cli backend=npm-cli

$ python3 -m unittest automation/immersive-production-v2/test_chain_driver.py   # 13 OK
$ python3 -m unittest volume_research/tests/test_volume_research.py             # 12 OK
$ bash volume_research/scripts/reproduce.sh
BYTE-LEVEL REPRODUCIBILITY PASS: encoded artifacts match across runs
VERDICT (run-a): INCONCLUSIVE      # the research gate stays inconclusive by design

$ node --test tests/immersive/{telemetry,interaction-capture,reference-intake,
    evaluation,deterministic-capture,timeline}/*.test.mjs
    tests/determinism-runtime/*.test.mjs                       # 119 pass, 0 fail

$ cd lab && npm ci && npm test                                 # 147 pass, 0 fail
$ cd starters/next-r3f-cinematic && npm ci && npm run typecheck && npm test && npm run build
    typecheck clean, 67 pass, build OK — route / stays server-rendered, 107 kB first load
$ cd tests/immersive/product-hero && npm ci && npm test         # 36 pass, 0 fail
$ cd tests/immersive/procedural-crystal && npm ci && npm test   # 32 pass, 0 fail
$ python3 procedural-generation/test_ip10c_review_regressions.py # 15 OK
$ node procedural-generation/test_ip10c_debug_regressions.mjs
IP10C_DEBUG_REGRESSIONS_GREEN
```

Unavailable on this host, reported as such and not counted:

- `procedural-generation/test_generator.py` and `test_handoff.py` need a real
  Blender install. Without one they fail closed with the `BLENDER_BIN` hint
  rather than skipping into a green result.
- The live `immersive-evaluation` gate needs Chromium and a GPU. See the
  UNVERIFIED row in the table above.

## Capability declarations

The following capabilities are unavailable in the local environment and
are reported as such — never `PASS`:

- Browser CLI: `UNAVAILABLE` if no compatible Playwright/Chromium is on
  `PATH`. The verify-browser adapter exits non-zero and the forward
  runner exits 0 with `UNAVAILABLE` per ADR-010 unless `--require-live`
  is set.
- GPU/WebGPU: `UNAVAILABLE` on hosts without GPU access. The verify
  adapter writes a non-empty `performance-summary.json` with the
  unavailable fields explicit.
- Live model: `--dry-run` for forward cases replays recorded traces;
  `--require-live` is the CI gate.

## Queue state at closure

Every `IP-NNx` task in `automation/immersive-production-v2/QUEUE.md` is
checked `[x]`. The driver test
`automation/immersive-production-v2/test_chain_driver.py::test_repository_queue_and_coverage_contract`
asserts that the checked count equals the number of checked rows in the
queue file.

## Operator gates still owed

Per `QUEUE.md` §"Manual release gates":

1. Cut `1.10` only after PR 4 is merged and every `T0.1`–`T0.3`
   acceptance gate is evidenced. T0.1 (determinism contract) is
   evidenced by the byte-identical PNG capture in
   `tests/immersive/deterministic-capture/compare-captures.mjs`, run by
   the `deterministic-capture` CI job. T0.2 (frame telemetry) is
   evidenced by `website-design-ultra/scripts/verify-browser.mjs`.
   T0.3 (visual contract intake) is evidenced by
   `tests/immersive/reference-intake/`.
2. Cut `1.11` only after PR 7 is merged and every `T1.1`–`T1.4`
   acceptance gate is evidenced. T1.1–`T1.4` are evidenced by
   `starters/next-r3f-cinematic/`, `starters/next-r3f-cinematic/lib/quality-controller.ts`,
   `tests/immersive/interaction-capture/`, and
   `tests/immersive/evaluation/` respectively.
3. Cut `1.12` only after PR 12 is merged and every `T2.1`–`T2.4`
   acceptance gate is evidenced. T2.1–`T2.4` are evidenced by
   `lab/`, `lab/src/modules/{foundational-shaders,transition-interaction,media-post,sdf-text,dom-text-effects,canvas-only-prohibition,gpu-particle-systems}.ts`,
   `lab/src/experiments/shaders/cinematic-timeline.ts`, and the
   reference-intake fixture suite.
4. Cut `2.0` only after PRs 13–14 are merged and `IP-11D` passes every
   definition-of-done line with linked fixture evidence. This document
   is that linking.

## Artifact manifest integrity

The committed artefacts named in this index all resolve at the paths
given. Two reproducibility claims are made here and they are separate:
the rendered scene capture is byte-identical across two clean runs of
`tests/immersive/deterministic-capture/compare-captures.mjs`, and the
committed volume artefacts (slice PNGs, `packed.wduv`, `points.glb`)
are byte-identical across two clean `volume_research/benchmark.py --out`
runs. Neither substitutes for the other.

## No general VDB exporter shipped

Per `TODO.md` §T3.3, no generic VDB exporter is shipped or announced.
`volume_research/` is a self-contained benchmark; the packed format
(`packed.wduv`) is scoped to the measured asset and is not promoted
beyond the declared source representation id `crystal-fog-density-32`.

## Negative gates preserved

Every advanced module in `website-design-ultra/skills/` keeps its
negatively gated `SKILL.md` description (`Use when ... does not activate it.`),
bound by `validate-content.mjs`. The `3d-hero` and `named-direction-no-references`
forward cases still forbid the add-on files in their `forbiddenFiles`
list, so ordinary work cannot accidentally load advanced modules.
