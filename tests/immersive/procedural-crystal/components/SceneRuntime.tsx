'use client'

import { useEffect, useRef } from 'react'
import {
  createClock,
  createRandomStreams,
  createStableFrameMarker,
  type SceneClock,
} from '../lib/determinism-runtime.ts'
import type { ImmersiveTelemetrySurface } from '../lib/telemetry-surface.ts'
import {
  createQualityController,
  type QualityController,
  type QualityTelemetryState,
} from '../lib/quality-controller.ts'
import { QUALITY_CONFIG } from '../lib/quality-config.ts'
import type { RuntimeMode } from '../lib/runtime-config.ts'

interface SceneRuntimeProps {
  mode: RuntimeMode
  cameraApplied: boolean
  assetsReady: boolean
  streamsInitialized: boolean
  telemetry: ImmersiveTelemetrySurface
  onQualityChange: (state: QualityTelemetryState) => void
}

/**
 * Scene-side bootstrap: the injected clock, named-stream PRNG, and the
 * stable-frame marker. The marker only fires once every precondition
 * (camera, assets, streams) is observed for the declared stable frame.
 *
 * Deterministic mode freezes the loop once the marker fires so two captures
 * of the same commit stay byte-identical.
 */
export function SceneRuntime({
  mode,
  cameraApplied,
  assetsReady,
  streamsInitialized,
  telemetry,
  onQualityChange,
}: SceneRuntimeProps) {
  const clockRef = useRef<SceneClock | null>(null)
  if (clockRef.current === null) {
    clockRef.current = createClock({
      mode: mode === 'deterministic' ? 'deterministic' : 'live',
      stepSeconds: 1 / 60,
    })
  }
  const clock = clockRef.current

  const streamsRef = useRef(createRandomStreams('procedural-crystal-seed'))
  const streams = streamsRef.current

  // Advance the injected clock on every render so the priority-0 frame
  // subscribers see this frame's time.
  clock.tick()
  streams.stream('scene-clock').next()

  const markerRef = useRef<ReturnType<typeof createStableFrameMarker> | null>(null)
  if (markerRef.current === null && typeof document !== 'undefined') {
    markerRef.current = createStableFrameMarker({
      target: document.documentElement,
      stableFrame: 12,
    })
  }
  const marker = markerRef.current

  useEffect(() => {
    if (!marker) return
    const reached = marker.afterVisibleRender({
      assetsReady,
      cameraStationApplied: cameraApplied,
      streamsInitialized,
      frame: clock.frame,
      stableFrame: 12,
    })
    if (reached) {
      telemetry.recordReady(clock.elapsed * 1000)
    }
  }, [marker, assetsReady, cameraApplied, streamsInitialized, clock, telemetry])

  const qualityRef = useRef<QualityController | null>(null)
  if (qualityRef.current === null) {
    qualityRef.current = createQualityController({
      ...QUALITY_CONFIG,
      now: () => clock.elapsed * 1000,
    })
  }
  const quality = qualityRef.current

  useEffect(() => {
    const detach = quality.attachVisibility(() =>
      typeof document === 'undefined' ? true : document.visibilityState === 'visible',
    )
    return () => detach()
  }, [quality])

  useEffect(() => {
    const state = quality.read()
    onQualityChange({ tier: state.tier, dpr: state.dpr, visible: true })
  }, [quality, onQualityChange])

  return null
}