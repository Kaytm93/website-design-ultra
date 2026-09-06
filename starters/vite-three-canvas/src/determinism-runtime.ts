/*
 * Copyable deterministic-scene runtime reference.
 *
 * This file has zero runtime dependencies and belongs outside the installed
 * website-design-ultra plugin payload. Copy it into an application rather than
 * importing it as a package. Scene systems read the injected clock and named
 * streams; only this boundary owns time and seed derivation.
 */

export interface SceneClock {
  readonly elapsed: number
  readonly delta: number
  readonly ratio: number
  readonly frame: number
  tick(): void
  pause(): void
  resume(): void
}

export interface DeterministicClockOptions {
  readonly mode: 'deterministic'
  readonly stepSeconds: number
  readonly targetStepSeconds?: number
}

export interface LiveClockOptions {
  readonly mode: 'live'
  readonly now?: () => number
  readonly targetStepSeconds?: number
  readonly maxStepSeconds?: number
}

export type ClockOptions = DeterministicClockOptions | LiveClockOptions

function requirePositiveFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`)
  }
  return value
}

function performanceNow(): number {
  if (typeof globalThis.performance?.now !== 'function') {
    throw new Error('Live clock requires performance.now() or an injected now()')
  }
  return globalThis.performance.now()
}

export function createClock(options: ClockOptions): SceneClock {
  const targetStepSeconds = requirePositiveFinite(
    options.targetStepSeconds ?? 1 / 60,
    'targetStepSeconds',
  )
  const deterministicStep =
    options.mode === 'deterministic'
      ? requirePositiveFinite(options.stepSeconds, 'stepSeconds')
      : 0
  let liveAdapter:
    | { readDeltaSeconds(): number; resetPreviousTime(): void }
    | undefined

  if (options.mode === 'live') {
    const now = options.now ?? performanceNow
    const maxStepSeconds = requirePositiveFinite(
      options.maxStepSeconds ?? 1 / 20,
      'maxStepSeconds',
    )
    let previousMilliseconds = now()
    liveAdapter = {
      readDeltaSeconds() {
        const currentMilliseconds = now()
        const rawSeconds = (currentMilliseconds - previousMilliseconds) / 1_000
        previousMilliseconds = currentMilliseconds
        return Math.min(Math.max(rawSeconds, 0), maxStepSeconds)
      },
      resetPreviousTime() {
        previousMilliseconds = now()
      },
    }
  }

  let elapsed = 0
  let delta = 0
  let frame = 0
  let paused = false

  return {
    get elapsed() {
      return elapsed
    },
    get delta() {
      return delta
    },
    get ratio() {
      return delta / targetStepSeconds
    },
    get frame() {
      return frame
    },
    tick() {
      if (paused) return
      delta = liveAdapter?.readDeltaSeconds() ?? deterministicStep
      elapsed += delta
      frame += 1
    },
    pause() {
      paused = true
      delta = 0
    },
    resume() {
      if (!paused) return
      liveAdapter?.resetPreviousTime()
      paused = false
    },
  }
}

export type RootSeed = string | number

export interface RandomStream {
  next(): number
}

export interface RandomStreams {
  stream(name: string): RandomStream
  names(): readonly string[]
}

function hash32(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function createRandomStream(seed: number): RandomStream {
  let state = seed >>> 0
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0
      let value = state
      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
      return ((value ^ (value >>> 14)) >>> 0) / 0x100000000
    },
  }
}

export function createRandomStreams(rootSeed: RootSeed): RandomStreams {
  const root = `${typeof rootSeed}:${String(rootSeed)}`
  const streamNames = new Set<string>()

  return {
    stream(name: string) {
      if (name.trim().length === 0) {
        throw new Error('stream name must be non-empty')
      }
      streamNames.add(name)
      return createRandomStream(hash32(`wdu:v1\u0000${root}\u0000${name}`))
    },
    names() {
      return [...streamNames].sort()
    },
  }
}

export type Vector3 = readonly [x: number, y: number, z: number]
export type Quaternion = readonly [x: number, y: number, z: number, w: number]

type CameraAim =
  | { readonly target: Vector3; readonly orientation?: never }
  | { readonly orientation: Quaternion; readonly target?: never }

type CameraProjection =
  | {
      readonly projection: 'perspective'
      readonly fov: number
      readonly orthographicScale?: never
    }
  | {
      readonly projection: 'orthographic'
      readonly orthographicScale: number
      readonly fov?: never
    }

export type CameraStation<SceneState extends string = string> = {
  readonly position: Vector3
  readonly sceneState: SceneState
} & CameraAim &
  CameraProjection

export function getCameraStation<Station extends CameraStation>(
  stations: Readonly<Record<string, Station>>,
  id: string,
): Station {
  if (!Object.prototype.hasOwnProperty.call(stations, id)) {
    const available = Object.keys(stations).sort().join(', ') || '(none)'
    throw new Error(
      `Unknown camera station "${id}". Available stations: ${available}`,
    )
  }
  return stations[id] as Station
}

export interface ReadyMarkerTarget {
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

export interface StableFrameState {
  readonly frame: number
  readonly assetsReady: boolean
  readonly cameraStationApplied: boolean
  readonly streamsInitialized: boolean
}

export interface StableFrameMarker {
  readonly ready: boolean
  afterVisibleRender(state: StableFrameState): boolean
  invalidate(): void
}

export interface StableFrameMarkerOptions {
  readonly target: ReadyMarkerTarget
  readonly stableFrame: number
}

const READY_ATTRIBUTE = 'data-wdu-ready'

export function createStableFrameMarker(
  options: StableFrameMarkerOptions,
): StableFrameMarker {
  if (!Number.isSafeInteger(options.stableFrame) || options.stableFrame < 0) {
    throw new RangeError('stableFrame must be a non-negative safe integer')
  }

  let ready = false
  const invalidate = () => {
    ready = false
    options.target.removeAttribute(READY_ATTRIBUTE)
  }
  invalidate()

  return {
    get ready() {
      return ready
    },
    afterVisibleRender(state) {
      const qualified =
        state.assetsReady &&
        state.cameraStationApplied &&
        state.streamsInitialized &&
        state.frame >= options.stableFrame

      if (!qualified) {
        invalidate()
        return false
      }

      options.target.setAttribute(READY_ATTRIBUTE, 'true')
      ready = true
      return true
    },
    invalidate,
  }
}
