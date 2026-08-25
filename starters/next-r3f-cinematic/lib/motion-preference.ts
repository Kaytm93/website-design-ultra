/**
 * Motion-preference resolution for the starter (IP-05C).
 *
 * The runtime boundary rule mirrors WDU_DETERMINISTIC: WDU_REDUCED_MOTION=1 is
 * the only value that selects reduced motion; an unset variable and every
 * other value select full motion. The server page resolves the flag per
 * request; scene systems receive the resolved preference as a prop and never
 * read process environment.
 *
 * Live mode combines three sources, in precedence order:
 *   1. an explicit user choice, persisted under MOTION_STORAGE_KEY,
 *   2. the system preference (prefers-reduced-motion: reduce),
 *   3. full motion.
 * The explicit choice is preserved and wins until the user changes it
 * (3d-runtime-quality adaptive-runtime.md: "An explicit user setting takes
 * precedence and must be preserved"). Motion controls image motion, not
 * image quality: the preference never changes the quality tier by itself.
 */

export type MotionPreference = 'full' | 'reduced'

/** Session persistence key for the explicit user choice. */
export const MOTION_STORAGE_KEY = 'wdu.next-r3f-cinematic.motion'

export function resolveMotionPreference(raw: string | undefined): MotionPreference {
  return raw === '1' ? 'reduced' : 'full'
}

export function readStoredMotionPreference(
  storage: { getItem(key: string): string | null } | null,
): MotionPreference | null {
  if (!storage) return null
  const value = storage.getItem(MOTION_STORAGE_KEY)
  return value === 'reduced' || value === 'full' ? value : null
}

export function writeStoredMotionPreference(
  storage: { setItem(key: string, value: string): void } | null,
  preference: MotionPreference,
): void {
  if (!storage) return
  storage.setItem(MOTION_STORAGE_KEY, preference)
}

export function systemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
