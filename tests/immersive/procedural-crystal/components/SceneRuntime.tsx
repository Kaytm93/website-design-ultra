'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  createClock,
  createRandomStreams,
  createStableFrameMarker,
  type RandomStream,
  type SceneClock,
} from '../lib/determinism-runtime.ts'
import {
  createQualityController,
  type QualityController,
  type QualityTelemetryState,
} from '../lib/quality-controller.ts'
import {
  createImmersiveTelemetrySurface,
  type ImmersiveTelemetrySurface,
  type RendererReader,
} from '../lib/telemetry-surface.ts'
import type { RendererCounters } from '../lib/immersive-telemetry.ts'
import { QUALITY_CONFIG } from '../lib/quality-config.ts'
import {
  DEFAULT_STATION_ID,
  type MotionPreference,
  type RuntimeMode,
} from '../lib/runtime-config.ts'
import { ROOT_SEED, STABLE_FRAME, STEP_SECONDS } from '../lib/scene-config.ts'
import assetManifest from '../lib/asset-manifest.json'

if (assetManifest.schema !== 1) {
  throw new Error(
    `wdu-product-hero: unsupported asset manifest schema ${String(assetManifest.schema)}`,
  )
}

interface SceneRuntimeProps {
  mode: RuntimeMode
  stationId: string
  /** Resolved at the application boundary; scene code never reads matchMedia. */
  motion: MotionPreference
  /** DOM-side subscription to tier/DPR changes (the poster overlay reacts to the poster tier). */
  onQualityChange?: (state: QualityTelemetryState) => void
  children: ReactNode
}

interface SceneRuntimeValue {
  /** The single injected clock. Every animation reads this; nothing else times the scene. */
  clock: SceneClock
  /** Named stream for product motion, seeded from ROOT_SEED. */
  productMotion: RandomStream
  /** Sorted seed-name metadata recorded with any capture. */
  seedNames: readonly string[]
  /** The camera owner reports a completed station application through this. */
  onCameraApplied: () => void
  /**
   * The one quality owner (IP-05B). Tier and DPR transitions happen only
   * here; scene code reads the decided state and never re-decides quality.
   */
  quality: QualityController
  /** The shared telemetry surface (IP-03A/B); the verifier reads it through window.__WDU_IMMERSIVE_TELEMETRY__. */
  telemetry: ImmersiveTelemetrySurface
  /** The model owner reports load completion through this; readiness gates on it. */
  markAssetsReady: () => void
  /** Change subscription for React surfaces that display the quality state. */
  onQualityChange: (listener: (state: QualityTelemetryState) => void) => () => void
  /** The resolved motion preference; scene code reads this, never the media query. */
  motion: MotionPreference
  /** The resolved runtime mode; the capture freeze and control locks read it. */
  mode: RuntimeMode
  /**
   * Context-loss recording: removes readiness and forces the camera to
   * re-apply before the next ready. Recovery is the DOM remount.
   */
  invalidateReady: () => void
  /** True only after the deterministic stable frame rendered (drives the capture freeze). */
  stableFrameReached: () => boolean
}

interface SceneBootstrap {
  clock: SceneClock
  productMotion: RandomStream
  seedNames: readonly string[]
  marker: ReturnType<typeof createStableFrameMarker>
  streamsInitialized: boolean
  quality: QualityController
  telemetry: ImmersiveTelemetrySurface
}

const SceneRuntimeContext = createContext<SceneRuntimeValue | null>(null)

export function useSceneRuntime(): SceneRuntimeValue {
  const value = useContext(SceneRuntimeContext)
  if (value === null) {
    throw new Error('useSceneRuntime must be used inside <SceneRuntime>')
  }
  return value
}

/** Map three's gl.info to the shared telemetry counters (T0.2 context surface). */
function mapRendererCounters(info: {
  render: { calls: number; triangles: number }
  memory: { geometries: number; textures: number }
  programs?: unknown[] | null
}): RendererCounters {
  return {
    api: 'webgl2',
    counters: {
      drawCalls: { value: info.render.calls, unit: 'count' },
      visibleTriangles: { value: info.render.triangles, unit: 'count' },
      textures: { value: info.memory.textures, unit: 'count' },
      geometries: { value: info.memory.geometries, unit: 'count' },
      programs: { value: info.programs?.length ?? 0, unit: 'count' },
    },
  }
}

