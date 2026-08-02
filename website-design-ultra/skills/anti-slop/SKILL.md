---
name: anti-slop
description: "Detect and remove AI-slop in shipped websites — both the generated copy and the visual defaults. Use when writing or auditing headlines, subheads, feature blurbs, CTAs, state and demo copy, or when output looks machine-made: purple gradients, badge-above-H1, colored card strips, identical feature cards, uniform spacing. Owns the tell catalogue, the density budgets, the protect list, and the copy linter."
---

# Anti-Slop — Detection and Repair

Slop is a distribution problem, not a word problem. Every tell in this skill is
the statistically most likely choice a model makes when the brief did not
constrain it. Removing the word without replacing the decision produces bland
copy instead of slop, which is a different failure with the same cause.

Two independent defects hide under "slop":

1. **Empty form** — structure that carries no information: `It's not X, it's Y`,
   a triplet with two real items, a badge above an H1. This skill owns it.
2. **False content** — a claim without evidence. `content-design` owns it; its
   claim ledger is the single source of truth. Do not restate it here.

A page can pass this skill and still lie. Run both.

## 1. Required and conditional reading

[references/prose-tells.md](references/prose-tells.md) is required, not a menu
entry. Read it before producing output whenever this skill was loaded because
copy is written, rewritten, or audited — a headline, a subhead, a blurb, a CTA,
a label, a state message, or a demo string. A plan, a contract, or a "no code"
deliverable counts: deciding what a line will say is writing it, and the tells
live in the decision, not in the file format that carries it. `core-rules` §3
states the same gate in the same terms; this section exists so that the two
agree at the point where the file is actually opened. Judging that the task does
not need the tell catalogue is not one of the available decisions.

The other two references are conditional:

| Condition | Read |
|---|---|
| Layout, card, badge, spacing, dark-mode, or effect defaults are written or audited | [references/design-tells.md](references/design-tells.md) |
| The output or the audited material is German | [references/locale-de.md](references/locale-de.md), in addition to prose tells and never instead of them |

A visual refresh that changes no copy is the one case that loads design tells
alone.

## 2. Mode

State which mode you are in before producing output.

- **Detect** — report only. Name the tell, quote at most 125 characters, give the
  fix in a few words, and assign a tier. Change nothing.
- **Rewrite** — replace the decision, not the vocabulary. Every rewrite must be
  traceable to a fact the brief already contains. Inventing a concrete detail to
  escape a vague sentence is the worse failure.

## 3. Tier model

Escalation matters more than the list. A single flagged word is weak evidence; a
cluster is strong evidence.

| Tier | Content | Rule |
|---|---|---|
| **Tier 1 — Structural** | Rhetorical forms that carry no information | Always rewrite. No density threshold, no direction exception. |
| **Tier 2 — Vocabulary** | Words that are usually the average choice | Flag in cluster: 3 or more distinct Tier-2 hits per 200 words, or any hit inside an H1/H2. A single hit in body copy is not a finding. |
| **Tier 3 — Density** | Measurable rhythm and formatting budgets | Measure, then decide. Report the number, not an impression. |

Tier 2 is deliberately not a ban. `robust` is the correct word in a reliability
claim, `seamless` is the term of art for a marquee loop. Context decides, and
Tier 3 catches the case where every choice went the average way at once.

## 4. Tier-3 budgets

Tier 3 is register-dependent. Reference documentation legitimately uses dense
headings, bold term lists, and dashes as definition separators; a hero headline
does not. Pick the register before measuring:

| Register | Use for | Effect |
|---|---|---|
| `marketing` (default) | landing pages, heroes, feature sections, interface copy | full budgets below |
| `docs` | reference docs, changelogs, API pages, this plugin's own files | looser dash/heading limits; bold-lead and ornament checks off; triplet counting off |
| `editorial` | articles, essays, long-form narrative | stricter rhythm and heading limits than marketing |

The numbers below are lint heuristics, chosen so this plugin's own approved prose
passes and the catalogued slop fixtures fail — not published constants.
Recalibrate against your own approved copy and record the change.

| Budget | Default | Fails when |
|---|---|---|
| Em dash | ≤ 1 per 300 words of prose; never in a headline | used as the rhythm device instead of a comma or a period |
| Triplet | ≤ 1 per 200 words | a three-item list has two real items and a filler |
| Sentence-length variation | coefficient of variation ≥ 0.35 over any block of 10+ sentences | every sentence is the same length |
| Bold lead-in bullets | < 50% of items in a list | `**Term:** definition` is the shape of every row |
| Evaluative adjectives | ≤ 1 per headline, ≤ 1 per blurb sentence | adjectives carry the claim instead of nouns and verbs |
| Heading density | ≥ 40 words of prose per heading | headings replace paragraphs |

Two budgets are measured on prose only, because tables and definition lists have
no rhythm to judge: a dash inside a table cell or directly after a term at the
head of a list item is notation, and a heading that labels a data block is not a
section. The adjective budget has no automated check; count it by hand.

Sentence-length variation is **advisory**: the linter prints the coefficient and
never fails on it. Short factual copy — a price paragraph, a retry policy, a
shipping condition — is legitimately uniform, and gating on it rejected exactly
the specific, evidence-led writing §5 asks for. A low number is worth a second
read, not a blocked build.

## 5. Specificity floor — the positive rule

Prohibition alone yields correct, forgettable copy. Every headline, subhead, and
feature blurb must name at least one of:

- the audience, by role or situation,
- the mechanism — what the product actually does,
- a number with unit, scope, and date,
- a named object inside the product,
- an observable outcome the user can check.

