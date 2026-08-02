# Editorial Directions

Each direction carries a token block. It is a declaration, not a preset: the
Tier-3 budgets in `anti-slop` design tells measure the built page against these
numbers when they are filled, and against the generic defaults when they are
not. Adapt the values to the brief and state what changed.

The failure mode specific to each direction moved into
`anti-slop/references/design-tells.md`, which owns the tell catalogue. Pick a
signature device from
[signature-moves.md](signature-moves.md) once a direction is chosen.

## Editorial / Magazine

- **Best for:** portfolios, publications, fashion, heritage storytelling.
- **Layout:** multi-column rhythm, pull quotes, image/caption relationships.
- **Type:** expressive display serif plus readable sans body.
- **Color:** Editorial Cream or Morandi Muted.
- **Motion:** restrained reveals and page-like transitions.
- **Hero:** type and image compose together.

```yaml
grid: "12col, text 6, figure 5, one gutter reserved for captions"
type-ratio: 1.333
space-scale: [4, 8, 16, 24, 40, 64, 104]
section-padding: { hero: 104, content: 72, cta: 48 }
radius: [0]
dominant-contrast: "scale, 5.2x between display serif and body"
motion-profile: jakub
```

## Organic / Natural

- **Best for:** sustainability, wellness, food, outdoor brands.
- **Layout:** irregular but calm spacing, soft geometry, tactile imagery.
- **Type:** humanist serif or soft grotesk.
- **Color:** Forest ESG or Organic Earth.
- **Motion:** slow, low-amplitude, pendular or growth-inspired.
- **Hero:** product/place photography plus restrained organic form.

```yaml
grid: "8col, irregular, alternating 5/3 and 3/5"
type-ratio: 1.25
space-scale: [4, 8, 16, 28, 44, 72, 112]
section-padding: { hero: 112, content: 72, cta: 44 }
radius: [16, 48]
dominant-contrast: "color, one saturated accent against a muted field"
motion-profile: jhey
```

## Swiss / International

- **Best for:** architecture, photography, cultural institutions, premium B2B.
- **Layout:** rigorous modular grid, visible alignment, left-biased hierarchy.
- **Type:** disciplined grotesk with tabular/mono detail where useful.
- **Color:** Swiss International.
- **Motion:** minimal and functional.
- **Hero:** number/type/image with explicit grid tension.
- **Exceptions:** true black and strict symmetry are valid when intentional.

```yaml
grid: "12col, strict, left-biased 8/4, visible baseline"
type-ratio: 1.333
space-scale: [8, 16, 24, 32, 48, 64, 96]
section-padding: { hero: 96, content: 64, cta: 32 }
radius: [0]
dominant-contrast: "scale, 4x between the section numeral and the body"
motion-profile: emil
```
