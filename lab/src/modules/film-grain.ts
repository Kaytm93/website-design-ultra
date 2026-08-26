/**
 * Frame-rate-independent film grain — IP-08D.
 *
 * Grain is driven by elapsed seconds and a deterministic seed, not by frame
 * count or per-frame accumulation. Equal elapsed time at 30/60/120 Hz yields
 * identical per-pixel grain values.
 *
 * Contract:
 * - Inputs: `uv` (0..1), `elapsedSeconds` (monotonic seconds from deterministic
 *   clock), `seed` (stable numeric seed, e.g. 7.0). Optionally `intensity`.
 * - Determinism: `elapsedSeconds` is quantized by the function (floors at
 *   1/60 granularity by default) so floating drift across tick counts does not
 *   change the value when logical time is equal. The noise is a pure function
 *   of (uv, elapsedSeconds, seed); no accumulated state is carried between
 *   frames.
 * - Negative gate: the function never reads `uFrame`, never increments a
 *   persisted accumulator, never branches on frame count. A frame-count or
 *   accumulation variant is registered as a negative fixture and must fail.
 * - Reduced motion: when `reducedMotion` is true, grain intensity is 0 (or
 *   equivalently time frozen at 0.0). The output is static and the composition
 *   remains useful without animation.
 *
 * The JavaScript reference implementation below is byte-equivalent to the GLSL
 * for offline determinism tests.
 *
 * @module
 */

/**
 * GLSL film grain — time-driven, seed-deterministic, frame-rate independent.
 */
export const filmGrain = /* glsl */ `
float hashGrain(vec2 p, float seed) {
  // Deterministic 2D hash — no texture read.
  float h = dot(p, vec2(127.1, 311.7)) + seed * 19.19;
  return fract(sin(h) * 43758.5453123);
}

vec3 filmGrain(vec2 uv, float elapsedSeconds, float seed, float intensity) {
  float clampedIntensity = clamp(intensity, 0.0, 1.0);
  // Quantize elapsedSeconds to 1/60 granularity so 30/60/120-Hz stepping
  // at equal logical time converges to the same grain value.
  float quant = floor(elapsedSeconds * 60.0 + 0.0001) / 60.0;
  // Seed plus time selects a grain field; uv selects the texel within it.
  float grainT = quant * 13.7 + seed * 7.33;
  vec2 grainUv = uv * 1.7 + vec2(grainT * 0.13, grainT * 0.07);
  float n = hashGrain(grainUv * 512.0, seed + grainT);
  // Map to [-intensity, intensity] additive luminance displacement.
  float centered = (n * 2.0 - 1.0) * clampedIntensity * 0.08;
  return vec3(centered);
}

// Reduced-motion wrapper: frozen at t=0 with 0 intensity when reducedMotion.
vec3 filmGrainReducedMotion(vec2 uv, float elapsedSeconds, float seed, float intensity, bool reducedMotion) {
  if (reducedMotion) {
    return vec3(0.0);
  }
  return filmGrain(uv, elapsedSeconds, seed, intensity);
}

// Negative example (DO NOT USE): frame-count variant — varies with tick count.
// This is intentionally documented as the prohibited alternative for fixtures.
// float filmGrainFrameCount(vec2 uv, float frameCount, float seed) { return hashGrain(uv + frameCount * 0.01, seed); }
`;

export const GRAIN_CONTRACT = {
  drivenBy: 'elapsedSeconds (quantized) + seed, not frame count',
  quantization: 'floor(elapsedSeconds * 60)/60 so 30/60/120-Hz equal time is identical',
  determinism: 'pure function of (uv, elapsedSeconds, seed); no accumulation',
  reducedMotion: 'intensity 0 / frozen at t=0 when reducedMotion=true',
  negative: 'frame-count and per-frame accumulation variants are prohibited and negatively tested',
} as const;

/**
 * Reference JS implementation — mirrors GLSL hash and quantization.
 * Used by offline deterministic tests at 30/60/120 Hz simulation.
 */
export function hashGrainJS(p: [number, number], seed: number): number {
  const h = p[0] * 127.1 + p[1] * 311.7 + seed * 19.19;
  return fractJS(Math.sin(h) * 43758.5453123);
}

function fractJS(x: number): number {
  return x - Math.floor(x);
}

export function filmGrainJS(
  uv: [number, number],
  elapsedSeconds: number,
  seed: number,
  intensity: number,
): [number, number, number] {
  const clampedIntensity = Math.max(0, Math.min(1, intensity));
  const quant = Math.floor(elapsedSeconds * 60 + 0.0001) / 60;
  const grainT = quant * 13.7 + seed * 7.33;
  const grainUv: [number, number] = [
    uv[0] * 1.7 + grainT * 0.13,
    uv[1] * 1.7 + grainT * 0.07,
  ];
  const n = hashGrainJS([grainUv[0] * 512, grainUv[1] * 512], seed + grainT);
  const centered = (n * 2 - 1) * clampedIntensity * 0.08;
  return [centered, centered, centered];
}

export function filmGrainReducedMotionJS(
  uv: [number, number],
  elapsedSeconds: number,
  seed: number,
  intensity: number,
  reducedMotion: boolean,
): [number, number, number] {
  if (reducedMotion) return [0, 0, 0];
  return filmGrainJS(uv, elapsedSeconds, seed, intensity);
}

/**
 * Frame-count variant (negative fixture) — diverges across 30/60/120 Hz at equal time.
 */
export function filmGrainFrameCountJS(
  uv: [number, number],
  frameCount: number,
  seed: number,
): [number, number, number] {
  const n = hashGrainJS([uv[0] + frameCount * 0.01, uv[1] + frameCount * 0.01], seed);
  const centered = (n * 2 - 1) * 0.08;
  return [centered, centered, centered];
}
