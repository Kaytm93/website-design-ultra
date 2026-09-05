precision highp float;

in vec2 reference; // per-particle UV into state textures [0,1]²

uniform sampler2D uPosLifeTex; // read target — never the currently bound write target
uniform sampler2D uVelSeedTex;
uniform float uTime;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

out float vLife;
out float vSeed;

void main() {
  vec4 posLife = texture(uPosLifeTex, reference);
  vec4 velSeed = texture(uVelSeedTex, reference);

  vec3 pos = posLife.xyz;
  float life = posLife.w;
  float seed = velSeed.w;

  vLife = life;
  vSeed = seed;

  // Points rendering from state texture — no per-particle React state
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = mix(1.0, 6.0, life) * (0.8 + seed * 0.4);
}
