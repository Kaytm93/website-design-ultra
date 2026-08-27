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
    `next-r3f-cinematic: unsupported asset manifest schema ${String(assetManifest.schema)}`,
  )
}

interface SceneRuntimeProps {
  mode: RuntimeMode
  stationId: string
  /** Resolved at the application boundary; scene code never reads matchMedia. */
  motion: MotionPreference
  /** Declared loading capture state (IP-06A): holds asset readiness so the loading surface stays visible. */
  loadingHold?: boolean
  /** DOM-side subscription to tier/DPR changes (the poster overlay reacts to the poster tier). */
  onQualityChange?: (state: QualityTelemetryState) => void
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
  /**
   * The one quality owner (IP-05B). Tier and DPR transitions happen only
   * here; scene code reads the decided state and never re-decides quality.
   */
  quality: QualityController
  /** Change subscription for React surfaces that display the quality state. */
  onQualityChange: (listener: (state: QualityTelemetryState) => void) => () => void
  /** The resolved motion preference (IP-05C); scene code reads this, never the media query. */
  motion: MotionPreference
  /** The resolved runtime mode; the capture freeze and control locks read it. */
  mode: RuntimeMode
  /**
   * Context-loss recording (IP-05C): removes readiness and forces the camera
   * to re-apply before the next ready. Recovery is the DOM remount.
   */
  invalidateReady: () => void
  /**
   * Capture-state invalidation (IP-06A): removes readiness when a declared
   * interaction state (pointer hover/press) changes, without touching the
   * camera contract or resuming the frozen clock. The marker re-sets on the
   * next rendered frame, so interaction captures are byte-identical across
   * runs regardless of input timing.
   */
  invalidateCaptureState: () => void
  /** True only after the deterministic stable frame rendered (drives the capture freeze). */
  stableFrameReached: () => boolean
  /** Loading hold gate: true when ?wdu-loading=1 holds asset readiness for poster capture. */
  loadingHold: boolean
  /** Shared timeline evaluation ref: CinematicTimeline writes, CameraRig/HeroObject read — no per-frame React state. */
  timelineEvaluationRef: React.MutableRefObject<Record<string, number> | null>
  /** Shared timeline progress ref: normalized [0,1] progress backing the evaluation. */
  timelineProgressRef: React.MutableRefObject<number>
}

interface SceneBootstrap {
  clock: SceneClock
  heroMotion: RandomStream
  seedNames: readonly string[]
  marker: ReturnType<typeof createStableFrameMarker>
  streamsInitialized: boolean
  assetsReady: boolean
  quality: QualityController
}

const SceneRuntimeContext = createContext<SceneRuntimeValue | null>(null)

export function useSceneRuntime(): SceneRuntimeValue {
  const value = useContext(SceneRuntimeContext)
  if (value === null) {
    throw new Error('useSceneRuntime must be used inside <SceneRuntime>')
  }
  return value
}

function createBootstrap(mode: RuntimeMode, loadingHold: boolean): SceneBootstrap {
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
  const streams = createRandomStreams(ROOT_SEED)
  const heroMotion = streams.stream('hero-motion')
  const marker = createStableFrameMarker({
    target: document.documentElement,
    stableFrame: STABLE_FRAME,
  })
  return {
    clock,
    quality,
    heroMotion,
    seedNames: streams.names(),
    marker,
    streamsInitialized: true,
    // The manifest is bundled and schema-checked above; nothing loads over the
    // network, so asset readiness is a resolved constant. The declared loading
    // capture state (?wdu-loading=1, IP-06A) holds readiness so the composed
    // loading surface stays visible deterministically.
    assetsReady: !loadingHold,
  }
}

/**
 * Scene bootstrap and the single clock, stream root, and ready marker owner.
 * Renders no pixels itself; it ticks the clock first in the pre-render
 * subscriber pass (priority -1) and evaluates the stable-frame marker in the
 * same pass, per the determinism contract. In deterministic mode a reached
 * stable frame freezes the render loop, so captures are byte-identical.
 *
 * IP-05C additions: the resolved motion preference is exposed to scene code,
 * context loss can invalidate readiness, and a diagnostic capture handle
 * (`globalThis.__WDU_CINEMATIC__`) exposes capture metadata plus the
 * renderer's resource counters for the lifecycle assertions. The handle is
 * deleted on unmount so it never points at a dead renderer.
 */
