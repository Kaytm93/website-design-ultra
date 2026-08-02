# Signature Moves

`component-patterns` requires one signature pattern per viewport and never says
what a signature is. This file answers that: a specific, implementable device
that a viewer could describe afterwards without naming a component library. The
difference between a competent page and a memorable one is almost always a
single such device, chosen deliberately.

Read this file when a composition contract needs its `signature-move` field, or
when a direction has been selected and the page still reads as a template. Pick
one per viewport. Two signature moves on one screen cancel each other, which is
why the invariant column matters as much as the device.

## The catalogue

| Move | Direction | Device | Invariant it must not break |
|---|---|---|---|
| Rule-line spine | Swiss, Refined Minimalism | One hairline runs the full width behind the headline; every later section snaps to it | Decorative, so it uses the `divider` token and never carries state |
| Type-scale jump | Editorial, Brutalist | A single word in the deck is set at headline size, the rest at body size | Heading levels stay semantic; the jump is CSS, not a heading tag inside a paragraph |
| Overprint | Editorial, Brutalist | The headline overlaps the image edge by about one stem width | Contrast is measured against the darkest region under the overlap, not the average |
| Column drop | Swiss, Editorial | One block starts two grid rows below its neighbour and never realigns | Source order still reads top to bottom; the offset is alignment, not DOM reordering |
| Numeric anchor | Product, dashboard | One verified number at display size, with unit, scope, and date beside it at caption size | The number is in the `content-design` claim ledger; no unit and scope, no move |
| Edge bleed | Glass, Organic, Editorial | Proof media runs past the viewport edge instead of into a rounded card | Nothing essential sits in the bled region, and the crop is art-directed per viewport |
| Single-object stage | Apple-like, Glass | One object, generous surround, everything else below the fold | The first screen still shows the primary action or a real scroll affordance |
| Settle reveal | Product, Apple-like | Rows or points resolve once on load, in one direction, then hold | Reduced motion renders the settled state directly; one timing owner per subtree |
| Loaded marquee | Brutalist, Cyberpunk, Retro-Futuristic | The moving strip carries dated or live content rather than logos | Pausable, stopped under reduced motion, and present in the DOM when still |
| Hard-cut boundaries | Brutalist, Neo-Memphis | The full-bleed background flips per section with no transition | Each background carries its own validated contrast pair |
| Instrument frame | Retro-Futuristic, Cyberpunk | Corner ticks, coordinate labels, and a measurement rail around the content | Decorative and hidden from assistive tech; never the only label of a control |
| Chromatic split | Cyberpunk | One element's color channels offset by one or two pixels | Never on body text, never on a focused element, never as a hover default |
| Sticker layer | Y2K, Neo-Memphis | Three to five rotated elements on a layer above the grid | Non-interactive, and never above a focus ring or inside a touch target |
| Single chrome object | Y2K | Exactly one element receives the full bevel and reflection treatment | The action color stays flat so the primary action is still the loudest element |
| Outline illustration | Neo-Memphis, Brutalist | Stroke-only shapes, no fills, one accent color | The shapes carry no information the text does not already state |
| Growth easing | Organic | Entrances decelerate over 400 to 700ms with no overshoot | Inside the `motion-system` duration table, and interruptible |
| Caption-first pairing | Editorial | The caption sits above its image at the text column's width | Real figure and caption markup; the caption is metadata, not a label |
| Density inversion | Bento, dashboard | The most important cell is the emptiest one | The emptiness is the emphasis, so its content still answers the section's question |
| Weight-only hierarchy | Refined Minimalism | One type size, three weights, no scale change | Heading levels stay semantic and the declared type ratio still applies |
| Tabular rail | Product, Swiss | A right-hand column of tabular figures locked to the grid | Tabular numerals are set explicitly, and real data uses table markup |

## Selecting one

1. Take the direction's token block. The move has to be expressible in it; a
   sticker layer inside a two-radius Swiss block is a direction change, not a
   signature.
2. Take the composition contract's `dominant-contrast`. The move should carry
   that axis rather than open a second one.
3. Name the invariant in the same sentence as the move. A signature that needs
   its invariant relaxed is a different decision and goes through the rule
   hierarchy in `core-rules`.
4. Check the narrow viewport before committing. Overprint, column drop, and the
   instrument frame all lose their point below roughly 480px and need a declared
   replacement in the recomposition contract.

A move used on every page of a site stops being a signature and becomes the
house style, which is the correct outcome. A move used twice on one page was
never a signature at all.
