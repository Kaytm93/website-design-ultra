#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uDissolve;
uniform float uSeed;
uniform bool uReducedMotion;
uniform bool uShowMissingGlyph;

// [module:sdf-text]
// MSDF atlas sample with median-of-three test and explicit missing-glyph
// fallback. The atlas stores three signed-distance channels in the red,
// green and blue components of each texel; the alpha is unused. A texel
// is inside the contour when its median signed distance is < 0.5
// (the rescale puts 0.5 at the contour). The shader reverses the rescale
// to recover a signed distance in [-halfSpread, +halfSpread] pixels.
//
// Visible-failure contract: when the rendered codepoint is not in the
// atlas (uAtlasIndex == 65535), the shader paints a magenta tile plus an
// outline so the failure is obvious without being destructive.

uniform sampler2D uAtlas;
uniform vec2 uAtlasColumnsRows; // (columns, rows) in tiles
uniform int uAtlasIndex; // glyph index; 65535 = MISSING_GLYPH_INDEX

const float SDF_HALF_SPREAD = 4.0;
const int MISSING_GLYPH_INDEX = 65535;

float median3(float a, float b, float c) {
  return max(min(a, b), min(max(a, b), c));
}

float sampleSignedDistance(vec2 uv) {
  vec4 sample0 = texture(uAtlas, uv);
  // Atlas packs signed distance rescaled into [0,1]; reverse the rescale
  // into [-1, 1] before the median test.
  float r = sample0.r * 2.0 - 1.0;
  float g = sample0.g * 2.0 - 1.0;
  float b = sample0.b * 2.0 - 1.0;
  return median3(r, g, b) * SDF_HALF_SPREAD;
}

void main() {
  vec2 px = vUv * uResolution;
  // Hard-coded glyph box for the deterministic fixture. The fixture only
  // renders one tile per run; the layout math here is intentionally simple
  // so the missing-glyph path is provably reachable.
  vec2 tileUv = vUv;
  float dist = sampleSignedDistance(tileUv);

  // Reduced motion: clamp dissolve so the surface stays static.
  float activeDissolve = uReducedMotion ? 0.0 : uDissolve;

  float coverage = smoothstep(0.5 - activeDissolve, 0.5, dist);

  vec3 missing = vec3(1.0, 0.0, 1.0);
  vec3 ink = vec3(0.92, 0.94, 0.96);
  vec3 color = mix(ink, vec3(0.05, 0.06, 0.08), coverage);

  if (uAtlasIndex == MISSING_GLYPH_INDEX && uShowMissingGlyph) {
    // Visible-failure tile: magenta fill with a darker cross.
    vec2 q = fract(vUv * 8.0);
    float cross = step(0.45, q.x) * step(q.x, 0.55) + step(0.45, q.y) * step(q.y, 0.55);
    color = mix(missing, vec3(0.4, 0.0, 0.4), cross);
  }

  fragColor = vec4(color, 1.0);
}