export function SceneRuntime({
  mode,
  stationId,
  motion,
  loadingHold = false,
  onQualityChange,
  children,
}: SceneRuntimeProps) {
  const bootstrapRef = useRef<SceneBootstrap | null>(null)
  let bootstrap = bootstrapRef.current
  if (bootstrap === null) {
    bootstrap = createBootstrap(mode, loadingHold)
    bootstrapRef.current = bootstrap
  }

  const cameraAppliedRef = useRef(false)
  const cameraApplyCountRef = useRef(0)
  const stableFrameReachedRef = useRef(false)
  const frameCountRef = useRef(0)
  const markerTraceRef = useRef<Array<{ frame: number; cam: boolean; reached: boolean }>>([])
  const camWritesRef = useRef<Array<string>>([])
  const gl = useThree((state) => state.gl)
  // Shared timeline state: CinematicTimeline writes; CameraRig/HeroObject read; no React state per frame.
  const timelineEvaluationRef = useRef<Record<string, number> | null>(null)
  const timelineProgressRef = useRef(0)

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

  // Capture-state invalidation (IP-06A): a declared interaction state change
  // removes readiness without resuming the frozen clock or touching the
  // camera contract. The marker re-sets on the next rendered frame, so the
  // captured pose is a pure function of the frozen clock and the declared
  // state — never of the frame the pointer event happened to land on.
  const invalidateCaptureState = useCallback(() => {
    camWritesRef.current.push(`capture-state@${frameCountRef.current}`)
    bootstrapRef.current?.marker.invalidate()
  }, [])

  // A station change invalidates readiness before the new shot applies; the
  // marker is set again only after the next stable frame renders.
  //
  // This must be a layout effect: a passive effect can flush after the first
  // rAF frame (the R3F loop starts during commit), which would reset
  // cameraAppliedRef after CameraRig already applied — and the rig never
  // re-applies an unchanged station, so readiness would never recover.
  useLayoutEffect(() => {
    cameraAppliedRef.current = false
    stableFrameReachedRef.current = false
    camWritesRef.current.push(`station-effect@${frameCountRef.current}`)
    bootstrapRef.current?.marker.invalidate()
  }, [stationId])

  // Dispose the quality controller's DOM observers with the scene. The
  // controller itself is garbage-collected with the bootstrap; nothing leaks
  // a visibility listener past unmount.
  //
  // This is a layout effect so the ready attribute is removed synchronously
  // at unmount, before a successor mount can render its first frame: a
  // passive cleanup could otherwise delete the successor's freshly set
  // data-wdu-ready attribute after the deterministic loop already froze.
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

  // The diagnostic capture handle. resourceCounts reads the renderer's own
  // counters, so repeated mount/unmount cycles (route transitions, restore
  // after context loss) can be asserted not to grow GPU resources (IP-05C).
  useEffect(() => {
    const readAttribute = (name: string): string | null =>
      document.documentElement.getAttribute(name)
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
    ;(globalThis as Record<string, unknown>).__WDU_CINEMATIC__ = handle
    return () => {
      delete (globalThis as Record<string, unknown>).__WDU_CINEMATIC__
    }
  }, [gl])

  // Advance the injected clock exactly once per rendered frame. Priority -1
  // runs first in the pre-render subscriber pass (R3F orders subscribers by
  // priority, negative first), so every priority-0 consumer — camera, quality
  // sample, hero pose — reads this frame's time.
  //
  // Deterministic freeze (IP-05C): once the stable frame is reached, the clock
  // itself stops ticking. Extra renders can still be scheduled by React
  // invalidations after data-wdu-ready is set, but they now draw the same
  // frozen pose, so captures stay byte-identical regardless of flush timing.
  //
  // NOTE: no useFrame in this starter may use a positive priority. R3F treats
  // a subscriber with priority > 0 as a manual render owner and disables its
  // automatic gl.render call, which leaves the canvas blank.
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
      assetsReady: boot.assetsReady,
      cameraStationApplied: cameraAppliedRef.current,
      streamsInitialized: boot.streamsInitialized,
    })
    markerTraceRef.current.push({
      frame: boot.clock.frame,
      cam: cameraAppliedRef.current,
      reached,
    })
    if (markerTraceRef.current.length > 64) markerTraceRef.current.shift()
    if (reached && mode === 'deterministic') stableFrameReachedRef.current = true
    else if (!reached) stableFrameReachedRef.current = false
  }, -1)

  const value: SceneRuntimeValue = {
    clock: bootstrap.clock,
    heroMotion: bootstrap.heroMotion,
    seedNames: bootstrap.seedNames,
    onCameraApplied,
    quality: bootstrap.quality,
    onQualityChange: bootstrap.quality.onChange,
    motion,
    mode,
    invalidateReady,
    invalidateCaptureState,
    stableFrameReached: () => stableFrameReachedRef.current,
    loadingHold,
    timelineEvaluationRef,
    timelineProgressRef,
  }

  return (
    <SceneRuntimeContext.Provider value={value}>{children}</SceneRuntimeContext.Provider>
  )
}
