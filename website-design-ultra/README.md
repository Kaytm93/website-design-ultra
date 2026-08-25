# website-design-ultra

Token-efficient website and immersive-3D design guidance for Claude Code and Codex.

Version 1.9.1 contains 21 skills and 6 Claude commands. It combines tiered anti-slop enforcement for generated copy and visual defaults, locale-safe English/German copy linting that reads a whole repository with one register per file, evidence-led content, a declared 2D composition contract, per-direction design tokens, a catalogue of signature devices, responsive art direction, license-aware typography, automated state-contrast validation, a provider-trace harness for selective-loading audits, production motion, component/state patterns, and a focused R3F/Three.js/WebGPU stack with cinematic 3D direction, adaptive runtime quality, touch gestures, a maintained feature matrix, and host-neutral browser verification. Four negative-gated add-ons cover the canvas-first class — architecture, multi-pass render graph, loading choreography, and sound — and stay unloaded until a brief names their condition. Copy quality is enforced deterministically, not by self-report.

## Structure

```text
website-design-ultra/
├── .claude-plugin/plugin.json
├── .codex-plugin/plugin.json
├── LICENSE
├── commands/
│   ├── design.md
│   ├── tweak.md                    # scoped single-component track
│   ├── audit.md
│   ├── refresh.md
│   ├── immersive.md
│   └── verify.md
├── tests/
│   ├── forward/                    # SaaS, editorial, dashboard, 3D, configurator, slop
│   │   └── traces/                 # recorded provider streams, replayed offline
│   └── copy/                       # linter regression gate
│       └── fixtures/               # slop and authentic-prose pairs, en + de
├── scripts/
│   ├── validate-content.mjs        # structure + contrast + linter regression
│   ├── lint-copy.mjs               # deterministic copy linter (tiers, profiles)
│   ├── forward-trace.mjs           # provider read-trace audit + tree digest
│   ├── run-forward-tests.mjs       # isolated live plugin evals
│   ├── release.mjs                 # release provenance gate
│   ├── install-codex-sync.sh       # install hourly macOS Git sync
│   ├── sync-codex-marketplace.sh   # refresh and reinstall from GitHub
│   └── verify-browser.mjs          # capability-gated browser adapter
└── skills/
    ├── core-rules/
    │   └── references/              # composition, recomposition, deterministic runtime
    ├── anti-slop/
    │   └── references/              # prose tells, Tier-2 words, design tells,
    │                                # German annex, operations
    ├── content-design/
    │   └── references/              # claims/proof, microcopy, localization
    ├── style-directions/
    │   └── references/          # product, editorial, expressive, signature moves
    ├── color-palettes/
    │   └── references/          # select only the needed palette family
    ├── typography/
    │   └── references/              # pairings, hierarchy/loading, licenses
    ├── motion-system/
    │   └── references/          # profiles, Motion, GSAP/scroll,
    │                            # frame-rate independence for render loops
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
    ├── 3d-asset-pipeline/
    ├── canvas-first-architecture/   # on demand: the canvas is the page
    │   └── references/          # parallel DOM layer, scene state and clock
    ├── render-graph/                # on demand: passes read earlier passes
    │   └── references/          # pass catalogue, buffers and precision
    ├── loading-choreography/        # on demand: staged first frame
    │   └── references/          # manifest/buckets, warm-up and first frame
    └── spatial-audio/               # on demand: the deliverable plays sound
        └── references/          # graph and mixing, event sound design
```

The last four are add-ons behind an already-loaded 3D stack. Each description
names one activating condition and closes by naming what does not activate it,
and `validate-content.mjs` fails the build when either sentence is missing.

## Progressive disclosure

The plugin uses three levels:

1. Skill names and short trigger descriptions are always visible.
2. A triggered `SKILL.md` contains only selection logic, invariants, and the core workflow.
3. Detailed palettes, directions, component recipes, and runtime-specific code live in one-level `references/` files.

