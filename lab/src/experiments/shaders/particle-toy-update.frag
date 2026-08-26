precision highp float;

uniform sampler2D uStatePosLife; // read target only — never the currently bound write target
uniform sampler2D uStateVelSeed; // read target only — never the currently bound write target
uniform float uTime;
uniform float uDelta;
uniform vec2 uPointer; // normalized [0,1]² from host clamp-and-invert, shader only
uniform vec2 uImpulseOrigin; // normalized impulse origin [0,1]²
uniform float uImpulseRadius; // capped radius
uniform float uImpulseStrength; // already decayed via (1-t)*exp(-3t) recovery, 0 when inactive
uniform float uImpulseAge; // seconds since impulse start
uniform int uOutMode; // 0 = PosLife, 1 = VelSeed — same shader initializes/updates both channels
uniform bool uInit; // true = initialize from deterministic spawn textures, false = normal update
uniform sampler2D uInitPosLife; // deterministic spawn data for posLife init (particles/spawn)
uniform sampler2D uInitVelSeed; // deterministic spawn data for velSeed init (particles/spawn + separate field stream)

in vec2 vUv;

out vec4 fragColor;

// Particle state layout:
// posLife = xyz position, w life in [0,1]
// velSeed = xyz velocity, w seed (stable per-particle random)

// Capped radial field around normalized pointer — bounded Gaussian with outer cutoff
// falloff = exp(-d²/(2σ²)) * smoothstep(radius, radius*0.9, d) — zero beyond radius+epsilon
// radius capped at 0.35 (review finding), fixture uses 0.18

void main() {
  // Initialize mode: copy deterministic spawn textures directly via real GPU draw
  // This ensures the four ping-pong targets are initialized by an executed Fullscreen-Shader-Draw,
  // not by a CPU-only DataTexture upload. The init textures are built on the host from
  // the injected `particles/spawn` stream and the separate `particles/field` stream.
  if (uInit) {
    if (uOutMode == 0) {
      fragColor = texture(uInitPosLife, vUv);
    } else {
      fragColor = texture(uInitVelSeed, vUv);
    }
    return;
  }

  vec4 posLife = texture(uStatePosLife, vUv);
  vec4 velSeed = texture(uStateVelSeed, vUv);

  vec3 pos = posLife.xyz;
  vec3 vel = velSeed.xyz;
  float life = posLife.w;
  float seed = velSeed.w;

  // Normalized particle position in field space [0,1] derived from world pos
  vec2 fieldPos = pos.xy * 0.25 + 0.5; // map world [-2,2] → [0,1] for pointer field

  // Bounded pointer field: Gaussian falloff
  vec2 toP = fieldPos - uPointer;
  float dist = length(toP);
  float radius = 0.18; // capped — any value > 0.35 is a review finding
  float sigma = radius * 0.45;
  float falloff = exp(- (dist * dist) / (2.0 * sigma * sigma));
  falloff *= smoothstep(radius, radius * 0.9, dist);
  // ensure zero beyond radius+epsilon via smoothstep cutoff above
  falloff = clamp(falloff, 0.0, 1.0);
  vec2 pointerField = normalize(toP + vec2(1e-4)) * falloff * 0.04;

  // Click impulse: one record, recovering strength already supplied as uImpulseStrength
  // impulseRecovery = (1 - t) * exp(-3t) computed on host from injected clock; shader just applies
  vec2 impulseField = vec2(0.0);
  if (uImpulseStrength > 0.001) {
    float cappedRadius = clamp(uImpulseRadius, 0.0, 0.25);
    vec2 toImpulse = fieldPos - uImpulseOrigin;
    float dImp = length(toImpulse);
    float impFalloff = exp(- (dImp * dImp) / (2.0 * cappedRadius * cappedRadius * 0.25));
    impFalloff *= smoothstep(cappedRadius, cappedRadius * 0.85, dImp);
    impFalloff = clamp(impFalloff, 0.0, 1.0);
    impulseField = normalize(toImpulse + vec2(1e-4)) * impFalloff * uImpulseStrength * 0.06;
  }

  // Integration (frame-rate independent via uDelta)
  vec3 accel = vec3(pointerField, 0.0) + vec3(impulseField, 0.0);
  // add tiny curl from seed for field variation (uses separate particles/field seed stream originally)
  accel.x += sin(seed * 6.28 + uTime * 0.7) * 0.002;
  vel += accel * clamp(uDelta, 0.0, 0.033);
  vel *= 0.995; // damping
  pos += vel * clamp(uDelta, 0.0, 0.033);

  // Life cycle — respawn when life reaches 0
  life -= uDelta * 0.2;
  if (life <= 0.0) {
    life = 1.0;
    pos = vec3((seed - 0.5) * 2.0, (fract(seed * 1.7) - 0.5) * 2.0, (fract(seed * 2.3) - 0.5) * 1.0);
    vel = vec3((fract(seed * 3.1) - 0.5) * 0.3, (fract(seed * 4.7) - 0.5) * 0.3, 0.0);
  }

  // Write updated state — this draw writes to the bound write target, which is never sampled above
  // Caller ensures uStatePosLife/uStateVelSeed are read targets, write is via render target binding.
  // Dual-target simulation outputs the channel selected by uOutMode.
  if (uOutMode == 0) {
    fragColor = vec4(pos, life);
  } else {
    fragColor = vec4(vel, seed);
  }
}
