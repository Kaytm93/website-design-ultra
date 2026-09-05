# Contracts

The anti-slop contract and the Priority-2 contracts in full. `README.md`
carries the short version.

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
