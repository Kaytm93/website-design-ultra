'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { CameraRig } from './CameraRig.tsx'
import { ContextLossGate } from './ContextLossGate.tsx'
import { ModelErrorBoundary } from './ModelErrorBoundary.tsx'
import { ProductModel } from './ProductModel.tsx'
import { QualityRuntime } from './QualityRuntime.tsx'
import { SceneRuntime } from './SceneRuntime.tsx'
import { createClock, type SceneClock } from '../lib/determinism-runtime.ts'
import { createQualityController, type QualityTelemetryState } from '../lib/quality-controller.ts'
import { QUALITY_CONFIG } from '../lib/quality-config.ts'
import { createImmersiveTelemetrySurface, type ImmersiveTelemetrySurface } from '../lib/telemetry-surface.ts'
import type { MotionPreference, RuntimeMode } from '../lib/runtime-config.ts'

interface Props {
  mode: RuntimeMode
  stationId: string
  motion: MotionPreference
  onQualityChange: (state: QualityTelemetryState) => void
  onContextLost: () => void
}

/**
 * The actual R3F Canvas leaf. Loaded through next/dynamic in SceneClient so
 * the module only enters the client bundle; scene bootstrap creates the
 * single clock, quality controller, and telemetry surface.
 */
export function ClientCanvas({ mode, stationId, motion, onQualityChange, onContextLost }: Props) {
  const [harness] = useState(() => {
    const clock = createClock({ mode: mode === 'deterministic' ? 'deterministic' : 'live', stepSeconds: 1 / 60 })
    const quality = createQualityController({ ...QUALITY_CONFIG, now: () => clock.elapsed * 1000 })
    const telemetry = createImmersiveTelemetrySurface({
      nowMs: () => clock.elapsed * 1000,
      mode: mode === 'deterministic' ? 'deterministic' : 'live',
      stepMs: 1000 / 60,
      readyMarker: 'html[data-wdu-ready="true"]',
      quality,
      readRenderer: null,
    })
    return {
      clock,
      quality,
      telemetry,
      state: { cameraApplied: false, assetsReady: false, streamsInitialized: true },
    }
  })

  // Publish the telemetry handle on globalThis so the verifier can read it
  // without coupling to the React tree. Deleted on unmount to keep the
  // surface ephemeral (lifecycle tests assert the resource counters return
  // to baseline).
  useEffect(() => {
    ;(globalThis as unknown as { __WDU_IMMERSIVE_TELEMETRY__?: ImmersiveTelemetrySurface }).__WDU_IMMERSIVE_TELEMETRY__ = harness.telemetry
    return () => {
      delete (globalThis as unknown as { __WDU_IMMERSIVE_TELEMETRY__?: ImmersiveTelemetrySurface }).__WDU_IMMERSIVE_TELEMETRY__
    }
  }, [harness.telemetry])

  const handleQuality = useCallback((state: QualityTelemetryState) => onQualityChange(state), [onQualityChange])
  const handleCameraApplied = useCallback(() => { harness.state.cameraApplied = true }, [harness])
  const handleAssetsReady = useCallback(() => { harness.state.assetsReady = true }, [harness])
  const handleContextLost = useCallback(() => {
    harness.telemetry.recordContextLoss('context lost')
    onContextLost()
  }, [harness, onContextLost])

  const renderClock = useMemo<SceneClock>(() => ({
    get elapsed() { return 0 },
    get delta() { return 0 },
    get frame() { return 0 },
    tick() { return this },
  }), [])

  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [0, 0.9, 3.2], fov: 35 }}
      dpr={[0.5, 1.25]}
      gl={{ antialias: true, alpha: true }}
      frameloop="always"
      data-wdu-mode={mode}
      data-wdu-station={stationId}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 4, 3]} intensity={1.1} />
      <SceneRuntime
        mode={mode}
        cameraApplied={harness.state.cameraApplied}
        assetsReady={harness.state.assetsReady}
        streamsInitialized={harness.state.streamsInitialized}
        telemetry={harness.telemetry}
        onQualityChange={handleQuality}
      />
      <CameraRig stationId={stationId} clock={renderClock} onCameraApplied={handleCameraApplied} />
      <ModelErrorBoundary telemetry={harness.telemetry}>
        <ProductModel clock={renderClock} motion={motion} markAssetsReady={handleAssetsReady} />
      </ModelErrorBoundary>
      <ContextLossGate telemetry={harness.telemetry} onContextLost={handleContextLost} />
      <QualityRuntime clock={renderClock} quality={harness.quality} telemetry={harness.telemetry} />
    </Canvas>
  )
}