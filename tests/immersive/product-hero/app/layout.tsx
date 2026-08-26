import type { Metadata, Viewport } from 'next'
import { resolveRuntimeMode } from '../lib/runtime-config'
import './globals.css'

export const metadata: Metadata = {
  title: 'Orbit One · wdu-product-hero evaluation fixture',
  description:
    'The website-design-ultra immersive evaluation fixture (IP-07A): an R3F product hero around one optimized model, with semantic DOM copy, portrait reframe, poster, reduced motion, and the shared quality and telemetry surfaces.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

/**
 * Server layout. The resolved runtime flags are recorded on the document root
 * as capture metadata: html[data-wdu-mode="deterministic"] means the flag
 * resolved to deterministic mode for this request; data-wdu-station and
 * data-wdu-motion record the requested capture station and the reduced-motion
 * state. In live mode SceneClient keeps the latter two in sync with the
 * user's choices.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { mode, stationId, motion } = resolveRuntimeMode()
  return (
    <html
      lang="en"
      data-wdu-mode={mode}
      data-wdu-station={stationId}
      data-wdu-motion={motion}
    >
      <body>{children}</body>
    </html>
  )
}
