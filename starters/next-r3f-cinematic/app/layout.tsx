import type { Metadata, Viewport } from 'next'
import { resolveRuntimeMode } from '../lib/runtime-config'
import './globals.css'

export const metadata: Metadata = {
  title: 'next-r3f-cinematic · server-rendered page, client canvas',
  description:
    'The website-design-ultra cinematic starter: a Next.js App Router page around a client-only React Three Fiber canvas leaf, with one camera owner, one injected clock, one asset manifest, wired deterministic capture, and complete fallback and lifecycle contracts.',
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
