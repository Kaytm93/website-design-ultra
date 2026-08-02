# website-design-ultra

## 1.7.0 — A Page Declares Its Composition (2026-08-02)

Two gaps, one on each side of the plugin. On the cost side, the minimum copy
path was 7,604 tokens of mandatory reading before a button label could be
written. On the quality side, a 3D scene had to declare its camera, safe area,
and poster frame before scene code, while a 2D page declared nothing: its
composition was whatever the first component written happened to imply.

### The 2D composition contract

- Added `core-rules/references/composition-contract.md` with seven fields:
  `visual-thesis`, `focal-element`, `first-screen-occupancy`, `asymmetry`,
  `dominant-contrast`, `quiet-zones`, `signature-move`. It loads under the same
  condition as the responsive contract.
- The two contracts answer complementary questions. Recomposition says what
  changes across wide, portrait, and narrow; this one says what must survive all
  three. If a narrow shot loses both the thesis and the signature move, it is a
  different page rather than a recomposition.
- `/design` step 5, `/refresh` step 2, `/audit` step 3, and `component-patterns`
  route to it. `validate-content.mjs` binds all seven field names.

### Directions carry tokens, and Tier 3 measures against them

- All 12 style directions gained a token block in the same YAML shape as the
  palettes: `grid`, `type-ratio`, `space-scale`, `section-padding`, `radius`,
  `dominant-contrast`, `motion-profile`.
- The validator requires one block per direction, all seven keys, and a
  `motion-profile` that `motion-system` actually defines. It counts 12.
- The Tier-3 visual budgets in `anti-slop` design tells now measure against the
  declaration when one is filled and against the generic defaults otherwise.
  Y2K and Neo-Memphis declare three radii and are conformant; an undeclared
  three-radius page still fails the two-radius budget. Before this change, Tier 3
  measured every page against a default, so an intentional direction and an
  unconstrained one produced the same finding.
- The per-direction `Avoid` bullets moved into `anti-slop/references/design-tells.md`
  as a Direction-specific tells table. The catalogue has one owner; the direction
  references now carry the token block in that space.

### Signature moves

- Added `style-directions/references/signature-moves.md`: 20 implementable
  devices, each with the directions it suits and the invariant it must not break.
- `component-patterns` has required "one signature pattern per viewport" since
  1.0 without defining a signature anywhere. This file is that definition, and
  both `component-patterns` and the composition contract now point at it.

### Divergence before commitment

- `/design` step 3 and `style-directions` §4 require three named variants before
  a direction is chosen: one line each, differing in composition rather than in
  palette, then a choice with the constraint the other two failed.
- This is the plugin's own thesis applied to itself. Slop is the statistically
  most likely choice when the brief did not constrain, and reading a shortlist
  and taking the closest row is exactly that shape. Every other gate had a
  counter-measure; the direction choice had none. It costs roughly zero tokens.

### The profile values are wired or they are decoration

- `DESIGN_VARIANCE: 7` and `VISUAL_DENSITY: 4` sat in `core-rules` §1 and were
  referenced nowhere; only `MOTION_INTENSITY` was used. Each now names what
  verifies it: variance against the ≤ 60% uniformity budget plus two deliberate
  grid breaks, density against `space-scale` and `section-padding` in the
  direction's token block.

### A cheaper minimum path

- `anti-slop/SKILL.md` fell from 12,280 to 9,320 bytes. The protect list, the
  linter manual, and the owner routing moved to `references/operations.md`, and
  the Tier-2 word list to `references/tier2-vocabulary.md`. The tier model, the
  budgets, and the specificity floor stayed inline, as did the three rules that
  decide a lint result: exit 2 is `NO-COPY`, a partial miss warns, a pass is not
  a content approval.
- The binding gate in `validate-content.mjs` now reads both English files.
  Splitting a reference must not let a Tier-2 term go undocumented; all 85 terms
  stay bound.
- `core-rules` §3 became a gate table, and §7 dropped from eleven items to the
  four no other skill owns. Restating each skill's own Check list produced a
  second copy that drifts.
- Measured: the minimum copy path (`core-rules` + `anti-slop` + prose tells) fell
  from 7,604 to 6,590 estimated tokens. That is 13%, not the 25% projected before
  the composition wiring was counted; §1 and §6 gained what §3 and §7 released.

### /tweak

