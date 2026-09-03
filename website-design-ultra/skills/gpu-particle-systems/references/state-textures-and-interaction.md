# GPU Particle Systems - State Textures and Interaction

This is the single technical reference for `gpu-particle-systems`. `SKILL.md` §1 decides whether this skill is active; this file decides whether the simulation is sound. Do not implement without reading it. Production particle allowance is never in this file - consume `qualityProfile.particles` from `3d-runtime-quality`.

## 1. State texture contract (copyable)

### 1.1 Two targets, not one

Allocate exactly two separate render targets that carry persistent simulation state across frames:

```
targetA : WebGLRenderTarget  → state read this frame, write next
targetB : WebGLRenderTarget  → state write this frame, read next
```

- **Format:** `RGBA16F` with `HalfFloatType` (or `FloatType` where `RGBA16F` half-float is unavailable, still `highp`). Each texel stores one particle.
- **Precision qualifier:** fragment shader declares `precision highp float;` (and `highp sampler2D` where the driver requires it). No `mediump` path for state.
- **Filtering:** `minFilter = magFilter = THREE.NearestFilter` on both state textures. Any interpolation between neighbouring particles is a bug.
- **Color space:** `texture.colorSpace = THREE.NoColorSpace` (equivalently `LinearSRGBColorSpace` without remap - never `SRGBColorSpace`). State channels are data, not display color.
- **No depth/stencil:** `depthBuffer = false`, `stencilBuffer = false` on both targets. State integration has no depth test.
- **No per-frame allocation:** the two targets are created once; only sampling, clearing, or reinitializing touches them inside the frame loop. No `new RenderTarget` per frame.

A fixture may use a small texture dimension explicitly labeled as a fixture/test size (for example a 32×32 fixture explicitly marked `// fixture/test size only - production consumes qualityProfile.particles`). That dimension is not a production allowance and must carry that comment.

### 1.2 One simulation owner for read / write / swap

One owner - the simulation step - owns which target is `read` and which is `write` before a render pass and swaps after it completes:

```
read  = ping
write = pong
render(stateWrite, read=ping) → swap → read=pong / write=ping
```

- Never sample the texture currently bound as the write attachment in the same draw - never sampling the currently bound write target. This is the same invariant as `render-graph` "never sample the target currently bound" - the failure is silent on some drivers and a black frame on others.
- `reset` reinitializes **both** targets (fills each texel via deterministic spawn) - reset reinitializing both targets. No per-frame reallocation means the targets persist; a reset writes into them.
- On resize: preserve particle identity (texel → particle mapping) unless the product tier explicitly changes the texture dimension via `qualityProfile.particles`; then reinitialize both targets at the new dimension. Do not recreate targets every frame for a non-tier-driven resize.

### 1.3 Channel layout - Position/Life and Velocity/Spawn or Seed channels

- **Channel A (`posLife` - Position/Life):** `xyz = position`, `w = life` in `[0,1]` (or age normalized). Life drives spawn/reset per texel.
- **Channel B (`velSpawn` - Velocity/Spawn or Seed):** `xyz = velocity`, `w = spawnSeed or stable random seed` (alternatively a separate `Seed` channel). The seed survives resets and keeps per-particle variation deterministic.

The lab experiments in `repo:lab/src/experiments/shaders/particle-toy-update.frag` use `posLife = (x,y,z,life)` and `velSeed = (vx,vy,vz,seed)` - the same layout that every production copy must preserve.

### 1.4 Deterministic initialization and stable seeding

Every random source takes a named seed via the injected `RandomStreams` contract from `templates/runtime/determinism-runtime.ts`.