Intended routing contracts (a passing live attempt is still required for an
exact provider, case, and tree):

- SaaS palette request → `color-palettes/SKILL.md` plus `references/neutral-product.md`.
- Any shipped copy line → `anti-slop/SKILL.md` plus `references/prose-tells.md`; the
  design, vocabulary, locale, and operations references stay unread.
- German landing page → the same two files plus `references/locale-de.md`.
- Reporting findings or running the linter → `anti-slop/references/operations.md`;
  writing one line does not load it.
- A hand-judged Tier-2 cluster → `anti-slop/references/tier2-vocabulary.md`; a
  linted surface never needs it.
- One scoped component via `/tweak` → `core-rules/SKILL.md` plus a linter run;
  no direction, palette, or pattern skill.
- Visual refresh with unchanged copy → `anti-slop/references/design-tells.md` only.
- Full page composition → `core-rules/references/composition-contract.md` next to
  the responsive contract; a component does not load either.
- Signature device for a page → `style-directions/references/signature-moves.md`
  after the direction is chosen, never during the shortlist.
- Claim/CTA rewrite → `content-design/SKILL.md` plus only claims or microcopy.
- Localized editorial page → content localization plus typography licensing, not every type reference.
- Full-page responsive work → `core-rules` plus `references/responsive-recomposition.md`.
- Reproducible dynamic capture, a visual baseline, a poster/checkpoint frame, or
  scene bug reproduction → `core-rules/references/determinism.md`; ordinary 2D
  work and an ordinary 3D hero do not load it.
- Form component → `component-patterns/SKILL.md` plus `references/navigation-forms-overlays.md`.
- R3F in Next.js → `r3f-patterns/SKILL.md` plus `references/nextjs.md`.
- 3D camera/light brief → `3d-art-direction/SKILL.md` plus only the relevant shot, light, or type reference.
- Runtime adaptation → `3d-runtime-quality/SKILL.md` plus tier matrix and only then the adaptive controller.
- WebGPU feature → `shaders-tsl/SKILL.md` plus `references/webgpu-feature-matrix.md`.
- Simple CSS hover → `motion-system/SKILL.md`; no GSAP or Motion reference.
- 3D hero on a normal page → the three mandatory 3D skills only. The
  canvas-first, render-graph, loading, and audio add-ons stay unread, and both
  3D forward cases forbid all four files.
- The canvas owns the page → `canvas-first-architecture/SKILL.md` plus
  `references/parallel-dom-layer.md`; a hero above a DOM page never reaches it.
- One bloom → `r3f-patterns`; a chain whose passes read each other →
  `render-graph/SKILL.md` plus only the catalogue or the buffer reference.
- One model behind Suspense → `r3f-patterns`; a staged manifest with an
  art-directed arrival → `loading-choreography/SKILL.md`.
- Sound named in the brief → `spatial-audio/SKILL.md`; a scene that merely could
  have sound does not load it.
- A hand-written `useFrame` damp → `motion-system/references/frame-rate-independence.md`;
  a GSAP or Motion tween is already time-based and does not.

Do not preload all design skills or all references.

Cross-skill mentions are selection pointers, not transitive dependencies. The
router decides a task gate before reading a child; a child does not recursively
reload its owner or sibling references.

The live forward suite audits this from provider events. It extracts actual
Claude `Read`/`Skill` calls or Codex command reads, rejects broad content scans,
enforces per-case allowed files and reference/token budgets, and fails when a
self-reported skill lacks read evidence. The dashboard contract requires
`neutral-product.md` while forbidding the editorial and expressive palette
families. Only a passing live attempt establishes that result for its exact
provider, case, and tree.

## Anti-slop contract

`anti-slop` is the single source of truth for slop detection. It separates two
defects that usually travel together: **empty form** — a rhetorical shape that
carries no information — and **false content**, which stays with
`content-design`. A page can pass one and fail the other.

