#version 300 es
precision highp float;

uniform vec2  uResolution;
uniform int   uVideoState;
uniform vec3  uFallbackColor;

out vec4 fragColor;

// DELIBERATE FAILURE FIXTURE: the `uMissingLut` sampler is intentionally
// not declared — compiling this file must surface a line-level diagnostic
// mentioning `uMissingLut` and `undeclared identifier`, demonstrating the
// failure path does not silently produce a blank canvas.

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  // Video fallback path — always non-blank. Failure and fallback states
  // both return uFallbackColor (luminance > 0.08).
  vec3 color;
  if (uVideoState == 3) { // FAILURE
    color = uFallbackColor;
  } else if (uVideoState == 4) { // FALLBACK
    color = uFallbackColor;
  } else {
    color = uFallbackColor * 0.95;
  }

  // Intentional undeclared reference: forces a compile error for failure-fixture verification.
  vec3 lutSample = texture(uMissingLut, uv).rgb;

  fragColor = vec4(color + lutSample * 0.0, 1.0);
}
