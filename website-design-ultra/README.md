# website-design-ultra

Token-efficient website and immersive-3D design guidance for Claude Code and Codex.

Version 2.0.1 contains 24 skills and 6 Claude commands. It enforces anti-slop
rules on generated copy and on visual defaults, with a deterministic English and
German copy linter that reads a whole repository at one register per file. It
carries evidence-led content, a declared 2D composition contract, per-direction
design tokens, responsive art direction, license-aware typography, and validated
state contrast. For 3D it carries a focused R3F, Three.js and WebGPU stack:
traceable reference intake, cinematic direction, adaptive runtime quality, touch
gestures, host-neutral browser verification, deterministic byte-identical
capture, three-gate telemetry, and declared interaction checkpoints.

Seven skills are negative-gated and stay unloaded until a brief names their
condition: `procedural-3d`, `canvas-first-architecture`, `render-graph`,
`loading-choreography`, `spatial-audio`, `gpu-particle-systems`, and
`reference-intake`. Six of them sit behind an already-loaded 3D stack;
`reference-intake` is the exception, gated on supplied reference frames rather
than on the stack. Needing one says nothing about the others.

Copy quality is enforced deterministically, not by self-report.

## Structure

24 skills under `skills/`, 6 commands under `commands/`, the validators and the
browser adapter under `scripts/`, and the files a project copies under
`templates/`. Each skill is one `SKILL.md` plus one level of `references/`.

The full tree, what each skill owns, and the routing rationale are in
[docs/structure.md](docs/structure.md).

## Progressive disclosure

The plugin uses three levels:

1. Skill names and short trigger descriptions are always visible.
2. A triggered `SKILL.md` contains only selection logic, invariants, and the core workflow.
3. Detailed palettes, directions, component recipes, and runtime-specific code live in one-level `references/` files.

Intended routing contracts (a passing live attempt is still required for an
exact provider, case, and tree):

- SaaS palette request → `color-palettes/SKILL.md` plus `color-palettes/references/neutral-product.md`.
- Any shipped copy line → `anti-slop/SKILL.md` plus `anti-slop/references/prose-tells.md`; the
  design, vocabulary, locale, and operations references stay unread.
- German landing page → the same two files plus `references/locale-de.md`.
- One scoped component via `/tweak` → `core-rules/SKILL.md` plus a linter run;
  no direction, palette, or pattern skill.
- Visual refresh with unchanged copy → `anti-slop/references/design-tells.md` only.
- Full page composition → `core-rules/references/composition-contract.md` next to
  the responsive contract; a component does not load either.
- Reproducible dynamic capture, a visual baseline, a poster/checkpoint frame, or
  scene bug reproduction → `core-rules/references/determinism.md`; ordinary 2D
  work and an ordinary 3D hero do not load it.
- Declared interaction checkpoints under deterministic capture →
  `core-rules/references/interaction-checkpoints.schema.json` plus
  `core-rules/references/determinism.md` §7; the manifest is the project's
  declaration, never a verifier hardcode.
- Comparing a committed baseline capture set against a candidate run →
  `core-rules/references/baseline-comparison.schema.json` plus
  `core-rules/references/determinism.md` §8; a diff score is evidence,
  never an aesthetic verdict.
- A shader effect that already exists → `shaders-tsl/references/module-index.md`
  plus the one file it names under `templates/shaders/`.
- 3D hero on a normal page → the three mandatory 3D skills only.

The complete list of routing contracts is in
[docs/structure.md](docs/structure.md).

## Contracts

The anti-slop contract (tiers, budgets, the protect list, the linter) and the
Priority-2 contracts (content and localization, responsive recomposition,
composition and direction tokens, typography licensing, state contrast) are in
[docs/contracts.md](docs/contracts.md).

## Commands

- `/website-design-ultra:design <briefing>` — build a 2D website or component.
- `/website-design-ultra:tweak <briefing>` — change one existing component without loading the page-level stack.
- `/website-design-ultra:immersive <briefing>` — build a justified 3D experience.
- `/website-design-ultra:audit <path>` — inspect design, code, states, accessibility, and optional 3D.
- `/website-design-ultra:refresh <path>` — change art direction while preserving functionality.
- `/website-design-ultra:verify <url-or-path>` — render and photograph Desktop, Mobile, Reduced Motion, and 3D fallback, then compare them visually.

## 3D routing

`immersive-3d` decides whether 3D is justified and selects the smallest stack:

- Six to ten exported PNG and SVG reference frames plus a written token block →
  `reference-intake` before `3d-art-direction`; it produces the traced contract
  and poster target before scene code. In a checkout of the same repository
  commit or tag, `automation/reference-intake/validate-reference-intake.mjs`
  validates the companion JSON and bytes offline; its fixtures and optional
  Figma REST helper remain root-only.