Findings are tiered so the ruleset does not flatten real voice:

- **Tier 1** structural forms are always rewritten, with no direction exception.
- **Tier 2** vocabulary is a finding only as a cluster or inside a heading, because
  `robust` in a reliability claim and `seamless` for a marquee loop are the correct
  words.
- **Tier 3** budgets are measured and reported as numbers, with a register profile
  (`marketing`, `docs`, `editorial`) deciding sensitivity.

A declared `.anti-slop-protect.json` exempts brand terms and signature phrasing;
every entry carries a reason, and an entry without one is reported as a suppressed
finding rather than applied. Prohibition alone produces bland copy, so the skill
also enforces a positive specificity floor: a headline must name an audience,
mechanism, dated number, product object, or observable outcome, and an unknown
fact stays an explicit placeholder instead of being resolved by invention.

`scripts/lint-copy.mjs` is the executable form, and it is the only one: the `slop`
forward case runs that same linter over the model's generated `copy.lines` instead
of restating Tier-1 patterns as fixture regexes, because a duplicated list drifts
and a flat pattern cannot express a Tier-3 budget at all. `forbiddenTerms` covers
only what the linter deliberately does not gate, and its scope must point at a
copy leaf — a whole subtree would match the model's own report of the pattern it
avoided. `scripts/validate-content.mjs` binds the linter to the references — a Tier-1 rule id or Tier-2 term that is not
documented fails the build — and replays `tests/copy/` so a rule change must still
catch every slop fixture while flagging nothing in the authentic-prose fixtures,
in English and German. The English binding surface spans two files since 1.7.0:
the structural tells stayed in `prose-tells.md`, the Tier-2 word list moved to
`tier2-vocabulary.md`, and both are bound. The plugin lints its own 74 documents
on every run. The
skill states its blind spots: fake-profound kickers, synonym cycling, and triplets
with a filler third item need a reader, and no lint result claims a copy line is
true.

When `--locale` is omitted, the linter resolves English or German separately for
each file from language metadata, locale-bearing path segments, or
high-frequency function words in the extracted visible copy. Mixed files run
both rule sets. If detection is inconclusive, both rule sets run and the text
report prints `AUTO-LOCALE WARNING`; JSON includes the per-file detection
source, scores, and warnings. `--locale en` and `--locale de` remain explicit
overrides.

## Priority-2 contracts

### Content and localization

`content-design` builds a `promise → mechanism → evidence → objections → action` hierarchy, records every claim as verified/qualified/illustrative/unknown, forbids fabricated proof, and routes state copy and localization into separate references.

### Responsive recomposition

Full pages and signature sections define wide, portrait, and narrow “shots” with explicit focal element, reading order, media crop/camera, CTA placement, density, proof, and interaction model. A smaller grid or font size alone is not considered complete responsive art direction.

### Composition contract and direction tokens

A 3D scene had to declare camera, safe area, and poster frame before scene code;
a 2D page had no equivalent, so its composition was decided by whichever
component happened to be written first.
`core-rules/references/composition-contract.md` closes that gap with a filled
block: visual thesis, focal element, first-screen occupancy, asymmetry, dominant
contrast, quiet zones, and one signature move. It loads under the same condition
as the responsive contract and answers the complementary question — what must
survive every viewport, where recomposition answers what changes.

Each of the 12 style directions now carries a token block in the same YAML shape
as the palettes: grid, type ratio, space scale, section padding, radii, dominant
contrast, and motion profile. `validate-content.mjs` binds every direction to one
and every `motion-profile` to a profile `motion-system` defines. The block also
changes what an audit measures: the Tier-3 visual budgets compare the built page
against the declaration when one exists, and against the generic defaults
otherwise. A deliberately three-radius brutalist page is now conformant by
declaration rather than a finding, while an undeclared one still fails.

