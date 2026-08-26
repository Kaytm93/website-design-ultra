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
];
