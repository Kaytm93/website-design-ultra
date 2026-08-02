# Expressive Directions

Each direction carries a token block. It is a declaration, not a preset: the
Tier-3 budgets in `anti-slop` design tells measure the built page against these
numbers when they are filled, and against the generic defaults when they are
not. Two blocks here deliberately exceed a default budget, which is the point:
a declared three-radius page is conformant, an undeclared one is a finding.

The failure mode specific to each direction moved into
`anti-slop/references/design-tells.md`, which owns the tell catalogue. Pick a
signature device from
[signature-moves.md](signature-moves.md) once a direction is chosen.

## Brutalist / Raw

- Hard grid, large type, visible borders, direct copy.
- Use Brutalist Shock; select one action color and keep the other decorative.
- Motion is instant, mechanical, or absent.

```yaml
grid: "6col, hard, no gutter collapse"
type-ratio: 1.618
space-scale: [0, 8, 16, 32, 64, 96]
section-padding: { hero: 96, content: 32, cta: 32 }
radius: [0]
dominant-contrast: "scale, 8x between headline and body"
motion-profile: emil
```

## Retro-Futuristic

- Dense technical framing, terminal or instrument references, controlled noise.
- Use Cyber Cockpit.
- Mono type may dominate; preserve long-form readability.
- Motion may use scan, typing, or data flow but must pause.

```yaml
grid: "12col, instrument rails on both outer columns"
type-ratio: 1.2
space-scale: [4, 8, 12, 20, 32, 52, 84]
section-padding: { hero: 84, content: 52, cta: 32 }
radius: [0, 2]
dominant-contrast: "density, the data rail against an empty stage"
motion-profile: jhey
```

## Y2K

- Chrome, bevels, layered stickers, playful digital nostalgia.
- Use Y2K Chrome; supporting colors are decorative.
- Motion may bounce or squash with strong touch/reduced-motion alternatives.

```yaml
grid: "10col, sticker layer above the grid"
type-ratio: 1.414
space-scale: [4, 8, 16, 24, 40, 64]
section-padding: { hero: 88, content: 48, cta: 40 }
radius: [4, 20, 999]
dominant-contrast: "material, one chrome object against flat fields"
motion-profile: jhey
```

Three radii is a declared exception to the two-radius budget. The pill value
carries the sticker layer, and the other two stay apart by role.

## Cyberpunk

- Dense information, coordinate systems, channel separation, hard contrast.
- Use Cyberpunk; cyan is the action color, magenta/green support atmosphere or semantics.
- Motion may glitch briefly; never flash beyond safe thresholds.

```yaml
grid: "12col, coordinate rails, one channel-offset zone"
type-ratio: 1.25
space-scale: [2, 4, 8, 16, 24, 40, 64]
section-padding: { hero: 80, content: 40, cta: 24 }
radius: [0, 2]
dominant-contrast: "density, packed data blocks against hard black gaps"
motion-profile: jhey
```

## Neo-Memphis

- Organized chaos, bold shapes, black outlines, expressive typography.
- Use Neo-Memphis; one action color, supporting flat decorative colors.
- Motion may rotate, squash, or spring.
- Keep reading order, touch targets, and content clarity intact.

```yaml
grid: "12col with a deliberate two-row break per section"
type-ratio: 1.414
space-scale: [4, 8, 16, 24, 40, 64, 96]
section-padding: { hero: 96, content: 56, cta: 40 }
radius: [0, 24, 999]
dominant-contrast: "shape, outlined forms against flat color fields"
motion-profile: jhey
```

Three radii again, declared: square for panels, round for shapes, pill for
labels. The uniformity budget still applies, so the break has to vary the
container recipe rather than repeat one box.
