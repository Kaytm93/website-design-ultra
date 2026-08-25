/**
 * Deterministic runtime constants for the starter scene. Every value is public
 * capture metadata: change one only when intentionally changing the capture
 * contract (determinism contract, section 2).
 */

/** Root seed for every named random stream. */
export const ROOT_SEED = 'next-r3f-cinematic-v1'

/** Fixed step the deterministic clock advances per rendered frame. */
export const STEP_SECONDS = 1 / 60

/** The marker waits for this many rendered frames before readiness. */
export const STABLE_FRAME = 12
