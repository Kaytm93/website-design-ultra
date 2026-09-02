# TSL Cheatsheet

Verify names against the installed Three version; TSL evolves quickly.

Imports: TSL functions from `three/tsl`, node materials/renderer from `three/webgpu`.

## Material hooks (NodeMaterial)
- `colorNode` — fragment color
- `emissiveNode` — emission (for bloom)
- `positionNode` — vertex position (deformation)
- `normalNode` — normals
- `roughnessNode`, `metalnessNode`, `opacityNode` — PBR channels

## Common inputs
- `positionLocal`, `positionWorld`, `positionView`
- `normalLocal`, `normalView`, `positionViewDirection`
- `uv()` — texture coordinates
- `time` — running time (animated shaders)
- `cameraPosition`, `modelWorldMatrix`

## Math / ops (method chain or function)
- `.add() .sub() .mul() .div()`
- `.clamp() .saturate() .mix(a,b,t) .smoothstep()`
- `sin() cos() pow() abs() fract() floor() length() dot() cross() normalize() mix() step()`
- `oneMinus(x)` = 1 - x

## Noise
- `mx_noise_float(vec3)` — 3D value noise (MaterialX)
- `mx_fractal_noise_float(vec3)` — fbm
- Tiling trick: input `*frequency + time*speed`

## Patterns
```js
// Fresnel
const fres = pow(oneMinus(dot(normalView, positionViewDirection).clamp()), 3.0);

// Vertical gradient 0..1
const t = positionLocal.y.mul(0.5).add(0.5);

// Animated displacement along normal
const n = mx_noise_float(positionLocal.mul(1.5).add(time.mul(0.3)));
material.positionNode = positionLocal.add(normalLocal.mul(n.mul(0.2)));
```

## Compute + storage buffers (WebGPU-only)
```js
import * as THREE from 'three/webgpu';
import { Fn, storage, instanceIndex, computeKernel, uniform } from 'three/tsl';
const data = new THREE.StorageInstancedBufferAttribute(count, 4);
const state = storage(data, 'vec4', count);
const morphA = storage(new THREE.StorageInstancedBufferAttribute(count, 4), 'vec4', count).toReadOnly();
const morphB = storage(new THREE.StorageInstancedBufferAttribute(count, 4), 'vec4', count).toReadOnly();
const progress = uniform(0);
const update = Fn(() => {
  const p = state.element(instanceIndex).toVar();
  const target = morphA.element(instanceIndex).mix(morphB.element(instanceIndex), progress);
  p.xyz.assign(p.xyz.add(target.xyz.sub(p.xyz).mul(0.016)));
  state.element(instanceIndex).assign(p);
})();
const kernel = computeKernel(update, [64]);
kernel.count = count; // count comes from qualityProfile.particles
await renderer.computeAsync(kernel);
```
`state.toAttribute()` feeds `positionNode`; morph targets are selected with `mix(A, B, progress)`. Map the velocity buffer to a speed node and `mix(colorA, colorB, speed.clamp(0, 1))` for velocity colour. Compute/storage has no WebGL2 path: keep the RGBA16F ping-pong shader fallback and report WebGPU `UNAVAILABLE` without a real `GPUDevice` execution.

## Renderer
- `WebGPURenderer` from `three/webgpu`; `await renderer.init()`; compatible features can fall back to WebGL2.
- WebGPU-only compute/effects still need an explicit fallback.
- Classic `EffectComposer` is not supported by `WebGPURenderer`; use its node/TSL postprocessing stack.
- Uniforms from JS: `uniform(value)` from `three/tsl`, then mutate `.value` per frame via a ref.

## Rules
The rules live in `SKILL.md` → Core rules. This cheatsheet is pure syntax reference.