function createBootstrap(mode: RuntimeMode, readRenderer: RendererReader): SceneBootstrap {
  // One clock: the deterministic adapter advances the declared fixed step per
  // rendered frame; the live adapter reads the wall clock only here, at its
  // outer boundary. No scene system reads a wall clock or a library ticker.
  const clock = createClock(
    mode === 'deterministic'
      ? { mode: 'deterministic', stepSeconds: STEP_SECONDS }
      : { mode: 'live' },
  )
  // One quality owner: created here, once per mount, with time injected from
  // the one scene clock. The controller never reads a wall clock, so in
  // deterministic mode its decisions are a pure function of the fixed-step
  // clock and the declared frame-time input — same run, same tier, same DPR.
  const quality = createQualityController({
    ...QUALITY_CONFIG,
    now: () => clock.elapsed * 1000,
  })
  // One telemetry surface: reads the same injected clock, the same quality
  // slice, and the renderer counters; in deterministic mode its warm-GPU
  // evidence is the declared fixed-step input, byte-identical across runs.
  const telemetry = createImmersiveTelemetrySurface({
    nowMs: () => clock.elapsed * 1000,
    mode,
    stepMs: STEP_SECONDS * 1000,
    readyMarker: 'html[data-wdu-ready="true"]',
    quality,
    readRenderer,
  })
  const streams = createRandomStreams(ROOT_SEED)
  const productMotion = streams.stream('product-motion')
  const marker = createStableFrameMarker({
    target: document.documentElement,
    stableFrame: STABLE_FRAME,
  })
  return {
    clock,
    quality,
    telemetry,
    productMotion,
    seedNames: streams.names(),
    marker,
    streamsInitialized: true,
  }
}

/**
 * Scene bootstrap and the single clock, stream root, telemetry surface, and
 * ready marker owner. Renders no pixels itself; it ticks the clock first in
 * the pre-render subscriber pass (priority -1) and evaluates the stable-frame
 * marker in the same pass, per the determinism contract. In deterministic
 * mode a reached stable frame freezes the render loop, so captures are
 * byte-identical.
 *
 * The ready marker additionally gates on the one optimized model: assets
 * become ready only after ProductModel reports load completion, so readiness
 * proves the model actually loaded and rendered.
 */
