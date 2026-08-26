# IP-08C compatibility note — bounded correction for IP-08D

**Pre-existing blocker inspected for IP-08D.**

`lab/src/experiments/shaders/transition-interaction.frag` (IP-08C) used three
symbols without declaring them in-file:

- `value2D(vec2)` and `curl3D(vec3,float)` — defined in
  `lab/src/experiments/shaders/foundational-shaders.frag` but not in this file.
  When the file is compiled standalone (diagnostic compile, `verify-lab.mjs` gate,
  or an isolated fixture import) the GLSL compiler reports `undeclared identifier`.
- `screenTexture` — sampled as `texture(screenTexture, uv)` inside
  `chromaticOffset` but no `uniform sampler2D screenTexture;` existed.

This did not block IP-08A/IP-08B gates because those gates did not compile this
frag in a standalone WebGL2 context; they validated the module strings and the
experiment via `RawShaderMaterial` with a shared header provisioned at runtime.
Any fresh isolated-compile gate introduced by IP-08D (LUT declares
`never-sample-write-target`, backend matrix, grain determinism) would fail
before exercising IP-08D logic.

**Bounded correction applied.**

Only `lab/src/experiments/shaders/transition-interaction.frag` was touched,
and only the minimal preamble needed to make the file self-contained for WebGL2
compilation:

- Added `uniform sampler2D screenTexture;`
- Added inline `hash2D`/`value2D` and `curl3D` helpers using the same hash as
  the foundational fixture, capped to the declared strengths.

No module contract was changed — caps (0.25, 0.08, 0.5, 0.3), pass order, and
`noCombine` metadata remain untouched. The cross-file dependency is preserved
conceptually; the correction keeps the file compilable without re-authoring the
module system or introducing SDF/MSDF, particles, or later queue tasks.
