'use client'

import { Canvas } from '@react-three/fiber'
import { CameraRig } from './CameraRig.tsx'
import { ContextLossGate } from './ContextLossGate.tsx'
import { HeroObject } from './HeroObject.tsx'
import { QualityRuntime } from './QualityRuntime.tsx'
import { SceneRuntime } from './SceneRuntime.tsx'
import { CAMERA_STATIONS } from '../lib/camera-stations.ts'
import type { MotionPreference, RuntimeMode } from '../lib/runtime-config.ts'
import type { QualityTelemetryState } from '../lib/quality-controller.ts'

const NOOP = () => {}

interface SceneCanvasProps {
  mode: RuntimeMode
  stationId: string
  /** Resolved at the application boundary; passed through to the scene runtime. */
  motion: MotionPreference
  /** Declared loading capture state (IP-06A): holds asset readiness so the loading surface stays visible. */
  loadingHold?: boolean
  /** DOM-side quality subscription (poster tier reveals the poster overlay). */
  onQualityChange?: (state: QualityTelemetryState) => void
  /** DOM-side context-loss notification (poster plus restore action). */
  onContextLost?: () => void
}

/**
 * The client-only canvas leaf. This component never renders on the server
 * (SceneClient loads it with ssr: false); the page around it stays a server
 * component. The canvas is decorative: every semantic surface lives in the
 * DOM outside it.
 *
 * There is deliberately no `dpr` prop on the Canvas: the quality controller
 * (IP-05B) is the one owner of pixel ratio and applies it imperatively in
 * QualityRuntime.
 */
export function SceneCanvas({
  mode,
  stationId,
  motion,
  loadingHold = false,
  onQualityChange,
  onContextLost,
}: SceneCanvasProps) {
  return (
    <Canvas
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 35, near: 0.1, far: 100, position: [0, 1.1, 4.6] }}
      className="scene-canvas"
      aria-hidden="true"
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 2]} intensity={1.6} />
      <pointLight position={[-3, 1, -2]} intensity={12} color="#ffb86b" />
      <SceneRuntime
        mode={mode}
        stationId={stationId}
        motion={motion}
        loadingHold={loadingHold}
        onQualityChange={onQualityChange}
      >
        <CameraRig stations={CAMERA_STATIONS} stationId={stationId} />
        <QualityRuntime />
        <HeroObject />
        <ContextLossGate onContextLost={onContextLost ?? NOOP} />
      </SceneRuntime>
    </Canvas>
  )
}
