# Spatial Typography

## Choose the text layer

| Content | Layer | Reason |
|---|---|---|
| Heading, claim, price, CTA | Semantic DOM | Readable, selectable, indexable, robust |
| Interactive hotspot | DOM or `<Html>` | Focus, keyboard, dynamic state |
| Decorative spatial label | drei `<Text>` | Real depth with limited content |
| Sculptural single word | Rare `<Text3D>` | Geometry is part of the subject |
| Long copy or body text | DOM only | Line length, reflow, accessibility |

Keep every meaningful statement in the DOM as well. Avoid duplicate focus targets when the same action exists both as `<Html>` and outside the canvas.

## Compose type in space

- Define a typography layer as foreground, world-locked, or object-attached.
- Fix screen-space target sizes; a readable world size on desktop does not guarantee mobile readability.
- Use perspective and occlusion only when they carry meaning. Important text must not disappear unpredictably behind geometry.
- Limit simultaneously visible spatial labels. Show distant or inactive information in a DOM list.
- Align text and model to shared guides; do not distribute them independently by feel.
- Use billboard alignment only for labels that must always be readable. Leave sculptural typography deliberately in space.
- Avoid strong bloom, transmission, or DoF effects on text.

## Mobile reframe

- Move headline and CTA into the normal DOM flow.
- Replace colliding hotspots with numbered markers plus DOM details.
- Enlarge touch targets independently of the visible marker size.
- Reduce world text or remove it before scaling it down to an unreadable size.
- Choose a portrait crop in which DOM and subject do not compete for the same area.

## Font and runtime

- Verify license and web embedding rights before preloading.
- Preload only font files and subsets that are actually visible.
- Keep fallback metrics stable so spatial and DOM composition do not jump after font load.
- Use atlas/SDF text for repeated dynamic labels; reserve geometry text for rare subjects.
- Drive semantic reading order through the DOM, not through z-position in space.

## Check

- [ ] Meaningful text exists in semantic DOM.
- [ ] Spatial text has a declared depth/occlusion behavior.
- [ ] Mobile labels are recomposed, not merely scaled.
- [ ] Focus order contains no duplicate Canvas/DOM controls.
- [ ] Font loading, fallback metrics, license, and reduced-motion state pass.
