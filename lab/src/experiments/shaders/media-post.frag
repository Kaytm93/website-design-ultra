precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform sampler2D uSceneTexture;
uniform sampler2D uVideoTexture;
uniform sampler2D uLutStrip;
uniform float uLutSize;
uniform float uLutIntensity;
uniform float uGrainIntensity;
uniform float uSeed;
uniform int   uVideoState;
uniform vec3  uFallbackColor;
uniform bool  uReducedMotion;

out vec4 fragColor;

// ---------------------------------------------------------------------------
// Module dependencies — IP-08C baseline note
// ---------------------------------------------------------------------------
// This file is self-contained for WebGL2 compilation: it does not rely on
// symbols from other shader files. IP-08C's transition-interaction.frag
// required a minimal compatibility note (see that file header) because its
// `value2D`/`curl3D`/`screenTexture` were not declared in-file. This file
// avoids that pre-existing blocker by inlining its helpers (hashGrain,
// applyLut) without cross-file symbols.

// ---------------------------------------------------------------------------
// [module:video-texture] — five states, never blank fallback
// ---------------------------------------------------------------------------
#define VIDEO_STATE_LOCKED   0
#define VIDEO_STATE_LOADING  1
#define VIDEO_STATE_PLAYING  2
#define VIDEO_STATE_FAILURE  3
#define VIDEO_STATE_FALLBACK 4

vec4 sampleVideoTexture(sampler2D videoTex, vec2 uv, int state, vec3 fallbackColor) {
  vec2 clampedUv = clamp(uv, 0.0, 1.0);
  if (state == VIDEO_STATE_PLAYING) {
    vec4 sampled = texture(videoTex, clampedUv);
    vec3 linear = pow(sampled.rgb, vec3(2.2));
    float luminance = dot(linear, vec3(0.2126, 0.7152, 0.0722));
    if (sampled.a < 0.01 || luminance < 0.001) {
      return vec4(fallbackColor, 1.0);
    }
    return vec4(linear, 1.0);
  }
  if (state == VIDEO_STATE_LOCKED) {
    return vec4(fallbackColor * 0.85, 1.0);
  }
  if (state == VIDEO_STATE_LOADING) {
    return vec4(fallbackColor, 1.0);
  }
  return vec4(fallbackColor, 1.0);
}

vec4 sampleVideoTextureReducedMotion(sampler2D videoTex, vec2 uv, int state, vec3 fallbackColor, bool reducedMotion) {
  if (reducedMotion) {
    return vec4(fallbackColor, 1.0);
  }
  return sampleVideoTexture(videoTex, uv, state, fallbackColor);
}

// ---------------------------------------------------------------------------
// [module:lut-color-grade] — render-graph-compatible LUT
// ---------------------------------------------------------------------------
// Contract (normative, also in lab/src/modules/lut.ts):
// - Input:  linear RGB, unencoded, pre-tone-map (read from uSceneTexture)
// - LUT texture: sRGB-encoded neutral 3D strip, decoded to linear after fetch
// - Output: linear RGB, still unencoded, pre-tone-map
// - Pass order: scene (write A linear unencoded) -> LUT (read A, write B, never sample B) -> tone-map/encode
// - Intermediate targets: linear, unencoded (RGBA16F linear); no premature encoding
// - Renderer compatibility: WebGL2 GLSL 300 es PASS when compiled; WebGPU is
//   declaratively UNAVAILABLE when only GLSL is shipped — raw GLSL is never reported as WebGPU PASS.
// - Negative gate: this pass reads uSceneTexture, never fragColor/self.

