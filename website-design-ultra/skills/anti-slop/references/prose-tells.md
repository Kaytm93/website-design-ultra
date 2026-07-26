# Prose Tells — Website Copy

Every entry names the surface where it appears on a website, why the form is
empty, and what replaces it. Tier-3 budgets live in `SKILL.md` §4; do not
restate them here.

## Tier 1 — Structural, always rewrite

| Tell | Shape | Why it is empty | Replace with |
|---|---|---|---|
| Negative parallelism | `It's not a CMS. It's a workflow.` | The negation carries the emphasis; the positive half is unconstrained | The positive claim alone, with the mechanism |
| Triple negation | `Not faster. Not cheaper. Better.` | Two discarded items exist only to stage the third | The third item, stated once |
| Colon reveal | `The result: fewer meetings.` | Dramatises an ordinary sentence | One sentence with a verb |
| Throat-clearing | `Here's the thing.` `Let's be honest.` | Announces speech instead of speaking | Delete; lead with the point |
| Faux-insight setup | `Most teams get this wrong.` | Invents a consensus to disagree with | The claim, standing alone |
| Rhetorical question | `What if onboarding took minutes?` | Asks the reader to supply the benefit | The benefit, as an assertion |
| Superficial-analysis clause | `…, highlighting the need for clarity.` | A trailing `-ing` clause that restates the subject | Delete, or name the consequence |
| Importance puffery | `plays a pivotal role`, `is a testament to` | Asserts significance instead of showing it | The observable fact |
| Vague attribution | `experts agree`, `studies show`, `it's widely known` | Borrowed authority with no source | A named source, or drop the claim |
| False range | `From solo founders to global enterprises` | A spectrum with no middle, chosen for rhythm | The one segment you actually serve |
| Fake-profound kicker | A closing aphorism after the last real point | Ends on mood instead of an action | The primary action, or the last concrete fact |
| Summary recap | `In summary`, `Overall`, a closing block restating the page | The page is not long enough to need it | Delete |
| Audience flattery | `for builders like you`, `teams who care about craft` | Flatters instead of qualifying | The role, situation, or job to be done |
| Both-sides hedging | `It can be powerful, though it depends` | Avoids the claim while appearing balanced | The bounded claim, or the named trade-off |
| Synonym cycling | `platform` → `solution` → `ecosystem` for one thing | Variation for its own sake breaks reference | One noun, repeated |
| Invented concept label | `Contextual Alignment Layer™` for an ordinary feature | A capitalised label instead of a definition | The plain description of what it does |

Linter rule ids for this table, as they appear in a report:
`en:negative-parallelism`, `en:more-than-just`, `en:triple-negation`,
`en:throat-clearing`, `en:faux-insight`, `en:rhetorical-setup`,
`en:superficial-analysis`, `en:importance-puffery`, `en:vague-attribution`,
`en:false-range`, `en:summary-recap`, `en:audience-flattery`,
`en:unlock-potential`, `en:next-level`, `en:fast-paced-world`,
plus the surface rules `em-dash-in-heading`, `emoji-in-heading`, and
`emoji-in-ui-label`. Tells with no id — the fake-profound kicker, both-sides
hedging, synonym cycling, invented concept labels — need a human reader; a regex
cannot see them. Do not read a clean report as their absence.

## Tier 2 — Vocabulary, flag in cluster

Flag at 3 or more distinct hits per 200 words, or any hit inside an H1/H2.

**Verbs.** delve, leverage, utilize, facilitate, foster, empower, unlock,
streamline, harness, supercharge, elevate, transform, revolutionize, navigate
(figurative), underscore, showcase, curate, ensure, drive (figurative), dive into.

**Adjectives.** seamless, robust, cutting-edge, innovative, holistic,
comprehensive, bespoke, effortless, powerful, intuitive, transformative,
unparalleled, world-class, next-generation, crucial, vital, pivotal, intricate.

