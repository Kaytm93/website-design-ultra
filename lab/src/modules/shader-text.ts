/**
 * J-D5 production shader-text adapter used by the root-only lab fixture.
 *
 * The foundational SDF atlas and DOM event mirror already have their own
 * modules. This seam composes them without making a second interaction owner.
 */

import {
  computeDissolveUniforms,
  computeGlitchUniforms,
  computeScrambleUniforms,
  type DomMirrorState,
  type EffectUniforms,
} from './dom-text-effects.js';

export const SHADER_TEXT_EFFECTS = ['scramble', 'glitch', 'dissolve'] as const;
export type ShaderTextEffect = (typeof SHADER_TEXT_EFFECTS)[number];

export interface ShaderTextUniformBundle {
  readonly uScramble: EffectUniforms;
  readonly uGlitch: EffectUniforms;
  readonly uDissolve: EffectUniforms;
}

export function computeShaderTextUniforms(state: DomMirrorState): ShaderTextUniformBundle {
  return {
    uScramble: computeScrambleUniforms(state),
    uGlitch: computeGlitchUniforms(state),
    uDissolve: computeDissolveUniforms(state),
  };
}