`style-directions/references/signature-moves.md` catalogues 20 implementable
devices, each with the direction it belongs to and the invariant it must not
break. `component-patterns` required one signature pattern per viewport without
ever defining a signature; this file is that definition.

`/design` step 3 requires three named variants before the direction is chosen,
one line each, differing in composition rather than palette. The direction choice
was the one gate in the plugin with no counter-measure against the attractor the
anti-slop thesis names: the most likely option wins whenever the brief did not
constrain, and picking the closest row of a shortlist has exactly that shape.

### Typography licensing

`typography` is now a progressive-disclosure router. Pairings, hierarchy/loading, and the complete license/open-alternative matrix load independently. Commercial, free-proprietary, OS-bundled, and OFL fonts are deliberately separate statuses.

### State contrast

Every curated palette declares and validates body/muted text, action, focus, meaningful border, decorative divider, danger, on-danger, and disabled tokens. RGBA glass surfaces and borders are composited over their declared backdrop before contrast is calculated.

`border` and `divider` are separate roles. A border is a boundary that carries
meaning and owes 3:1; a divider only separates, so WCAG sets no minimum and the
validator checks the role instead of a threshold — visible at all, and quieter
than that palette's border. A palette name is the direction it belongs to, not
the named product's token file: these values are re-derived to pass the contrast
contract, so `border` is louder than the hairline those interfaces ship.

## Commands

- `/website-design-ultra:design <briefing>` — build a 2D website or component.
- `/website-design-ultra:tweak <briefing>` — change one existing component without loading the page-level stack.
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

Four further layers exist and stay unloaded until the brief names their
condition. Needing one says nothing about the others:

- The canvas is the page, sections are scene states, no DOM page behind it →
  `canvas-first-architecture`, which also carries the parallel DOM layer that
  keeps the `core-rules` canvas-only invariant satisfied rather than waived.
- Passes read what earlier passes wrote, or more than two effects share the
  frame → `render-graph`.
- The first meaningful frame depends on staged assets → `loading-choreography`.
- The deliverable plays sound → `spatial-audio`.

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

For a runnable target with the shared immersive telemetry surface, the same
output directory also contains `performance-summary.json`: a timestamp-free
comparison of the declared three-gate budget with the fixed warm sample window,
first meaningful frame, and transfer completed before that marker. Missing
browser, GPU, or surface evidence remains `UNAVAILABLE`, never `PASS`.

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

- Keep manifest version as the plugin version; individual skills do not duplicate it.
- Keep references one level below `SKILL.md`.
- Put information in either `SKILL.md` or a reference, never both.
- Recalculate color contrast after changing a token.
- Verify framework/library APIs against installed versions.
- Test all code examples and internal links before release.

Run the deterministic content check. It validates structure and contrast, binds
the linter's rules to their references, replays the copy fixtures, and lints the
plugin's own prose:

```bash
node scripts/validate-content.mjs
```

Lint a project's copy, or this plugin's own documents:

```bash
node scripts/lint-copy.mjs --path src
node scripts/lint-copy.mjs --path .                                      # whole repo, register per file
node scripts/lint-copy.mjs --path content --profile editorial            # one register for all
node scripts/lint-copy.mjs --path content --locale de --profile editorial
node scripts/lint-copy.mjs --path src --protect .anti-slop-protect.json --strict
node scripts/lint-copy.mjs --self
```

Exit code 1 marks a Tier-1 hit or an exceeded Tier-3 budget; `--strict` adds
Tier-2 clusters. A `PASS` reports the absence of catalogued patterns and is never
a content approval.

Aimed at a repository root, the walk skips dot directories and build output and
prints every skip: agent scratch space such as `.claude/worktrees` holds whole
copies of the repository, and entering it reports the same sentence once per copy.
Repo prose — `README`, `CHANGELOG`, `AGENTS.md`, `CLAUDE.md`, Markdown outside a
shipped-copy path — is judged in the `docs` register, where em dashes, tick-box
headings, and one heading per paragraph are normal. Construction tells stay on in
every register; only `em-dash-in-heading`, `emoji-in-heading`, and
`de:english-em-dash` relax, because those three judge published typography.
`--profile` sets one register for every file. Read the printed `profile auto →`
split before quoting a count.

