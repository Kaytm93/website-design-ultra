precision highp float;

in float vLife;
in float vSeed;

out vec4 fragColor;

void main() {
  // Circular point shape
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float alpha = (1.0 - smoothstep(0.6, 1.0, r2)) * vLife;
  vec3 col = mix(vec3(0.4, 0.7, 1.0), vec3(1.0, 0.6, 0.8), vSeed);
  fragColor = vec4(col, alpha);
}
