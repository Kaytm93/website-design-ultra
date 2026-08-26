#version 300 es
precision highp float;

uniform float uTime;

out vec4 fragColor;

// DELIBERATE SYNTAX ERROR: uResolution is not declared — this file is the
// compile-error fixture. When compiled, the WebGL context returns a line-level
// diagnostic that the lab captures and displays instead of a blank canvas.

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 col = 0.5 + 0.5 * cos(uTime + uv.xyx);
  fragColor = vec4(col, 1.0);
}