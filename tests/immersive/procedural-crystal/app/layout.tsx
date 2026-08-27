import type { Metadata, Viewport } from 'next'
import { resolveRuntimeMode } from '../lib/runtime-config'
import './globals.css'

export const metadata: Metadata = {
  title: 'Procedural Crystal · wdu-procedural-crystal evaluation fixture',
  description:
    'The website-design-ultra immersive evaluation fixture (IP-10C): a procedurally generated Draco-compressed crystal evaluated by the shared immersive contracts.',
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
 * state. The evaluator reads these from the served HTML to verify the
 * deterministic capture contract (mobile gate uses data-wdu-station,
 * reduced-motion gate uses data-wdu-motion).
 *
 * Mirrors product-hero/app/layout.tsx so the live evaluation runner sees the
 * same SSR attributes for both peer fixtures.
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