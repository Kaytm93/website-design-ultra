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

Read only the selected family, then select one primary direction. Each direction
in those files carries a token block: grid, type ratio, space scale, section
padding, radii, dominant contrast, and motion profile. That block is what
`anti-slop` measures the built page against, so it belongs in the output.

[references/signature-moves.md](references/signature-moves.md) is a fourth
reference, not a fourth family. Read it after the direction is chosen, when a
page or signature section needs its one memorable device. Skip it for a single
component.

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

## 4. Divergence before commitment

This step exists because the direction choice is where this plugin's own thesis
applies to itself. Slop is the statistically most likely option when the brief
did not constrain, and reading a shortlist and picking the closest row has
exactly that shape with nothing arguing against it. Every other gate in the
plugin has a counter-measure; until now this one had none.

Before committing, write three named variants, one line each:

```text
A / <direction> + <signature move>: what the first screen looks like
B / <direction> + <signature move>: what the first screen looks like
C / <direction> + <signature move>: what the first screen looks like
```

The three have to differ in composition and layout, not in palette alone. Then
choose one and state what the other two lose against this brief. A variant
rejected as "less fitting" was never a real alternative: name the constraint it
failed, such as content volume, brand system, reading order, or device context.

For a single component or a system that already declares its direction, skip to
§5 and say which existing decision made the divergence unnecessary.

## 5. Commitment

State:

```text
Primary direction: …
Optional secondary influence: … (scope only)
Token block: … (from the direction reference, with any adaptation named)
Signature move: … (device plus the invariant it keeps)
Reason: … (including why the two rejected variants lose)
```

Then use `content-design`, `color-palettes`, `typography`, `motion-system`, and `component-patterns` only for decisions the chosen direction actually requires. Use `core-rules`’ responsive recomposition and composition-contract references for full pages and signature sections.

## Check

- [ ] Direction follows the brief and existing brand.
- [ ] Three variants were written and two were rejected against a named constraint, or the skip was justified.
- [ ] Primary/secondary roles are unambiguous.
- [ ] The token block is filled and any deviation from the reference is stated.
- [ ] One signature move is named per viewport, with the invariant it respects.
- [ ] Layout, type, surface, imagery, and motion tell the same story.
- [ ] Direction exceptions do not override accessibility or performance.
- [ ] Wide, portrait, and narrow views preserve the same thesis through deliberate reprioritization, reframing, or replacement.