Naming none of these is a finding regardless of vocabulary.

**Swap test:** replace the product name with a competitor's. If the sentence
stays true, it describes the category, not the product. This flags for review; a
deliberate category claim can survive it, an accidental one cannot.

Unknown facts stay as explicit placeholders. Never resolve a specificity finding
by inventing the specific.

## 6. Protect list

A protect list prevents the de-slop pass from flattening real voice or a real
product name. It is a declared artifact, not an assumption, and every entry
carries a reason — the same standard as a claim in the ledger.

```json
{
  "terms": [
    { "value": "Seamless", "reason": "product name, verified in package.json" },
    { "value": "robust", "reason": "reliability claim, engineering docs term" }
  ],
  "patterns": [
    { "value": "Not sure yet\\.", "reason": "founder voice, appears in approved copy" }
  ]
}
```

Store it as `.anti-slop-protect.json` at project root. An unexplained entry is
not a protect entry; it is a suppressed finding. Report collisions instead of
silently keeping the term.

## 7. Deterministic check

Self-reported de-slopping is not evidence, for the same reason a self-reported
skill route is not evidence of Progressive Disclosure. Run the linter:

```bash
node scripts/lint-copy.mjs --path src --profile marketing --protect .anti-slop-protect.json
node scripts/lint-copy.mjs --path content --profile editorial
node scripts/lint-copy.mjs --path content --locale de --profile editorial # explicit override
node scripts/lint-copy.mjs --stdin --json
```

The linter reads Markdown prose and the visible text of JSX/TSX, HTML, Vue,
Svelte, and Astro, plus the string values of JSON message catalogues — a
`locales/`, `i18n/`, `lang/`, `messages/`, or `translations/` path, or a file
named `en.json`/`de.json`. Message ids are not copy and are not linted. Other
JSON is skipped so config files cannot bury real findings. It skips code fences,
inline code, blockquotes, class attributes, and imports, and reports per tier
with counts, locations, and the measured numbers. Exit code 1 on any Tier-1 hit
or exceeded Tier-3 budget; `--strict` also fails on Tier-2 clusters. Its own
regression gate lives in `tests/copy/`: a rule change must still catch every slop
fixture and still flag nothing in the authentic-prose fixtures.

**`NO-COPY` and exit code 2.** When no file matched the path, or no visible text
could be extracted from any input, the status is `NO-COPY` and the exit code is
2 — never `PASS`. Copy built at runtime from a plain `.js` file, or held in a
format the extractor does not read, is unchecked, not clean. A partial miss is
reported as a `NO-COPY WARNING` naming the files that were skipped. Read that
warning before quoting a pass: it is the same failure mode as a self-reported
route, and it is the one this file exists to refuse.

With no `--locale`, the linter detects English or German per file. Declared
frontmatter/HTML language and locale-bearing path segments win; otherwise it
scores high-frequency function words in the visible copy, not the vocabulary it
is judging. Mixed files run both rule sets. An inconclusive file also runs both
and emits `AUTO-LOCALE WARNING`, so an omitted flag can never silently mean
English. Use `--locale en` or `--locale de` only as a deliberate override.

`--self` lints the plugin's own documents in the `docs` register and skips this
skill's reference files, which necessarily quote the patterns they forbid. That is
the only exemption, and it is the reason the exemption is stated here rather than
left implicit.

Known blind spots — a clean report is not their absence:

- fake-profound kickers, synonym cycling, and invented concept labels need a
  reader,
- the triplet count cannot tell three real items from two plus a filler, so it is
  a gate in `marketing` only and a number everywhere else,
- markup extraction is best effort and prefers missing a string over inventing a
  finding; what it missed shows up as a `NO-COPY WARNING`, not as a pass,
- sentence-length variation is advisory and decides nothing on its own,
- nothing here checks whether a claim is true.

A lint pass proves the absence of catalogued patterns. It does not prove the copy
is true, specific, or worth reading — only §5 and `content-design` do that. Never
report a lint pass as a content approval.

## 8. Output contract

Return:

1. mode (detect or rewrite),
2. findings by tier with location and the quoted trigger,
3. Tier-3 measurements as numbers,
4. rewritten copy or the marked placeholder, with the fact each rewrite rests on,
5. protect-list collisions,
6. the linter command and its result, or why it was not run.

## 9. Routing — do not duplicate an owner

This skill owns the catalogue, the budgets, the protect list, and the linter.
The fixes stay with their owner:

- fabricated claims, evidence ladder, state microcopy → `content-design`
- font bans and their documented exceptions → `typography`
- palette, gradients, contrast tokens → `color-palettes`
- generic hero, equal card rows, cursor and layout defaults → `core-rules` §5
- rotating cube, aimless particles, rigid loops → `immersive-3d` §4
- identical fade-ins, snapping buttons, timing ownership → `motion-system`
- three-cards-by-reflex versus a real pattern choice → `component-patterns`

## Check

- [ ] Mode was stated before output.
- [ ] Tier-1 hits are zero, not merely reduced.
- [ ] Tier-2 findings are clusters, not isolated words.
- [ ] Tier-3 budgets were measured and reported as numbers.
- [ ] Every headline and blurb clears the specificity floor.
- [ ] No rewrite invented a fact; unknowns stayed placeholders.
- [ ] Protect-list entries carry reasons; collisions were reported.
- [ ] The linter ran, or its absence was stated instead of implied.
- [ ] The status was `PASS`, not `NO-COPY`, and any skipped-file warning was read.
