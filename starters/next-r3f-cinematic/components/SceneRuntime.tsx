'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { useFrame } from '@react-three/fiber'
import {
  createClock,
  createRandomStreams,
  createStableFrameMarker,
  type RandomStream,
  type SceneClock,
} from '../lib/determinism-runtime.ts'
import { ROOT_SEED, STABLE_FRAME, STEP_SECONDS } from '../lib/scene-config.ts'
import assetManifest from '../lib/asset-manifest.json'
import type { RuntimeMode } from '../lib/runtime-config.ts'

if (assetManifest.schema !== 1) {
  throw new Error(
    `next-r3f-cinematic: unsupported asset manifest schema ${String(assetManifest.schema)}`,
  )
}

interface SceneRuntimeProps {
  mode: RuntimeMode
  stationId: string
  children: ReactNode
}

interface SceneRuntimeValue {
  /** The single injected clock. Every animation reads this; nothing else times the scene. */
  clock: SceneClock
  /** Named stream for hero motion, seeded from ROOT_SEED. */
  heroMotion: RandomStream
  /** Sorted seed-name metadata recorded with any capture. */
  seedNames: readonly string[]
  /** The camera owner reports a completed station application through this. */
  onCameraApplied: () => void
}

interface SceneBootstrap {
  clock: SceneClock
  heroMotion: RandomStream
  seedNames: readonly string[]
  marker: ReturnType<typeof createStableFrameMarker>
  streamsInitialized: boolean
  assetsReady: boolean
}

const SceneRuntimeContext = createContext<SceneRuntimeValue | null>(null)

export function useSceneRuntime(): SceneRuntimeValue {
  const value = useContext(SceneRuntimeContext)
  if (value === null) {
    throw new Error('useSceneRuntime must be used inside <SceneRuntime>')
  }
  return value
}

function createBootstrap(mode: RuntimeMode): SceneBootstrap {
  // One clock: the deterministic adapter advances the declared fixed step per
  // rendered frame; the live adapter reads the wall clock only here, at its
  // outer boundary. No scene system reads a wall clock or a library ticker.
  const clock = createClock(
    mode === 'deterministic'
      ? { mode: 'deterministic', stepSeconds: STEP_SECONDS }
      : { mode: 'live' },
  )
  const streams = createRandomStreams(ROOT_SEED)
  const heroMotion = streams.stream('hero-motion')
  const marker = createStableFrameMarker({
    target: document.documentElement,
    stableFrame: STABLE_FRAME,
  })
  return {
    clock,
    heroMotion,
    seedNames: streams.names(),
    marker,
    streamsInitialized: true,
    // The manifest is bundled and schema-checked above; nothing loads over the
    // network, so asset readiness is a resolved constant.
    assetsReady: true,
  }
}

/**
 * Scene bootstrap and the single clock, stream root, and ready marker owner.
 * Renders no pixels itself; it ticks the clock before render (priority 0) and
 * evaluates the stable-frame marker after the visible render (priority -1),
 * per the determinism contract.
 */
export function SceneRuntime({ mode, stationId, children }: SceneRuntimeProps) {
  const bootstrapRef = useRef<SceneBootstrap | null>(null)
  let bootstrap = bootstrapRef.current
  if (bootstrap === null) {
    bootstrap = createBootstrap(mode)
    bootstrapRef.current = bootstrap
  }

  const cameraAppliedRef = useRef(false)

  const onCameraApplied = useCallback(() => {
    cameraAppliedRef.current = true
  }, [])

  // A station change invalidates readiness before the new shot applies; the
  // marker is set again only after the next stable frame renders.
  useEffect(() => {
    cameraAppliedRef.current = false
    bootstrapRef.current?.marker.invalidate()
  }, [stationId])

  // Remove readiness when the scene unmounts.
  useEffect(() => {
    const boot = bootstrapRef.current
    return () => boot?.marker.invalidate()
  }, [])

  // Advance the injected clock exactly once per rendered frame, before the
  // render. Consumers that read clock values run at priority 1 or later.
  useFrame(() => {
    bootstrapRef.current?.clock.tick()
  }, 0)

  // Priority -1 subscribers run after the visible render: this is the render
  // owner's stable-frame check.
  useFrame(() => {
    const boot = bootstrapRef.current
    if (!boot) return
    boot.marker.afterVisibleRender({
      frame: boot.clock.frame,
      assetsReady: boot.assetsReady,
      cameraStationApplied: cameraAppliedRef.current,
      streamsInitialized: boot.streamsInitialized,
    })
  }, -1)

  const value: SceneRuntimeValue = {
    clock: bootstrap.clock,
    heroMotion: bootstrap.heroMotion,
    seedNames: bootstrap.seedNames,
    onCameraApplied,
  }

  return (
    <SceneRuntimeContext.Provider value={value}>{children}</SceneRuntimeContext.Provider>
  )
}
