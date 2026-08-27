'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { QualityController } from '../lib/quality-controller.ts'
import type { SceneClock } from '../lib/determinism-runtime.ts'
import type { ImmersiveTelemetrySurface } from '../lib/telemetry-surface.ts'

/**
 * The single writer of pixel ratio and frame-loop state. Hooks the
 * quality controller to the telemetry surface so the verifier reads the
 * shared counters from one source.
 */
export function QualityRuntime({
  clock,
  quality,
  telemetry,
}: {
  clock: SceneClock
  quality: QualityController
  telemetry: ImmersiveTelemetrySurface
}) {
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const set = useThree((state) => state.set)

  useEffect(() => {
    gl.setPixelRatio(quality.dpr)
  }, [gl, quality.dpr])

  useEffect(() => {
    let raf = 0
    let last = clock.elapsed * 1000
    function step() {
      const now = clock.elapsed * 1000
      const frameMs = Math.max(1, now - last)
      last = now
      telemetry.recordFrameTimeMs(frameMs)
      invalidate()
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [clock, telemetry, invalidate])

  useEffect(() => {
    set({ frameloop: quality.tier === 'poster' ? 'never' : 'always' })
  }, [set, quality.tier])

  return null
}