- Spawn determinism uses the namespace **`particles/spawn`** - that exact string, not `spawn` alone, not `particle/spawn`. Call `streams.stream('particles/spawn')` to seed initial position/velocity/life/seed channels.
- Any additional randomness (curl variation, turbulence offset, morph jitter) uses a **separate named stream** - for example `particles/field` or `particles/turbulence`. Never reuse the `particles/spawn` stream for field noise so adding a field does not change spawn order.
- In deterministic mode (`WDU_DETERMINISTIC=1`) the same root seed and the same `particles/spawn` stream produce byte-identical state textures after initialization and after a `reset`. A comparator may hash the two `posLife` textures' readback pixels.
- In live mode a `live-${Date.now()}` root still passes through the same stream API; the seed is not read from `Math.random()` directly in scene code.

Seeding is not a visual variety feature to layer over undeterministic `Math.random()`; it is the mechanism that makes two captures comparable.

## 2. Pointer field - normalized space and bounded falloff

Pointer data is captured **once** per event in the host, converted to normalized scene coordinates, and forwarded to the simulation shader as a single `vec2`. The shader never reads `clientX` / `clientY` or element bounds.

### 2.1 Host normalization

For every `pointermove` / `pointerdown` over the canvas element:

```ts
const rect = canvas.getBoundingClientRect();
const x = clamp((clientX - rect.left) / rect.width, 0, 1);
const y = clamp(1 - (clientY - rect.top) / rect.height, 0, 1); // invert Y: canvas bottom → 0
```

- `x` and `y` are each clamped to `[0,1]` so positions off-canvas do not produce out-of-range uniforms.
- `y` is inverted (`1 - …`) because DOM Y grows downward and simulation/NDC Y grows upward; omitting that inversion is a shipped bug - the field trails mirrored vertically.
- The result is passed as `uniform vec2 uPointer;` (normalized). The shader never receives raw pixel coordinates.

The reference implementation in `repo:lab/src/experiments/particle-toy.ts` performs this exact clamp-and-invert exactly once per normalized update; the shader receives only `uPointer`.

### 2.2 Shader radial field and falloff

Inside the update fragment shader, the field is applied as a **bounded radial displacement**:

```glsl
vec2 toP = particle.xy - uPointer; // particle.xy already in normalized [0,1] field space
float dist = length(toP);
float radius = 0.18; // capped - any value > 0.35 is a budget/code-review finding
float sigma  = radius * 0.45;
float falloff = exp(- (dist * dist) / (2.0 * sigma * sigma)); // Gaussian
falloff *= smoothstep(radius, radius * 0.9, dist); // outer cutoff, ensures zero beyond radius+epsilon
falloff = clamp(falloff, 0.0, 1.0);
vec2 field = normalize(toP + 1e-4) * falloff * 0.04; // 0.04 is the capped strength
```

- `radius` is capped (recommended ≤ `0.18` normalized units for the fallback fixture; any production value above `0.35` is a review finding - it smears the field across the whole system). Smaller radii are correct - the default is deliberately narrow.
- The falloff is Gaussian `exp(-d²/(2σ²))` with a `smoothstep` outer cutoff so the field is exactly zero beyond a bounded disc. No unbounded `1/(d+ε)` field that influences every particle.
- The field never runs per-particle React state. The host writes one uniform; the shader loops only in GLSL.

The lab's `particle-toy-update.frag` documents this falloff verbatim and the test `repo:lab/tests/gpu-particles.test.ts` asserts that the source contains the Gaussian expression and a capped radius check.

## 3. Click impulse - one record, recovering over time, then inactive

A click creates **exactly one** impulse record. No accumulation in an array, no second impulse before the previous one recovered.

### 3.1 Impulse record

```ts
type Impulse = {
  origin: [number, number]; // normalized [0,1]², same space as uPointer (Y-inverted, clamped)
  radius: number;           // capped - e.g. ≤ 0.25 normalized, configured and clamped in shader
  strength: number;         // configured peak; multiplied by recovery curve each frame
  startTime: number;        // clock.elapsed at click, from the injected SceneClock
};
```

- The record is created from the same normalized pointer coordinate as §2.1, using the same clamp-and-invert. One click → one record; the handler replaces, never pushes.

