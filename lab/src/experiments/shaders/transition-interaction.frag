precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform float uFrostedProgress;
uniform float uFrostedStrength;
uniform float uChromaticAmplitude;
uniform float uFlowStrength;
uniform float uShockwaveTime;
uniform vec2  uShockwaveOrigin;
uniform float uShockwaveMaxRadius;
uniform float uShockwaveStrength;
uniform float uSeed;
uniform bool  uReducedMotion;

out vec4 fragColor;

// [module:frosted-transition-mask]
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

// [module:chromatic-offset]
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

// [module:click-shockwave]
vec2 clickShockwave(vec2 uv, vec2 origin, float time, float maxRadius, float strength) {
  float cappedMaxRadius = clamp(maxRadius, 0.0, 1.0);
  float cappedStrength = clamp(strength, 0.0, 0.5);
  vec2 delta = uv - origin;
  float dist = length(delta);
  float radius = clamp(time * 0.5, 0.0, cappedMaxRadius);
  float ring = smoothstep(radius - 0.05, radius, dist) - smoothstep(radius, radius + 0.05, dist);
  return normalize(delta + 0.0001) * ring * cappedStrength;
}

// [module:flow-field-deformation]
vec2 flowFieldDeformation(vec2 uv, float time, float seed, float strength) {
  float cappedStrength = clamp(strength, 0.0, 0.3);
  vec3 p = vec3(uv * 3.0, time * 0.25 + seed * 0.01);
  vec3 flow = curl3D(p, cappedStrength);
  vec2 offset = flow.xy * cappedStrength * 0.1;
  return clamp(uv + offset, 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 col = 0.5 + 0.5 * cos(uTime * 0.6 + uv.xyx + vec3(0.0, 2.0, 4.0));

  float activeTime = uReducedMotion ? 0.0 : uTime;

  vec2 flowUv = flowFieldDeformation(uv, activeTime, uSeed, uFlowStrength);
  col = 0.5 + 0.5 * cos(activeTime * 0.6 + flowUv.xyx + vec3(0.0, 2.0, 4.0));

  col = frostedTransitionMask(flowUv, col, vec3(0.85, 0.88, 0.94), uFrostedProgress, uFrostedStrength, uSeed);

  vec2 shockwaveOffset = clickShockwave(flowUv, uShockwaveOrigin, uShockwaveTime, uShockwaveMaxRadius, uShockwaveStrength);
  vec2 shockedUv = clamp(flowUv + shockwaveOffset, 0.0, 1.0);
  col = 0.5 + 0.5 * cos(activeTime * 0.6 + shockedUv.xyx + vec3(0.0, 2.0, 4.0));
  col = frostedTransitionMask(shockedUv, col, vec3(0.85, 0.88, 0.94), uFrostedProgress, uFrostedStrength, uSeed);

  if (uChromaticAmplitude > 0.001) {
    col = chromaticOffset(shockedUv, col, uChromaticAmplitude, normalize(vec2(1.0, 0.5)));
  }

  fragColor = vec4(col, 1.0);
}
