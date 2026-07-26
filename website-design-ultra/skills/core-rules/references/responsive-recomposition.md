# Responsive Art Direction

Responsive work is a change in composition and priority, not a sequence of smaller widths.

## Define viewport shots

For each meaningful state—usually wide, portrait/tablet, and narrow—record:

| Decision | Wide | Portrait | Narrow |
|---|---|---|---|
| focal element | | | |
| first reading unit | | | |
| media role and crop/camera | | | |
| primary action placement | | | |
| density and removed detail | | | |
| navigation/interaction model | | | |
| proof visible before scroll | | | |

Choose transitions where the content or interaction stops working, not by device-brand breakpoints.

## Recomposition operations

Use one or more deliberately:

- **Reorder:** place promise, proof, and action in the order the narrow task requires while preserving a logical DOM/tab order.
- **Promote/demote:** move the decisive proof earlier; move secondary metadata or decoration later.
- **Replace:** swap wide diagrams, dense tables, pinned stories, or 3D shots for a narrow-specific representation.
- **Reframe:** change crop, focal point, camera/FOV, object pose, or art safe area.
- **Regroup:** turn a multi-column feature field into prioritized chapters, a comparison summary, or progressive disclosure.
- **Reduce:** remove decorative depth, supporting objects, redundant labels, and persistent motion without removing the claim.
- **Change interaction:** replace hover, drag-only, or wide navigation with touch/keyboard-safe controls.

Changing only column count, `font-size`, or scale is adaptation, not a complete responsive direction.

## Common patterns

- Hero split → claim/action first, proof media second or edge-cropped behind a protected text safe area.
- Bento dashboard → task summary and urgent states first; secondary modules become sections/disclosures.
- Editorial spread → preserve headline/deck/image/caption relationships in a single reading stream.
- Comparison table → keep repeated-field semantics; provide a priority summary plus scroll or per-option detail, not unrelated cards.
- Sticky/scroll story → normal-flow chapters on narrow or reduced-motion viewports.
- 3D hero/configurator → define a portrait camera shot, larger controls, reduced orbit range, and stable poster/DOM alternative.

## Proof

Test real content at narrow/portrait/wide sizes, landscape phone, 200% zoom, coarse pointer, reduced motion, missing media, and a long locale. Verify:

- no essential content depends on hover, crop, canvas, or animation,
- CTA and current state remain visible,
- headings do not orphan into unusable fragments,
- source order, focus order, and visual order agree,
- touch targets and sticky UI do not obscure focused content,
- mobile retains the same thesis even when its composition differs.

Return the viewport-shot table or an equivalent explicit contract for full pages and signature sections.