Exit code 2 marks `NO-COPY`: no file matched the path, or no visible text could
be extracted from any input. That is not a pass. It reads Markdown, JSX/TSX,
HTML, Vue, Svelte, Astro, and the string values of JSON message catalogues —
message ids are not copy. Copy assembled at runtime in plain `.js`, or held in a
format the extractor does not read, is reported as unchecked, and a partial miss
prints a `NO-COPY WARNING` naming the skipped files.

`sentence-variation` is advisory: measured and printed, never fail-gating. Short
factual copy is legitimately uniform, and gating on it rejected the specific,
evidence-led writing the skill asks for.

Validate the six forward-test contracts and replay the committed trace fixtures
without model usage:

```bash
node scripts/run-forward-tests.mjs --dry-run
```

This command intentionally says that no model behavior was tested. It is not a
Progressive Disclosure proof.

### Committed evidence scope

The repository commits two historical Claude traces: `dashboard`, recorded
against version 1.5.1, and `slop`, recorded against a dirty 1.6.1 candidate whose
manifest still read 1.6.0. Each fixture is bound to its recorded tree digest and
replays its exact accessed and forbidden files.

Those snapshots exercise the Claude trace parser and document those two attempts
only. They do not establish current 1.7.0 routing, the other four cases, routing
stability, or Codex behavior. `--dry-run` prints this historical inventory before
the current case contracts so the local evidence boundary stays visible.

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

If the selected CLI is installed outside `PATH`, pass its executable explicitly.
The same binary is then used for version, authentication, and the live run:

```bash
node scripts/run-forward-tests.mjs \
  --provider codex \
  --provider-cli /absolute/path/to/codex \
  --case dashboard
```

Use `--provider claude` to test Claude plugin loading and `--case saas` (or another case ID) during iteration. Live tests load this plugin source read-only, request schema-constrained output, and fail on missing skill routes, missing read evidence, unexpected references, broad reads, off-root reads, or per-case Plugin-token budgets. Reports include accessed files, observed bytes, a deterministic `ceil(bytes / 4)` Plugin-token estimate, provider-reported total usage, the git provenance of the tree, and its content digest. `--max-budget-usd` applies to Claude; Codex uses its configured account limits.

### One attempt is one sample, not a verdict

Skill routing is not deterministic. The same tree and the same case produce
different reference sets across attempts, so a single green run is not evidence
that a case is stable, and a single red run is not evidence of a regression.
Measured over three full runs of this suite, the set of passing cases changed
every time while the count stayed roughly flat.

Score by pass rate instead:

```bash
node scripts/run-forward-tests.mjs \
  --provider claude \
  --repeat 5 \
  --min-pass-rate 0.8 \
  --max-budget-usd 0.60 \
  --report /absolute/path/forward-report.json
```

Each case runs `--repeat` times and is scored against `--min-pass-rate`. The
summary marks any case under threshold and lists the failures that occurred in
more than one attempt — those are the reproducible ones and the only ones worth
acting on. Failures appearing in a single attempt are usually noise, and editing
rule prose to chase them tends to displace a different requirement rather than
fix anything.

Cost is cases × repeats × `--max-budget-usd`. Six cases at `--repeat 5` and
`0.60` is up to 18 USD, so iterate with `--case` and raise `--repeat` only when
a change is ready to be judged.

The defaults (`--repeat 1 --min-pass-rate 1`) reproduce the older
all-or-nothing behaviour. Treat that mode as a smoke test.

