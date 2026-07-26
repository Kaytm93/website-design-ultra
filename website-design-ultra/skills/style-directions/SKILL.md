---
name: style-directions
description: Select and apply a coherent website art direction. Use when the visual direction is unclear or named, including minimal, editorial, brutalist, glass, retro, organic, Apple-like, bento, Swiss, Y2K, cyberpunk, or Neo-Memphis. Load only the reference family containing the selected direction.
---

# Style Direction Router

Choose a direction from audience, content, brand voice, product risk, and interaction needs—not industry stereotypes alone.

## 1. Shortlist

| Signals | Candidate family |
|---|---|
| Product clarity, SaaS, consumer hardware, modular feature stories | [references/product.md](references/product.md) |
| Narrative content, culture, architecture, sustainability, premium editorial | [references/editorial.md](references/editorial.md) |
| Creative agency, music, gaming, youth, experimental brands | [references/expressive.md](references/expressive.md) |

Read only the selected family, then select one primary direction.

## 2. Controlled combinations

A secondary influence is allowed only when:

- its role is named, such as “Swiss grid” or “editorial type,”
- the primary direction still controls most decisions,
- tokens, motion, and component behavior remain coherent.

Do not combine two complete directions or change direction mid-output.

## 3. Selection questions

1. Is the interface primarily functional, narrative, commercial, or expressive?
2. How much content and interaction must fit above the fold?
3. Should users feel trust, speed, tactility, luxury, warmth, or disruption?
4. Does an existing brand system constrain type, color, imagery, or motion?
5. Would 3D communicate product form or story, or only decorate?

## 4. Commitment

State:

```text
Primary direction: …
Optional secondary influence: … (scope only)
Reason: …
```

Then use `content-design`, `color-palettes`, `typography`, `motion-system`, and `component-patterns` only for decisions the chosen direction actually requires. Use `core-rules`’ responsive recomposition reference for full pages and signature sections.

## Check

- [ ] Direction follows the brief and existing brand.
- [ ] Primary/secondary roles are unambiguous.
- [ ] Layout, type, surface, imagery, and motion tell the same story.
- [ ] Direction exceptions do not override accessibility or performance.
- [ ] Wide, portrait, and narrow views preserve the same thesis through deliberate reprioritization, reframing, or replacement.
