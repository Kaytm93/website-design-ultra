// motion-preference.ts — Stored user motion preference. Server HTML stays
// independent of the browser's stored value; the client uses this in live mode
// to choose between full and reduced motion.

const KEY = 'wdu-procedural-crystal-motion'

export function readStoredMotionPreference(storage: Pick<Storage, 'getItem'> | null): 'full' | 'reduced' | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(KEY)
    return raw === 'reduced' || raw === 'full' ? raw : null
  } catch {
    return null
  }
}

export function writeStoredMotionPreference(storage: Pick<Storage, 'setItem'> | null, value: 'full' | 'reduced'): void {
  if (!storage) return
  try {
    storage.setItem(KEY, value)
  } catch {
    // ignore — privacy mode / disabled storage
  }
}

export function systemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}