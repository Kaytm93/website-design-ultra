---
name: content-design
description: Shape evidence-led website content and interface copy. Use for content hierarchy, messaging, headlines, real claims, proof, CTAs, labels, helper/error text, empty states, trust copy, localization, transcreation, or audits of invented and vague marketing language. Load only the relevant reference.
---

# Content Design Router

Make the interface’s promise, proof, and next action understandable before polishing prose. Preserve verified user content unless the brief authorizes rewriting.

## Read only what the task needs

| Need | Read |
|---|---|
| Claims, evidence, proof hierarchy, testimonials, metrics | [references/claims-and-proof.md](references/claims-and-proof.md) |
| Buttons, forms, errors, empty states, consent, status copy | [references/microcopy.md](references/microcopy.md) |
| Multiple locales, translation, transcreation, expansion, formats | [references/localization.md](references/localization.md) |

Load multiple references only when the deliverable genuinely crosses those concerns.

This skill owns whether a sentence is *true and useful*. Whether its form is the
average machine choice is owned by `anti-slop`, which holds the tell catalogue,
the density budgets, and the linter. Both gates apply to shipped copy: evidence
without form yields a truthful page that reads as generated, form without
evidence yields fluent invention.

## Core workflow

1. Identify audience, job, user stage, verified facts, unknowns, primary action, and risk.
2. Build the page hierarchy as `promise → mechanism → evidence → objections → action`.
3. Mark every claim as verified, qualified, illustrative, or unknown.
4. Draft plain, specific copy at the required level of confidence.
5. Test the hierarchy without imagery or animation.
6. Stress-test relevant UI states and locales before final layout.

## Invariants

- Never invent customers, testimonials, awards, security/compliance status, integrations, performance numbers, prices, dates, or product capabilities.
- Keep unknown facts as explicit placeholders such as `[verified metric needed]`; do not turn them into plausible prose.
- Distinguish real product data from illustrative demo content in the interface.
- Keep the accessible name and visible label aligned.
- State errors in task language and provide a possible next step when one exists.
- Do not encode meaning only in idiom, color, icon, motion, or wordplay.
- Preserve source content and legal meaning across locales; transcreate tone only within approved constraints.

## Output contract

Return:

1. content hierarchy and primary action,
2. a claim/proof ledger with unknowns,
3. final copy or clearly marked placeholders,
4. applicable state microcopy,
5. localization notes and stress strings when relevant.

## Check

- [ ] The first screen communicates one primary promise and action.
- [ ] Every factual claim maps to evidence or is visibly qualified.
- [ ] Labels predict outcomes; errors explain recovery.
- [ ] Empty/loading/success copy reflects real state, not theatre.
- [ ] Dates, numbers, names, and text expansion survive supported locales.
- [ ] `anti-slop` ran over the final copy; a vague sentence was not repaired by
      inventing a specific.
