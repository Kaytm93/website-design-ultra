# Buffers and Precision

Allocation decisions for the targets a chain declares. Verify every API name
against the installed Three release before copying anything here; render-target
and multi-target constructors have changed shape more than once.

## Format per target

| Target | Format | Reason |
|---|---|---|
| Scene colour, before tone map | half float | eight bits per channel clips highlights, and bloom then has nothing to find |
| Bloom and blur chain | half float | the same values, at a lower resolution |
| Depth | depth texture, or the depth attachment the renderer exposes | sampled by depth of field, ambient occlusion, and volumetrics |
| Normals | half float, or packed into two channels | full float buys precision nothing downstream uses |
| Velocity | half float, two channels | screen-space offsets are small numbers |
| Output | eight bits, encoded | the only target carrying the output transform |

Full float targets are rarely the right answer. They double bandwidth, and
linear filtering of 32-bit float textures is an extension on WebGL2 and a
feature to request on WebGPU rather than a guarantee. Reach for them only when a
measured precision problem exists.

## Colour space through the chain

Intermediate targets hold linear values and are not sRGB-encoded. Encoding an
intermediate applies the transfer curve twice by the time the frame reaches the
screen; the result reads as a washed-out grade rather than as an error, which is
why it survives review. Set the transform once, on the target that reaches the
display.

## Ping-pong

An effect that reads its own previous result needs two targets and a swap per
step:

```js
let read = targetA
let write = targetB

function step(renderer, material) {
  material.uniforms.tPrevious.value = read.texture
  renderer.setRenderTarget(write)
  renderer.render(quadScene, quadCamera)
  ;[read, write] = [write, read]
}
```

Sampling the bound target is undefined behaviour. Some drivers return the
previous contents, some return black, and the difference between development
and a visitor's machine is exactly this.

Temporal passes add one rule: the history target survives across frames, so it
has to be invalidated on resize, on a camera cut, and when the scene state
machine transitions. A history kept across a cut ghosts the previous section
into the new one.

## Depth access

- WebGL2 exposes depth as a texture that can be sampled by later passes. Attach
  it to the scene target rather than re-rendering the scene depth-only, unless
  a prepass is needed for another reason.
- WebGPU exposes depth through the node pipeline. `shaders-tsl` owns that path
  and its feature matrix; do not assume the WebGL arrangement transfers.
- Multiple render targets write colour, normals, and velocity in one geometry
  pass. That is one draw of the scene instead of three, and it is the single
  largest saving available to a chain that needs all three buffers.

## Resize

Every target scales with the canvas, each by its own declared factor. Two rules
keep this from decaying:

1. One resize handler owns all targets. Targets allocated inside a system and
   resized nowhere are the usual cause of an effect that looks correct on load
   and soft after a window change.
2. Debounce the reallocation, and reallocate rather than stretch. Continuous
   reallocation during a drag-resize stalls harder than the resize itself.

DPR belongs to the `3d-runtime-quality` controller. A chain that applies its own
device-pixel-ratio logic creates a second adaptive system, which is the
oscillation that skill exists to prevent.

## Disposal

Dispose targets when a scene state that owns them exits, and on teardown. One
full-resolution four-channel half-float target at 1440 by 900 with DPR 2 is
2880 by 1800 pixels, which is about 40 MB of GPU memory. A chain that leaks
three of those per section change exhausts a mobile GPU inside a single visit,
and the symptom is a lost context rather than a memory warning.

Dispose in this order: render targets, then the materials of the fullscreen
quads, then the geometries. Releasing the material first leaves the target
referenced by a live uniform on some renderer versions.

## Measuring

`renderer.info` reports draw calls, triangles, and programs. It does not report
fill cost, which is what a pass chain spends. Measure the chain by removing
passes one at a time and reading the frame-time change on the weakest target
device — a per-pass timing query is not available consistently enough across
browsers to rely on in production.
