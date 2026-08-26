/**
 * Foundational noise primitives for the shader lab.
 *
 * Each function is pure GLSL that compiles on WebGL2 (#version 300 es).
 * The companion manifest declares the same support for WebGPU TSL because
 * the math is backend-agnostic; only the input/output wiring changes.
 *
 * @module
 */

/**
 * Simplex 3D noise.
 *
 * Cost class: medium. One gradient evaluation per octave; three octaves
 * are used by default in the visual fixture. Overdraw is not increased
 * because this returns a single scalar.
 *
 * @param p - Normalized 3D position.
 * @returns Scalar noise in [-1, 1].
 */
export const simplex3D = /* glsl */ `
float simplex3D(vec3 p) {
  const vec3 K1 = vec3(0.333333333, 0.166666667, 0.333333333);
  const vec3 K2 = vec3(-0.333333333, 0.166666667, -0.333333333);
  const vec3 K3 = vec3(0.166666667, 0.5, 0.166666667);
  const vec3 K4 = vec3(-0.166666667, 0.5, -0.166666667);

  vec3 i = floor(p + dot(p, K1));
  vec3 x0 = p - i + dot(i, K1);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + K1;
  vec3 x2 = x0 - i2 + K2;
  vec3 x3 = x0 - K3;
  vec3 x4 = x0 - K4;

  i = mod(i, 289.0);
  float n0 = dot(
    vec3(
      6.0 * fract(0.5 * (i.x + i.y + i.z)) - 3.0,
      6.0 * fract(0.5 * (i.x + i.y + i.z + 1.0)) - 3.0,
      6.0 * fract(0.5 * (i.x + i.y + i.z + 2.0)) - 3.0,
    ),
    x0,
  );
  float n1 = dot(
    vec3(
      6.0 * fract(0.5 * (i.x + i1.x + i.y + i1.y + i.z + i1.z)) - 3.0,
      6.0 * fract(0.5 * (i.x + i1.x + i.y + i1.y + i.z + i1.z + 1.0)) - 3.0,
      6.0 * fract(0.5 * (i.x + i1.x + i.y + i1.y + i.z + i1.z + 2.0)) - 3.0,
    ),
    x1,
  );
  float n2 = dot(
    vec3(
      6.0 * fract(0.5 * (i.x + i2.x + i.y + i2.y + i.z + i2.z)) - 3.0,
      6.0 * fract(0.5 * (i.x + i2.x + i.y + i2.y + i.z + i2.z + 1.0)) - 3.0,
      6.0 * fract(0.5 * (i.x + i2.x + i.y + i2.y + i.z + i2.z + 2.0)) - 3.0,
    ),
    x2,
  );
  float n3 = dot(
    vec3(
      6.0 * fract(0.5 * (i.x + 1.0 + i.y + 1.0 + i.z + 1.0)) - 3.0,
      6.0 * fract(0.5 * (i.x + 1.0 + i.y + 1.0 + i.z + 1.0 + 1.0)) - 3.0,
      6.0 * fract(0.5 * (i.x + 1.0 + i.y + 1.0 + i.z + 1.0 + 2.0)) - 3.0,
    ),
    x3,
  );
  float n4 = dot(
    vec3(
      6.0 * fract(0.5 * (i.x + 1.0 + i.y + 1.0 + i.z)) - 3.0,
      6.0 * fract(0.5 * (i.x + 1.0 + i.y + 1.0 + i.z + 1.0)) - 3.0,
      6.0 * fract(0.5 * (i.x + 1.0 + i.y + 1.0 + i.z + 2.0)) - 3.0,
    ),
    x4,
  );

  float t0 = 0.6 - x0.x * x0.x - x0.y * x0.y - x0.z * x0.z;
  float t1 = 0.6 - x1.x * x1.x - x1.y * x1.y - x1.z * x1.z;
  float t2 = 0.6 - x2.x * x2.x - x2.y * x2.y - x2.z * x2.z;
  float t3 = 0.6 - x3.x * x3.x - x3.y * x3.y - x3.z * x3.z;
  float t4 = 0.6 - x4.x * x4.x - x4.y * x4.y - x4.z * x4.z;

  t0 *= t0;
  t1 *= t1;
  t2 *= t2;
  t3 *= t3;
  t4 *= t4;

  return 27.0 * (
    t0 * t0 * n0 +
    t1 * t1 * n1 +
    t2 * t2 * n2 +
    t3 * t3 * n3 +
    t4 * t4 * n4
  );
}
`;

/**
 * Value noise with smooth Hermite interpolation.
 *
 * Cost class: low. One dot product and one hash per cell corner; the
 * fixture uses two octaves so the cost stays below the simplex path.
 *
 * @param p - 2D position.
 * @returns Scalar noise in [-1, 1].
 */
export const value2D = /* glsl */ `
float value2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  int ix = int(i.x);
  int iz = int(i.y);
  float a = hash2D(vec2(float(ix), float(iz)));
  float b = hash2D(vec2(float(ix + 1), float(iz)));
  float c = hash2D(vec2(float(ix), float(iz + 1)));
  float d = hash2D(vec2(float(ix + 1), float(iz + 1)));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}

float hash2D(vec2 p) {
  const float K = 12.9898;
  const float K2 = 78.233;
  float h = dot(p, vec2(K, K2));
  return fract(sin(h) * 43758.5453);
}
`;

/**
 * Curl noise from the analytical gradient of simplex noise.
 *
 * Cost class: medium. Requires six simplex evaluations to build the
 * Jacobian, but returns a divergence-free vector. The fixture keeps the
 * curl scale bounded so it cannot generate per-pixel overdraw.
 *
 * @param p - 3D position.
 * @param strength - Bounded curl strength multiplier.
 * @returns 3D curl vector.
 */
export const curl3D = /* glsl */ `
vec3 curl3D(vec3 p, float strength) {
  const float e = 0.1;
  float dx = simplex3D(p + vec3(e, 0.0, 0.0)) - simplex3D(p - vec3(e, 0.0, 0.0));
  float dy = simplex3D(p + vec3(0.0, e, 0.0)) - simplex3D(p - vec3(0.0, e, 0.0));
  float dz = simplex3D(p + vec3(0.0, 0.0, e)) - simplex3D(p - vec3(0.0, 0.0, e));

  vec3 curl = vec3(
    (simplex3D(p + vec3(0.0, dz, 0.0)) - simplex3D(p - vec3(0.0, dz, 0.0))) -
    (simplex3D(p + vec3(0.0, dy, 0.0)) - simplex3D(p - vec3(0.0, dy, 0.0))),
    (simplex3D(p + vec3(dx, 0.0, 0.0)) - simplex3D(p - vec3(dx, 0.0, 0.0))) -
    (simplex3D(p + vec3(dz, 0.0, 0.0)) - simplex3D(p - vec3(dz, 0.0, 0.0))),
    (simplex3D(p + vec3(0.0, 0.0, dy)) - simplex3D(p - vec3(0.0, 0.0, dy))) -
    (simplex3D(p + vec3(0.0, 0.0, dx)) - simplex3D(p - vec3(0.0, 0.0, dx)))
  );

  return curl * strength / (2.0 * e + 0.0001);
}
`;
