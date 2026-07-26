# website-design-ultra

## 1.6.0 — Anti-Slop for Generated Text and Visual Defaults (2026-07-26)

### The gap this closes

Until 1.5.3 the plugin's anti-slop surface was almost entirely visual. Text slop
was covered by a single sentence in `content-design`
(`references/claims-and-proof.md`) naming three words. A generated page could
therefore pass every existing gate — verified claims, validated contrast,
trace-proven routing, real responsive recomposition — and still read as machine
output in every headline. Copy is part of the design, so it now has the same
class of contract the color tokens have.

### New skill

- Added `anti-slop`, the 17th skill and the single source of truth for slop
  detection. It separates **empty form** (a rhetorical shape carrying no
  information) from **false content** (a claim without evidence, which stays with
  `content-design`), and states that a page can pass one gate and fail the other.
- `references/prose-tells.md` catalogues the Tier-1 structural forms with the
  website surface each appears on, the Tier-2 vocabulary, the formatting tells in
  rendered copy, and worked rewrites.
- `references/design-tells.md` adds the visual tells no other skill owned: badge
  above the H1, the colored card edge strip, icon-topped identical feature cards,
  numbered step rows, stat banners, emoji icon sets, all-caps micro-labels,
  untouched framework defaults, dark mode by reflex, plus measurable spacing,
  radius, type-scale and uniformity budgets and the squint test. Long-standing
  defaults stay in `core-rules` §5, fonts in `typography`, 3D in `immersive-3d`
  §4; the file routes to them instead of restating them.
- `references/locale-de.md` is a German annex, because a slop catalogue does not
  translate: `nicht nur … sondern auch`, `Es ist wichtig zu beachten`,
  `Tauche ein in`, nominal style, actorless passive, du/Sie register drift,
  Denglisch action labels, en dash instead of em dash, and § 5 UWG exposure on
  unsupported superlatives. Adding a further locale now has a stated minimum.

### Tiers instead of a blacklist

- Tier 1 structural forms are always rewritten. Tier 2 vocabulary is a finding
  only as a cluster or inside a heading, because `robust` in a reliability claim
  and `seamless` for a marquee loop are the correct words. Tier 3 budgets are
  measured and reported as numbers.
- Tier-3 sensitivity is register-dependent (`marketing`, `docs`, `editorial`). A
  reference document legitimately uses dense headings, bold term lists, and dashes
  as definition separators; a hero headline does not.
- A `.anti-slop-protect.json` exempts brand terms and signature phrasing. Every
  entry carries a reason, mirroring the claim ledger; an entry without one is
  reported as a suppressed finding rather than applied.
- Added a positive specificity floor, because prohibition alone produces bland
  copy: a headline must name an audience, mechanism, dated number, product object,
  or observable outcome, and an unknown fact stays a placeholder instead of being
  resolved by invention.

### Deterministic enforcement

- Added `scripts/lint-copy.mjs`, a zero-dependency linter over Markdown prose and
  JSX/HTML visible text, with tiers, register profiles, German inflection
  handling, protect list, JSON output, and exit codes.
- Rhythm budgets measure prose only. A dash inside a table cell, a dash directly
  after a term at the head of a list item, and a heading that labels a data block
  are notation, not rhythm — the first calibration pass produced 81 findings on
  the plugin's own documents, and every one of them was a measurement artifact of
  that kind rather than slop.
- Added `tests/copy/` as the linter's own regression gate: slop and
  authentic-prose fixture pairs in English and German, a JSX fixture, and one
  document linted under two profiles to prove the register decides the verdict.
- `scripts/validate-content.mjs` now binds the executable rules to their prose:
  an undocumented Tier-1 rule id or Tier-2 term fails the build. It replays the
  copy fixtures and fails when the plugin's own 57 documents do not lint clean.
  This caught real drift on the first run (`game-changer` versus `game changer`,
  a curly apostrophe, six undocumented German rule ids).
- Added the `slop` forward case and a scoped `forbiddenTerms` contract. Scoping
  matters: a contract may legitimately name the pattern it avoided, so the
  assertion runs against the `copy` subtree of the response, never the whole
  serialized answer.

### Routing and commands

- Added a routing gate in `core-rules` §3: any user-visible copy activates
  `anti-slop`, independently of whether `content-design` was in scope. A hero
  headline written during a layout task was previously ungated.
