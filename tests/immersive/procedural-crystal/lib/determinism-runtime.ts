// determinism-runtime.ts — Minimal copyable determinism primitives (IP-02B / IP-10C):
// injectable clock, named-stream PRNG, named camera-station lookup, stable-frame
// marker. Kept tiny on purpose: the fixture is small and we deliberately do not
// duplicate the full product-hero surface; the methods here are the subset that
// the runtime-config, scene-runtime, and tests share.

export interface SceneClock {
  readonly elapsed: number
  readonly delta: number
  readonly frame: number
  tick(): SceneClock
}

export interface CreateClockOptions {
  readonly mode: 'deterministic' | 'live'
  readonly stepSeconds?: number
  readonly nowSeconds?: () => number
}

export function createClock(options: CreateClockOptions): SceneClock {
  const step = options.stepSeconds ?? 1 / 60
  const now = options.nowSeconds ?? (() => performance.now() / 1000)
  let frame = 0
  let elapsed = 0
  let last = now()
  return {
    get elapsed() { return elapsed },
    get delta() {
      if (options.mode === 'deterministic') return step
      return Math.max(0, now() - last)
    },
    get frame() { return frame },
    tick() {
      if (options.mode === 'deterministic') {
        elapsed += step
      } else {
        const current = now()
        elapsed += Math.max(0, current - last)
        last = current
      }
      frame += 1
      return this
    },
  }
}

export interface RandomStreams {
  stream(name: string): { next(): number }
  names(): string[]
}

export function createRandomStreams(seed: string): RandomStreams {
  // xfnv1a hash + mulberry32 — tiny, deterministic, zero-dep.
  // Each call to stream(name) returns a fresh generator sharing the same
  // initial state for that name; streams are independent so adding a new
  // stream does not perturb an existing stream's sequence.
  let hash = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const baseState = hash >>> 0
  const names: string[] = []
  function stream(name: string): { next(): number } {
    let s = (baseState ^ fnv1a(name)) >>> 0
    if (!names.includes(name)) {
      names.push(name)
      names.sort()
    }
    return {
      next() {
        s = (s + 0x6d2b79f5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      },
    }
  }
  return { stream, names: () => names.slice() }
}

function fnv1a(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type CameraStations = Record<string, { position: [number, number, number]; target: [number, number, number] }>

export function getCameraStation(stations: CameraStations, id: string): { position: [number, number, number]; target: [number, number, number] } {
  const found = stations[id]
  if (!found) {
    const known = Object.keys(stations).sort().join(', ')
    throw new Error(`Unknown camera station "${id}". Known stations: ${known}`)
  }
  return found
}

export interface StableFrameMarker {
  ready: boolean
  afterVisibleRender(state: { assetsReady: boolean; cameraStationApplied: boolean; streamsInitialized: boolean; frame: number; stableFrame?: number }): boolean
  invalidate(): void
}

export interface StableFrameMarkerOptions {
  target: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void }
  stableFrame: number
}

export function createStableFrameMarker(options: StableFrameMarkerOptions): StableFrameMarker {
  let ready = false
  return {
    get ready() { return ready },
    afterVisibleRender(state) {
      const threshold = state.stableFrame ?? options.stableFrame
      if (!state.assetsReady || !state.cameraStationApplied || !state.streamsInitialized) {
        return false
      }
      if (state.frame < threshold) return false
      if (ready) return true
      options.target.setAttribute('data-wdu-ready', 'true')
      ready = true
      return true
    },
    invalidate() {
      options.target.removeAttribute('data-wdu-ready')
      ready = false
    },
  }
}