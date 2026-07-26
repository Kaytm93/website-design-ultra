# website-design-ultra

Token-efficient website and immersive-3D design guidance for Claude Code and Codex.

Version 1.5.3 contains 16 skills and 5 Claude commands. It combines evidence-led content, responsive art direction, license-aware typography, automated state-contrast validation, trace-proven selective loading, production motion, component/state patterns, and a focused R3F/Three.js/WebGPU stack with cinematic 3D direction, adaptive runtime quality, touch gestures, a maintained feature matrix, and host-neutral browser verification.

## Structure

```text
website-design-ultra/
├── .claude-plugin/plugin.json
├── .codex-plugin/plugin.json
├── LICENSE
├── commands/
│   ├── design.md
│   ├── audit.md
│   ├── refresh.md
│   ├── immersive.md
│   └── verify.md
├── tests/
│   └── forward/                    # SaaS, editorial, dashboard, 3D, configurator
│       └── traces/                 # recorded provider streams, replayed offline
├── scripts/
│   ├── validate-content.mjs        # structure + semantic contrast
│   ├── forward-trace.mjs           # provider read-trace audit + tree digest
│   ├── run-forward-tests.mjs       # isolated live plugin evals
│   ├── release.mjs                 # release provenance gate
│   ├── install-codex-sync.sh       # install hourly macOS Git sync
│   ├── sync-codex-marketplace.sh   # refresh and reinstall from GitHub
│   └── verify-browser.mjs          # capability-gated browser adapter
└── skills/
    ├── core-rules/
    │   └── references/              # responsive recomposition contract
    ├── content-design/
    │   └── references/              # claims/proof, microcopy, localization
    ├── style-directions/
    │   └── references/          # product, editorial, expressive
    ├── color-palettes/
    │   └── references/          # only one palette family is loaded
    ├── typography/
    │   └── references/              # pairings, hierarchy/loading, licenses
    ├── motion-system/
    │   └── references/          # profiles, Motion, GSAP/scroll
    ├── component-patterns/
    │   └── references/          # hero, cards, forms/overlays
    ├── ui-states/
    │   └── references/          # async, forms, accessibility
    ├── immersive-3d/
    ├── 3d-art-direction/
    │   └── references/          # camera, light/material/tone, spatial type
    ├── 3d-runtime-quality/
    │   └── references/          # tier matrix, adaptive runtime
    ├── r3f-patterns/
    │   └── references/          # Next.js, performance/assets
    ├── r3f-interaction/
    │   └── references/          # hotspots/camera, configurator, touch/gestures
    ├── shaders-tsl/
    │   └── references/          # TSL syntax, WebGPU feature matrix
    ├── scroll-immersion/
    └── 3d-asset-pipeline/
```

## Progressive disclosure

The plugin uses three levels:

1. Skill names and short trigger descriptions are always visible.
2. A triggered `SKILL.md` contains only selection logic, invariants, and the core workflow.
3. Detailed palettes, directions, component recipes, and runtime-specific code live in one-level `references/` files.

Examples:

- SaaS palette request → `color-palettes/SKILL.md` plus `references/neutral-product.md`.
- Claim/CTA rewrite → `content-design/SKILL.md` plus only claims or microcopy.
- Localized editorial page → content localization plus typography licensing, not every type reference.
- Full-page responsive work → `core-rules` plus `references/responsive-recomposition.md`.
- Form component → `component-patterns/SKILL.md` plus `references/navigation-forms-overlays.md`.
- R3F in Next.js → `r3f-patterns/SKILL.md` plus `references/nextjs.md`.
- 3D camera/light brief → `3d-art-direction/SKILL.md` plus only the relevant shot, light, or type reference.
- Runtime adaptation → `3d-runtime-quality/SKILL.md` plus tier matrix and only then the adaptive controller.
- WebGPU feature → `shaders-tsl/SKILL.md` plus `references/webgpu-feature-matrix.md`.
- Simple CSS hover → `motion-system/SKILL.md`; no GSAP or Motion reference.

Do not preload all design skills or all references.

Cross-skill mentions are selection pointers, not transitive dependencies. The
router decides a task gate before reading a child; a child does not recursively
reload its owner or sibling references.

The live forward suite validates this from provider events. It extracts actual
Claude `Read`/`Skill` calls or Codex command reads, rejects broad content scans,
enforces per-case allowed files and reference/token budgets, and fails when a
self-reported skill lacks read evidence. The dashboard case additionally proves
that `neutral-product.md` is read while the editorial and expressive palette
families are not.

## Priority-2 contracts

### Content and localization

`content-design` builds a `promise → mechanism → evidence → objections → action` hierarchy, records every claim as verified/qualified/illustrative/unknown, forbids fabricated proof, and routes state copy and localization into separate references.

### Responsive recomposition

Full pages and signature sections define wide, portrait, and narrow “shots” with explicit focal element, reading order, media crop/camera, CTA placement, density, proof, and interaction model. A smaller grid or font size alone is not considered complete responsive art direction.

### Typography licensing

