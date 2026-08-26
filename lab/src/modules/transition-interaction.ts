/**
 * Transition and interaction shader modules for the lab.
 *
 * Each module declares bounded inputs, reduced-motion behavior, and
 * composition rules. Modules are not auto-composed: an experiment must
 * explicitly import and activate each effect.
 *
 * @module
 */

/**
 * Frosted transition / displacement mask.
 *
 * Blends between a base color and a frosted color using a noise-driven
 * mask. The displacement is clamped so texture lookups never escape the
 * source quad.
 *
 * @param uv - Normalized screen UV.
 * @param base - Base sample color.
 * @param frosted - Frosted overlay color.
 * @param progress - Transition progress in [0, 1].
 * @param strength - Displacement strength, capped at 0.25.
 * @param seed - Deterministic seed.
 * @returns Frosted sample color.
 */
export const frostedTransitionMask = /* glsl */ `
vec3 frostedTransitionMask(vec2 uv, vec3 base, vec3 frosted, float progress, float strength, float seed) {
  float cappedStrength = clamp(strength, 0.0, 0.25);
  vec2 displacement = vec2(
    value2D(uv * 4.0 + seed) * cappedStrength,
    value2D(uv * 4.0 + seed + 0.5) * cappedStrength
  );
  vec2 sampleUv = clamp(uv + displacement, 0.0, 1.0);
  vec3 displaced = mix(base, frosted, smoothstep(0.0, 1.0, progress));
  return mix(displaced, frosted, smoothstep(0.45, 0.55, progress));
}
`;

/**
 * Chromatic offset with hard amplitude cap.
 *
 * Offsets the red/blue channels independently from the green channel.
 * The maximum per-channel offset is bounded so the effect never samples
 * outside the source quad.
 *
 * @param uv - Normalized screen UV.
 * @param col - Source color.
 * @param amplitude - Base offset amplitude, capped at 0.08.
 * @param direction - Offset direction in screen space.
 * @returns Chromatically offset color.
 */
export const chromaticOffset = /* glsl */ `
vec3 chromaticOffset(vec2 uv, vec3 col, float amplitude, vec2 direction) {
  float cappedAmplitude = clamp(amplitude, 0.0, 0.08);
  vec2 redUv = clamp(uv + direction * cappedAmplitude, 0.0, 1.0);
  vec2 blueUv = clamp(uv - direction * cappedAmplitude, 0.0, 1.0);
  return vec3(
    texture(screenTexture, redUv).r,
    col.g,
    texture(screenTexture, blueUv).b
  );
}
`;

/**
 * Click shockwave.
 *
 * Emits a single radial pulse from a click origin. The pulse radius
 * grows with time and is clamped so it cannot exceed the declared
 * maximum radius. In reduced-motion contexts the shockwave freezes
 * at the initial state and does not animate.
 *
 * @param uv - Normalized screen UV.
 * @param origin - Click origin in normalized UV space.
 * @param time - Elapsed time since click in seconds.
 * @param maxRadius - Maximum radius in normalized UV space, capped at 1.0.
 * @param strength - Shockwave strength, capped at 0.5.
 * @returns Distortion offset.
 */
export const clickShockwave = /* glsl */ `
vec2 clickShockwave(vec2 uv, vec2 origin, float time, float maxRadius, float strength) {
  float cappedMaxRadius = clamp(maxRadius, 0.0, 1.0);
  float cappedStrength = clamp(strength, 0.0, 0.5);
  vec2 delta = uv - origin;
  float dist = length(delta);
  float radius = clamp(time * 0.5, 0.0, cappedMaxRadius);
  float ring = smoothstep(radius - 0.05, radius, dist) - smoothstep(radius, radius + 0.05, dist);
  return normalize(delta + 0.0001) * ring * cappedStrength;
}
`;

/**
 * Flow-field deformation.
 *
 * Displaces UVs along a curl-noise flow field. The displacement magnitude
 * is clamped so the texture samples never escape the source quad. The
 * time input is frame-rate independent because it is driven by the
 * scene clock delta, not wall-clock seconds.
 *
 * @param uv - Normalized screen UV.
 * @param time - Frame-rate independent elapsed time.
 * @param seed - Deterministic seed.
 * @param strength - Flow strength, capped at 0.3.
 * @returns Deformed UV.
 */
export const flowFieldDeformation = /* glsl */ `
vec2 flowFieldDeformation(vec2 uv, float time, float seed, float strength) {
  float cappedStrength = clamp(strength, 0.0, 0.3);
  vec3 p = vec3(uv * 3.0, time * 0.25 + seed * 0.01);
  vec3 flow = curl3D(p, cappedStrength);
  vec2 offset = flow.xy * cappedStrength * 0.1;
  return clamp(uv + offset, 0.0, 1.0);
}
`;
