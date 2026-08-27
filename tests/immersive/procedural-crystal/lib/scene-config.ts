// scene-config.ts — Single source of truth for the procedural-crystal runtime
// model URL, deterministic scene constants, and the crystal's rotation phase.
// Components read from here; no scene file hardcodes a URL or a phase
// constant. Mirrors product-hero/lib/scene-config.ts so both peer fixtures
// share the same scene-constant surface.

export const MODEL_ASSET_URL = '/model/procedural-crystal.glb'

/** Root seed for the named-stream PRNG (IP-02B). */
export const ROOT_SEED = 'procedural-crystal-seed'

/** The declared fixed-step for deterministic mode (seconds). */
export const STEP_SECONDS = 1 / 60

/** The stable-frame target; the ready marker fires once the marker has
 *  observed this frame count after the camera station is applied and the
 *  model is loaded. 12 frames is the empirical cold-load floor on the
 *  declared desktop profile. */
export const STABLE_FRAME = 12

/** The declared long-frame threshold for the warm-GPU evidence (ms). */
export const LONG_FRAME_MS = 50

export function crystalRotationY(phase: number, elapsed: number, motion: 'full' | 'reduced'): number {
  if (motion === 'reduced') return phase
  return phase + elapsed * 0.25
}