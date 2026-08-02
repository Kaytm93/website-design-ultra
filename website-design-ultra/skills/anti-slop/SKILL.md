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

The other references are conditional:

| Condition | Read |
|---|---|
| Layout, card, badge, spacing, dark-mode, or effect defaults are written or audited | [references/design-tells.md](references/design-tells.md) |
| A Tier-2 cluster is judged without a linter run, or a flagged term needs a protect-list decision | [references/tier2-vocabulary.md](references/tier2-vocabulary.md) |
| Findings are reported, the linter is operated beyond §6, a protect list is written, or a fix is routed to its owner | [references/operations.md](references/operations.md) |
| The output or the audited material is German | [references/locale-de.md](references/locale-de.md), in addition to prose tells and never instead of them |

A visual refresh that changes no copy is the one case that loads design tells
alone. A single label or state message on a linted surface is the one case that
loads no reference beyond prose tells.

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

The visual Tier-3 budgets live in `references/design-tells.md`. They are measured
against the direction's declared token block when `style-directions` filled one,
and against the stated defaults otherwise. A deliberate three-radius brutalist
page is a declaration, not a finding; an undeclared one is still a finding.

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

## 6. Deterministic check

Self-reported de-slopping is not evidence, for the same reason a self-reported
skill route is not evidence of Progressive Disclosure. Run the linter:

```bash
node scripts/lint-copy.mjs --path src --profile marketing --protect .anti-slop-protect.json
```

Three rules govern the result and stay here rather than in the reference:

- Exit code 2 is `NO-COPY`, not a pass. Nothing was read, so nothing was checked.
- A partial miss prints a `NO-COPY WARNING` naming the skipped files. Read it
  before quoting a pass.
- A pass proves the absence of catalogued patterns. It never approves content;
  only §5 and `content-design` do that.

Registers, locale detection, the protect-list schema, and the catalogued blind
spots live in [references/operations.md](references/operations.md). Twelve of the
16 English Tier-1 tells carry a rule id; the other four need a reader, and a
clean report is not their absence.

## 7. Output contract

Return:

1. mode (detect or rewrite),
2. findings by tier with location and the quoted trigger,
3. Tier-3 measurements as numbers,
4. rewritten copy or the marked placeholder, with the fact each rewrite rests on,
5. protect-list collisions,
6. the linter command and its result, or why it was not run.

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
