# Product Directions

Each direction carries a token block. It is a declaration, not a preset: the
Tier-3 budgets in `anti-slop` design tells measure the built page against these
numbers when they are filled, and against the generic defaults when they are
not. Adapt the values to the brief and state what changed.

The failure mode specific to each direction moved into
`anti-slop/references/design-tells.md`, which owns the tell catalogue. Pick a
signature device from
[signature-moves.md](signature-moves.md) once a direction is chosen.

## Refined Minimalism

- **Best for:** productivity, B2B tools, high-trust SaaS.
- **Layout:** asymmetrical grid, generous negative space, dividers before cards.
- **Type:** precise grotesk plus mono for data.
- **Color:** Linear Mono, Stripe Clean, or Tech Lab.
- **Motion:** fast, restrained, interruptible.
- **Hero:** type-first or asymmetric split with one proof asset.

```yaml
grid: "12col, hero 7/5, content 8/4"
type-ratio: 1.25
space-scale: [4, 8, 16, 24, 40, 64, 104]
section-padding: { hero: 104, content: 64, cta: 40 }
radius: [0, 4]
dominant-contrast: "weight, 400 against 600 at one size"
motion-profile: emil
```

## Glass / Liquid

- **Best for:** premium consumer technology and sensory product stories.
- **Layout:** layered depth with few meaningful translucent surfaces.
- **Type:** light display weight, highly controlled line length.
- **Color:** Aurora Glass.
- **Motion:** depth parallax and slow material response; provide a still mode.
- **Hero:** one focal glass object or layered scene, not floating cards everywhere.

```yaml
grid: "12col, centered 8/4 with two layered overlays"
type-ratio: 1.25
space-scale: [4, 8, 16, 24, 40, 64, 96]
section-padding: { hero: 96, content: 64, cta: 48 }
radius: [12, 24]
dominant-contrast: "depth, three surface layers over one backdrop"
motion-profile: jakub
```

## Apple-like Product Precision

- **Best for:** hardware, apps, wearables, focused product narratives.
- **Layout:** strict rhythm, intentional symmetry, large product moments.
- **Type:** system-like hierarchy with licensed/available equivalents.
- **Color:** Apple Light or Apple Dark.
- **Motion:** smooth, non-bouncy, product-led.
- **Hero:** centered composition is an intentional exception when it strengthens product focus.

```yaml
grid: "12col, symmetric, product rows run full-bleed"
type-ratio: 1.2
space-scale: [4, 8, 16, 32, 56, 88, 136]
section-padding: { hero: 136, content: 88, cta: 56 }
radius: [0, 18]
dominant-contrast: "scale, 6x between product shot and caption"
motion-profile: jakub
```

Symmetry here is the declared answer to the composition contract's `asymmetry`
field, not a missing decision.

## Bento Feature Engine

- **Best for:** feature-rich products that benefit from visual demonstrations.
- **Layout:** varied spans and clear sequence; not automatically three equal cards.
- **Type:** compact grotesk with strong labels.
- **Color:** Stripe Clean or Tech Lab.
- **Motion:** one illustrative behavior per card; pause persistent loops.
- **Hero:** claim and proof before the grid.

```yaml
grid: "12col bento, 4/4/4 with one 8-span and one 2-row cell"
type-ratio: 1.25
space-scale: [4, 8, 12, 16, 24, 40, 64]
section-padding: { hero: 80, content: 56, cta: 40 }
radius: [8, 16]
dominant-contrast: "area, the lead cell is 4x the smallest"
motion-profile: jakub
```
