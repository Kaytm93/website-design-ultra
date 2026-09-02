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

/** The committed, Draco-compressed procedural crystal model. */
export const MODEL_ASSET_URL = '/model/procedural-crystal.glb'

/** The local CC0 environment map copied from website-design-ultra/templates/assets. */
export const HDRI_ASSET_URL = '/assets/studio_small_08_1k.hdr'

/** Rotation speed of the hero in full motion, radians per second. */
export const HERO_ROTATION_SPEED = 0.4

/**
 * Pointer-interaction capture values (IP-06A). The hover and pressed poses are
 * instantaneous deltas on top of the frozen pose, so the captured state is a
 * pure function of the declared interaction state and never of input timing.
 * All values are public capture metadata.
 */
export const POINTER_STATES = ['idle', 'hover', 'pressed'] as const
export type PointerState = (typeof POINTER_STATES)[number]

/** Scale applied while the pointer is over the hero. */
export const POINTER_HOVER_SCALE = 1.03
/** Scale applied while the pointer is pressed on the hero. */
export const POINTER_PRESSED_SCALE = 0.97
/** Emissive lift while the pointer is over the hero. */
export const POINTER_HOVER_EMISSIVE = 0x3a2f1d
/** Emissive lift while the pointer is pressed on the hero. */
export const POINTER_PRESSED_EMISSIVE = 0x4a3b24
/**
 * A local point near the crystal's front-facing lower facet that is projected
 * to the screen as the deterministic pointer target. The verifier moves the
 * pointer to this anchor's center; the ray through it hits the hero group.
 */
export const POINTER_ANCHOR_LOCAL: readonly [number, number, number] = [0.35, 0.65, 0.45]

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