### 3.2 Recovery curve - clock-driven, declarative

Strength decays over a **declared recovery time** via the injected deterministic clock, not `performance.now()` and not a per-frame factor:

```ts
const RECOVERY_SECONDS = 1.2; // declared, visible in the contract; lab fixture uses 1.2
function impulseStrength(now: number, impulse: Impulse | null): number {
  if (!impulse) return 0;
  const age = now - impulse.startTime; // `now` is clock.elapsed from the injected SceneClock
  if (age < 0 || age >= RECOVERY_SECONDS) return 0; // inactive after recovery window
  const t = age / RECOVERY_SECONDS; // in [0,1)
  return impulse.strength * (1 - t) * exp(-3.0 * t); // peak→zero, exact shape is contract (documented in update frag)
}
```

- While `0 ≤ age < RECOVERY_SECONDS` the shader receives a live impulse; at or beyond the window the impulse is **inactive** - the uniform strength is exactly `0` and the shader applies zero displacement.
- No `setState` per particle and no React state setter called inside `useFrame` / the render loop. The host updates one `uImpulse.*` uniform per frame; the shader decides per texel.

The lab documents this as `impulseRecovery = (1 - t) * exp(-3 t)` inside `particle-toy-update.frag` and in the TypeScript helper; tests assert that the source contains the recovery formula, the `0` strength past the window, and that the update shader samples at most one impulse.

## 4. Render-loop invariant - no per-particle React state

The following are hard prohibitions:

- No `setParticles` / `useState(particles)` that stores a `Float32Array` per particle and updates it from `useFrame`.
- No `setState` (React or otherwise) called every frame for the pointer or the impulse beyond the single uniform write to `uPointer` / `uImpulse`. The pointer uniform is written once per DOM event or once per frame from a cached normalized value, not via a React state transition per particle tick.
- Buffers backing a `Points` / `InstancedMesh` attribute are written from the rendered state texture (via readback or vertex shader sampling), not from React state.

The lab's `particle-toy.ts` mutates refs and writes uniforms; the test asserts that the source contains no `setState` / `useState` particle loop and that shader state is the only per-particle store.

## 5. Fallback, reduced motion, and capability - non-empty composition

A non-empty composition is mandatory in three situations. A blank canvas, a transparent clear, or a missing poster asset is never a fallback.

- **Reduced motion (`prefers-reduced-motion: reduce`):** the simulation freezes. `uTime` is held at `0`, pointer field strength becomes `0`, impulse is immediately inactive, `Points` attributes hold their last composition. The poster still image remains meaningful - it is the reduced-motion representation, not an empty container. Any toggle that restores motion must be a visible, keyboard-reachable control - a media-query-only freeze without a control is incomplete.
- **Poster:** the quality tier `Poster` is a composition, not a blank fallback color. Use `immersive-3d`'s poster contract and `3d-runtime-quality`'s tier definition. The particle lab renders a static `Points` snapshot for poster captures; `repo:lab/src/fixtures/gpu-particles-deterministic.ts` fires `data-wdu-ready` once that composition is stable.
- **Capability fallback:** when float render targets / `half-float` are unavailable or `WebGL2` context creation fails, the lab renders the poster composition and the Canvas falls back to the DOM headline/CTA without requiring GPU simulation. The capability signal is a readable device probe (see §6), not a try/catch that blanks silently.

## 6. Renderer matrix - what counts as evidence

### WebGL2

A **PASS** may only be recorded after **real browser execution** with a **float render target** (half-float or full-float) on the same device profile that ships the scene. Concretely: a valid `WebGL2RenderingContext`, `EXT_color_buffer_float` or `EXT_color_buffer_half_float` present, two `RGBA16F`/`HalfFloat` render targets created, a ping-pong update draw that completes without `FRAMEBUFFER_INCOMPLETE`, a sampled render, and a captured PNG whose `deviceProfile` and `floatTarget` are logged. Static source-text checks, a successful `tsc --noEmit`, or a mock/simulated target are not real execution - they cannot produce a WebGL2 PASS and must be reported as **UNAVAILABLE** when used as the sole evidence.

