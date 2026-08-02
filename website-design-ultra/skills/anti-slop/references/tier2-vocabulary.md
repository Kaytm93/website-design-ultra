# Tier-2 Vocabulary — English

The words below are findings only as a cluster: 3 or more distinct hits per 200
words, or any hit inside an H1/H2. `SKILL.md` §3 owns the threshold; this file
owns the list.

Read it when a Tier-2 cluster is judged by hand — no linter run available, a
protect-list decision on a flagged term, or an audit that has to name the words
rather than count them. `scripts/lint-copy.mjs` carries the same list
executably, so a linted surface does not need this file. The German list stays
in [locale-de.md](locale-de.md).

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
correct. Record such uses in the protect list with a reason; the schema lives in
[operations.md](operations.md).
