/**
 * Deterministic runtime constants for the product-hero fixture. Every value is
 * public capture metadata: change one only when intentionally changing the
 * capture contract (determinism contract, section 2).
 */

import type { MotionPreference } from './motion-preference.ts'

/** Root seed for every named random stream. */
export const ROOT_SEED = 'wdu-product-hero-v1'

/** Fixed step the deterministic clock advances per rendered frame. */
export const STEP_SECONDS = 1 / 60

/** The marker waits for this many rendered frames before readiness. */
export const STABLE_FRAME = 12

/** Rotation speed of the product in full motion, radians per second. */
export const PRODUCT_ROTATION_SPEED = 0.35

/**
 * A rendered frame whose delta exceeds this is recorded as a long frame in
 * the shared telemetry document (T0.2 context surface). 50 ms is three times
 * the declared 16.7 ms target — a drop, not a jitter.
 */
export const LONG_FRAME_MS = 50

/**
 * The one optimized model. The value is a local committed asset declared in
 * lib/asset-manifest.json; the fixture fetches nothing else at runtime. The
 * GLB is the output of scripts/build-model.mjs (the documented
 * inspect/validate/optimize pipeline) and passes `gltf-transform validate`.
 */
export const MODEL_ASSET_URL = '/model/orbit-one.glb'

/**
 * The product's rotation as a pure function of capture-contract values
 * (IP-05C pattern). Reduced motion holds the seeded static pose — the
 * strongest static shot, per 3d-art-direction — while full motion advances at
 * PRODUCT_ROTATION_SPEED from the injected clock. Both modes are
 * deterministic: the same seed, clock, station, and motion select the same
 * pose.
 */
export function productRotationY(
  phase: number,
  elapsed: number,
  motion: MotionPreference,
): number {
  return motion === 'reduced' ? phase : phase + elapsed * PRODUCT_ROTATION_SPEED
}
