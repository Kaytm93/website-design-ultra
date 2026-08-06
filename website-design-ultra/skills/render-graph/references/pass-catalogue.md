# Pass Catalogue

One row per pass, with the reason to reject it next to the reason to add it.
Every entry assumes the contract in `render-graph` §2 is already filled, so the
question here is which passes earn a slot rather than which exist.

## The catalogue

| Pass | Reads | Typical scale | Cost | Fails as |
|---|---|---|---|---|
| Bloom | color, before tone map | 0.5 or 0.25, mip chain | medium | a glow on everything, because the threshold was set on display-referred values |
| Depth of field | color, depth | 0.5, near and far split | high | bleeding across depth edges, and a sharp halo around foreground objects |
| Screen-space ambient occlusion | depth, normals | 0.5, blurred | medium | dark halos around silhouettes, and crawling noise while the camera moves |
| Screen-space reflections | depth, normals, color | 0.5 | high | reflections that vanish at the screen edge, which no parameter fixes |
| Volumetric light | depth, a noise texture | 0.25 to 0.5, raymarched | high | banding, unless the ray offset is dithered per pixel |
| Motion blur | velocity | 0.5 | medium | smeared static geometry when the velocity buffer misses skinned or instanced meshes |
| Temporal anti-aliasing | color, depth, velocity, previous frame | 1.0 | high | ghosting behind moving objects, and shimmering on transparent surfaces that write no velocity |
| Fast approximate anti-aliasing | color, after tone map | 1.0 | low | softened text and thin lines |
| Subpixel morphological anti-aliasing | color, after tone map | 1.0 | low to medium | edges it cannot classify, mostly on high-frequency detail |
| Colour grading or LUT | color | 1.0 | low | a broken image when the LUT expects display-referred input and receives HDR |
| Film grain, vignette, chromatic offset | color, after tone map | 1.0 | low | a filter look that competes with the art direction |

## Choosing anti-aliasing

Take this decision before the rest of the chain, because it constrains the
others.

- **Multisampling** on the scene target is the cheapest correct answer for
  geometry edges and costs nothing in temporal stability. It does not
  anti-alias shader aliasing inside a surface.
- **Morphological or approximate passes** are post-tone-map, cost little, and
  soften. They are the right answer when the scene is already stable and the
  budget is small.
- **Temporal anti-aliasing** resolves shader aliasing and specular sparkle that
  nothing else reaches, and it costs a velocity buffer, a history target,
  sub-pixel jitter on the projection matrix, and a rejection rule for stale
  history. It also conflicts with every other temporal accumulation in the
  chain. Take it when the scene needs it and the frame budget can hold it,
  not as a default.

A scene that only aliases on geometry edges does not need the temporal path.
Establish which kind of aliasing is visible before paying for the expensive fix.

## Bloom without an exposure trap

Threshold on scene-referred luminance, before the tone map. A threshold applied
after tone mapping shifts every time the exposure changes, so the effect appears
to drift while the artist is grading.

Build the blur as a downsample chain rather than as one wide kernel: successive
half-resolution steps, then upsample and add. Six levels at 0.5 scale cost less
than a single wide blur at full resolution and produce a wider, softer falloff.

## Volumetrics without banding

Raymarching a small step count produces visible rings. Offset each ray's start
by a per-pixel value from a blue-noise texture, then let the temporal or spatial
blur resolve the noise. A white-noise offset resolves worse at the same cost.
Render at quarter scale and upsample with a depth-aware filter, otherwise the
volume bleeds over foreground geometry.

## Passes that need a velocity buffer

Motion blur and temporal anti-aliasing both reproject the previous frame, which
means every moving surface has to write velocity. The three that are routinely
missed: skinned meshes, instanced meshes whose transforms update on the GPU, and
anything displaced in a vertex shader. A surface that moves without writing
velocity ghosts, and the ghost looks like a material bug rather than a missing
buffer.

## When the answer is not a pass

- Ambient occlusion baked into the asset costs nothing per frame and beats a
  screen-space approximation on quality. `3d-asset-pipeline` owns the bake.
- A gradient in the environment map replaces a fullscreen gradient pass.
- Emissive materials plus a modest bloom read better than a strong bloom
  compensating for flat materials.
- A camera framing change from `3d-art-direction` removes more visual noise than
  any amount of post.
