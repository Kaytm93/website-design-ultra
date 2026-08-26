/**
 * Video texture states for the shader lab — IP-08D.
 *
 * Five mutually exclusive states. Every shader and fixture must handle all
 * five and guarantee a non-blank fallback representation.
 *
 * States:
 * - locked   — autoplay blocked (requires user gesture). Show poster/fallback.
 * - loading  — source selected but not yet decodable. Show poster with progress.
 * - playing  — decodable frames available. Sample the video texture.
 * - failure  — decode / network / CORS failure. Show fallback, never blank.
 * - fallback — explicit static poster path when video is unavailable.
 *
 * Reduced motion: playback pauses, no time-driven change. The visible frame
 * freezes at the poster/fallback color. A useful static representation is
 * preserved; the canvas never blanks.
 *
 * Implementation note: the sampler uniform `uVideoTexture` is only sampled
 * when `state == 2` (playing). All other states return the uniform fallback
 * color so the pass never depends on an unavailable video decode.
 *
 * @module
 */

/**
 * Numeric video state — mirrored in GLSL as #define constants.
 */
export const VIDEO_STATE = {
  LOCKED: 0,
  LOADING: 1,
  PLAYING: 2,
  FAILURE: 3,
  FALLBACK: 4,
} as const;

export type VideoStateValue = (typeof VIDEO_STATE)[keyof typeof VIDEO_STATE];

/**
 * Non-blank fallback color. Used when video is unavailable or has failed.
 * Chosen as muted desaturated blue-grey — luminance > 0.08 so framebuffer
 * is never blank/transparent.
 */
export const VIDEO_FALLBACK_RGB = [0.14, 0.16, 0.19] as const;

/**
 * GLSL function: sampleVideoTexture
 *
 * Contract:
 * - `videoTex` is the video element texture (externally updated).
 * - `uv` is normalized quad UV.
 * - `state` uses VIDEO_STATE constants.
 * - `fallbackColor` is a non-blank RGB fallback supplied by the caller.
 * - Returns RGBA with alpha=1.0 in all branches — never blank.
 *
 * Reduced motion: caller passes uReducedMotion; shader branch freezes at
 * fallback when reduced motion is true.
 */
export const videoTexture = /* glsl */ `
#define VIDEO_STATE_LOCKED   0
#define VIDEO_STATE_LOADING  1
#define VIDEO_STATE_PLAYING  2
#define VIDEO_STATE_FAILURE  3
#define VIDEO_STATE_FALLBACK 4

vec4 sampleVideoTexture(sampler2D videoTex, vec2 uv, int state, vec3 fallbackColor) {
  vec2 clampedUv = clamp(uv, 0.0, 1.0);
  if (state == VIDEO_STATE_PLAYING) {
    vec4 sampled = texture(videoTex, clampedUv);
    // Video arrives as sRGB-encoded bytes; convert to linear for composition.
    // GLSL: manual sRGB->linear (gamma 2.2 approx) — caller tone-maps after.
    vec3 linear = pow(sampled.rgb, vec3(2.2));
    // Guard against zero/blank decode: if sampled is black and alpha 0, use fallback.
    float luminance = dot(linear, vec3(0.2126, 0.7152, 0.0722));
    if (sampled.a < 0.01 || luminance < 0.001) {
      return vec4(fallbackColor, 1.0);
    }
    return vec4(linear, 1.0);
  }
  if (state == VIDEO_STATE_LOCKED) {
    // Locked: show fallback dimmed to signal gesture-required.
    return vec4(fallbackColor * 0.85, 1.0);
  }
  if (state == VIDEO_STATE_LOADING) {
    // Loading: fallback with subtle luminance pulse placeholder (no time dependency here — caller drives pulse via fallbackColor).
    return vec4(fallbackColor, 1.0);
  }
  // FAILURE and FALLBACK both show fallback — never transparent or blank.
  return vec4(fallbackColor, 1.0);
}
`;

/**
 * GLSL helper: videoTextureReducedMotion
 *
 * When reduced motion is true, always returns fallback regardless of state,
 * preserving a useful static representation and stopping time-driven change.
 */
export const videoTextureReducedMotion = /* glsl */ `
vec4 sampleVideoTextureReducedMotion(sampler2D videoTex, vec2 uv, int state, vec3 fallbackColor, bool reducedMotion) {
  if (reducedMotion) {
    return vec4(fallbackColor, 1.0);
  }
  return sampleVideoTexture(videoTex, uv, state, fallbackColor);
}
`;
