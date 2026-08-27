'use client'

/**
 * The art-directed poster. Always rendered; the parent reveals it when the
 * canvas is not ready, when WebGL is unavailable, when the quality tier is
 * poster, or after context loss. Decorative (aria-hidden) because the
 * fallback never replaces DOM copy.
 */
export function Poster({ variant, visible }: { variant: 'desktop' | 'portrait'; visible: boolean }) {
  if (!visible) return null
  return (
    <img
      aria-hidden="true"
      alt=""
      src={variant === 'portrait' ? '/poster-portrait.svg' : '/poster-desktop.svg'}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}