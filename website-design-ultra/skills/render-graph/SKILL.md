---
name: render-graph
description: Design a multi-pass render chain for a Three.js, WebGL, or WebGPU scene — pass order, resolution scale per pass, ping-pong buffers, depth and normal prepasses, HDR formats and precision, and where tone mapping and grading sit. Use only when passes read what earlier passes wrote, or when more than two effects share the frame. One bloom, one vignette, or a stock effect chain does not activate this skill.
---

# Render Graph

Load only when a pass reads an earlier buffer, more than two ordered effects
share the frame, resolution splits are needed, or grading/exposure has a defined
position. One stock bloom/vignette/effect chain stays in `r3f-patterns`.

## Pass-chain contract

Fill before implementation; the block is the schema and the values are an example.

```yaml
color-space: "linear working space, output transform at the end"
hdr-format: "half-float intermediate targets"
tone-map: "one operator, one exposure, applied once"
grade-position: "scene-referred, before the tone map"
passes:
  - name: "scene"
    scale: 1.0
    writes: "color, depth"
  - name: "bloom"
    scale: 0.5
    reads: "color"
    cost: "mip chain, six levels"
  - name: "composite"
    scale: 1.0
    reads: "color, bloom"
  - name: "output"
    scale: 1.0
    note: "tone map plus output transform, the only encoded target"
budget-full-res-passes: 3
```

`scale` prices fullscreen work; at 1440×900 and DPR 2, one full-resolution pass
is about 5.2 megapixels. Read [references/pass-catalogue.md](references/pass-catalogue.md)
for choices and [references/buffers-and-precision.md](references/buffers-and-precision.md)
for target formats, resize, and disposal.

## Invariants and order

Never sample the target currently bound: use two targets and swap for feedback.
Apply one exposure/tone map once; keep intermediates unencoded; match grading to
its declared scene/display side. Resize and dispose every target. Postprocessing
must match the renderer; `shaders-tsl` owns WebGL versus WebGPU separation.

Depth/normal/velocity prepasses precede readers. Scene-referred bloom, volumetrics,
and DOF precede tone mapping. Display-referred grain, chromatic offset, vignette,
and matching LUT follow it. Anti-alias geometry before effects that smear it; the
output transform is last and once.

## Cost and routing

`3d-runtime-quality` chooses the tier; this graph declares pass-level degradation:
reduce effect scale, shorten mips/steps, remove temporal passes, and keep the
pass carrying the thesis. Prefer uniforms/scale over rebuilding variants.

Pass catalogue → [references/pass-catalogue.md](references/pass-catalogue.md);
buffers/precision → [references/buffers-and-precision.md](references/buffers-and-precision.md);
TSL → `shaders-tsl`; visual intent → `3d-art-direction`; React composer →
`r3f-patterns`.

## Check

- [ ] The contract lists every pass with a scale and what it reads.
- [ ] Full-resolution fullscreen passes are counted and within the declared
      budget.
- [ ] No pass samples the target it writes.
- [ ] Tone mapping happens once, and the grade sits on the declared side of it.
- [ ] Intermediate targets are unencoded; only the output is transformed.
- [ ] Every target resizes and is disposed.
- [ ] Pass-level degradation is declared and ordered.
- [ ] The chain was measured on mobile, not only on the development machine.
