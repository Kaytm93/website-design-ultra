'use client'

import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { CameraRig } from './CameraRig.tsx'
import { CinematicTimeline } from './CinematicTimeline.tsx'
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
 * The client-only canvas leaf. The scene uses one WebGL renderer, one physical
 * key-light shadow owner, and one local HDRI loaded by HeroObject. Tone mapping
 * and exposure are fixed here instead of changing with quality tiers.
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
      shadows
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 34, near: 0.1, far: 20, position: [0, 0.8, 4.6] }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.outputColorSpace = SRGBColorSpace
      }}
      className="scene-canvas"
      aria-hidden="true"
    >
      <color attach="background" args={['#0a0d12']} />
      <ambientLight intensity={0.24} />
      <directionalLight
        castShadow
        position={[-3.5, 5, 4]}
        intensity={3.2}
        color="#fff4df"
        shadow-mapSize={[512, 512]}
        shadow-camera-near={0.1}
        shadow-camera-far={14}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <directionalLight position={[4, 1.2, -2]} intensity={0.55} color="#7288c7" />
      <pointLight position={[-3, 0.7, 2]} intensity={4} color="#7aa2f7" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.23, 0]} receiveShadow>
        <circleGeometry args={[2.4, 64]} />
        <meshStandardMaterial color="#131923" roughness={0.8} metalness={0.05} />
      </mesh>
      <SceneRuntime
        mode={mode}
        stationId={stationId}
        motion={motion}
        loadingHold={loadingHold}
        onQualityChange={onQualityChange}
      >
        <CinematicTimeline />
        <CameraRig stations={CAMERA_STATIONS} stationId={stationId} />
        <QualityRuntime />
        <HeroObject />
        <ContextLossGate onContextLost={onContextLost ?? NOOP} />
      </SceneRuntime>
    </Canvas>
  )
}
