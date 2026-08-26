'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useSceneRuntime } from './SceneRuntime.tsx'

interface ContextLossGateProps {
  onContextLost: () => void
}

/**
 * The context-loss observer (IP-05C pattern). The WebGLRenderer already
 * listens for webglcontextlost and calls preventDefault (three r185
 * re-initializes on restore), so this gate observes and records:
 *
 * - the failure on the quality controller — forcePoster('context lost') is
 *   the 3d-runtime-quality failure path, straight to the Poster tier with
 *   source 'failure',
 * - the failure on the shared telemetry surface — a context-loss event with
 *   count and reason (T0.2 context surface),
 * - readiness invalidation — html[data-wdu-ready] is removed until a fresh
 *   bootstrap qualifies again,
 * - the DOM side — SceneClient reveals the poster and the restore action.
 *
 * Recovery is the DOM action: it remounts the canvas with a fresh context,
 * which is deterministic in both modes. A browser-restored old context is
 * deliberately not trusted for re-verified renderer state; the remount is the
 * single recovery path.
 */
export function ContextLossGate({ onContextLost }: ContextLossGateProps) {
  const gl = useThree((state) => state.gl)
  const { quality, telemetry, invalidateReady } = useSceneRuntime()

  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (event: Event) => {
      // Mirror three's own handler: keep the browser's restore path open.
      event.preventDefault()
      quality.forcePoster('context lost')
      telemetry.recordContextLoss('context lost')
      invalidateReady()
      onContextLost()
    }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [gl, quality, telemetry, invalidateReady, onContextLost])

  return null
}