**Nouns.** paradigm shift, game changer, tapestry, landscape (figurative),
ecosystem (figurative), journey (figurative), synergy, cornerstone, blueprint,
roadmap (as metaphor), testament, potential, deep dive, treasure trove.

**Filler phrases.** it's worth noting, at the end of the day, in today's
fast-paced world, at its core, let's dive in, take it to the next level, unlock
the full potential, the key to success, more than just.

**Hedges that weaken a real claim.** really, just, simply, actually, truly,
literally, genuinely, fundamentally, essentially.

Three of these — *delves*, *underscores*, *showcasing* — are the highest-excess
style words measured in post-2022 biomedical abstracts against a pre-LLM
baseline (Kobak et al., *Science Advances* 2025). They are strong signals in any
register.

Not a ban. `robust` in a reliability claim, `ecosystem` about an actual
integration graph, and `seamless` as the term of art for a marquee loop are all
correct. Record such uses in the protect list with a reason.

## Formatting tells in rendered copy

These are copy decisions, not CSS. Route the visual versions to
[design-tells.md](design-tells.md).

- Emoji inside headings, buttons, or nav labels.
- `**Term:** definition` as the shape of every list row.
- Mid-sentence bold used for emphasis rather than for a scannable term.
- Unicode arrow and sparkle decoration (`→`, `✨`, `▸`) as ornament.
- A heading above every two-sentence block.
- Title Case On Everything, or ALL CAPS micro-labels on every section.
- Sentence fragments as a rhythm device: `Fast. Reliable. Yours.`

## Surface-specific rules

**Hero headline.** One outcome, for one audience. No em dash. No badge text that
repeats the headline. Fails if it survives the swap test by accident.

**Subhead.** Names the mechanism the headline claims. Not a second headline, not
a list of three adjectives.

**Feature blurb.** Capability → user consequence → evidence pointer. One
sentence may carry one evaluative adjective; the rest must be nouns and verbs.

**Primary CTA.** The outcome of pressing it: `Start a transcription`, not `Get
started` or `Unlock your workflow`. `Continue` only when the next step is
unambiguous from context.

**Proof block.** A metric needs unit, scope, and date. A quote needs a named
person and permission. An anonymous quote imitating social proof is a Tier-1
fabrication, owned by `content-design`.

**Empty and error states.** State the condition and the next step. No jokes, no
apology theatre, no invented cause. Owned by `content-design`
`references/microcopy.md`; this file only flags the slop shapes.

**Demo and placeholder content.** Label it as illustrative in the interface.
Fictional customer names that read as real are a fabrication, not a placeholder.

**Footer and trust copy.** No certification, compliance status, or award without
a verifiable source.

## Rewrite examples

| Slop | Repaired | What changed |
|---|---|---|
| `More than just a note-taker — it's your team's second brain.` | `Turns a recorded call into a Markdown file with owners and due dates.` | Negative parallelism and metaphor replaced by the mechanism |
| `Seamlessly unlock the full potential of your meetings.` | `Every call is transcribed in German or English, then exported to Markdown.` | Three Tier-2 words replaced by two verified capabilities |
| `Trusted by teams who care about craft.` | `[verified customer reference needed]` | Flattery replaced by an explicit unknown, not by a plausible substitute |
| `Our platform leverages cutting-edge AI to streamline workflows.` | `It writes the action items you would otherwise type after the call.` | Category prose replaced by an observable outcome |
| `Ready to transform how your team works?` | `Start a transcription` | Rhetorical setup replaced by the action label |

## Rewrite protocol

1. Name the tier and the surface before touching the sentence.
2. Find the fact the sentence was standing in for. If the brief has none, write a
   placeholder — never a plausible invention.
3. Rewrite once. Do not re-polish; a second pass drifts back to the average.
4. Re-check the specificity floor in `SKILL.md` §5. A sentence with zero Tier
   hits and zero specifics is still a finding.
5. Read the page as a sequence of decisions and delete any line that neither
   sets an expectation, explains a state, proves a claim, nor helps the next
   action.
