# Camera, Composition, and Mobile Reframing

## Contents

- Lens and FOV
- Composition contract
- Responsive shot map
- Implementation handoff
- Poster frame

## Lens and FOV

Choose the spatial effect first, then a starting range. Verify the final effect on the target device.

| Effect | Perspective starting range | Typical use | Risk |
|---|---:|---|---|
| Compressed, iconic | 24–35° | Premium product, calm still life | Reads flat; camera must move further away |
| Natural, present | 35–50° | Hero, viewer, spatial editorial composition | Needs a clear silhouette |
| Close, dynamic | 50–65° | Expressive close-ups, fast spatial impact | Edge distortion and restless text |

When comparing FOVs, keep the subject roughly the same size by adjusting camera distance with it. Do not compare FOVs from the same camera position.

- Use an orthographic camera only for diagrammatic, isometric, or deliberately flat spaces.
- Set the target point to the meaning anchor, not automatically to the world origin.
- Keep `near` as far as possible and `far` as close as possible without clipping required geometry.
- Avoid wide-angle close-ups of product edges when dimensional accuracy or trust matters.

## Composition contract

Define per shot:

- subject anchor in normalized canvas coordinates, for example `x: 0.68, y: 0.48`,
- expected silhouette and which surfaces must be visible,
- DOM safe area as a percentage or bounding box,
- foreground, midground, and background role,
- permitted crop zones of the model,
- camera position, target point, FOV, and object transform,
- focus distance only when DoF is actually selected.

Align DOM and canvas to the same layout guides. Review heading, CTA, hotspots, and model as one composition.

## Responsive shot map

Use canvas aspect ratio, actual overlay area, and input mode as signals; do not rely on CSS breakpoints alone.

| State | Recomposition |
|---|---|
| Wide desktop | Anchor the subject to the side, keep the DOM safe area clear, allow more depth staging |
| Compact desktop/tablet | Bring the subject closer, reduce depth, condense labels or move them into a DOM list |
| Portrait mobile | Select a new portrait shot, stack the subject vertically, reset camera/target, place text before or after the canvas instead of over it |
| Coarse pointer | Enlarge interactive details, limit orbit range, remove hover-dependent hints |
| Reduced motion | Show the strongest static shot; make no information depend on a camera move |

Treat mobile as a cut, not as a scale:

1. Prioritize one surface or detail instead of the entire desktop model.
2. Move the subject relative to the DOM hierarchy.
3. Reduce perspective depth and background objects when they displace text.
4. Move spatial labels into a semantic DOM list as soon as they collide.
5. Adapt the shadow frustum and LOD to the new shot.

## Implementation handoff

Store shots as data instead of scattered media-query side effects:

```ts
const SHOTS = {
  wide: {
    camera: [0.2, 0.3, 5.8],
    target: [0.4, 0.1, 0],
    fov: 36,
    subject: [0.8, -0.1, 0],
    scale: 1,
  },
  portrait: {
    camera: [0, 0.35, 6.4],
    target: [0, 0.45, 0],
    fov: 31,
    subject: [0, 0.55, 0],
    scale: 0.86,
  },
} as const
```

Switch shots rarely and based on state. Damp a visible camera move with `delta`; set the shot directly under reduced motion. Do not let OrbitControls and a custom rig write at the same time.

## Poster frame

- Use the same camera and lighting idea as the live shot.
- Export desktop and portrait posters separately when the crop would otherwise lose the statement.
- Keep text and CTA in the DOM; bake only decorative typography into the poster.
- Compare poster and live canvas at the same container size for silhouette, anchor, and tonal value.
