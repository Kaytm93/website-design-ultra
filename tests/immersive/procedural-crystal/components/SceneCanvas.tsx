'use client'

import { Canvas } from '@react-three/fiber'
import { CameraRig } from './CameraRig.tsx'
import { ProductModel } from './ProductModel.tsx'
import { QualityRuntime } from './QualityRuntime.tsx'
import type { QualityController } from '../lib/quality-controller.ts'
import type { SceneClock } from '../lib/determinism-runtime.ts'
import type { ImmersiveTelemetrySurface } from '../lib/telemetry-surface.ts'
import type { MotionPreference } from '../lib/runtime-config.ts'

interface SceneCanvasProps {
  mode: 'live' | 'deterministic'
  stationId: string
  motion: MotionPreference
  clock: SceneClock
  quality: QualityController
  telemetry: ImmersiveTelemetrySurface
  onCameraApplied: () => void
  onAssetsReady: () => void
}

/**
 * The client-only canvas leaf. No other component mounts a Canvas; the
 * poster stays behind this surface until the stable-frame marker fires.
 */
export function SceneCanvas({
  mode,
  stationId,
  motion,
  clock,
  quality,
  telemetry,
  onCameraApplied,
  onAssetsReady,
}: SceneCanvasProps) {
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
      <CameraRig stationId={stationId} clock={clock} onCameraApplied={onCameraApplied} />
      <ProductModel clock={clock} motion={motion} markAssetsReady={onAssetsReady} />
      <QualityRuntime clock={clock} quality={quality} telemetry={telemetry} />
    </Canvas>
  )
}