`typography` is now a progressive-disclosure router. Pairings, hierarchy/loading, and the complete license/open-alternative matrix load independently. Commercial, free-proprietary, OS-bundled, and OFL fonts are deliberately separate statuses.

### State contrast

Every curated palette declares and validates body/muted text, action, focus, meaningful border, danger, on-danger, and disabled tokens. RGBA glass surfaces and borders are composited over their declared backdrop before contrast is calculated.

## Commands

- `/website-design-ultra:design <briefing>` — build a 2D website or component.
- `/website-design-ultra:immersive <briefing>` — build a justified 3D experience.
- `/website-design-ultra:audit <path>` — inspect design, code, states, accessibility, and optional 3D.
- `/website-design-ultra:refresh <path>` — change art direction while preserving functionality.
- `/website-design-ultra:verify <url-or-path>` — render and photograph Desktop, Mobile, Reduced Motion, and 3D fallback, then compare them visually.

## 3D routing

`immersive-3d` decides whether 3D is justified and selects the smallest stack:

- Every shipped scene → `3d-art-direction` for camera, composition, light, materials, tone mapping, responsive shots, and spatial type.
- Every shipped scene → `3d-runtime-quality` for Poster/Low/Medium/High, adaptive shadows/LOD/PostFX/particles/DPR, pause, and hysteresis.
- R3F production scene → `r3f-patterns`.
- Click, hotspot, configurator, camera focus → `r3f-interaction`.
- TSL/WebGPU or custom material → `shaders-tsl`.
- Scroll storytelling → `scroll-immersion`.
- Blender/Spline/glTF/KTX2 → `3d-asset-pipeline`.

WebGLRenderer is the mature default. WebGPURenderer is selected for a concrete TSL/WebGPU benefit and uses renderer-compatible postprocessing.

Every 3D result requires an art-direction contract, budget, explicit quality tiers, offscreen pause, reduced-motion behavior, DOM alternative content, and an art-directed 2D poster fallback.

The WebGPU feature matrix records support separately for WebGPU, the `WebGPURenderer` WebGL2 fallback, TSL postprocessing, compute dependency, and known limitations. Re-test it against the installed Three release.

## Common dependencies

Install only what the selected implementation uses:

```bash
# Motion for React
npm i motion

# Core R3F
npm i three @react-three/fiber @react-three/drei

# WebGL postprocessing only
npm i @react-three/postprocessing

# Scroll storytelling
npm i gsap lenis

# Camera damping
npm i maath

# Development profiling
npm i -D r3f-perf leva
```

For `/verify`, probe the host-neutral adapter first:

```bash
node scripts/verify-browser.mjs --probe
node scripts/verify-browser.mjs \
  --url http://127.0.0.1:3000 \
  --out output/playwright/verify/manual
```

The adapter accepts an explicit CLI, a compatible Codex wrapper, a CLI on
`PATH`, or the npm CLI only after the required session, `run-code`, and
screenshot capabilities pass. If no compatible CLI exists, use the host’s
native browser automation. Otherwise report `UNAVAILABLE`, never `PASS`, and
keep the launch gate open until real screenshots are inspected.

For an explicit plan/contract with no executable target, report
`NOT_APPLICABLE (plan-only)` and define the future capture matrix. Do not use
`UNAVAILABLE`: that status is reserved for an executable target whose browser
capability is missing.

## Asset optimization

Inspect and validate before and after:

```bash
npx @gltf-transform/cli inspect input.glb
npx @gltf-transform/cli validate input.glb
npx @gltf-transform/cli optimize input.glb optimized.glb \
  --compress draco \
  --texture-compress webp
npx @gltf-transform/cli uastc optimized.glb optimized-ktx2.glb
npx @gltf-transform/cli validate optimized-ktx2.glb
```

Choose ETC1S or UASTC from texture content and quality needs. Do not blindly stack Blender Draco, glTF Transform, gltfpack, and `gltfjsx --transform`.

## Installation

### Claude Code

The repository root carries `.claude-plugin/marketplace.json`, so the plugin
installs from the marketplace:

```bash
/plugin marketplace add <owner>/<repo>
/plugin install website-design-ultra@kay-design
```

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

- Keep manifest version as the plugin version; individual skills do not duplicate it.
- Keep references one level below `SKILL.md`.
- Put information in either `SKILL.md` or a reference, never both.
- Recalculate color contrast after changing a token.
- Verify framework/library APIs against installed versions.
- Test all code examples and internal links before release.

Run the deterministic content check:

```bash
node scripts/validate-content.mjs
```

Validate the five forward-test fixtures and trace parsers without model usage:

```bash
node scripts/run-forward-tests.mjs --dry-run
```

This command intentionally says that no model behavior was tested. It is not a
Progressive Disclosure proof.

Run isolated live forward tests through an authenticated Codex CLI (default) or Claude Code:

```bash
node scripts/run-forward-tests.mjs \
  --provider claude \
  --case dashboard \
  --model sonnet \
  --max-budget-usd 0.75 \
  --report /absolute/path/forward-report.json \
  --trace-dir /absolute/path/traces
```

