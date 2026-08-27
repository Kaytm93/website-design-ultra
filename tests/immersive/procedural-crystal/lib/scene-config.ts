// scene-config.ts — Single source of truth for the procedural-crystal runtime
// model URL and the deterministic rotation phase. Components read from here;
// no scene file hardcodes a URL or a phase constant.

export const MODEL_ASSET_URL = '/model/procedural-crystal.glb'

export function crystalRotationY(phase: number, elapsed: number, motion: 'full' | 'reduced'): number {
  if (motion === 'reduced') return phase
  return phase + elapsed * 0.25
}