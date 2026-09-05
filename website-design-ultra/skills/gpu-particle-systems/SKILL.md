---
name: gpu-particle-systems
description: Simulate thousands of GPU particles with persistent texture state, spatial fields, trails, or volume morphing. Use only when the brief requires thousands of particles with persistent per-particle simulation state across frames, a spatial field, trails/history, or volume morphing. Decorative dust, sparkle, small instanced particles, a short burst, or a single click shockwave alone does not activate this skill.
---

# GPU Particle Systems

This is a cost class, not default decoration. Open only when the brief requires
thousands of particles, persistent state across frames, and a spatial field,
trails/history, or volume morphing. State which predicate applies.

Decorative dust, sparkle, tens/hundreds of instanced particles, a one-shot burst,
or a standalone click shockwave stay in `r3f-patterns`/`shaders-tsl`. A shockwave
here must be a recovering impulse inside persistent ping-pong simulation.
Particle counts belong to `3d-runtime-quality` (`qualityProfile.particles`), not
this skill or its reference.

## Contract and workflow

Before simulation code, read [references/state-textures-and-interaction.md](references/state-textures-and-interaction.md).
It owns the two RGBA16F/HalfFloat targets, precision/filter/color-space/depth
settings, one read/write/swap owner, reset, seeded streams, normalized pointer
field, bounded recovering impulse, no per-particle React state, and renderer
matrix. WebGL2 is PASS only after real float-target execution; WebGPU is
UNAVAILABLE without a real WGSL/TSL device. Fallbacks are non-empty.

1. Answer the gate and select the quality profile.
2. Allocate two targets with no per-frame reallocation and one simulation owner.
3. Wire normalized pointer and one recovering impulse from the injected clock.
4. Seed spawn/reset through `particles/spawn` and named streams.
5. Provide reduced-motion, poster, and capability fallback compositions.
6. Verify the declared WebGL2 path honestly; leave unsupported WebGPU unverified.

## Routing

Counts → `3d-runtime-quality`; decorative particles → `r3f-patterns`; TSL and
backend fallback → `shaders-tsl`; buffer chains → `render-graph`; deterministic
clock/streams → `core-rules/references/determinism.md`.

## Check

- [ ] The §1 gate is answered and the third predicate (field / trail / morph) is named.
- [ ] `references/state-textures-and-interaction.md` was read and its texture / precision / sampling / ownership contract is implemented.
- [ ] Two RGBA16F/HalfFloat targets exist with `highp`, `NearestFilter`, `NoColorSpace`, no depth/stencil, one owner, and no sampling of the bound write target.
- [ ] Spawn/reset is deterministic via `particles/spawn` and named streams; reset reinitializes both targets; no per-frame allocation.
- [ ] Pointer is normalized once from canvas-relative client coordinates; the shader applies only a bounded radial field with the documented falloff.
- [ ] Click creates exactly one impulse record decaying via the injected clock's recovery time; no per-particle React state or setter in the render loop.
- [ ] Production particle allowance is read from `qualityProfile.particles`; no count is duplicated in this skill or the reference matrix.
- [ ] Reduced-motion / poster / capability fallback is a non-empty composition, not a blank canvas.
- [ ] Renderer matrix is honest: WebGL2 PASS only after real float-target browser execution; otherwise UNAVAILABLE; WebGPU UNAVAILABLE without a real WGSL/TSL device.