- Added a sixth command for one scoped component, where direction, palette, and
  pattern are already decided. It skips `style-directions`, `color-palettes`,
  and `component-patterns` by default, and with at most three changed text
  surfaces it runs the linter instead of reading the tell catalogue.
- That substitution is a shift from reading to execution, not a lower standard:
  the linter fires 12 of the 16 English Tier-1 tells with rule ids. It does not
  cover the four that carry no id or the specificity floor, so a changed H1,
  subhead, or feature blurb still loads `anti-slop` and its prose reference.
- The path costs about 2,500 tokens against 7,604.

### Forward contracts

- All six cases authorize `operations.md` and `composition-contract.md`; `saas`,
  `editorial`, and `dashboard` require the composition contract as read evidence.
  `slop` additionally authorizes `tier2-vocabulary.md`, since a copy case may
  judge a cluster by hand.
- Reference and token budgets moved by exactly the difference the new
  authorizations and the shrunken files produce, not by what a run happened to
  consume.

### Not in this release

The `signature-move` field has no deterministic check. A page can declare one and
implement nothing, and no script can see the difference. `/verify` screenshots
plus the squint test remain the only evidence, which is the same boundary the
specificity floor has always had.

Release-Tag: v1.7.0

## 1.6.7 — An Unread Tree Is Not a Clean Tree (2026-08-02)

A review of 1.6.4 found three defects that survived into 1.6.6. One of them
inverted the plugin's own standard: the copy linter reported `PASS` on files it
had never read.

### The linter no longer passes what it did not read

- `LINT: PASS — 0 file(s)` and a pass over files that yielded no extractable
  text are both gone. The status is `NO-COPY` and the exit code is 2, which is
  the "could not check" code, not the green one. A partial miss prints a
  `NO-COPY WARNING` naming every skipped file.
- Reproduced before the fix: a Svelte project and a `locales/de.json` bundle
  each returned `PASS — 0 file(s)` with exit 0, and a Three.js page whose copy
  is built in plain `.js` returned `PASS` over five files and zero words.
- Added `.vue`, `.svelte`, and `.astro` to the extractor, routed through the
  markup path with an Astro frontmatter strip and a class-attribute strip.
- Added JSON message catalogues: string values only, from a `locales`, `i18n`,
  `lang`, `messages`, or `translations` path, or an `en.json`/`de.json` file.
  Message ids are not copy and are not linted — gettext-style catalogues use
  the English source string as the id, so reading keys would report the source
  language of a translated file. All other JSON is skipped so config files
  cannot bury real findings.
- `tests/copy/` gained three fixtures and a `forbiddenRules` assertion that
  guards the extractor's boundary rather than only its reach: Tier-1 patterns
  hidden in Svelte `<script>`/`<style>` blocks, English Tier-1 patterns used as
  German message ids, and a runtime-built page that must report `NO-COPY`.

### Sentence-length variation is advisory

- The rule failed on short, factual, specific copy — a price paragraph, a retry
  policy — which is exactly the writing §5 asks for. It is measured and printed,
  and it no longer decides an exit code.
- Its minimum sample rose from 5 sentences to 10.

### Palettes ship the divider they told you to create

- All 20 palettes gained a `divider` token. `border` stays the 3:1 boundary that
  carries meaning; `divider` is the decorative rule, and WCAG sets no minimum
  for it.
- The validator enforces the role rather than a threshold: a divider must be
  visible (≥ 1.1) and must be quieter than that palette's border. 282 state
  contrast checks, up from 242.
- The palette references now say plainly that a brand name is the direction, not
  that product's token file, and that `border` is louder than the hairline those
  interfaces actually ship.

### Not in this release

Light and dark remain separate palettes rather than a paired token set. Pairing
20 palettes across two modes is design work with 240 new contrast obligations,
not a mechanical edit, and several directions are deliberately single-mode.

Release-Tag: v1.6.7

## 1.6.6 — Evidence-Scoped Routing Claims (2026-07-29)

The public manifests described minimal routing as trace-proven or
trace-validated. The repository, however, commits only two historical Claude
event streams: `dashboard` from 1.5.1 and `slop` from a dirty 1.6.1 candidate
whose manifest still read 1.6.0. Neither trace covers the current tree, the other
four cases, Codex, or routing stability. Version 1.6.5 also records that repeated
live attempts still vary.

### Public claim and evidence boundary

- Replaced the unqualified routing-outcome claim in both plugin manifests, the
  Claude marketplace entry, and the README introduction with the verifiable
  capability: a provider-trace harness for selective-loading audits.