The Claude runner isolates the session with `--setting-sources ""` and
`--strict-mcp-config`. Without that isolation the run inherits the operator's own
skills and an installed copy of this same plugin, and the trace then measures the
wrong tree. Paths outside the tested plugin root are reported as `offRootReads`
and fail the case instead of counting as evidence.

`--trace-dir` writes the raw provider event stream per case. Those files are
archivable evidence for that attempt's routing result. A recorded stream can be replayed
against the parser without any CLI: fixtures in `tests/forward/traces/` run on
every `--dry-run`, so the Claude trace-parser path stays covered on machines
where Claude Code is not authenticated.

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

**1.9.1** — the line a finding points at:

- fixed the line number every finding is reported at: match offsets came from the
  rewritten text the rules run on, and the line was recovered afterwards by
  searching the file for the matched string, which for a one-character match like
  `—` returned the first em dash anywhere in the file, or line 1,
- offsets are now carried out of the extractor — Markdown and markup mask what
  they strip so the text keeps the file's coordinates, JSX and JSON record where
  each collected piece was found,
- a match starting at a paragraph break no longer lands on the blank line above
  its sentence, and a match wrapped across two source lines no longer reports the
  line above it,
- no rule changed: across the fixture suite no finding appeared, vanished, or
  changed tier, and 20 line numbers moved onto the line their text is on,
- `expected.json` cases now carry a `lines` map, and
  `tests/copy/fixtures/source-lines-de.tsx` holds one em dash in copy on line 16
  and a decoy em dash in a comment on line 4; the previous linter fails the new
  assertions 19 times.

**1.9.0** — a repository is not a website:

- the directory walk skips dot directories and build output and prints every
  skip; on one real site `.claude/worktrees` alone produced 2292 of 3304 Tier-1
  findings by holding whole copies of the checkout,
- without `--profile`, each file gets its own register — `docs` for repo prose,
  the base register for shipped copy — printed as `profile auto → docs 61 /
  marketing 108`,
- `emoji-in-heading` and `de:english-em-dash` now relax with the register, as
  `em-dash-in-heading` already did; every construction tell stays on everywhere,
- same site after both changes: 641 files and 3304 Tier-1 became 169 and 2, and
  both survivors are real em dashes in German `alt` and `aria-label` text,
- added `tests/copy/fixtures/tree/`, the suite's first directory fixture,
  asserted under auto, under `--profile marketing`, and with the skipped
  directory named as the path.

**1.8.2** — the same blind spot, in English:

- fixed the English Tier-1 patterns, which were built from literal spaces and so
  fired only when a whole phrase landed on one source line; every space is now
  `\s+`, and the bounded spans tolerate a line break but not a paragraph break,
- added `tests/copy/fixtures/slop-wrapped-en.md`, the `slop-en.md` tells broken
  across line ends: the previous patterns found 1 of its 12 tells,
- no English tell was added, removed, or widened; single-line behaviour, the
  clean fixtures, and `--self` are unchanged.

**1.8.1** — the deterministic layer, made runnable and made German:

- fixed the copy-linter command in `anti-slop/SKILL.md`,
  `anti-slop/references/operations.md`, and `/tweak`: a bare relative
  `scripts/lint-copy.mjs` resolves against the user's project and dies with
  `Cannot find module`, so all three now use the `<plugin-root>` convention that
  `/audit` and `/verify` already used,
- tightened the `anti-slop` check line so a command that never started counts as
  an unverified copy layer rather than a stated linter absence,
- fixed `de:negative-parallelism`: it gated `nicht nur … sondern auch`, a correct
  correlative conjunction, and now matches the `It's not just X, it's Y` calque
  it was meant to catch,
- added `de:more-than-just`, `de:fast-paced-world`, `de:false-range`, and
  `de:revolutionize-the-way`; widened `de:next-level` and
  `de:importance-puffery`; made the German patterns whitespace-tolerant so a
  wrapped markdown line still matches,
