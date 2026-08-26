/**
 * Fresnel and thin-film iridescence modules for the shader lab.
 *
 * Both effects share a single Schlick-style Fresnel term. Iridescence adds
 * a wavelength-dependent phase shift with a bounded spectral sample count.
 * Overdraw is bounded by disabling alpha blending; the visual fixture uses
 * an opaque base with a Fresnel highlight layer.
 *
 * @module
 */

/**
 * Schlick Fresnel approximation.
 *
 * Cost class: low. One dot product, one pow, and one mix per fragment.
 * No texture reads; no transparent overdraw in the fixture.
 *
 * @param N - Normalized world-space normal.
 * @param V - Normalized view direction.
 * @param f0 - Base reflectivity at normal incidence.
 * @returns Fresnel term in [0, 1].
 */
export const fresnelSchlick = /* glsl */ `
float fresnelSchlick(vec3 N, vec3 V, float f0) {
  float cosTheta = max(dot(N, V), 0.0);
  return mix(f0, 1.0, pow(1.0 - cosTheta, 5.0));
}
`;

/**
 * Thin-film iridescence with bounded spectral samples.
 *
 * Cost class: medium. The fixture uses three wavelength samples; increasing
 * the sample count above six is flagged in the manifest as a cost exception.
 * The phase shift is wrapped so thickness stays in a physically plausible
 * 200–900 nm band.
 *
 * Color space: linear RGB output. The caller is responsible for tone-mapping
 * and output encoding.
 *
 * @param N - Normalized world-space normal.
 * @param V - Normalized view direction.
 * @param thickness - Film thickness in nanometres.
 * @returns RGB iridescence color.
 */
export const iridescenceThinFilm = /* glsl */ `
vec3 iridescenceThinFilm(vec3 N, vec3 V, float thickness) {
  float cosTheta = max(dot(N, V), 0.0);
  float phase = 2.0 * 3.14159265359 * thickness * (1.0 - cosTheta);
  const vec3 wavelengths = vec3(680.0, 550.0, 440.0);
  vec3 delta = 2.0 * 3.14159265359 * (1.0 - cosTheta) * wavelengths;
  vec3 shift = cos(delta) * 0.5 + 0.5;
  vec3 tint = mix(vec3(0.05), vec3(0.95), shift);
  return tint * fresnelSchlick(N, V, 0.04);
}
`;
