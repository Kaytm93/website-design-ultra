'use client'

import assetManifest from '../lib/asset-manifest.json'

const POSTER_SOURCES = {
  desktop:
    assetManifest.assets.find((asset) => asset.id === 'poster-desktop')?.url ??
    '/poster-desktop.png',
  portrait:
    assetManifest.assets.find((asset) => asset.id === 'poster-portrait')?.url ??
    '/poster-portrait.png',
} as const

export type PosterVariant = keyof typeof POSTER_SOURCES

interface PosterProps {
  /** The viewport class; each variant is composed for its crop (IP-05C). */
  variant: PosterVariant
  /** Revealed behind loading, at the poster quality tier, and on context loss. */
  visible: boolean
}

/**
 * The art-directed 2D fallback (IP-05C). One capture per viewport class, taken
 * from the scene itself through the deterministic entry point: same crystal,
 * same key light, same stage shadow, same environment reflection, each from the
 * camera station that composes for that crop. Drawing the poster by hand is how
 * a fallback drifts from the thing it stands in for, so it is rendered instead
 * — `npm run capture:poster` regenerates both and records their hashes in
 * lib/asset-manifest.json. The fallback is a composition, never a blank frame.
 *
 * The poster is decorative: text and controls stay in the DOM (3d-art-direction:
 * "Keep text and CTA in the DOM; bake only decorative typography into the
 * poster" — this poster bakes none, and a render of the scene has none to bake).
 */
export function Poster({ variant, visible }: PosterProps) {
  return (
    <img
      className="scene-poster"
      src={POSTER_SOURCES[variant]}
      alt=""
      aria-hidden="true"
      draggable={false}
      hidden={!visible}
    />
  )
}