- Renamed the Claude manifest keyword from `trace-validated-routing` to
  `provider-trace-auditing`.
- Documented the two committed fixtures with their historical scope. Dry runs
  now print provider, case, plugin version, tree digest, and file count for each
  replay before listing the current six case contracts.
- Added a deterministic content gate that rejects `trace-proven` and
  `trace-validated` outcome wording on current public surfaces, keeps the README
  lead version aligned with both manifests, and requires the evidence-scope
  disclosure.

### Live-harness repair

- Corrected the strict response schema: the root now requires `copy`, and
  `copy` requires both `lines` and `slopChecks`. Codex Structured Outputs had
  rejected the previous schema before inference while both offline gates passed.
- Added a recursive strict-schema validator to the dry run and content
  validation. Every object must forbid additional properties and require every
  declared property.
- Fixed Codex trace parsing for a single reader wrapped as
  `/bin/zsh -lc "sed …"`. The opening quote was not recognized as a command
  boundary, so a real file read disappeared unless a second reader followed it.
- Provider failures now prefer terminal JSONL `error` or `turn.failed` events,
  unwrap nested API messages, and append stderr as secondary diagnostics. A
  harmless warning can no longer hide the actual schema or API failure.
- Added `--provider-cli` so installations outside `PATH` can select one
  executable consistently for version, authentication, and the live run.
  Unknown authentication-probe failures now fail closed as `UNAVAILABLE`.

This release makes the routing differentiator inspectable without presenting an
auditing mechanism or a historical replay as proof of current stable behavior.

Release-Tag: v1.6.6

---

## 1.6.5 — Required References and Honest Test Scoring (2026-07-29)

Version 1.6.3 passed one of six forward cases. The roughly twenty findings were
almost all missed *references* rather than missed skills — `prose-tells.md`
three times, `responsive-recomposition.md` twice — so skills were being routed
correctly while their mandatory references were treated as a menu.

### The reference gate

- Rewrote `anti-slop` §1 so the prose reference is stated as required at the
  point where the file is opened, not only in `core-rules` §3.
- Separated the base layer from the add-ons in `immersive-3d` §2, and added the
  `anti-slop` copy gate to `/immersive`, which had none.
- Marked the contract blocks in `3d-art-direction` and `3d-runtime-quality` as
  schemas whose values live in the references, so the block could no longer be
  mistaken for the answer.
- Promoted the responsive contract to its own required step in `/immersive`.
- Scoped the `color-palettes` description to actual color decisions. "dashboards,
  landing pages" had pulled the skill into every landing-page task.

### Plan-only deliverables still write copy

The `anti-slop` gate fires when user-visible copy is "written, rewritten, or
audited". Three cases ask for a plan and say "not final code", so under a literal
reading no copy is written and the gate did not fire — while the contracts
required it anyway. Emphasis was not the problem: the section already said
"required, not a menu entry" and was still skipped.

All four copies of the gate now state that deciding what a line will say is
writing it, and that "no code" limits the format of the deliverable rather than
the tells inside it.

This is the one change in this release with repeated before-and-after evidence.
`saas` and `3d-hero` both went from not reading `prose-tells.md` to reading it,
and held across the two runs after the change.

### Test contracts corrected

Four cases demanded behaviour their own rules forbid, or forbade behaviour the
rules license:

- `saas` required `component-patterns`, which both `core-rules` §3 and
  `/design` step 7 exclude for landing-page planning by name.
- `editorial` forbade `microcopy.md` while naming a subscription action, which
  `content-design`'s own table routes to that file.
- `slop` capped the run at 9000 estimated tokens while the references the same
  contract marked allowed cost 11040. The case could satisfy every routing rule
  and still fail.
- All six token budgets were calibrated against a smaller tree; headroom had
  drifted to between +0.8% and +8.9%. They are now the allowed-set ceiling plus
  five percent, so the budget measures routing rather than file growth.

`core-rules` §3 also read "Style exploration/direction is explicitly requested",
which pulled `style-directions` into any brief naming a direction, while
`/design` said only "explicitly requested style exploration". Both now agree
that a named direction is an input.

### Pass rate replaces the single attempt

Three full runs of the suite returned 0/6, 3/6 and 3/6, and the set of passing
cases changed every time: `saas` passed the second run and failed the third,
`3d-hero` did the reverse. At those rates a six-case all-or-nothing gate goes
green a few percent of the time regardless of routing quality, so it cannot
separate a regression from a reroll.