- rewrote both German fixtures from real marketing copy instead of from the
  regexes, added `clean-de-correlative.md` as the false-positive guard, and added
  `requiredRules` to `tests/copy/expected.json` so a fixture names the tells it
  covers instead of only how many findings it produces.

**1.8.0** — the canvas-first class, gated so it stays out of the way:

- added `canvas-first-architecture` for experiences where the canvas is the page:
  a gate that ends the skill for a 3D hero, a compensation contract with nine
  fields, one owner per axis, and the list of what never moves into the scene,
- added `canvas-first-architecture/references/parallel-dom-layer.md`, the
  mechanism that satisfies the `core-rules` canvas-only invariant instead of
  waiving it, plus a four-run verification matrix,
- added `render-graph` for multi-pass chains: a pass contract with a resolution
  scale per pass, the fill-cost model, ping-pong and precision rules, and a
  pass-level degradation order that feeds the runtime controller,
- added `loading-choreography`, including the rule that a progress readout is a
  claim and needs a real signal — a bar that eases to 90 percent and waits is
  invented data under the same rule that governs copy,
- added `spatial-audio` with the unlock gesture, the mix discipline, and the
  separation the accessibility invariants require: motion and sound are two
  preferences with two controls,
- added `motion-system/references/frame-rate-independence.md`, which converts an
  existing per-frame coefficient without retuning it and names the boundary
  where a spring needs a fixed sub-step,
- gave `immersive-3d` a second budget class for full-canvas experiences, so the
  component-class numbers are no longer exceeded quietly,
- bound all four add-on descriptions in `validate-content.mjs`: each must state
  one activating condition and close by naming what does not activate it, and
  both 3D forward cases now forbid all four files, so over-triggering is a test
  failure rather than a matter of taste.

**1.7.0** — a page declares its composition, and the small path costs less:

- added `core-rules/references/composition-contract.md`, the 2D twin of the
  art-direction contract: thesis, focal element, first-screen occupancy,
  asymmetry, dominant contrast, quiet zones, signature move,
- gave all 12 style directions a token block in the palette YAML shape, bound by
  the validator, and made the Tier-3 visual budgets measure against the
  declaration when one exists,
- added `style-directions/references/signature-moves.md`: 20 devices, each with
  its direction and the invariant it must not break,
- required three named variants before a direction is committed, in `/design`
  step 3 and in `style-directions` §4,
- wired `DESIGN_VARIANCE` and `VISUAL_DENSITY` to checks instead of leaving them
  unreferenced next to `MOTION_INTENSITY`,
- moved the protect list, the linter manual, and the owner routing out of
  `anti-slop/SKILL.md` into `references/operations.md`, and the Tier-2 word list
  into `references/tier2-vocabulary.md`; the binding gate now spans both English
  files,
- added `/tweak` for a single scoped component: no direction, palette, or
  pattern skill, and a linter run instead of the tell catalogue for at most three
  changed text surfaces,
- compressed `core-rules` §3 into a gate table and cut §7 to the four checks no
  other skill owns.

**1.6.7** — an unread tree is not a clean tree:

- the copy linter no longer reports `PASS` over files it never read; nothing
  checked is `NO-COPY` with exit code 2, and a partial miss names the skipped
  files,
- added Vue, Svelte, Astro, and JSON message catalogues to the extractor; message
  ids are not linted,
- made `sentence-variation` advisory and raised its minimum sample to 10
  sentences, because it failed short factual copy,
- gave all 20 palettes a decorative `divider` token, validated as a role rather
  than a threshold, and stated plainly that a palette name is a direction rather
  than that product's tokens.

**1.6.6** — evidence-scoped routing claims and an executable Codex gate:

- replaced outcome language about proven/validated routing with the verifiable
  capability: provider-trace audits for selective skill loading,
- documented the exact two-trace historical evidence boundary,
- made the strict response schema valid for Codex Structured Outputs and added
  an offline recursive schema gate,