- `content-design` and `anti-slop` now state their split explicitly — evidence
  without form yields a truthful page that reads as generated; form without
  evidence yields fluent invention.
- `/design` gained a copy-form step and reports the lint result in its output.
  `/audit` gained a deterministic copy-lint step, an off-scale-spacing search, and
  two new "Never" rules: no single Tier-2 word as a finding, no lint `PASS`
  reported as content approval. `/refresh` now lints copy that survives a visual
  redirection.

### Notes

- The blind spots are documented rather than implied: fake-profound kickers,
  synonym cycling, and a triplet whose third item is filler need a reader, JSX
  extraction is best effort, and no lint result claims a line is true.
- Tier-2 lists stay in base form so they bind one-to-one to the references;
  inflection is handled in the linter.

Release-Tag: v1.6.0

---

## 1.5.3 — Codex Git Marketplace & Automatic Sync (2026-07-26)

### Codex distribution

- Added `.agents/plugins/marketplace.json` at the repository root. Codex can now
  install the plugin directly from `Kaytm93/website-design-ultra` as the
  `kay-design` Git marketplace.
- The marketplace points at the existing `website-design-ultra/` artifact, so
  Claude and Codex consume the same versioned plugin tree without a duplicate
  package.

### Automatic updates

- Added `scripts/sync-codex-marketplace.sh`, which refreshes the configured Git
  marketplace snapshot and reinstalls `website-design-ultra@kay-design`.
- Added `scripts/install-codex-sync.sh`, which installs and starts a user-level
  macOS LaunchAgent. It runs once when loaded and then hourly, logs under
  `~/Library/Logs/`, and needs no GitHub token for this public repository.

Release-Tag: v1.5.3

---

## 1.5.2 — Licensing, Distribution & One Language (2026-07-26)

### Licensing

- Added the MIT `LICENSE` file. Both manifests had declared `"license": "MIT"`
  without shipping the text, so the plugin was formally unlicensed. A ruleset
  that demands a verified license for every font file does not ship without one
  of its own.
- The license is present both at the repository root and inside
  `website-design-ultra/`, because the plugin folder is the distributed
  artifact and may travel on its own.

### Distribution

- Added `.claude-plugin/marketplace.json` at the repository root. The plugin can
  now be installed with `/plugin marketplace add <owner>/<repo>` instead of a
  manual folder copy.
- `project-vault/` was removed from version control and ignored. Private working
  notes are not part of the distributed product; the files stay on disk.

### Content correction

- Removed the vanilla Three.js sample scene from `immersive-3d` §6. It omitted
  the DOM alternative content, the WebGL-unavailable fallback, and the
  offscreen/`document.hidden` pause — all three declared mandatory two sections
  above it in the same file.
- §6 is now a written contract instead of a sample. A hero example is the code
  most likely to be copied unchanged, so a non-conforming one does more damage
  than no example at all. The reason is stated in the skill.

### Language

- The whole delivered surface is English now: `CHANGELOG.md`, the `.gitignore`
  comments, and the two German strings in `scripts/release.mjs`. The pre-version-
  control anchor is `Release-Tag: none`; the gate prints `predates version
  control`.

Release-Tag: v1.5.2

---

## 1.5.1 — Provenance & Proven Claude Provider (2026-07-26)

### Version control

- The project now lives in a git repository. Every changelog section anchors on
  a `Release-Tag` that must resolve in this repository; `scripts/release.mjs`
  resolves it to a commit and fails otherwise.
- A changelog cannot contain the SHA of the commit that introduces it. The
  anchor is therefore the tag name, which is known before the commit, and the
  SHA is resolved at verification time.
- The old placeholder that declared the SHA unavailable is now a hard validation
  failure. A ruleset that requires evidence for every claim does not carry an
  unverifiable provenance claim about itself.
- Sections that predate version control say so explicitly instead of claiming an
  unresolvable SHA.
- New: `pluginTreeDigest` — a reproducible sha256 over the plugin tree. A routing
  claim applies to a tree, not to a folder name.

### Claude provider

