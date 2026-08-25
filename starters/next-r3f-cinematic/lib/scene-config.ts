/**
 * Deterministic runtime constants for the starter scene. Every value is public
 * capture metadata: change one only when intentionally changing the capture
 * contract (determinism contract, section 2).
 */

import type { MotionPreference } from './motion-preference.ts'

/** Root seed for every named random stream. */
export const ROOT_SEED = 'next-r3f-cinematic-v1'

/** Fixed step the deterministic clock advances per rendered frame. */
export const STEP_SECONDS = 1 / 60

/** The marker waits for this many rendered frames before readiness. */
export const STABLE_FRAME = 12

/** Rotation speed of the hero in full motion, radians per second. */
export const HERO_ROTATION_SPEED = 0.4

/**
 * The hero's rotation as a pure function of capture-contract values (IP-05C).
 * Reduced motion holds the seeded static pose — the strongest static shot, per
 * 3d-art-direction camera-and-composition.md — while full motion advances at
 * HERO_ROTATION_SPEED from the injected clock. Both modes are deterministic:
 * the same seed, clock, station, and motion select the same pose.
 */
export function heroRotationY(
  phase: number,
  elapsed: number,
  motion: MotionPreference,
): number {
  return motion === 'reduced' ? phase : phase + elapsed * HERO_ROTATION_SPEED
}
