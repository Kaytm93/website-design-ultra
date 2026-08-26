/**
 * Dissolve effect with stable seed-derived edge width.
 *
 * The dissolve threshold is driven by a noise value sampled at a position
 * that incorporates the stream seed. The edge width is derived from that
 * same seed and clamped so the fixture remains stable across runs and
 * backends.
 *
 * @module
 */

/**
 * Dissolve threshold with stable edge width.
 *
 * Cost class: low. One noise sample per fragment; no texture reads.
 *
 * Reduced motion: the threshold is frozen to the initial seed-derived value
 * and does not animate.
 *
 * @param position - World-space position used as the noise coordinate.
 * @param seed - Deterministic stream seed string hash.
 * @param threshold - Animated dissolve amount in [0, 1].
 * @returns vec2(alpha, edgeWidth).
 */
export const dissolveStable = /* glsl */ `
vec2 dissolveStable(vec3 position, float seed, float threshold) {
  float noise = value2D(position.xy + seed);
  float edgeWidth = clamp(0.02 + seed * 0.001, 0.01, 0.06);
  float alpha = smoothstep(threshold - edgeWidth, threshold + edgeWidth, noise * 0.5 + 0.5);
  return vec2(alpha, edgeWidth);
}
`;