Use `--provider claude` to test Claude plugin loading and `--case saas` (or another case ID) during iteration. Live tests load this plugin source read-only, request schema-constrained output, and fail on missing skill routes, missing read evidence, unexpected references, broad reads, off-root reads, or per-case Plugin-token budgets. Reports include accessed files, observed bytes, a deterministic `ceil(bytes / 4)` Plugin-token estimate, provider-reported total usage, the git provenance of the tree, and its content digest. `--max-budget-usd` applies to Claude; Codex uses its configured account limits.

The Claude runner isolates the session with `--setting-sources ""` and
`--strict-mcp-config`. Without that isolation the run inherits the operator's own
skills and an installed copy of this same plugin, and the trace then measures the
wrong tree. Paths outside the tested plugin root are reported as `offRootReads`
and fail the case instead of counting as evidence.

`--trace-dir` writes the raw provider event stream per case. Those files are the
archivable evidence behind a routing claim. A recorded stream can be replayed
against the parser without any CLI: fixtures in `tests/forward/traces/` run on
every `--dry-run`, so the Claude path stays covered on machines where Claude Code
is not authenticated.

If the selected CLI is missing or unauthenticated, the run reports `UNAVAILABLE`
with a reason, leaves the launch gate open, and exits 0 — the same contract as
browser verification (ADR-010). It is never reported as a pass. Use
`--require-live` in CI to turn `UNAVAILABLE` into a non-zero exit.

Live cases time out after five minutes by default; adjust with `--timeout-ms` for CI. Both providers pin medium reasoning so the suite remains practical and independent of a developer’s local default.

### Release provenance

```bash
node scripts/release.mjs --strict
```

Every changelog section anchors on a `Release-Tag` that must resolve to a real
tag in this repository; the gate prints the resolved commit for each version. A
changelog cannot contain the SHA of the commit that introduces it, so the tag
name — known before the commit — is the anchor, and the SHA is resolved at
verification time. The old `Commit-SHA` placeholder that declared the SHA
unavailable is now a hard validation failure: a ruleset that requires evidence
for every claim does not ship an unverifiable provenance claim of its own.

## Version

**1.5.3** — native Codex Git distribution and automatic updates:

- added `.agents/plugins/marketplace.json` for direct installation from GitHub,
- added a reusable marketplace refresh/reinstall script,
- added an opt-in macOS LaunchAgent installer that synchronizes hourly.

**1.5.2** — licensing, distribution, and one language:

- added the MIT `LICENSE` that both manifests had already declared,
- added `.claude-plugin/marketplace.json` so the plugin installs from a
  marketplace instead of a manual folder copy,
- removed the private `project-vault/` from version control,
- removed the vanilla Three.js sample scene from `immersive-3d` §6: it omitted
  the DOM alternative, the WebGL fallback, and the offscreen pause that the same
  file declares mandatory. §6 is a written contract now,
- the delivered surface is English throughout; the pre-version-control anchor is
  `Release-Tag: none`.

**1.5.1** — provenance and a proven Claude provider:

- release history moved under version control; every changelog section anchors
  on a resolvable `Release-Tag`, enforced by `scripts/release.mjs`,
- fixed two defects in the Claude trace path: namespaced `plugin:skill`
  invocations were dropped as evidence, and plugin-shaped reads outside the
  tested root were credited as if they came from it,
- isolated the Claude runner from operator settings and MCP servers,
- provider availability now follows the `UNAVAILABLE` contract instead of
  aborting the run,
- added recorded-trace fixtures, replayed offline on every `--dry-run`,
- palette output now requires one named contrast statement per required pair,
  after a live Claude run omitted the border pair.

**1.5.0** — trace-proven routing and portable verification:

- added provider event tracing with exact allowed/forbidden file contracts and
  per-case reference/token budgets,
- tightened default routing so generic dashboards do not load style or
  component recipes,
- added a capability-gated browser adapter without a required Codex path,
- added `PASS | FAIL | UNAVAILABLE`; unavailable visual automation keeps the
  result unverified and the launch gate open.
- separated `NOT_APPLICABLE (plan-only)` from runtime `UNAVAILABLE`.

**1.4.0** — evidence-led content and responsive production contracts:

- added `content-design` for claim ledgers, real proof, state microcopy, and localization/transcreation,
- split typography into pairings, hierarchy/loading, and a complete license/open-alternative matrix,
- added wide/portrait/narrow responsive recomposition to `core-rules`,
- added five automated forward-test cases for SaaS, editorial, dashboard, 3D hero, and configurator,
- expanded the palette validator to focus, meaningful borders, danger/error, disabled, and composited glass contrast.

**1.3.0** — 3D direction, runtime quality, and rendered verification:

- added `3d-art-direction` with camera/FOV, composition, lighting, material hierarchy, tone mapping, portrait reframing, and spatial typography,
- added `3d-runtime-quality` with explicit tiers, adaptive shadows/LOD/PostFX/particles/DPR, offscreen pause, and quality hysteresis,
- added `/verify` for real Desktop/Mobile/Reduced-Motion/Fallback screenshots and visual comparison,
- added a cancellable touch/gesture state machine to `r3f-interaction`,
- added a maintained WebGPU/WebGL2/TSL/Compute feature matrix.
