---
name: render-graph
description: Design a multi-pass render chain for a Three.js, WebGL, or WebGPU scene — pass order, resolution scale per pass, ping-pong buffers, depth and normal prepasses, HDR formats and precision, and where tone mapping and grading sit. Use only when passes read what earlier passes wrote, or when more than two effects share the frame. One bloom, one vignette, or a stock effect chain does not activate this skill.
---

# Render Graph

A chain of passes is a budget with a drawing attached. Declare the chain, price
it, and only then implement it. `3d-art-direction` owns what the image should
look like; this skill owns how many buffers it costs to get there.

## 1. Gate

Load this skill when at least one is true:

- A pass samples a buffer an earlier pass wrote — depth, normals, velocity, or a
  previous frame.
- The chain runs more than two effects and their order changes the result.
- The scene needs a resolution split: full-res geometry, half-res effects.
- Grading, a LUT, or an exposure decision has to sit at a defined point.

A single bloom behind `@react-three/postprocessing`, a vignette, or an unmodified
stock chain is `r3f-patterns` work and stops here.

## 2. Pass-chain contract

Fill before implementation. The block is the schema; the passes below are one
filled example, not a default chain to copy.

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

`scale` is the field that decides whether the chain fits. A full-resolution
fullscreen pass costs width by height by device-pixel-ratio squared fragment
invocations: roughly 5.2 megapixels per pass on a 1440 by 900 viewport at DPR 2.
Three such passes are a frame's worth of fill on an integrated GPU before the
scene itself has drawn anything.

Read [references/pass-catalogue.md](references/pass-catalogue.md) when selecting
passes, and [references/buffers-and-precision.md](references/buffers-and-precision.md)
when allocating the targets they need.

## 3. Invariants

- **Never sample the target currently bound.** Effects that read their own
  output need two targets and a swap. The failure is silent on some drivers and
  a black frame on others.
- **One tone map, one exposure, one place.** A second operator inside a material
  produces an image no exposure change can correct.
- **Intermediate targets stay unencoded.** Only the final output carries the
  sRGB transform. An encoded intermediate double-applies the curve, and the
  result reads as washed-out rather than as a bug.
- **A grade built for display-referred input cannot eat HDR values.** Declare
  `grade-position` and match the LUT to it.
- **Every target resizes.** One target missed on resize renders at the previous
  size and reads as softness rather than as an error.
- **Every target is disposed.** Render targets are the largest single source of
  leaked GPU memory in a long-lived scene.
- **Postprocessing follows the renderer.** The classic WebGL composer and the
  node-based WebGPU stack are separate; `shaders-tsl` owns that split and the
  feature matrix behind it.

## 4. Order

Ordering is not stylistic. These dependencies are fixed:

1. Depth, normal, and velocity prepasses precede anything that reads them.
2. Effects that operate on scene-referred light — bloom, volumetrics, depth of
   field — run before the tone map.
3. Effects that operate on the final image — film grain, chromatic offset,
   vignette, and any LUT authored for display-referred input — run after it.
4. Anti-aliasing that resolves geometry edges runs before effects that smear
   them; temporal anti-aliasing wants the frame before any other temporal pass.
5. The output transform is last and happens once.

## 5. Cost control

Tiers come from `3d-runtime-quality`; this skill supplies what those tiers drop
and in what order. Declare the pass-level degradation together with the chain:

1. Reduce effect-pass scale before touching global DPR — half-res bloom is
   nearly free visually, half-res geometry is not.
2. Shorten mip chains and raymarch step counts before removing a pass, so the
   image changes gradually rather than by disappearing.
3. Remove the temporal passes first when the frame budget is missed; they cost
   the most and degrade the worst under an unstable frame time.
4. Keep the pass that carries the visual thesis. A chain that drops its subject
   to hold a frame rate has lost the scene rather than optimized it.

Switching a pass on or off recompiles material variants and can itself stall.
Prefer changing a uniform or a scale over rebuilding the chain at runtime.

## 6. Routing

- Effect selection, cost class, failure modes → **[references/pass-catalogue.md](references/pass-catalogue.md)**
- Formats, precision, depth access, MRT, resize, disposal → **[references/buffers-and-precision.md](references/buffers-and-precision.md)**
- WebGPU or TSL node postprocessing → **`shaders-tsl`**
- Which tier drops which pass → **`3d-runtime-quality`**
- Exposure, tone-mapping intent, material hierarchy → **`3d-art-direction`**
- React integration of the composer → **`r3f-patterns`**

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