- Fixed two defects in the Claude trace path that would have scored the first
  real run incorrectly:
  - Plugin skills are invoked as `plugin:skill`. The old matcher accepted only
    `[a-z0-9-]+` and therefore dropped **every** `Skill` event; a correct run
    would have failed as "trace did not observe skill".
  - Paths were not bound to the plugin root under test. A read of the installed
    copy under `~/.claude/skills/...` counted as evidence about the tested tree.
    Such paths are now `offRootReads` and fail the case instead of confirming it.
- The Claude runner isolates the session with `--setting-sources ""` and
  `--strict-mcp-config`. Without isolation the run inherits the operator's own
  skills, CLAUDE.md, and MCP servers — including an installed copy of this
  same plugin.
- A missing or unauthenticated provider no longer aborts hard; it reports
  `UNAVAILABLE` with a reason, keeps the launch gate open, and exits 0.
  `--require-live` turns that into a failure in CI. Same contract as ADR-010
  for browser verification.
- `--trace-dir` archives the raw provider event stream per case. Recorded
  streams live under `tests/forward/traces/` and are replayed against the parser
  on every `--dry-run`, so the Claude path stays covered on machines without an
  authenticated CLI.
- Reports now include provider status, model, git provenance, and tree digest.

### Content defect found by the live run

- The first real `--provider claude` run of the `dashboard` case passed every
  trace condition but missed the contrast statement for `border`. The output
  instruction in `color-palettes` listed the pairs only as running prose. It now
  requires one named contrast statement per pair; an omitted pair is a gap, not
  brevity.
- After the fix: `PASS` with nine named contrast states.

Release-Tag: v1.5.1

---

## 1.5.0 — Trace-Proven Routing & Portable Verify (2026-07-25)

### Progressive disclosure with real evidence

- Moved the forward harness onto provider-side event traces: Claude `Read`/`Skill`
  events and Codex command reads are evaluated as actual file accesses.
- Every case declares allowed/forbidden files, a maximum reference count, and a
  deterministic plugin token budget (`ceil(bytes / 4)`).
- Broad content reads fail; so do self-reported skill routes without read
  evidence.
- The dashboard live case proves it: only `neutral-product.md`, no editorial or
  expressive palette, no broad reads, roughly 8.6k observed plugin tokens.
- Fixed two over-routes that the new trace made visible: `component-patterns`
  and `style-directions` no longer load by default for a dashboard whose
  function is already clear.

### Host-neutral browser verification

- New `scripts/verify-browser.mjs` adapter with a capability probe for session,
  `run-code`, and screenshots; no fixed `$CODEX_HOME` path anymore.
- A compatible Codex wrapper, a PATH CLI, or the npm CLI are accepted only after
  a successful probe; Claude Cowork can use its host browser capability.
- `/verify`, `/immersive`, `immersive-3d`, `3d-runtime-quality`, and the WebGPU
  matrix use `PASS | FAIL | UNAVAILABLE`.
- `UNAVAILABLE` delivers static evidence and an open capture matrix, but stays
  explicitly **unverified** and blocks launch readiness.
- Plan- or contract-only work uses `NOT_APPLICABLE (plan-only)` instead; the
  check becomes mandatory at the first executable build.

Release-Tag: v1.5.0 — applied retroactively on 2026-07-26 to the import commit of the delivered folder state. The tag documents exactly that state, not the intermediate steps that produced it.

---

## 1.4.0 — Content Truth, Responsive Recomposition & Forward Tests (2026-07-25)

### Content and responsive

- New `content-design` skill with separate references for the claim/proof ledger, interface microcopy, and localization/transcreation.
- Extended `core-rules` with a wide/portrait/narrow contract for real recomposition, reframing, reordering, replacement, and interaction changes.
- Updated routing in `/design`, `/immersive`, `/audit`, `/refresh`, component patterns, and style directions.

### Typography

- Rebuilt `typography` as a progressive-disclosure router.
- Pairings/roles, hierarchy/loading, and the license matrix load independently.
- Added a complete matrix of every recommended font family with commercial / free-proprietary / OS-restricted / OFL status and open-source alternatives.

### Validation and forward tests

- Extended palette contracts with `focus`, meaningful `border`, `danger`, `on-danger`, and `disabled`.
- The validator composites RGBA glass surfaces and borders in sRGB and checks every state contrast deterministically.
- Added a live harness with schema output and five representative cases for SaaS, editorial, dashboard, 3D hero, and configurator.
- Updated manifests and README to version 1.4.0 / 16 skills.

