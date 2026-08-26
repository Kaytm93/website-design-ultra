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
];