- credited single shell-wrapped Codex reader commands instead of dropping their
  file access from the trace,
- surfaced structured provider failures before secondary CLI diagnostics, and
- added `--provider-cli` for installations outside `PATH`.

**1.6.5** — required references and honest test scoring:

- moved mandatory reads to the point of use and aligned conflicting routing
  contracts,
- clarified that plan-only deliverables still write copy, and
- added repeated attempts plus per-case pass-rate thresholds.

**1.6.4** — locale-safe copy linting:

- replaced the implicit English default with per-file English/German detection
  from metadata, paths, and visible-text language signals,
- run both rule sets for mixed or inconclusive copy and emit an explicit warning
  for inconclusive detection,
- expose locale mode, per-file resolution, scores, and warnings in JSON output,
- added an unlabelled German regression fixture that reproduces the former false
  pass without relying on a `-de` filename.

**1.6.3** — release validation and Claude distribution repair:

- fixed the `anti-slop` frontmatter so Claude receives its name and trigger
  description instead of silently loading empty metadata,
- let the copy linter drain its JSON output before exiting, restoring the
  plugin-wide self-lint inside `validate-content.mjs`,
- made the deterministic validator reject unquoted flat-frontmatter values that
  contain YAML syntax,
- added GitHub validation for JavaScript syntax, content contracts, offline
  forward traces, Claude's strict parser, and tagged-release provenance,
- rejected path-only shell output as read evidence and passed requested models
  through to Codex live runs,
- made `plugin.json` the single Claude update-version source and pinned the npm
  Playwright fallback,
- documented the required third-party marketplace auto-update toggle for Claude
  Code.

**1.6.2** — forward contracts admit the routing gate:

- all five pre-existing cases now allow and require `anti-slop` plus
  `prose-tells.md`, because the 1.6.0 gate fires on any user-visible copy,
- the editorial case additionally requires `locale-de.md`, since its brief ships
  German copy; every other case forbids the annex to prove it stays unread,
- reference and token budgets rose by exactly what the newly authorized files
  cost, not by what a run happened to consume,
- documented that the live suite was already red on v1.5.3 for reasons unrelated
  to anti-slop, and that its routing varies between runs.

**1.6.1** — the copy contract measured against a live run:

- the `slop` forward case now runs `lint-copy.mjs` over the generated
  `copy.lines` instead of duplicating Tier-1 regexes in the fixture,
- `forbiddenTerms` scopes are required to be leaf paths; a subtree scope matched
  the model's own note that it had avoided the pattern,
- removed the bare em-dash assertion: the dash is a measured Tier-3 budget, not a
  pattern gate, and the fixture contradicted the skill it was testing,
- `validate-content.mjs` now rejects both mistakes, so neither can return,
- archived `tests/forward/traces/claude-slop.*` as the read evidence for the
  routing claim; it covers plugin-relative path resolution where the dashboard
  fixture covers the absolute form.

**1.6.0** — anti-slop for generated text and visual defaults:

- added the `anti-slop` skill with tiered prose tells, the 2026 visual tells no
  other skill owned, and a German locale annex,
- added `scripts/lint-copy.mjs`: a zero-dependency copy linter with tiers,
  register profiles, a reason-bearing protect list, and JSON output,
- added `tests/copy/` as the linter's regression gate, with slop and
  authentic-prose fixture pairs in English and German,
- `validate-content.mjs` now binds every linter rule to its reference, replays the
  fixtures, and fails when the plugin's own prose does not lint clean,
- added a routing gate: any user-visible copy activates `anti-slop`, independently
  of whether the claim ledger was in scope,
- added the `slop` forward case and a scoped `forbiddenTerms` contract that
  asserts Tier-1 patterns are absent from shipped copy, not merely named in the
  contract,
- `/audit` gained a deterministic copy-lint step and off-scale-spacing search;
  `/refresh` now lints copy that survives a visual redirection.

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