Release-Tag: none — this version predates version control. No commit documents it.

---

## 1.3.0 — 3D Direction, Runtime Quality & Visual Verify (2026-07-25)

### New mandatory layers

- `3d-art-direction`: camera/FOV, composition, lighting dramaturgy, material hierarchy, color pipeline, tone mapping, mobile reframing, and spatial typography.
- `3d-runtime-quality`: Poster/Low/Medium/High tiers, adaptive shadows, LOD, PostFX, particles, DPR, offscreen/visibility pause, and quality hysteresis.

### Interaction and renderer

- Extended `r3f-interaction` with a cancellable touch/gesture state machine: drag thresholds, pinch/zoom, pointer capture, `touch-action`, hover fallback, `pointercancel`, and `lostpointercapture`.
- Extended `shaders-tsl` with a maintained feature matrix covering WebGPU, the `WebGPURenderer` WebGL2 fallback, TSL postprocessing, compute dependency, and known limitations.

### Verification

- New `/verify` command renders a real URL, photographs desktop, mobile, reduced motion, and the disabled WebGPU/WebGL fallback, and requires actual visual inspection.
- The validator checks 15 skills, 5 commands, and the new Priority-1 contracts.
- Updated manifests and README to version 1.3.0.

Release-Tag: none — this version predates version control. No commit documents it.

---

## 1.2.1 — Correctness & Progressive Disclosure (2026-07-25)

### Defects corrected

- Next.js App Router: `ssr: false` now lives in a small client wrapper component instead of `app/page.tsx`.
- R3F compatibility is no longer described as a blanket "v9 + React 18/19"; installed versions must be verified.
- glTF Transform: replaced the valid but unspecific KTX2 shortcut with an explicit ETC1S/UASTC decision path; `inspect` and `validate` are mandatory.
- Separated WebGL `@react-three/postprocessing` from WebGPU/TSL postprocessing.
- The scroll camera uses delta-based damping instead of a fixed-factor `lerp`.
- Lenis/GSAP uses one ticker with cleanup; `scrollerProxy` is reserved for real proxy scrollers.
- Updated Motion for React to `motion` / `motion/react`.
- Added GLTF cloning and material/geometry/render-target lifecycle.
- Corrected canvas accessibility: no interactive controls under `role="img"`; a duplicated canvas view may be `aria-hidden`.

### Ruleset consolidated

- New hierarchy: invariants → defaults → justified direction exceptions.
- Pure black, several supporting colors, centered Apple heroes, and font pairings no longer contradict blanket hard bans.
- One dominant action color remains mandatory; additional colors are decorative or semantic.
- Removed `transition: all`.
- UI states are selected by behavior instead of being forced onto every static component.

### Token efficiency

Large skills are now routers with on-demand `references/`:

- `style-directions`: product / editorial / expressive.
- `color-palettes`: neutral-product / editorial-natural / expressive.
- `motion-system`: profiles / Motion React / GSAP scroll.
- `component-patterns`: heroes / bento-cards / navigation-forms-overlays.
- `ui-states`: async / forms-feedback / accessibility.
- `r3f-patterns`: Next.js / performance-assets.
- `r3f-interaction`: hotspots-camera-text / configurator-animation.

Skill descriptions were shortened and redundant `metadata.version` blocks removed. The plugin version lives only in the manifests.

### Packaging

- Claude manifest at `1.2.1`.
- Codex manifest extended with three starter prompts.
- README updated to dual-host installation, correct commands, and the new reference structure.
- A deterministic validator checks skill frontmatter, reference paths, manifest versions, outdated patterns, and all 20 palette contrasts.

Release-Tag: none — this version predates version control. No commit documents it.

---

## 1.2.0 — Interactive 3D

Release-Tag: none — this version predates version control. No commit documents it.

13 skills + 4 commands. Every `SKILL.md` carries `metadata.version: "1.2.0"`, matching the plugin version. YAML validated.

## Installation

