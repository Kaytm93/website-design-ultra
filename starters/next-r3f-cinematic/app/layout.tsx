import type { Metadata, Viewport } from 'next'
import { resolveRuntimeMode } from '../lib/runtime-config'
import './globals.css'

export const metadata: Metadata = {
  title: 'next-r3f-cinematic · server-rendered page, client canvas',
  description:
    'The website-design-ultra cinematic starter: a Next.js App Router page around a client-only React Three Fiber canvas leaf, with one camera owner, one injected clock, one asset manifest, and wired deterministic capture.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

/**
 * Server layout. The resolved runtime mode is recorded on the document root as
 * capture metadata: html[data-wdu-mode="deterministic"] means the flag
 * resolved to deterministic mode for this request.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { mode } = resolveRuntimeMode()
  return (
    <html lang="en" data-wdu-mode={mode}>
      <body>{children}</body>
    </html>
  )
}
