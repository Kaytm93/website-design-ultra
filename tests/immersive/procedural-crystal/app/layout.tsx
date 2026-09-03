import type { Metadata, Viewport } from 'next'
import { resolveRuntimeMode } from '../lib/runtime-config'
import assetManifest from '../lib/asset-manifest.json'
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
 * The declared preload set, read from the one asset manifest and ordered by
 * the manifest's own buckets: critical (the Draco decoder, without which the
 * model cannot be read) before progressive (the model itself). No URL is
 * written here — an asset is preloaded only because lib/asset-manifest.json
 * marks it, so the manifest stays the single source of truth.
 */
const PRELOADS = [...assetManifest.assets]
  .filter((asset): asset is typeof asset & { preload: true; preloadAs: string } =>
    (asset as { preload?: boolean }).preload === true,
  )
  .sort(
    (a, b) =>
      assetManifest.buckets.indexOf(a.bucket) - assetManifest.buckets.indexOf(b.bucket),
  )

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
 *
 * The preload links are the fixture's loading choreography, and they are what
 * keeps the reduced-motion still still. Without them the browser learns about
 * the model only after hydration has imported the client-only canvas chunk
 * and mounted the Canvas, and it learns about the decoder only after the GLB
 * response reveals its KHR_draco_mesh_compression extension — three round
 * trips stacked in series behind React. The scene then reaches its stable
 * frame long after first paint, so the art-directed loading poster is still
 * covering the frame when a capture is taken. The reduced-motion gate is what
 * sees this: it photographs the page twice, 750 ms apart, and a loading
 * poster that vanishes between the two shots is a page still changing under
 * prefers-reduced-motion. React hoists these into <head>, so the requests
 * start while the HTML is still parsing and run in parallel with hydration
 * instead of behind it.
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
      <body>
        {PRELOADS.map((asset) => (
          <link
            key={asset.id}
            rel="preload"
            href={asset.url}
            as={asset.preloadAs}
            crossOrigin="anonymous"
          />
        ))}
        {children}
      </body>
    </html>
  )
}