export function SceneRuntime({
  mode,
  stationId,
  motion,
  onQualityChange,
  children,
}: SceneRuntimeProps) {
  const gl = useThree((state) => state.gl)

  const rendererReaderRef = useRef<RendererReader | null>(null)
  if (rendererReaderRef.current === null) {
    rendererReaderRef.current = {
      read: () => ({
        counters: mapRendererCounters(gl.info),
        info: gl.info,
      }),
    }
  }

  const bootstrapRef = useRef<SceneBootstrap | null>(null)
  let bootstrap = bootstrapRef.current
  if (bootstrap === null) {
    bootstrap = createBootstrap(mode, rendererReaderRef.current)
    bootstrapRef.current = bootstrap
  }

  const assetsReadyRef = useRef(false)
  const cameraAppliedRef = useRef(false)
  const cameraApplyCountRef = useRef(0)
  const stableFrameReachedRef = useRef(false)
  const frameCountRef = useRef(0)
  const markerTraceRef = useRef<Array<{ frame: number; cam: boolean; reached: boolean }>>([])
  const camWritesRef = useRef<Array<string>>([])

  const onCameraApplied = useCallback(() => {
    cameraAppliedRef.current = true
    cameraApplyCountRef.current += 1
    camWritesRef.current.push(`apply@${frameCountRef.current}`)
  }, [])

  const invalidateReady = useCallback(() => {
    stableFrameReachedRef.current = false
    cameraAppliedRef.current = false
    camWritesRef.current.push(`invalidate@${frameCountRef.current}`)
    bootstrapRef.current?.marker.invalidate()
  }, [])

  // The model owner reports load completion; readiness gates on it so the
  // ready marker proves the optimized model loaded and rendered.
  const markAssetsReady = useCallback(() => {
    if (assetsReadyRef.current) return
    assetsReadyRef.current = true
    camWritesRef.current.push(`assets-ready@${frameCountRef.current}`)
    bootstrapRef.current?.marker.invalidate()
  }, [])

  // A station change invalidates readiness before the new shot applies; the
  // marker is set again only after the next stable frame renders.
  useLayoutEffect(() => {
    cameraAppliedRef.current = false
    stableFrameReachedRef.current = false
    camWritesRef.current.push(`station-effect@${frameCountRef.current}`)
    bootstrapRef.current?.marker.invalidate()
  }, [stationId])

  // Dispose the quality controller's DOM observers with the scene. The
  // controller and surface are garbage-collected with the bootstrap; nothing
  // leaks a visibility listener past unmount.
  useLayoutEffect(() => {
    const boot = bootstrapRef.current
    return () => {
      boot?.marker.invalidate()
      boot?.quality.dispose()
    }
  }, [])

  // Report the initial quality state to the DOM side and subscribe to tier or
  // DPR transitions. The poster overlay reacts to the poster tier; firing
  // only on change keeps this off the per-frame path.
  useEffect(() => {
    if (!onQualityChange) return
    onQualityChange(bootstrap.quality.qualityState())
    return bootstrap.quality.onChange(onQualityChange)
  }, [onQualityChange])

  // The diagnostic handles. The telemetry surface is the verifier's shared
  // reading surface (IP-03); the cinematic handle exposes capture metadata
  // plus the renderer's resource counters for lifecycle assertions. Both are
  // removed on unmount so they never point at a dead renderer.
  useEffect(() => {
    const readAttribute = (name: string): string | null =>
      document.documentElement.getAttribute(name)
    const telemetry = bootstrap.telemetry
    const handle = {
      mode: () => readAttribute('data-wdu-mode') ?? 'live',
      motion: () => readAttribute('data-wdu-motion') ?? 'full',
      stationId: () => readAttribute('data-wdu-station') ?? DEFAULT_STATION_ID,
      context: () => readAttribute('data-wdu-context') ?? 'ok',
      ready: () => readAttribute('data-wdu-ready') === 'true',
      frame: () => frameCountRef.current,
      cameraAppliedCount: () => cameraApplyCountRef.current,
      camWrites: () => camWritesRef.current.slice(-16),
      markerTrace: () => markerTraceRef.current.slice(-12),
      resourceCounts: () => ({
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
      }),
    }
    const globalThis_ = globalThis as Record<string, unknown>
    globalThis_.__WDU_CINEMATIC__ = handle
    globalThis_.__WDU_IMMERSIVE_TELEMETRY__ = {
      read: () => telemetry.read(),
      collect: (input: { warmupFrames: number | null; sampleWindow: number | null }) =>
        telemetry.collect(input),
      rendererInfo: () => telemetry.rendererInfo(),
    }
    return () => {
      delete globalThis_.__WDU_CINEMATIC__
      delete globalThis_.__WDU_IMMERSIVE_TELEMETRY__
    }
  }, [gl])

  // Advance the injected clock exactly once per rendered frame. Priority -1
  // runs first in the pre-render subscriber pass (R3F orders subscribers by
  // priority, negative first), so every priority-0 consumer — camera, quality
  // sample, product pose — reads this frame's time.
  //
  // Deterministic freeze: once the stable frame is reached, the clock itself
  // stops ticking. Extra renders can still be scheduled by React
  // invalidations after data-wdu-ready is set, but they now draw the same
  // frozen pose, so captures stay byte-identical regardless of flush timing.
  useFrame(() => {
    if (mode === 'deterministic' && stableFrameReachedRef.current) return
    frameCountRef.current += 1
    bootstrapRef.current?.clock.tick()
  }, -1)

  // The stable-frame check also runs at priority -1, registered after the
  // tick, so it sees the freshly ticked frame number. In deterministic mode a
  // reached stable frame freezes the loop (QualityRuntime), so the canvas
  // keeps presenting exactly the stable frame and captures are byte-identical.
  useFrame(() => {
    const boot = bootstrapRef.current
    if (!boot) return
    const reached = boot.marker.afterVisibleRender({
      frame: boot.clock.frame,
      assetsReady: assetsReadyRef.current,
      cameraStationApplied: cameraAppliedRef.current,
      streamsInitialized: boot.streamsInitialized,
    })
    markerTraceRef.current.push({
      frame: boot.clock.frame,
      cam: cameraAppliedRef.current,
      reached,
    })
    if (markerTraceRef.current.length > 64) markerTraceRef.current.shift()
    if (reached) {
      // Record the first-meaningful-frame observation once, from the scene
      // clock (deterministic: frame × fixed step; live: measured elapsed).
      boot.telemetry.recordReady(boot.clock.elapsed * 1000)
      if (mode === 'deterministic') stableFrameReachedRef.current = true
    } else {
      stableFrameReachedRef.current = false
    }
  }, -1)

  const value: SceneRuntimeValue = {
    clock: bootstrap.clock,
    productMotion: bootstrap.productMotion,
    seedNames: bootstrap.seedNames,
    onCameraApplied,
    quality: bootstrap.quality,
    telemetry: bootstrap.telemetry,
    markAssetsReady,
    onQualityChange: bootstrap.quality.onChange,
    motion,
    mode,
    invalidateReady,
    stableFrameReached: () => stableFrameReachedRef.current,
  }

  return (
    <SceneRuntimeContext.Provider value={value}>{children}</SceneRuntimeContext.Provider>
  )
}
