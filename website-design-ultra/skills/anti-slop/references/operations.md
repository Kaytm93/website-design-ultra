# Anti-Slop Operations — Protect List, Linter, Owner Routing

Read this file when findings are reported, when the linter is operated beyond
the single command in `SKILL.md`, when a protect list is written or contested,
or when a fix belongs to a different skill. Writing one line of copy does not
need it; auditing a page and reporting the result does.

## Protect list

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

## Operating the linter

Self-reported de-slopping is not evidence, for the same reason a self-reported
skill route is not evidence of Progressive Disclosure. `<plugin-root>` resolves
as in `SKILL.md` §6.

```bash
node "<plugin-root>/scripts/lint-copy.mjs" --path src --profile marketing --protect .anti-slop-protect.json
node "<plugin-root>/scripts/lint-copy.mjs" --path content --profile editorial
node "<plugin-root>/scripts/lint-copy.mjs" --path content --locale de --profile editorial # explicit override
node "<plugin-root>/scripts/lint-copy.mjs" --stdin --json
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
route, and it is the one this catalogue exists to refuse.

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
is true, specific, or worth reading — only the specificity floor and
`content-design` do that. Never report a lint pass as a content approval.

## Coverage of the deterministic layer

Of the 16 Tier-1 prose tells, 12 carry a linter rule id and fire without a
reader. The remaining four — the fake-profound kicker, both-sides hedging,
synonym cycling, and invented concept labels — have no id, and a clean report is
not evidence that they are absent. The German split is tighter: 17 of the 18
tells carry ids, and nominal style needs a reader.

This is the boundary that decides when a linter run may replace reading the
catalogue. It may where the deterministic rules cover the surface — a handful of
labels, a button, a state message. It may not where the judgment is the point: a
hero headline, a page audit, or any rewrite that has to find the fact the
sentence was standing in for.

## Routing — do not duplicate an owner

This skill owns the catalogue, the budgets, the protect list, and the linter.
The fixes stay with their owner:

- fabricated claims, evidence ladder, state microcopy → `content-design`
- font bans and their documented exceptions → `typography`
- palette, gradients, contrast tokens → `color-palettes`
- generic hero, equal card rows, cursor and layout defaults → `core-rules` §5
- rotating cube, aimless particles, rigid loops → `immersive-3d` §4
- identical fade-ins, snapping buttons, timing ownership → `motion-system`
- three-cards-by-reflex versus a real pattern choice → `component-patterns`
- a declared direction token block that a Tier-3 budget contradicts →
  `style-directions`; the declaration wins when it is filled and justified
