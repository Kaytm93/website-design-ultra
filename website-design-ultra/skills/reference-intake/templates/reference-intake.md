# Reference Intake Record

Copy this file into the project evidence directory. Replace every `unknown` in
the input and poster sections with supplied or produced evidence. In the
art-direction ledger, keep `unknown` when no frame supports a value.

## Input manifest

Use six to ten entries. Keep at least one PNG and one SVG export in the set; add
`frame-07` through `frame-10` only when supplied.

```yaml
frames:
  - id: frame-01
    file: unknown
    format: png
    dimensions-or-viewbox: unknown
    viewport: unknown
    role: unknown
    provenance: unknown
  - id: frame-02
    file: unknown
    format: svg
    dimensions-or-viewbox: unknown
    viewport: unknown
    role: unknown
    provenance: unknown
  - id: frame-03
    file: unknown
    format: unknown
    dimensions-or-viewbox: unknown
    viewport: unknown
    role: unknown
    provenance: unknown
  - id: frame-04
    file: unknown
    format: unknown
    dimensions-or-viewbox: unknown
    viewport: unknown
    role: unknown
    provenance: unknown
  - id: frame-05
    file: unknown
    format: unknown
    dimensions-or-viewbox: unknown
    viewport: unknown
    role: unknown
    provenance: unknown
  - id: frame-06
    file: unknown
    format: unknown
    dimensions-or-viewbox: unknown
    viewport: unknown
    role: unknown
    provenance: unknown

written-token-block:
  source-file: unknown
  direction-name: unknown
  grid: unknown
  color: unknown
  typography: unknown
  spacing: unknown
  motion: unknown
  must-preserve: []
  must-avoid: []
```

## Art-direction trace ledger

Keep every row. A supported row replaces both `unknown` values and names one
manifest id as `source-frame`. Notes begin with the visible observation; put
corroborating frame ids there rather than changing the source grammar.

```yaml
art-direction:
  - field: visual-thesis
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: hero-subject
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: camera.framing
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: camera.fov
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: camera.position
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: camera.target
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: camera.near-far
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: composition.subject-anchor
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: composition.dom-safe-area
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: lighting
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: material-order
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: color-output
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: tone-mapping
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: mobile-reframe
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: spatial-type
    value: unknown
    source-frame: unknown
    observation: unknown
  - field: poster-frame
    value: unknown
    source-frame: unknown
    observation: unknown
```

## Contradictions and unknowns

```yaml
contradictions: []
open-questions: []
```

Each contradiction entry names `field`, `frames`, `axis`, and
`resolution: unknown`. Do not hide disagreement in the observation text.

## Poster target

The asset must exist before the status changes. It is the image the live scene
will be held against, not a fallback generated after implementation.

```yaml
poster-target:
  asset: unknown
  format: unknown
  source-frames: []
  wide-crop: unknown
  portrait-crop: unknown
  subject-anchor: unknown
  dom-safe-area: unknown
  silhouette: unknown
  lighting-direction: unknown
  material-ranking: unknown
  tonal-range: unknown
  comparison-size: unknown
scene-code-status: blocked
```

Change `scene-code-status` to `ready-for-3d-art-direction` only after the input
manifest is complete, every trace row is cited or `unknown`, contradictions are
visible, and the poster target asset exists. Scene code comes later.
