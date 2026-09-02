# Shader module index

Seventeen modules exist as running code in the lab. This index is the entry
point: read the row, then read the shader. Nothing here is reconstructed from
prose, and a job that needs a frost transition opens
`templates/shaders/transition-interaction.frag` instead of inventing one.

Every module declares the same five fields — renderer support, cost class,
reduced-motion behaviour, colour-space assumption, and a visual fixture, plus
the path an implementation copies from. The fields are generated from
`repo:lab/src/modules/manifest.ts`, which is the source of truth; the fixture
column names the lab file that proves the module runs.

**There is no "apply all effects" path.** Every module in this index is
declared `noCombine`. A project selects the minimum chain that carries its
visual thesis. Stacking them because they are available is the anti-slop rule
failing in shader form.

**Cost class** is relative, not a budget. The budget stays in `immersive-3d`
§3 and the tiers in `3d-runtime-quality`; a `high` module does not fit
everywhere a `low` one does, and neither number replaces a measurement.

**Colour space is a contract between passes, not a preference.** Every module
below composes in linear RGB and tone-maps afterwards. Inserting one into a
chain that tone-maps early produces a wrong image that still renders.

## Copyable shaders

`templates/shaders/` holds the GLSL these modules are built from, mirrored
byte for byte from the lab. Three deliberate-failure shaders in
`repo:lab/src/fixtures/` are not mirrored: they exist to make a compile error
observable, and shipping them as copyable templates would invite the opposite.

## Modules

### Noise primitives

#### Simplex 3D noise` (`noise-simplex3d`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | medium |
| Reduced motion | Animation may freeze; noise field remains static. |
| Colour space | Linear RGB output; tone-map after composition. |
| Fixture | `repo:lab/src/experiments/shaders/foundational-shaders.frag` |
| Copy from | `templates/shaders/foundational-shaders.frag` |

#### Value 2D noise` (`noise-value2d`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | low |
| Reduced motion | Animation may freeze; noise field remains static. |
| Colour space | Linear RGB output; tone-map after composition. |
| Fixture | `repo:lab/src/experiments/shaders/foundational-shaders.frag` |
| Copy from | `templates/shaders/foundational-shaders.frag` |

#### Curl 3D noise` (`noise-curl3d`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | medium |
| Reduced motion | Animation may freeze; curl field remains static. |
| Colour space | Linear RGB output; tone-map after composition. |
| Fixture | `repo:lab/src/experiments/shaders/foundational-shaders.frag` |
| Copy from | `templates/shaders/foundational-shaders.frag` |

### Fresnel and iridescence

#### Fresnel Schlick` (`fresnel-schlick`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | low |
| Reduced motion | Fresnel term remains view-dependent; motion may freeze. |
| Colour space | Linear RGB output; tone-map after composition. |
| Fixture | `repo:lab/src/experiments/shaders/foundational-shaders.frag` |
| Copy from | `templates/shaders/foundational-shaders.frag` |

#### Thin-film iridescence` (`iridescence-thin-film`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | medium |
| Reduced motion | Iridescence tint remains static when motion freezes. |
| Colour space | Linear RGB output; tone-map after composition. |
| Fixture | `repo:lab/src/experiments/shaders/foundational-shaders.frag` |
| Copy from | `templates/shaders/foundational-shaders.frag` |

### Dissolve

#### Stable dissolve` (`dissolve-stable`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | low |
| Reduced motion | Dissolve threshold freezes at the current seed-derived value. |
| Colour space | Linear RGB output; alpha discarded in the fragment shader. |
| Fixture | `repo:lab/src/experiments/shaders/foundational-shaders.frag` |
| Copy from | `templates/shaders/foundational-shaders.frag` |

### Frosted transition

#### Frosted transition mask` (`frosted-transition-mask`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | medium |
| Reduced motion | Transition freezes at the current progress value; no animation. |
| Colour space | Linear RGB output; source samples clamped to the source quad. |
| Fixture | `repo:lab/src/experiments/shaders/transition-interaction.frag` |
| Copy from | `templates/shaders/transition-interaction.frag` |

### Chromatic offset

#### Capped chromatic offset` (`chromatic-offset`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | low |
| Reduced motion | Channel offset remains static; no animated change. |
| Colour space | Linear RGB output; red/blue channel samples clamped. |
| Fixture | `repo:lab/src/experiments/shaders/transition-interaction.frag` |
| Copy from | `templates/shaders/transition-interaction.frag` |

### Click shockwave

#### Click shockwave` (`click-shockwave`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | medium |
| Reduced motion | Shockwave does not animate; click origin still renders as a static state. |
| Colour space | Linear RGB output; displacement stays within declared radius. |
| Fixture | `repo:lab/src/experiments/shaders/transition-interaction.frag` |
| Copy from | `templates/shaders/transition-interaction.frag` |

### Flow-field deformation

#### Flow-field deformation` (`flow-field-deformation`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | medium |
| Reduced motion | Flow field freezes at the current time-derived state. |
| Colour space | Linear RGB output; UV displacement clamped to the source quad. |
| Fixture | `repo:lab/src/experiments/shaders/transition-interaction.frag` |
| Copy from | `templates/shaders/transition-interaction.frag` |

### SDF / MSDF text

#### SDF / MSDF text foundation` (`sdf-text`)

