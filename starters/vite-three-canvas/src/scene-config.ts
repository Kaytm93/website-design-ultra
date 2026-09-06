/**
 * Deterministic runtime constants for the vanilla starter scene.
 *
 * Every value here is public capture metadata, exactly as in the R3F starter:
 * change one only when the capture contract is intentionally changing. The two
 * starters do not share these numbers — they are different compositions — but
 * they share the rule that the numbers are declared in one file and read from
 * it, never inlined into scene code.
 */

import type { MotionPreference } from './motion-preference.ts'

/** Root seed for every named random stream. */
export const ROOT_SEED = 'vite-three-canvas-v1'

/** Fixed step the deterministic clock advances per rendered frame. */
export const STEP_SECONDS = 1 / 60

/** The readiness marker waits for this many rendered frames. */
export const STABLE_FRAME = 12

/** Rotation speed of the hero in full motion, radians per second. */
export const HERO_ROTATION_SPEED = 0.32

/**
 * Hero geometry parameters.
 *
 * The hero is generated rather than imported so this starter has no asset
 * dependency and no binary in its diff — and so it is neither a torus knot nor
 * a default cube, which the plugin's own surfaces may not ship. The shape is a
 * seeded cluster of faceted shards: deterministic from ROOT_SEED, so two runs
 * at the same seed produce byte-identical geometry.
 */
export const HERO_SHARD_COUNT = 7
export const HERO_RADIAL_SEGMENTS = 6
export const HERO_BASE_RADIUS = 0.26
export const HERO_MIN_HEIGHT = 0.55
export const HERO_MAX_HEIGHT = 1.6

/**
 * Device-pixel-ratio ceilings. The quality controller owns adaptation between
 * tiers; these two numbers are the outer bounds the vanilla contract fixes —
 * 2 on desktop, 1.5 on a coarse pointer.
 */
export const DPR_CEILING_DESKTOP = 2
export const DPR_CEILING_MOBILE = 1.5

/**
 * The hero's rotation as a pure function of capture-contract values.
 *
 * Reduced motion holds the seeded static pose; full motion advances at
 * HERO_ROTATION_SPEED from the injected clock. Both are deterministic: the same
 * seed, clock and motion preference select the same pose. This is the same
 * contract the R3F starter states, written without React so the two paths can
 * be compared directly.
 */
export function heroRotationY(
  phase: number,
  elapsed: number,
  motion: MotionPreference,
): number {
  return motion === 'reduced' ? phase : phase + elapsed * HERO_ROTATION_SPEED
}

/**
 * The DPR ceiling for a pointer capability, not for a viewport width. A narrow
 * desktop window is still a desktop; a large tablet with a coarse pointer is
 * not. `matchMedia` is passed in rather than read, so this stays testable and
 * the module keeps no browser dependency.
 */
export function dprCeiling(coarsePointer: boolean): number {
  return coarsePointer ? DPR_CEILING_MOBILE : DPR_CEILING_DESKTOP
}
