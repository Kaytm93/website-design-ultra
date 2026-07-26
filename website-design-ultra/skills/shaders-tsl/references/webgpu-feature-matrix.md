# WebGPU Feature Matrix

Status: Three r185 documentation, checked on 2026-07-25. Verify the installed Three version and the migration guide before every implementation.

## Legend

- ✅: intended path; still test visually.
- ⚠️: feature/backend/version dependent; a smoke test is mandatory.
- ❌: no supported path in this renderer/backend.
- —: not applicable.

## Matrix

| Feature | WebGPU | WebGL2 fallback (`forceWebGL`) | TSL postprocessing | Compute dependency | Known limitations |
|---|---|---|---|---|---|
| glTF + built-in PBR/node materials | ✅ | ✅ | — | no | Test loader extensions, blending, and output per backend |
| TSL material graph | ✅ WGSL | ✅ GLSL for compatible nodes | — | no | A WebGPU compile does not prove fallback compatibility |
| TSL vertex displacement/Fresnel/noise | ✅ | ⚠️ only transpilable nodes | — | no | Measure fragment cost, precision, and mobile overdraw |
| `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile()` | ❌ | ❌ in the `WebGPURenderer` fallback | — | no | Port to TSL or keep a deliberate `WebGLRenderer` path |
| Instancing, skinning, morphs, shadows | ✅ | ✅ | — | no | Image and performance parity is not guaranteed |
| Tone mapping and output color space | ✅ | ✅ | ✅ as output chain | no | Check render targets and transparent clear colors separately |
| Basic PostFX, for example bloom/color adjustments | ✅ | ⚠️ verify each effect individually | ✅ | usually no | Do not reuse classic composer passes |
| MRT/G-buffer-based node passes | ✅ | ⚠️ WebGL2 capabilities/attachment limits | ✅ | no | Format and attachment limits are device dependent |
| Advanced node passes, for example SSGI/SSS/DoF | ✅ | ⚠️ effect dependent | ✅ | effect dependent | High cost; often off or simplified on the mobile tier |
| `RenderPipeline`/node composition | ✅ | ⚠️ verify nodes and targets individually | ✅ | optional | The API is version sensitive; check `needsUpdate`/pass lifecycle |
| Storage buffer / compute dispatch | ✅ | ❌ | optional | yes | A separate CPU, texture, or disable fallback is required |
| GPU particle simulation with compute | ✅ | ❌ | — | yes | Low/Medium need a CPU or static alternative |
| Custom WGSL/backend-specific node | ✅ | ❌ | optional | optional | Leaves the shared TSL path |
| Classic `EffectComposer` | ❌ | ❌ in the `WebGPURenderer` path | ❌ | no | Use only with a deliberate legacy `WebGLRenderer` stack |

`forceWebGL: true` tests the WebGL2 backend path of `WebGPURenderer`; it is not an identity test for the classic `WebGLRenderer`.

## Feature record

Document for every feature actually used:

```yaml
feature: "selective bloom"
three-version: "0.185.x"
webgpu: "pass"
webgl2-fallback: "pass | degraded | fail"
tsl-postprocessing: true
compute-required: false
fallback: "emissive material without bloom"
tested:
  chrome-macos: "version + date"
  chrome-windows: "version + date"
  mobile: "device/browser + date"
known-limitations: "one concise sentence"
```

## Maintenance protocol

1. Pin and record the exact Three version.
2. Read the official migration guide for every version bump.
3. Render the same shot with WebGPU and with `forceWebGL: true`.
4. Use identical camera, assets, tone mapping, exposure, and quality tier.
5. Compile every material and every PostFX pass on both backends.
6. Check console, context loss, transparency, shadows, skinning, and render targets.
7. Photograph both paths with the capability-checked
   `scripts/verify-browser.mjs` adapter from the plugin, or with real host
   browser automation. Update date, browser, and limitations. When both are
   missing, log `UNAVAILABLE`; do not claim a pass without artifacts.
8. Mark compute features without a fallback as WebGPU-only and ship a poster, CPU, or simplified alternative.

## Known renderer boundaries

- `WebGPURenderer` remains version sensitive; verify APIs against the installed release.
- The WebGL2 fallback and the classic `WebGLRenderer` have different feature sets.
- Classic shader materials and `EffectComposer` are not a migration without porting.
- TSL postprocessing replaces the classic composer in the `WebGPURenderer` path.
- Compute and storage buffers require an explicit non-compute alternative.
- After upgrades, pay particular attention to premultiplied alpha, transparent backgrounds, and pass output.

## Primary sources

- [Three.js WebGPURenderer manual](https://threejs.org/manual/en/webgpurenderer)
- [Three.js TSL specification](https://threejs.org/docs/TSL.html)
- [Three.js Migration Guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide)