| Field | Value |
|---|---|
| Renderer support | WebGL2 |
| Cost class | low |
| Reduced motion | Text geometry is static; dissolve uniform is clamped to 0 under reduced motion. The visual surface stays a stable composition with no animation. |
| Colour space | Atlas is linear RGB unencoded (signed-distance rescaled into [0, 1], not display color). Output is composed in linear RGB and tone-mapped after composition. Same pass-order contract as the LUT module: scene -> text -> tone-map. |
| Fixture | `repo:lab/src/experiments/shaders/sdf-text.frag` |
| Copy from | `templates/shaders/sdf-text.frag` |

### Video texture

#### Video texture states` (`video-texture`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | medium |
| Reduced motion | Playback pauses; displays poster/fallback color. No time-driven change; static representation remains useful. |
| Colour space | sRGB video decoded to linear RGB for composition; output remains linear RGB before tone-map. Never blank. |
| Fixture | `repo:lab/src/experiments/shaders/media-post.frag` |
| Copy from | `templates/shaders/media-post.frag` |

### LUT colour grade

#### LUT color grade (render-graph)` (`lut-color-grade`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | low |
| Reduced motion | LUT is color-only; no animation, reduced-motion unchanged. |
| Colour space | Input linear RGB unencoded pre-tone-map; LUT sRGB strip decoded to linear; output linear RGB still pre-tone-map. Pass order scene -> LUT (read A, write B, never self-sample) -> tone-map/encode. Intermediate targets linear unencoded. WebGL2 GLSL PASS, WebGPU WGSL/TSL UNAVAILABLE declaratively when only GLSL shipped; raw GLSL never reported as WebGPU PASS. |
| Fixture | `repo:lab/src/experiments/shaders/media-post.frag` |
| Copy from | `templates/shaders/media-post.frag` |

The manifest lists both backends, but the module ships GLSL only: its own reduced-motion field records WebGPU as `UNAVAILABLE` until a WGSL/TSL implementation exists. Raw GLSL is never a WebGPU `PASS`.

### Film grain

#### Frame-rate-independent film grain` (`film-grain`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | low |
| Reduced motion | Grain frozen at t=0 / intensity 0 under reduced motion; static composition preserved without animation. |
| Colour space | Additive luminance grain in linear RGB; tone-map after grain. Driven by elapsedSeconds and seed, not frame count. |
| Fixture | `repo:lab/src/experiments/shaders/media-post.frag` |
| Copy from | `templates/shaders/media-post.frag` |

### Owned by another skill

These three share the manifest and the same five fields, but their gate lives
elsewhere. They are listed so the index is complete, not so `shaders-tsl`
routes to them.

#### GPU particle systems (ping-pong state)` (`gpu-particles`)

| Field | Value |
|---|---|
| Renderer support | WebGL2, WebGPU |
| Cost class | high |
| Reduced motion | Simulation frozen at t=0; static Points composition preserved. No animation when prefers-reduced-motion is set. |
| Colour space | Linear data texture (NoColorSpace, NearestFilter); render targets RGBA16F HalfFloat highp, no depth/stencil. Not display color. |
| Fixture | `repo:lab/src/experiments/particle-toy.ts` |
| Copy from | `templates/shaders/particle-toy-update.frag` |

The GLSL half is mirrored; the simulation loop itself is TypeScript and stays in the lab.

Gate owner: `gpu-particle-systems`.

#### DOM-mirrored shader text effects (scramble, glitch, dissolve)` (`dom-text-effects`)

| Field | Value |
|---|---|
| Renderer support | WebGL2 |
| Cost class | low |
| Reduced motion | All three effects collapse to amplitude 0 under reduced motion; the DOM interaction paths (pointer, focus, click, keyboard) stay live so accessibility is unaffected. The visual surface stays static and the DOM text remains the visible authority. |
| Colour space | Canvas overlay composes additively in linear RGB and is rendered with premultiplied alpha so the underlying DOM text is the visible authority. The DOM owns the color tokens; the shader does not invent color values. |
| Fixture | `repo:lab/src/experiments/shaders/dom-text-effects.ts` |
| Copy from | not mirrored — see the note |

No GLSL to mirror: the module is a TypeScript canvas overlay over DOM text.

Gate owner: `canvas-first-architecture`.

#### Canvas-only prohibition list (primary actions, forms, legal copy, pricing)` (`canvas-only-prohibition`)

| Field | Value |
|---|---|
| Renderer support | WebGL2 |
| Cost class | low |
| Reduced motion | The prohibition list is independent of motion: violation detection, runtime observer, and fixture all run identically with prefers-reduced-motion set. The decorative canvas surface stays static under reduced motion; only its visual amplitude is bounded, never its semantic authority. |
| Colour space | The module is structural, not visual: it asserts DOM presence and machine-translation readability of canonical twins. No color or pixel data is emitted by the module itself; the canvas overlay reuses the same linear-RGB premultiplied contract as the DOM-mirrored text effects. |
| Fixture | `repo:lab/src/fixtures/canvas-only-prohibition-deterministic.ts` |
| Copy from | not mirrored — see the note |

Not a shader. The executable validator ships as `templates/runtime/canvas-only-prohibition.ts`.

Gate owner: `canvas-first-architecture`.

## Using a module

1. Read the row. If the cost class or the renderer support does not fit the
   declared budget and backend, stop here. That is the decision the index
   exists to make cheap.
2. Copy the file named in **Copy from** into the project. It is a copy: the
   plugin ships one version and the project owns its own from that point.
3. Keep the reduced-motion behaviour the row states. It is the module's
   contract, not a suggestion, and `immersive-3d` §5 owns the rule it serves.
4. Place the pass where the colour-space field says it goes. `render-graph`
   owns the ordering when more than two effects share the frame.
5. Verify on every declared backend. A WebGL2 pass is not WebGPU evidence.