### WebGPU

**WebGPU** is `UNAVAILABLE`, never `PASS`, unless all of these co-occur: a live
`GPUDevice` was acquired, the copyable `templates/particles/compute-particles.ts`
WGSL/TSL implementation of the state update and particle render was submitted
and executed, and an artifact or screenshot tied to that run was recorded. Raw
GLSL - even via `three.webgpu`'s compatibility fallback - that has not been
rewritten as WGSL/TSL and executed on a `GPUDevice` is declaratively not a
WebGPU PASS. The backend matrix stores the result of the real compute verifier;
without that run it must remain `UNAVAILABLE`.

The contract field `webgpuRequires` records exactly that sentence so tooling can match it:

```ts
webgpuRequires: "WGSL/TSL implementation executed on a GPUDevice - raw GLSL is never WebGPU PASS";
```

The same two-source rule binds the plugin validator and the lab harness: a `PASS` must cite the browser-capability source; a `UNAVAILABLE` cites the missing device/run, not a code style objection.

## 7. Copyable starter reference

When copying this contract into a project:

1. Copy this file and `SKILL.md` §1's gate answer into the project's evidence directory.
2. Import the injected `SceneClock` and `RandomStreams` (`templates/runtime/determinism-runtime.ts`) - the simulation never reads `performance.now()` or `Math.random()` directly while `WDU_DETERMINISTIC=1`.
3. Allocate `qualityProfile.particles` count (from `3d-runtime-quality`) as a square or near-square texture dimension `ceil(sqrt(N))`; the lab's small fixture dimension stays labeled `fixture/test size only`.
4. Never copy the fixture dimension into the production profiles.

## Check - this reference

- [ ] Two separate `RGBA16F`/`HalfFloat` state targets with `highp`, `NearestFilter`, `NoColorSpace`, no depth/stencil, one owner, swap, and never sample the bound write target.
- [ ] Reset reinitializes both targets; no `new RenderTarget` inside the frame loop.
- [ ] Channel layout is `posLife` and `velSeed` (or equivalent documented alias).
- [ ] `RandomStreams` namespace `particles/spawn` is the sole source for spawn/reset; additional randomness uses another named stream.
- [ ] Pointer is normalized once per event via `clamp((clientX-left)/width,0,1)` / `clamp(1-(clientY-top)/height,0,1)`; the shader applies only a bounded Gaussian radial field with a documented cutoff.
- [ ] Click produces exactly one impulse record (`origin`, `radius`, `strength`, `startTime/age`) whose strength is `peak * (1-t) * exp(-3t)` via the injected clock's recovery window and is inactive (`0`) after it.
- [ ] No per-particle React state and no React state setter inside the render loop - no per-particle React state.
- [ ] Reduced-motion / poster / capability fallback are non-empty compositions, not a blank canvas.
- [ ] No particle count appears in this reference or the skill matrix; production consumes `qualityProfile.particles`; the fixture dimension carries a `fixture/test size` annotation.
- [ ] WebGL2 PASS only after real browser float-target execution; WebGPU PASS only after the copyable TSL template runs on a real GPUDevice; otherwise each backend is UNAVAILABLE.

## 8. Verification markers (test-only, must remain)

- normalized pointer
- capped radius
- never sampling the currently bound write target
- reset reinitializing both targets
- no per-frame reallocation
- Position/Life and Velocity/Spawn or Seed channels
- separate named stream
- clamp((clientX-left)/width and clamp(1-(clientY-top)/height
- falloff with exp(-d²/(2σ²)) and (1 - t) * exp(-3 - inactive after recovery - RECOVERY_SECONDS
- one impulse record with origin radius strength startTime
