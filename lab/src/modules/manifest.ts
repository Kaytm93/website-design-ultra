/**
 * Manifest for foundational shader modules.
 *
 * Every module entry declares the five required fields:
 * - renderer support
 * - cost class
 * - reduced-motion behavior
 * - color space assumptions
 * - visual fixture reference
 *
 * @module
 */

export interface ShaderModuleManifestEntry {
  id: string;
  name: string;
  rendererSupport: ('webgl2' | 'webgpu')[];
  costClass: 'low' | 'medium' | 'high';
  reducedMotion: string;
  colorSpace: string;
  fixture: string;
  noCombine: boolean;
}

export const foundationalShaderManifest: ShaderModuleManifestEntry[] = [
  {
    id: 'noise-simplex3d',
    name: 'Simplex 3D noise',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'medium',
    reducedMotion: 'Animation may freeze; noise field remains static.',
    colorSpace: 'Linear RGB output; tone-map after composition.',
    fixture: 'lab/src/experiments/shaders/foundational-shaders.frag',
    noCombine: true,
  },
  {
    id: 'noise-value2d',
    name: 'Value 2D noise',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'low',
    reducedMotion: 'Animation may freeze; noise field remains static.',
    colorSpace: 'Linear RGB output; tone-map after composition.',
    fixture: 'lab/src/experiments/shaders/foundational-shaders.frag',
    noCombine: true,
  },
  {
    id: 'noise-curl3d',
    name: 'Curl 3D noise',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'medium',
    reducedMotion: 'Animation may freeze; curl field remains static.',
    colorSpace: 'Linear RGB output; tone-map after composition.',
    fixture: 'lab/src/experiments/shaders/foundational-shaders.frag',
    noCombine: true,
  },
  {
    id: 'fresnel-schlick',
    name: 'Fresnel Schlick',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'low',
    reducedMotion: 'Fresnel term remains view-dependent; motion may freeze.',
    colorSpace: 'Linear RGB output; tone-map after composition.',
    fixture: 'lab/src/experiments/shaders/foundational-shaders.frag',
    noCombine: true,
  },
  {
    id: 'iridescence-thin-film',
    name: 'Thin-film iridescence',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'medium',
    reducedMotion: 'Iridescence tint remains static when motion freezes.',
    colorSpace: 'Linear RGB output; tone-map after composition.',
    fixture: 'lab/src/experiments/shaders/foundational-shaders.frag',
    noCombine: true,
  },
  {
    id: 'dissolve-stable',
    name: 'Stable dissolve',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'low',
    reducedMotion: 'Dissolve threshold freezes at the current seed-derived value.',
    colorSpace: 'Linear RGB output; alpha discarded in the fragment shader.',
    fixture: 'lab/src/experiments/shaders/foundational-shaders.frag',
    noCombine: true,
  },
  {
    id: 'frosted-transition-mask',
    name: 'Frosted transition mask',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'medium',
    reducedMotion: 'Transition freezes at the current progress value; no animation.',
    colorSpace: 'Linear RGB output; source samples clamped to the source quad.',
    fixture: 'lab/src/experiments/shaders/transition-interaction.frag',
    noCombine: true,
  },
  {
    id: 'chromatic-offset',
    name: 'Capped chromatic offset',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'low',
    reducedMotion: 'Channel offset remains static; no animated change.',
    colorSpace: 'Linear RGB output; red/blue channel samples clamped.',
    fixture: 'lab/src/experiments/shaders/transition-interaction.frag',
    noCombine: true,
  },
  {
    id: 'click-shockwave',
    name: 'Click shockwave',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'medium',
    reducedMotion: 'Shockwave does not animate; click origin still renders as a static state.',
    colorSpace: 'Linear RGB output; displacement stays within declared radius.',
    fixture: 'lab/src/experiments/shaders/transition-interaction.frag',
    noCombine: true,
  },
  {
    id: 'flow-field-deformation',
    name: 'Flow-field deformation',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'medium',
    reducedMotion: 'Flow field freezes at the current time-derived state.',
    colorSpace: 'Linear RGB output; UV displacement clamped to the source quad.',
    fixture: 'lab/src/experiments/shaders/transition-interaction.frag',
    noCombine: true,
  },
  {
    id: 'video-texture',
    name: 'Video texture states',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'medium',
    reducedMotion: 'Playback pauses; displays poster/fallback color. No time-driven change; static representation remains useful.',
    colorSpace: 'sRGB video decoded to linear RGB for composition; output remains linear RGB before tone-map. Never blank.',
    fixture: 'lab/src/experiments/shaders/media-post.frag',
    noCombine: true,
  },
  {
    id: 'lut-color-grade',
    name: 'LUT color grade (render-graph)',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'low',
    reducedMotion: 'LUT is color-only; no animation, reduced-motion unchanged.',
    colorSpace: 'Input linear RGB unencoded pre-tone-map; LUT sRGB strip decoded to linear; output linear RGB still pre-tone-map. Pass order scene -> LUT (read A, write B, never self-sample) -> tone-map/encode. Intermediate targets linear unencoded. WebGL2 GLSL PASS, WebGPU WGSL/TSL UNAVAILABLE declaratively when only GLSL shipped; raw GLSL never reported as WebGPU PASS.',
    fixture: 'lab/src/experiments/shaders/media-post.frag',
    noCombine: true,
  },
  {
    id: 'film-grain',
    name: 'Frame-rate-independent film grain',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'low',
    reducedMotion: 'Grain frozen at t=0 / intensity 0 under reduced motion; static composition preserved without animation.',
    colorSpace: 'Additive luminance grain in linear RGB; tone-map after grain. Driven by elapsedSeconds and seed, not frame count.',
    fixture: 'lab/src/experiments/shaders/media-post.frag',
    noCombine: true,
  },
  {
    id: 'gpu-particles',
    name: 'GPU particle systems (ping-pong state)',
    rendererSupport: ['webgl2', 'webgpu'],
    costClass: 'high',
    reducedMotion: 'Simulation frozen at t=0; static Points composition preserved. No animation when prefers-reduced-motion is set.',
    colorSpace: 'Linear data texture (NoColorSpace, NearestFilter); render targets RGBA16F HalfFloat highp, no depth/stencil. Not display color.',
    fixture: 'lab/src/experiments/particle-toy.ts',
    noCombine: true,
  },
  {
    id: 'sdf-text',
    name: 'SDF / MSDF text foundation',
    rendererSupport: ['webgl2'],
    costClass: 'low',
    reducedMotion: 'Text geometry is static; dissolve uniform is clamped to 0 under reduced motion. The visual surface stays a stable composition with no animation.',
    colorSpace: 'Atlas is linear RGB unencoded (signed-distance rescaled into [0, 1], not display color). Output is composed in linear RGB and tone-mapped after composition. Same pass-order contract as the LUT module: scene -> text -> tone-map.',
    fixture: 'lab/src/experiments/shaders/sdf-text.frag',
    noCombine: true,
  },
  {
    id: 'dom-text-effects',
    name: 'DOM-mirrored shader text effects (scramble, glitch, dissolve)',
    rendererSupport: ['webgl2'],
    costClass: 'low',
    reducedMotion: 'All three effects collapse to amplitude 0 under reduced motion; the DOM interaction paths (pointer, focus, click, keyboard) stay live so accessibility is unaffected. The visual surface stays static and the DOM text remains the visible authority.',
    colorSpace: 'Canvas overlay composes additively in linear RGB and is rendered with premultiplied alpha so the underlying DOM text is the visible authority. The DOM owns the color tokens; the shader does not invent color values.',
    fixture: 'lab/src/experiments/shaders/dom-text-effects.ts',
    noCombine: true,
  },
];

export const mediaPostManifest: ShaderModuleManifestEntry[] = foundationalShaderManifest.filter((entry) =>
  ['video-texture', 'lut-color-grade', 'film-grain'].includes(entry.id),
);

export const sdfTextManifest: ShaderModuleManifestEntry[] = foundationalShaderManifest.filter(
  (entry) => entry.id === 'sdf-text',
);

export const domTextEffectsManifest: ShaderModuleManifestEntry[] = foundationalShaderManifest.filter(
  (entry) => entry.id === 'dom-text-effects',
);
