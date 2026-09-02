---
name: gpu-particle-systems
description: Simulate thousands of GPU particles with persistent texture state, spatial fields, trails, or volume morphing. Use only when the brief requires thousands of particles with persistent per-particle simulation state across frames, a spatial field, trails/history, or volume morphing. Decorative dust, sparkle, small instanced particles, a short burst, or a single click shockwave alone does not activate this skill.
---

# GPU Particle Systems

Persistent GPU simulation is a cost class, not a default decoration. This skill owns the texture-based ping-pong contract only when the brief establishes a field the particles inhabit across frames.

## 1. Gate - selection and negative gating

This skill opens only when **all** of these hold:

1. The brief requires **thousands** of particles in a spatial field - not dozens or a handful.
2. The simulation carries **persistent state across frames** - each particle's position/velocity is integrated from the previous frame, not recreated per frame.
3. At least one is true: a **spatial field** displaces particles, **trails/history** is sampled across frames, or **volume morphing** interpolates between shapes.

If the answer to any row below is in the right column, this skill does not open. Use `r3f-patterns` instead.

| Brief asks for | This skill | Not this skill → |
|---|---|---|
| Decorative dust drifting over a surface | - | `r3f-patterns` with a small `InstancedMesh` or `Points` |
| Sparkle or glitter on an object | - | `r3f-patterns` |
| Small instanced particles (tens–hundreds, buffer-driven) | - | `r3f-patterns` |
| A short burst (one-shot emission, no persistent state) | - | `r3f-patterns` |
| A single click shockwave without persistent particle state | - | `r3f-patterns` or `shaders-tsl` |

A single click shockwave **factor** - the generic radial displacement without persistent textured particle history - stays in `r3f-patterns` / `shaders-tsl`. This skill's click is a **recovering impulse inside a persistent ping-pong simulation**, not a standalone effect.

State the gate answer in the deliverable. A scene that cannot state which of field / trail / morph it carries took the expensive texture simulation by accident.

Particle counts per tier are not in this skill or its reference. They are owned by `3d-runtime-quality` and consumed as `qualityProfile.particles`. The lab may carry a fixture texture dimension explicitly marked as a test size only.

## 2. Contract - what the reference owns

Technical precision, sampling, ownership, seeding, pointer normalization, falloff, impulse shape, and the WebGL2/WebGPU renderer matrix are not in this file. Read [references/state-textures-and-interaction.md](references/state-textures-and-interaction.md) before any simulation code is written. Answering this step from the gate alone leaves the simulation unsound.

That reference is the single copyable contract for:

- two separate RGBA16F / HalfFloat state targets (`highp`, `NearestFilter`, `NoColorSpace`, no depth/stencil),
- one simulation owner for read / write / swap, never sampling the currently bound write target,
- reset by reinitializing both targets (no per-frame reallocation),
- position/life and velocity/spawn-or-seed channels,
- deterministic seeding via the injected `RandomStreams` namespace `particles/spawn` and separate named streams for additional randomness,
- normalized pointer field and capped radial falloff,
- one recovering click impulse with origin / radius / strength / startTime-or-age decaying via the injected clock,
- the rule that no per-particle React state and no React state setter exists in the render loop,
- WebGL2 requires real float-render-target execution for PASS; WebGPU uses the copyable `templates/particles/compute-particles.ts` TSL path and requires a real GPUDevice execution for PASS. Both paths keep the non-empty reduced-motion / poster / capability fallback.

Do not copy particle counts from a fixture or example into production; read the quality profile.

## 3. Workflow

1. Answer the §1 gate and cite which of field / trails / morph supplied the third predicate.
2. Read `references/state-textures-and-interaction.md` and the tiered particle allowance from `3d-runtime-quality` (`qualityProfile.particles`).
3. Allocate the two state targets and the simulation owner. No per-frame reallocation.
4. Wire the normalized pointer field and the one-shot recovering impulse from the contract - never per-particle React state.
5. Implement deterministic spawn/reset from `particles/spawn` and any additional named streams.
6. Produce the mandatory fallbacks: a reduced-motion composition, a poster tier, and a capability fallback that is never a blank canvas - each is a non-empty composition.
7. Verify the WebGL2 path with a real browser float-target execution and the
   WebGPU path with `templates/particles/compute-particles.ts` on a live
   `GPUDevice`; leave each backend `UNAVAILABLE` when its required execution is
   absent.

## 4. Routing

- Concrete counts per tier → **`3d-runtime-quality` (`3d-runtime-quality/references/tier-matrix.md`, `qualityProfile.particles`)**
- Single-pass decorative dust / sparkle / short burst → **`r3f-patterns`**
- TSL / WebGPU node material choice and WebGL2 fallback → **`shaders-tsl`**
- Multi-pass chains that read earlier buffers → **`render-graph`**
- Deterministic clock / streams / `data-wdu-ready` → **`core-rules/references/determinism.md`**

## Check

- [ ] The §1 gate is answered and the third predicate (field / trail / morph) is named.
- [ ] `references/state-textures-and-interaction.md` was read and its texture / precision / sampling / ownership contract is implemented.
- [ ] Two RGBA16F/HalfFloat targets exist with `highp`, `NearestFilter`, `NoColorSpace`, no depth/stencil, one owner, and no sampling of the bound write target.
- [ ] Spawn/reset is deterministic via `particles/spawn` and named streams; reset reinitializes both targets; no per-frame allocation.
- [ ] Pointer is normalized once from canvas-relative client coordinates; the shader applies only a bounded radial field with the documented falloff.
- [ ] Click creates exactly one impulse record decaying via the injected clock's recovery time; no per-particle React state or setter in the render loop.
- [ ] Production particle allowance is read from `qualityProfile.particles`; no count is duplicated in this skill or the reference matrix.
- [ ] Reduced-motion / poster / capability fallback is a non-empty composition, not a blank canvas.
- [ ] Renderer matrix is honest: WebGL2 PASS only after real float-target browser execution; WebGPU PASS only after `templates/particles/compute-particles.ts` executes on a real GPUDevice; otherwise each backend is UNAVAILABLE.
