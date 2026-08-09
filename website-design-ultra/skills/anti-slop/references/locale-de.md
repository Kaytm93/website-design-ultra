# Locale Annex — German

A slop catalogue does not translate. English tells map onto different German
forms, and German has high-frequency markers with no English equivalent. Load
this file in addition to [prose-tells.md](prose-tells.md) whenever German copy is
written or audited.

Text expansion, formatting, plural rules, and RTL behavior are owned by
`content-design` `references/localization.md`. This file covers only the slop
shapes.

## Tier 1 — Structural, always rewrite

Most of these are calques. German model output is rarely German slop invented
from scratch; it is an English tell carried across with the words translated and
the form left standing. That is why the shapes below name the frame rather than
the vocabulary, and why the English annex is not a translation source.

| Tell | Shape | Replace with |
|---|---|---|
| `Es ist nicht nur ein X, es ist ein Y` | Calque of `It's not just X, it's Y`. The doubled copula stages a reveal the second half does not deliver | The positive claim alone |
| `Mehr als nur ein X` | Defines the product by what it exceeds instead of by what it does | What it does |
| `Es ist wichtig zu beachten, dass …` / `spielt eine entscheidende Rolle` | Announces importance instead of stating it | The fact |
| `Entdecke, wie du …` | Invites discovery instead of naming the outcome | The outcome |
| `Tauche ein in …` | Metaphorical opener, direct calque of "dive into" | The action label |
| `Sag Tschüss zu X und Hallo zu Y` | Advertising formula with no content | The change, stated once |
| `… auf ein neues Level heben` / `auf die nächste Stufe` | Unbounded improvement claim | The measurable change |
| `In der heutigen schnelllebigen Welt …` | Scene-setting opener that dates nothing and names no one | The first sentence that carries a fact |
| `Ob Freelancer oder Konzern …` / `vom Startup bis zum Weltkonzern` | False range: two poles asserted as if they were coverage | The audience the product was actually built for |
| `revolutionieren die Art und Weise, wie …` | Category claim standing in for the mechanism | What the product does differently |
| `Viele Experten sind sich einig` | Borrowed authority, unsourced | A named source, or drop it |
| `Doch damit ist es nicht getan` / `Doch das ist noch nicht alles` | Transition that stages the next paragraph | Delete |
| Rhetorical question opener (`Was wäre, wenn …?`) | Asks the reader to supply the benefit | The assertion |
| `Fazit:` block on a short page | Recap the page does not need | Delete, or end on the action |
| `das volle Potenzial entfalten` | Unbounded outcome with no unit and no owner | The outcome the reader can check |
| Nominal style (`die Durchführung der Erstellung von`) | Chains of `-ung` nouns replacing verbs | Verbs: `erstellen`, `prüfen`, `exportieren` |
| Passive with no actor (`wird sichergestellt, dass`) | Hides who acts | Name the actor, or use the active form |

Linter rule ids for this table: `de:negative-parallelism`,
`de:more-than-just`, `de:importance-puffery`, `de:rhetorical-setup`,
`de:discovery-opener`, `de:metaphor-opener`, `de:ad-formula`, `de:next-level`,
`de:fast-paced-world`, `de:false-range`, `de:revolutionize-the-way`,
`de:vague-attribution`, `de:staged-transition`, `de:summary-recap`,
`de:actorless-passive`, `de:unlock-potential`. The em-dash tell carries
`de:english-em-dash` and is described under typography below. The nominal-style
row has no id: chains of `-ung` nouns need a reader, not a regex.

**Not a tell: `nicht nur … sondern auch`.** The correlative conjunction is
ordinary, informative German, and the second half normally carries the item it
promises. It was gated as Tier 1, which meant "always rewrite, no exception", so
the linter demanded that correct sentences be made worse. It is now deliberately
ungated. The tell is the first row above, where the negation is asyndetic and
the second half only restates the first with a larger noun.
`tests/copy/fixtures/clean-de-correlative.md` holds the correct use and must
stay a `PASS`; that fixture is what stops the rule from coming back.

## Tier 2 — Vocabulary, flag in cluster

Same threshold as English: 3 or more distinct hits per 200 words, or any hit in
an H1/H2.

**Verbs.** revolutionieren, eintauchen, vertiefen, unterstreichen, navigieren,
sicherstellen, gewährleisten, optimieren, transformieren, adressieren,
implementieren, priorisieren, erschließen, fördern, ermöglichen, entfesseln,
befähigen, kultivieren, kuratieren.

**Adjectives.** nahtlos, ganzheitlich, maßgeschneidert, facettenreich,
zukunftsorientiert, essenziell, inspirierend, bahnbrechend, beispiellos,
bemerkenswert, robust, dynamisch, innovativ, nuanciert, hochwertig, skalierbar,
effizient, unzählig.

**Nouns.** Paradigmenwechsel, Synergie, Mehrwert, Potenzial, Spektrum,
Bandbreite, Fundgrube, Leuchtturm, Dreh- und Angelpunkt, Baustein, Grundstein,
Wegbereiter, Kompass, Blaupause, Fahrplan, Expertise, Zusammenspiel,
Game Changer.

**Connective inflation.** darüber hinaus, ferner, folglich, letztendlich,
zweifellos, zweifelsohne, grundsätzlich, insbesondere, zunehmend. One per
section is normal; a chain of them is the tell.

As in English this is not a ban. `robust` in a load claim and `skalierbar` about
a measured architecture are correct. Record the exception in the protect list
with a reason.

## German-specific checks

**Register consistency.** Choose `du` or `Sie` once and hold it across
headlines, buttons, errors, legal text, and email. Mixed address is the most
visible machine tell in German interface copy, and it usually appears where
generated sections were assembled from different prompts.

**Denglisch in action labels.** `Jetzt starten` and `Kostenlos testen` are
German; `Get Started`, `Sign up now`, and `Book a Demo` inside an otherwise
German page are untranslated defaults. Keep a real English term when it is the
established word in the field (`Deploy`, `Commit`, `Repository`); replace it when
a normal German word exists.

**Coined compounds.** `Effizienzsteigerungspotenzial` and similar single-word
abstractions read as generated. Split into a verb phrase.

**Superlative inflation.** `die beste`, `die führende`, `einzigartig`,
`einzigartige Lösung` are competition-law relevant in Germany, Austria, and
Switzerland (§ 5 UWG covers misleading advertising) and require substantiation.
Treat an unsupported market-leadership claim as a fabricated claim under
`content-design`, not as a style issue.

**Quotation marks and typography.** Use „…" for German copy, not "…" or "…".
Use the correct dash: German prose uses the en dash with spaces (` – `), not the
em dash. An em dash in German copy is usually an untranslated English default and
counts as a Tier-1 formatting tell here rather than a budget item.

**Real umlauts.** ä, ö, ü, ß — never `ae`, `oe`, `ue`, `ss`, and never mojibake
from an encoding round-trip. Check rendered output, not source.

## Adding another locale

Before shipping copy in a language without an annex, produce one. The minimum is:

1. the structural tells, since rhetorical forms differ by language,
2. a Tier-2 vocabulary list with at least verbs, adjectives, and set phrases,
3. the register/formality decision and where it must stay consistent,
4. the punctuation and quotation conventions,
5. any advertising-law constraint on superlatives and comparative claims,
6. one worked rewrite example.

Copy translated from an English slop list is not an annex. Until an annex
exists, state that the locale is unchecked rather than implying it passed.