```bash
# Backup
cp -R ~/.claude/skills/website-design-ultra ~/Desktop/wdu-backup-$(date +%F)

# Replace skills and commands (adjust the download path)
cp -R ~/Downloads/website-design-ultra/skills/.   ~/.claude/skills/website-design-ultra/skills/
cp -R ~/Downloads/website-design-ultra/commands/. ~/.claude/skills/website-design-ultra/commands/

# Raise the version in the manifest: "version": "1.2.0"
open -e ~/.claude/skills/website-design-ultra/.claude-plugin/plugin.json

claude plugin validate ~/.claude/skills/website-design-ultra --strict
```

Then run `/reload-plugins` in a session, followed by `claude plugin details website-design-ultra` — expected: **17 components** (13 skills + 4 commands).

---

## New: skill `r3f-interaction`

Makes 3D touchable. Events and raycasting (`stopPropagation`, `<Bvh>`, `raycast={null}`, `onPointerMissed`) · **keyboard parity is mandatory** · hotspots via `<Html>` · camera states with `easing.damp3` · configurator variants · GLTF clips with cross-fade · text in 3D space.

Wired into `immersive-3d` (§2 stack table, §7 routing), `core-rules` (§3), `motion-system`, `r3f-patterns`, and the `/immersive` command.

## Extended: `r3f-patterns`

Next.js integration (`dynamic` with `ssr: false`, `'use client'` in the scene instead of the page, one global canvas plus `<View track>` instead of several canvases) and robustness (`webglcontextlost`, canvas accessibility as the single source of truth, `leva` in development only).

## Dedupe: single sources of truth

| Rule | Single source |
|---|---|
| `prefers-reduced-motion`, focus rings, contrast | `ui-states` §6 |
| Reduced motion and 2D fallback for 3D | `immersive-3d` §5 |
| 3D performance budget | `immersive-3d` §3 |
| Anti-slop 3D | `immersive-3d` §4 |
| 3D stack selection | `immersive-3d` §2 |
| Color prohibitions | `core-rules` §4 |
| Font prohibitions | `typography` |
| One animation library per tree | `core-rules` §6 |
| Canvas accessibility (`role="img"`) | `r3f-patterns` |

Every other location only points at these. The TSL cheatsheet is now a pure syntax reference.

## Two contradictions resolved

1. **Inter** — allowed as **body** text in brutalist/editorial/Swiss/magazine-tech, prohibited as **display/hero** in a premium context. The exception lives in `typography`.
2. **Purple** — direction D (glassmorphism): slate-950 → teal-900 → cyan-950 instead of indigo → purple.

## Commands brought in line

The commands still carried the duplicates that were removed from the skills.

**`/immersive`** — now routes to `r3f-interaction`; new step 7 "interaction and keyboard parity"; the three rules in the "never" block (fallbacks, library mixing, uncompressed models) are references to `immersive-3d` §4/§5 and `core-rules` §6 instead of separate wording; the color rule points at `core-rules` §4.

**`/audit`** — new 3D layer (`immersive-3d`, `r3f-patterns`, `r3f-interaction`) that applies only when 3D is present; greps for `useFrame`/`<Canvas>` and pointer handlers; missing keyboard parity is always 🔴 critical; the purple ban now points at `core-rules` §4 instead of `color-palettes`; the blanket `font-inter` grep no longer reports blindly but distinguishes body from display.

**`/refresh`** — "drop Inter, drop purple" replaced by references to `typography` and `core-rules` §4 including the body-Inter exception; a 3D refresh must not lose fallbacks or keyboard parity.

**`/design`** — routes to `/immersive` when the briefing calls for 3D.

## Token cost

Previously roughly 1,351 always-on tokens across 16 components. `r3f-interaction` adds roughly 110 tokens → about 1,460.

The lever remains the on-invoke part: an ordinary design request fires `core-rules` + `style-directions` + `component-patterns` + `motion-system` + `ui-states` ≈ **11k tokens**. Progressive disclosure for `component-patterns` (~3k) and `color-palettes` (~1.5k) — index table in `SKILL.md`, details moved to `references/` — would save roughly half of that.

## Still open

- Progressive disclosure for `component-patterns` and `color-palettes`
- Font licensing notes (PP Mori, PP Editorial, Berkeley Mono, Helvetica Now are commercial)
- Verification loop after output (connection to `plan-design-review`)
- `README.md` in the plugin root: probably still says 12 skills and 4 commands — not inspectable, please update it yourself
- Optional: `r3f-physics` (`@react-three/rapier`)