- Every shipped scene → `3d-art-direction` for camera, composition, light, materials, tone mapping, responsive shots, and spatial type.
- Every shipped scene → `3d-runtime-quality` for Poster/Low/Medium/High, adaptive shadows/LOD/PostFX/particles/DPR, pause, and hysteresis.
- R3F production scene → `r3f-patterns`.
- Click, hotspot, configurator, camera focus → `r3f-interaction`.
- TSL/WebGPU or custom material → `shaders-tsl`.
- Scroll storytelling → `scroll-immersion`.
- Procedural geometry that must be generated from parameters → `procedural-3d` before `3d-asset-pipeline`; it generates the GLB that the pipeline then inspects, validates, and optimizes. Ordinary imported GLB inspection alone does not activate it.
- Imported Blender/Spline/glTF/KTX2 asset that only needs inspection, validation, or optimization → `3d-asset-pipeline`.

Five further layers exist and stay unloaded until the brief names their
condition. Needing one says nothing about the others:

- The canvas is the page, sections are scene states, no DOM page behind it →
  `canvas-first-architecture`, which also carries the parallel DOM layer that
  keeps the `core-rules` canvas-only invariant satisfied rather than waived.
- Passes read what earlier passes wrote, or more than two effects share the
  frame → `render-graph`.
- The first meaningful frame depends on staged assets → `loading-choreography`.
- The deliverable plays sound → `spatial-audio`.
- Thousands of particles with persistent texture state, spatial fields, trails, or volume morphing → `gpu-particle-systems`; decorative dust, sparkle, small instanced particles, a short burst, or a single click shockwave stays in `r3f-patterns` and does not activate it.

WebGLRenderer is the mature default. WebGPURenderer is selected for a concrete TSL/WebGPU benefit and uses renderer-compatible postprocessing.

Every 3D result requires an art-direction contract, budget, explicit quality tiers, offscreen pause, reduced-motion behavior, DOM alternative content, and an art-directed 2D poster fallback.

The WebGPU feature matrix records support separately for WebGPU, the `WebGPURenderer` WebGL2 fallback, TSL postprocessing, compute dependency, and known limitations. Re-test it against the installed Three release.

## Dependencies and assets

What the generated code expects to be installed, and how models, textures and
HDRIs are prepared, are in [docs/dependencies.md](docs/dependencies.md).

## Installation

### Claude Code

The repository root carries `.claude-plugin/marketplace.json`, so the plugin
installs from the marketplace:

```bash
/plugin marketplace add Kaytm93/website-design-ultra
/plugin install website-design-ultra@kay-design
```

Claude Code leaves automatic updates disabled by default for third-party
marketplaces. In `/plugin`, open **Marketplaces**, select `kay-design`, and
choose **Enable auto-update**. Claude Code will then refresh the marketplace and
installed plugin in the background after startup; run `/reload-plugins` when it
announces an update, or use the new version on the next launch. The public
repository does not require a GitHub token.

To work on a local checkout instead, use the folder directly and validate it:

```bash
claude plugin validate /absolute/path/to/website-design-ultra --strict
```

Reload plugins after adding commands or changing the manifest.

### Codex

The repository root carries `.agents/plugins/marketplace.json`, so Codex can use
the GitHub repository as the `kay-design` marketplace:

```bash
codex plugin marketplace add Kaytm93/website-design-ultra --ref main
codex plugin add website-design-ultra@kay-design
```

On macOS, install the optional user-level sync agent from a checkout:

```bash
./website-design-ultra/scripts/install-codex-sync.sh
```

It refreshes the Git marketplace, reinstalls the plugin once when loaded, and
then checks hourly. Logs are written to
`~/Library/Logs/website-design-ultra-sync.log` and
`~/Library/Logs/website-design-ultra-sync.error.log`.

## Maintenance

`scripts/validate-content.mjs` is the gate: skill and command shape, documented
paths, router coverage, marker contracts, palette contrast, and the copy linter
run against the plugin's own prose. `scripts/run-forward-tests.mjs --dry-run`
replays the committed fixtures offline. `scripts/release.mjs --strict` checks
that every changelog section resolves to a real tag.

The full procedure, the live forward-test command and its cost model, and the
release rules are in [docs/maintenance.md](docs/maintenance.md).

### Committed evidence scope

The repository commits two historical Claude traces: `dashboard`, recorded
against version 1.5.1, and `slop`, recorded against a dirty 1.6.1 candidate whose
manifest still read 1.6.0. Each fixture is bound to its recorded tree digest and
replays its exact accessed and forbidden files.

Those snapshots exercise the Claude trace parser and document those two attempts
only. They do not establish current 2.0.1 routing, the other five cases, routing
stability, or Codex behavior. `--dry-run` prints this historical inventory before
the current case contracts so the local evidence boundary stays visible.

## Version history

`CHANGELOG.md` at the repository root. The README does not keep a second copy.