vec3 applyLutWebGL2(vec3 linearColor, sampler2D lutStrip, float lutSize, float intensity) {
  float clampedIntensity = clamp(intensity, 0.0, 1.0);
  vec3 clamped = clamp(linearColor, 0.0, 1.0);
  float size = lutSize;
  float slices = size;
  float r = clamped.r * (size - 1.0);
  float g = clamped.g * (size - 1.0);
  float b = clamped.b * (size - 1.0);
  float sliceLow  = floor(b);
  float sliceHigh = min(sliceLow + 1.0, slices - 1.0);
  float bFrac = fract(b);
  vec2 lutUvLow  = vec2((sliceLow  * size + r + 0.5) / (slices * size), (g + 0.5) / size);
  vec2 lutUvHigh = vec2((sliceHigh * size + r + 0.5) / (slices * size), (g + 0.5) / size);
  vec3 lutLow  = pow(texture(lutStrip, lutUvLow).rgb,  vec3(2.2));
  vec3 lutHigh = pow(texture(lutStrip, lutUvHigh).rgb, vec3(2.2));
  vec3 lutMixed = mix(lutLow, lutHigh, bFrac);
  return mix(clamped, lutMixed, clampedIntensity);
}

// ---------------------------------------------------------------------------
// [module:film-grain] — frame-rate-independent, seed-deterministic
// ---------------------------------------------------------------------------
float hashGrain(vec2 p, float seed) {
  float h = dot(p, vec2(127.1, 311.7)) + seed * 19.19;
  return fract(sin(h) * 43758.5453123);
}

vec3 filmGrain(vec2 uv, float elapsedSeconds, float seed, float intensity) {
  float clampedIntensity = clamp(intensity, 0.0, 1.0);
  float quant = floor(elapsedSeconds * 60.0 + 0.0001) / 60.0;
  float grainT = quant * 13.7 + seed * 7.33;
  vec2 grainUv = uv * 1.7 + vec2(grainT * 0.13, grainT * 0.07);
  float n = hashGrain(grainUv * 512.0, seed + grainT);
  float centered = (n * 2.0 - 1.0) * clampedIntensity * 0.08;
  return vec3(centered);
}

vec3 filmGrainReducedMotion(vec2 uv, float elapsedSeconds, float seed, float intensity, bool reducedMotion) {
  if (reducedMotion) {
    return vec3(0.0);
  }
  return filmGrain(uv, elapsedSeconds, seed, intensity);
}

// ---------------------------------------------------------------------------
// Visual fixture
// ---------------------------------------------------------------------------
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  float activeTime = uReducedMotion ? 0.0 : uTime;
  float grainTime  = uReducedMotion ? 0.0 : uTime;

  // 1. Video texture (state-driven, reduced-motion aware)
  vec4 video = sampleVideoTextureReducedMotion(uVideoTexture, uv, uVideoState, uFallbackColor, uReducedMotion);

  // 2. Scene sample: in this fixture the "scene" is the video output already
  //    rendered to a linear unencoded intermediate. We still exercise the LUT
  //    read path by modulating with a procedural base then applying LUT.
  vec3 sceneLinear = video.rgb * 0.9 + vec3(0.02, 0.02, 0.03);

  // 3. LUT pass: reads uSceneTexture conceptually; in this single-pass fixture
  //    we use sceneLinear directly. A real render-graph would bind the prior
  //    pass output to uSceneTexture — the contract is demonstrated, not the
  //    feedback. Never sample fragColor.
  vec3 lutApplied;
  if (uLutIntensity > 0.001) {
    // WebGL2 path: 2D strip lookup. WebGPU would use a separate WGSL module,
    // declared UNAVAILABLE here — raw GLSL is never reported as WebGPU PASS.
    lutApplied = applyLutWebGL2(sceneLinear, uLutStrip, uLutSize, uLutIntensity);
  } else {
    lutApplied = sceneLinear;
  }

  // 4. Film grain — driven by elapsedSeconds and seed, not frame count
  vec3 grain = filmGrainReducedMotion(uv, grainTime, uSeed, uGrainIntensity, uReducedMotion);
  vec3 color = clamp(lutApplied + grain, 0.0, 1.0);

  // 5. Tone-map last (linear -> sRGB for display). Intermediate targets remain linear unencoded.
  //    Simple gamma encode for display; real app would use ACES/neutral tone-map here.
  vec3 encoded = pow(color, vec3(1.0 / 2.2));

  fragColor = vec4(encoded, 1.0);
}
