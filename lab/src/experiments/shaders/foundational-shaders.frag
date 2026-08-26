precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform float uNoiseStrength;
uniform float uCurlStrength;
uniform float uIridescenceThickness;
uniform float uDissolveThreshold;
uniform float uSeed;

out vec4 fragColor;

// ---------------------------------------------------------------------------
// Foundational shader modules — inline GLSL for direct WebGL2 compilation.
// ---------------------------------------------------------------------------

// [module:noise-simplex3d]
vec3 mod289_3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289_4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289_4(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289_3(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x2_ = x_ * ns.x + ns.yyyy;
  vec4 y2_ = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x2_) - abs(y2_);

  vec4 b0 = vec4(x2_.xy, y2_.xy);
  vec4 b1 = vec4(x2_.zw, y2_.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float simplex3D(vec3 p) {
  return snoise(p);
}

// [module:noise-value2d]
float hash2D(vec2 p) {
  const float K = 12.9898;
  const float K2 = 78.233;
  float h = dot(p, vec2(K, K2));
  return fract(sin(h) * 43758.5453);
}

float value2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash2D(i);
  float b = hash2D(i + vec2(1.0, 0.0));
  float c = hash2D(i + vec2(0.0, 1.0));
  float d = hash2D(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0 - 1.0;
}

// [module:noise-curl3d]
vec3 curl3D(vec3 p, float strength) {
  float eps = 0.1;
  float dxp = snoise(p + vec3(eps, 0.0, 0.0));
  float dxm = snoise(p - vec3(eps, 0.0, 0.0));
  float dyp = snoise(p + vec3(0.0, eps, 0.0));
  float dym = snoise(p - vec3(0.0, eps, 0.0));
  float dzp = snoise(p + vec3(0.0, 0.0, eps));
  float dzm = snoise(p - vec3(0.0, 0.0, eps));

  vec3 curl;
  curl.x = dyp - dym - (dzp - dzm);
  curl.y = dzp - dzm - (dxp - dxm);
  curl.z = dxp - dxm - (dyp - dym);

  return curl * strength / (2.0 * eps + 0.0001);
}

// [module:fresnel-schlick]
float fresnelSchlick(vec3 N, vec3 V, float f0) {
  float cosTheta = max(dot(N, V), 0.0);
  return mix(f0, 1.0, pow(1.0 - cosTheta, 5.0));
}

// [module:iridescence-thin-film]
vec3 iridescenceThinFilm(vec3 N, vec3 V, float thickness) {
  float cosTheta = max(dot(N, V), 0.0);
  vec3 wavelengths = vec3(680.0, 550.0, 440.0);
  vec3 delta = 2.0 * 3.14159265359 * (1.0 - cosTheta) * wavelengths;
  vec3 shift = cos(delta) * 0.5 + 0.5;
  vec3 tint = mix(vec3(0.05), vec3(0.95), shift);
  return tint * fresnelSchlick(N, V, 0.04);
}

// [module:dissolve-stable]
vec2 dissolveStable(vec3 position, float seed, float threshold) {
  float noise = value2D(position.xy + seed);
  float edgeWidth = clamp(0.02 + seed * 0.001, 0.01, 0.06);
  float alpha = smoothstep(threshold - edgeWidth, threshold + edgeWidth, noise * 0.5 + 0.5);
  return vec2(alpha, edgeWidth);
}

// ---------------------------------------------------------------------------
// Visual fixture
// ---------------------------------------------------------------------------
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 col = vec3(0.02, 0.02, 0.03);

  float seed = uSeed;
  vec3 position = vec3(uv * 3.0, uTime * 0.15);
  position.xy += seed * 0.001;

  float simplex = simplex3D(position) * uNoiseStrength;
  col += vec3(0.08, 0.18, 0.22) * smoothstep(-0.2, 0.8, simplex);

  float value = value2D(uv * 6.0 + seed) * 0.5;
  col += vec3(0.18, 0.10, 0.22) * smoothstep(-0.1, 0.6, value);

  vec3 curl = curl3D(position * 0.8, uCurlStrength);
  float curlMag = length(curl) * 0.25;
  col += vec3(0.12, 0.22, 0.18) * smoothstep(0.05, 0.35, curlMag);

  vec3 N = normalize(vec3(uv * 2.0 - 1.0, 1.0));
  vec3 V = normalize(vec3(0.0, 0.0, 1.0));
  float fresnel = fresnelSchlick(N, V, 0.04);
  col += vec3(0.6, 0.8, 1.0) * fresnel * 0.25;

  vec3 iridescence = iridescenceThinFilm(N, V, uIridescenceThickness);
  col += iridescence * 0.35;

  vec2 dissolve = dissolveStable(position, seed, uDissolveThreshold);
  float edgeWidth = dissolve.y;
  if (dissolve.x < 0.5) {
    float edge = smoothstep(0.5 - edgeWidth, 0.5, dissolve.x);
    col += vec3(0.95, 0.35, 0.15) * edge * 0.6;
  }
  if (dissolve.x < 0.01) discard;

  fragColor = vec4(col, 1.0);
}
