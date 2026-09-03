'use client'

import assetManifest from '../lib/asset-manifest.json'

const POSTER_SOURCES = {
  desktop:
    assetManifest.assets.find((asset) => asset.id === 'poster-desktop')?.url ??
    '/poster-desktop.svg',
  portrait:
    assetManifest.assets.find((asset) => asset.id === 'poster-portrait')?.url ??
    '/poster-portrait.svg',
} as const

export type PosterVariant = keyof typeof POSTER_SOURCES

interface PosterProps {
  /** The viewport class; each variant is composed for its crop (IP-05C). */
  variant: PosterVariant
  /** Revealed behind loading, at the poster quality tier, and on context loss. */
  visible: boolean
}

/**
 * The art-directed 2D fallback (IP-05C). One composed SVG per viewport class,
 * mirroring the live composition — a faceted procedural crystal on a dark
 * stage, the same palette, key light, shadow, and environment reflection — so
 * the fallback is a composition, never a blank frame. The poster is decorative:
 * text and controls stay in the DOM (3d-art-direction: "Keep text and CTA in
 * the DOM; bake only decorative typography into the poster" — this poster bakes
 * none).
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
