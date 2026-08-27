'use client'

import { useEffect } from 'react'
import type { ImmersiveTelemetrySurface } from '../lib/telemetry-surface.ts'

/**
 * WebGL context-loss recovery: when the canvas loses its context, force the
 * poster quality tier and surface the DOM restore action. The verifier reads
 * the context-loss event from the telemetry document.
 */
export function ContextLossGate({
  telemetry,
  onContextLost,
}: {
  telemetry: ImmersiveTelemetrySurface
  onContextLost: () => void
}) {
  useEffect(() => {
    const handler = (event: Event) => {
      const lost = event as WebGLContextEvent
      lost.preventDefault()
      telemetry.recordContextLoss('context lost')
      onContextLost()
    }
    document.addEventListener('webglcontextlost', handler, true)
    return () => {
      document.removeEventListener('webglcontextlost', handler, true)
    }
  }, [telemetry, onContextLost])
  return null
}