`run-forward-tests.mjs` gained `--repeat N` and `--min-pass-rate`. Cases are
scored by pass rate, and the summary distinguishes failures reproduced across
attempts from single-attempt noise. The defaults reproduce the previous
behaviour, now documented as a smoke test rather than as proof.

### What is not fixed

Three cases still fail intermittently, and this release does not claim
otherwise:

- `3d-hero` drops `responsive-recomposition.md` in roughly one run in three.
  Making it a required step did not stabilize it.
- `configurator` reports five touch decisions but does not name where
  `setPointerCapture` is taken; it covers capture loss only.
- `ui-states` and `color-palettes` intermittently activate in cases that do not
  request them. Whether those are routing errors or contracts that are stricter
  than the documented rules is unresolved.

No case has passed three consecutive runs. The pass-rate mode exists to measure
that honestly rather than to hide it.

Release-Tag: v1.6.5

---

## 1.6.4 — Locale-Safe Copy Linting (2026-07-28)

The copy linter previously treated an omitted `--locale` as English. A German
file could therefore contain catalogued German Tier-1 forms and still print
`LINT: PASS`, even though no German rule had run.

### Locale contract

- Replaced the implicit English default with per-file locale detection.
  Frontmatter, HTML language metadata, and locale-bearing path segments take
  precedence; otherwise the linter scores high-frequency English and German
  function words in the extracted visible copy.
- Mixed-language files run both rule sets. Inconclusive files also run both
  rule sets and emit an `AUTO-LOCALE WARNING` instead of silently implying
  language coverage.
- Kept `--locale en`, `--locale de`, and repeated/comma-separated values as
  explicit overrides for deliberately scoped runs.
- Added the resolved locale, detection source, scores, and warnings to JSON
  output so automation can audit which language contract actually ran.

### Regression evidence

- Added an unlabelled German slop fixture so content detection, rather than a
  `-de` filename, must select the German rules.
- The exact omitted-flag reproduction now returns 8 German Tier-1 findings and
  3 Tier-2 findings instead of a false pass.

Release-Tag: v1.6.4

---

## 1.6.3 — Release Validation & Claude Distribution Repair (2026-07-27)

Version 1.6.2 reached `main` with two release-blocking defects: Claude could not
parse the new `anti-slop` frontmatter, and the deterministic self-lint lost part
of its JSON report during process termination. The repository also documented a
Claude marketplace install without the third-party auto-update step required to
keep that install current.

### Runtime and validation fixes

- Quoted the `anti-slop` description containing `machine-made: ...`, so Claude's
  YAML parser keeps the skill metadata instead of dropping it.
- Replaced the linter's immediate `process.exit(...)` with `process.exitCode`.
  The process now drains the full plugin-wide JSON report before terminating,
  and `validate-content.mjs` can parse the self-lint again.
- Extended the flat-frontmatter validator to reject unquoted values containing
  YAML-significant colon or comment syntax. The exact metadata defect that
  escaped 1.6.2 is now a deterministic failure.
- Stopped treating a shell command that merely prints a plugin path as Codex
  read evidence, and added a negative parser regression for that case.
- Passed `--model` through to Codex live runs instead of recording a requested
  model that the provider never received.
- Required recorded trace fixtures to carry a semantic plugin version and a
  valid tree digest. The fixtures remain historical parser evidence; a dry run
  still makes no claim about current model behavior.

### Repository and distribution hardening

- Added a GitHub Actions workflow for JavaScript syntax, content validation,
  Claude's strict plugin parser, recorded forward-trace replay, and strict
  provenance checks on version tags.
- Documented that Claude Code disables auto-update for third-party marketplaces
  by default and that `kay-design` must have auto-update enabled after install.
  The repository is public, so this path needs no GitHub token.
- Removed the duplicate version from the marketplace entry; the Claude plugin
  manifest is now the single update-version source, while the Codex manifest is
  checked against it.
- Replaced the source file's literal NUL digest separator with the equivalent
  JavaScript escape, pinned the npm Playwright fallback, and ignored generated
  browser-verification output.

### Scope

This patch does not claim that the live forward suite is green. The documented
SaaS, editorial, and 3D routing failures and run-to-run variability remain open;
offline replay proves parser compatibility only.

