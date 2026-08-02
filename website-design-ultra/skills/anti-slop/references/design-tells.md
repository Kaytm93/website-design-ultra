# Design Tells — Visual Defaults

This file contains only the tells that no other skill owns. The long-standing
defaults — centered marketing hero, equal three-card rows, a card around every
block, arbitrary glass, AI purple/pink gradients, uncontrolled glow, pure black,
Inter as a display face, custom cursors — stay in `core-rules` §5 and
`typography`. 3D versions stay in `immersive-3d` §4. Motion sameness stays in
`motion-system`.

## Tier 1 — Structural, always rewrite

**Badge above the H1.** A small pill (`✨ Now in beta`, `Introducing v2`) parked
directly over the headline. It is the single most repeated generated hero
component. Either the badge carries news the headline does not — then it belongs
in the page as a real announcement — or it goes.

**Colored edge strip on cards.** A 3–4px left or top border in the accent color
on every card. The most reliable single visual tell. Reserve a colored edge for
semantic state (error, warning, selected); never for decoration.

**Icon-topped identical feature cards.** A centered line icon, a bold two-word
title, two lines of body, repeated across a row with identical weight. The
uniformity is the tell, not the icon. Give the strongest item more area, or drop
the card container entirely.

**Numbered 1 · 2 · 3 step row.** A three-column row of circled numerals as the
default process visual, even when the process has two or five steps, or no
sequence at all.

**Stat banner row.** Four numbers in a full-width band, disconnected from the
claim they support. Put each number next to the sentence it proves, with unit,
scope, and date.

**Emoji as an icon set.** Emoji in navigation, sidebars, feature lists, or
buttons instead of a consistent icon system.

**All-caps micro-labels everywhere.** `FEATURES`, `HOW IT WORKS`, `PRICING`
letterspaced above every section. One deliberate eyebrow label is a choice;
seven is a template.

**Serif-italic accent word.** A single italic serif word inside an otherwise
sans headline, used as the only typographic idea on the page. Commit to a real
pairing instead — see `typography`.

**Decorative monospace.** Monospace for headings, labels, or marketing copy to
signal "technical". Reserve it for code, identifiers, and tabular figures.

**Gradient-filled big numbers.** A gradient clipped to large numerals or a
metric. The number is the content; the gradient is noise.

**Untouched framework defaults.** `rounded-2xl shadow-lg p-6` on every card,
stock shadcn neutral grey with Tailwind blue as the action color, or a starter
template shipped with only the copy swapped. Framework defaults are a starting
point, not a direction.

**Dark mode by reflex.** Dark chosen because generated pages are dark, not
because the content, brand, or viewing context calls for it. If dark is right,
say why once — and check body text against `color-palettes`, since mid-grey on
near-black is the usual companion failure.

**Bento by reflex.** A bento grid selected before knowing whether the content has
items of genuinely different weight. See `component-patterns`.

## Direction-specific tells

Each named direction has one failure mode that only appears inside it, and it is
the one a generated page reaches for. These moved here from
`style-directions/references/` so the catalogue has a single owner; the
directions themselves now carry a token block instead.

| Direction | The tell |
|---|---|
| Refined Minimalism | Anonymous monochrome with no distinctive content idea — restraint standing in for a decision. |
| Glass / Liquid | Unreadable composited contrast, and the generic purple mesh gradient behind the panel. |
| Apple-like Product Precision | Copied Apple trade dress, or SF fonts called on platforms that do not license them. |
| Bento Feature Engine | Every feature becomes an animated rounded rectangle of equal weight. |
| Editorial / Magazine | Generic text-over-image instead of type and image composed together. |
| Organic / Natural | Greenwashing clichés, and decorative blobs that carry no content meaning. |
| Brutalist / Raw | Illegibility presented as experimentation. |
| Y2K | Reproducing genuinely inaccessible Web 1.0 behavior rather than quoting its look. |
| Cyberpunk | Neon on black with no hierarchy underneath it. |
| Neo-Memphis | Shape energy that breaks reading order, touch targets, or content clarity. |

## Tier 3 — Measurable defaults

Report these as numbers, not impressions.

Measure against the direction's declared token block when `style-directions`
filled one, and against the defaults below otherwise. A brutalist page that
declares `radius: [0, 2, 24]` has three radii by intent and passes; the same page
without a declaration fails the radius budget. The declaration has to be filled
and justified — an empty schema is not a defence, and no declaration overrides an
accessibility or performance invariant.

| Budget | Default | Fails when |
|---|---|---|
| Spacing scale | every value a multiple of 8, with 4 as the half-step | arbitrary values appear (`p-[13px]`, `mt-[37px]`, `gap-[19px]`) |
| Radius set | at most 2 radii across the page, plus `full` for pills | one radius on every element regardless of size or role |
| Type scale | one ratio, stated once (for example ×1.25 for apps, ×1.333 for editorial) | sizes are picked per component |
| Section rhythm | vertical padding varies by section role | hero, content, and CTA carry identical padding |
| Uniformity | no more than 60% of blocks share the same container recipe | every block is the same box with different text |
| Measure | 60–80 characters for body text | full-width paragraphs at desktop |

Grouping order before reaching for a border: whitespace first, then a 3–5%
background-lightness shift, then soft elevation. Add a line only when all three
fail. This extends `core-rules` §6, which prefers whitespace and grouping over
cards.

## The squint test

The cheapest diagnostic for machine-made composition, and the one code review
cannot perform.

1. Render the page and capture a full-page screenshot — use `/verify`.
2. Scale it to roughly 200px wide, or blur it heavily.
3. Look for a focal point.

If every section reads as the same grey rectangle at thumbnail size, hierarchy is
missing regardless of how the individual components look. A generated page
usually fails here while passing every component-level check.

Also verify at thumbnail size:

- one element dominates the first screen,
- section boundaries are visible without reading,
- the primary action is locatable by shape and weight alone,
- the page does not repeat one rhythm from top to bottom.

## Audit sequence

1. Screenshot first. Do not audit visual slop from source code alone.
2. Squint test for hierarchy.
3. Walk the Tier-1 list against the screenshot.
4. Measure the Tier-3 budgets in the token and utility layer.
5. Route each finding to its owner: fonts → `typography`, color and contrast →
   `color-palettes`, hero and card recipes → `component-patterns`, motion →
   `motion-system`, 3D → `immersive-3d` §4, a contested Tier-3 measurement →
   `style-directions`, which owns the token block it is measured against.
6. Report the count per tier and the measured numbers.

A design that clears every tell is not automatically good. It is only free of the
average choice — the direction still has to be a choice, made in
`style-directions` or by the existing brand system.
