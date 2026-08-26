/**
 * LUT color-grade module — IP-08D.
 *
 * Render-graph-compatible LUT placement with explicit color-space contract.
 *
 * LUT contract — normative:
 * - Input color space:  linear RGB, unencoded, pre-tone-map.
 *   The scene pass writes to a linear, unencoded intermediate target (RGBA16F
 *   or RGBA8 linear). The LUT pass reads that target, never the target it is
 *   writing.
 * - LUT texture encoding: neutral 3D LUT stored as 2D strip, sRGB-encoded
 *   identity. Sampling the LUT at its identity coordinate returns the input
 *   unchanged after sRGB->linear decode.
 * - Output color space: linear RGB, still unencoded and pre-tone-map.
 *   Tone-mapping and OETF encoding happen in the final pass after LUT.
 * - Pass order:  scene (write A, linear unencoded) -> LUT (read A, write B,
 *   never sample B) -> tone-map + encode (read B, write screen).
 *   LUT never samples the target currently being written (no feedback).
 * - Intermediate targets: intermediate attachments are linear and unencoded.
 *   Never apply sRGB decode twice, never encode before LUT.
 * - Renderer-compatible implementation:
 *   WebGL2: GLSL 300 es, uniform sampler2D uLutTexture; lookup via
 *     2D strip mapping (size 32, 32 slices tiled as 32*32). Function
 *     `applyLutWebGL2`.
 *   WebGPU: WGSL is distinct; raw GLSL is NOT reported as WebGPU PASS.
 *     The declarative backend matrix marks WebGPU as UNAVAILABLE for this
 *     module when only GLSL is shipped. A TSL/WGSL path is required for
 *     a real WebGPU PASS — not claimed here. The TSL wireframe for the
 *     LUT lookup is provided as a comment and is not compiled as GLSL.
 *
 * Negative gate: the module does not sample the write target; the experiment
 * explicitly binds `uSceneTexture` (read) and writes to `fragColor` (write).
 *
 * @module
 */

/**
 * GLSL LUT lookup — WebGL2 path.
 *
 * The caller is responsible for binding:
 * - `sampler2D sceneTexture` (the previous linear scene pass, read-only)
 * - `sampler2D lutTexture`   (neutral LUT strip, read-only)
 * - Never binding `fragColor` as input.
 */
export const lutColorGradeWebGL2 = /* glsl */ `
uniform sampler2D uSceneTexture;
uniform sampler2D uLutStrip;
uniform float uLutSize; // e.g. 32.0
uniform float uLutIntensity; // in [0,1], 0 = identity

// LUT identity strip coordinates: domain [0,1] RGB -> 2D strip UV.
// Layout: 32 slices tiled horizontally: slice = floor(B * (size-1)), cell coords = R,G + slice offset.
vec3 applyLutWebGL2(vec3 linearColor, sampler2D lutStrip, float lutSize, float intensity) {
  float clampedIntensity = clamp(intensity, 0.0, 1.0);
  vec3 clamped = clamp(linearColor, 0.0, 1.0);

  float size = lutSize;
  float slices = size;

  // Scale from [0,1] texel-centered coords. The LUT texture must use NEAREST filtering
  // so sampling does not interpolate across slice boundaries.
  float r = clamped.r * (size - 1.0);
  float g = clamped.g * (size - 1.0);
  float b = clamped.b * (size - 1.0);

  float sliceLow  = floor(b);
  float sliceHigh = min(sliceLow + 1.0, slices - 1.0);
  float bFrac = fract(b);

  vec2 lutUvLow  = vec2((sliceLow  * size + r + 0.5) / (slices * size), (g + 0.5) / size);
  vec2 lutUvHigh = vec2((sliceHigh * size + r + 0.5) / (slices * size), (g + 0.5) / size);

  vec3 lutLow  = texture(lutStrip, lutUvLow).rgb;
  vec3 lutHigh = texture(lutStrip, lutUvHigh).rgb;

  // Decode LUT texels from sRGB to linear (LUT stored as sRGB identity strip).
  lutLow  = pow(lutLow,  vec3(2.2));
  lutHigh = pow(lutHigh, vec3(2.2));

  vec3 lutMixed = mix(lutLow, lutHigh, bFrac);
  return mix(clamped, lutMixed, clampedIntensity);
}

// Convenience: sample scene and apply LUT in one call; never samples fragColor.
vec3 lutPassWebGL2(vec2 uv) {
  vec2 clampedUv = clamp(uv, 0.0, 1.0);
  vec3 sceneLinear = texture(uSceneTexture, clampedUv).rgb;
  return applyLutWebGL2(sceneLinear, uLutStrip, uLutSize, uLutIntensity);
}
`;

/**
 * WebGPU / TSL wireframe — NOT compiled as GLSL.
 *
 * This string is documentation for the declarative backend matrix.
 * It declares the WebGPU path as UNAVAILABLE until a WGSL/TSL
 * implementation is provided and executed on a real WebGPU device.
 *
 * If WebGPU is executed with only `applyLutWebGL2` (raw GLSL), the
 * result must remain UNAVAILABLE, never PASS.
 */
export const lutWebGPUWireframe = /* wgsl-not-compiled */ `
// WGSL/TSL wireframe for LUT — NOT claimed as PASS without device execution.
// @group(0) @binding(0) var sceneTexture: texture_2d<f32>;
// @group(0) @binding(1) var sceneSampler: sampler;
// @group(0) @binding(2) var lutStrip: texture_2d<f32>;
// @group(0) @binding(3) var lutSampler: sampler; // nearest
// fn applyLutWGSL(linearColor: vec3<f32>, lutSize: f32, intensity: f32) -> vec3<f32> { /* 2D strip lookup, sRGB->linear decode, mix */ }
// Pass order identical: scene (linear unencoded A) -> lut (read A, write B) -> tone-map.
`;

export const LUT_CONTRACT = {
  inputColorSpace: 'linear RGB, unencoded, pre-tone-map',
  lutTextureEncoding: 'sRGB-encoded neutral 3D LUT as 2D strip, linear after decode',
  outputColorSpace: 'linear RGB, still unencoded, pre-tone-map',
  toneMapSide: 'after LUT; LUT output is still linear before tone-map + encode',
  passOrder: 'scene -> LUT (read scene, write LUT target, never self-sample) -> tone-map/encode',
  intermediateTargets: 'linear, unencoded (e.g. RGBA16F linear); no premature encoding',
  renderers: {
    webgl2: 'PASS via GLSL 300 es applyLutWebGL2 when executed',
    webgpu: 'UNAVAILABLE declarative until WGSL/TSL path executes on WebGPU device; raw GLSL is never reported as WebGPU PASS',
  },
  negativeGate: 'Never sample target currently being written; uSceneTexture != fragColor',
} as const;