Release-Tag: v1.6.3

---

## 1.6.2 — Forward Contracts Admit the Routing Gate (2026-07-26)

The 1.6.0 gate fires on any user-visible copy, so `anti-slop` and
`prose-tells.md` now appear in every case that writes copy. The five contracts
written before the gate existed reported that correct behavior as an unexpected
skill and an unexpected reference. The contracts were stale, not the routing.

### Contract updates

- `anti-slop` is allowed and **required** in all six cases. Five live runs
  confirmed the gate fires, so this is an evidenced assertion rather than an
  aspiration.
- `prose-tells.md` is allowed and required for the same reason.
- The editorial case additionally requires `locale-de.md`, because its brief
  ships German copy. Every other case forbids the annex, which turns the locale
  rule into a proof instead of a hope.
- `design-tells.md` is allowed in the build cases and forbidden only in the
  copy-only `slop` case. An earlier pass forbade it everywhere, and the dashboard
  run correctly read it for a visual layout — the contract was wrong, not the run.
- Reference and token budgets rose by exactly what the newly authorized files
  cost (`anti-slop` 2423 + `prose-tells` 2080, plus 1435 for the annex and 1400
  for the design catalogue where authorized). They were not raised to whatever a
  run consumed; a budget tuned until green measures nothing.

### What this release deliberately does not fix

The live suite was already failing on **v1.5.3**, before `anti-slop` existed.
Recorded against that tag with the same model and effort:

- `saas`: `component-patterns` is required but not routed.
- `editorial`: `style-directions`, `editorial.md`, and `microcopy.md` load
  unexpectedly, 7 references against a budget of 5, 8833 tokens against 8500, and
  the OFL/licensing signal is missing.
- `3d-hero`: `camera-and-composition.md`, `tier-matrix.md`, and
  `responsive-recomposition.md` are required but unread, while `r3f-interaction`
  and `configurator-animation.md` load unexpectedly.

Repeated runs of the same case also route differently, so `allowedSkills` and
`forbiddenFiles` fail intermittently on their own. Both problems predate this
work and neither is addressed here. Raising a budget or deleting an assertion to
hide them would convert a real finding into a green check, which is the failure
mode this suite exists to prevent. They need their own release.

Release-Tag: v1.6.2

---

## 1.6.1 — The Copy Contract, Measured Against a Live Run (2026-07-26)

The first live `--provider claude --case slop` run failed, and both failures were
defects in the contract rather than in the output. The generated copy was clean and
the routing was trace-correct: exactly `core-rules`, `content-design`, `anti-slop`
plus `prose-tells.md`, with the design and locale references untouched, no broad
reads, no off-root reads, 8606 plugin tokens against a 9000 budget.

### Two contract defects, both now impossible

- `forbiddenTerms` was scoped at the `copy` subtree, which also carries the
  model's own tier report. The run failed on `/\bget started\b/` because the
  response explained that its CTA was "Start a transcription", *not* "Get
  started". Punishing that honesty is the opposite of the intent. Scopes must now
  be leaf paths, enforced in both the runner and `validate-content.mjs`.
- The pattern list contained a bare em dash, so any dash anywhere in the copy
  failed the case. The skill itself permits one per 300 words of prose and forbids
  it only in headings. The fixture therefore contradicted the rule it was testing.
  A flat regex cannot express a Tier-3 budget, so it no longer tries.

### One source of truth for the catalogue

- Added `lintCopy` to the forward-case contract: the case runs
  `scripts/lint-copy.mjs` over the model's `copy.lines` with a register profile and
  locale. The eval now enforces the rules the project enforces, rather than a
  second copy of them that drifts.
- `forbiddenTerms` keeps a narrower job: the case-specific extras the linter
  deliberately does not gate, such as a weak `Get started` CTA or the founder's
  own `premium` and `innovative` reaching the page.
- `validate-content.mjs` fails if the slop case restates a pattern that already
  exists as a linter rule.

### Evidence

- Archived `tests/forward/traces/claude-slop.jsonl` and its expectation file. Both
  recorded traces now replay on every `--dry-run`. The new fixture exercises
  plugin-relative path resolution, where `claude-dashboard` exercises the absolute
  `{{PLUGIN_ROOT}}` form.
- The re-run passed with the same routing and token profile, which is the first
  measured — rather than asserted — evidence that the 1.6.0 routing gate works.

Release-Tag: v1.6.1

---

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
