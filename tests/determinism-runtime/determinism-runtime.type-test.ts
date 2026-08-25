import {
  type CameraStation,
  createClock,
  createRandomStreams,
  createStableFrameMarker,
  getCameraStation,
} from '../../references/determinism-runtime.ts'

const stations = {
  'hero-wide': {
    position: [0, 1.2, 4.8],
    target: [0, 0.8, 0],
    projection: 'perspective',
    fov: 35,
    sceneState: 'hero',
  },
  plan: {
    position: [0, 8, 0],
    orientation: [0, 0, 0, 1],
    projection: 'orthographic',
    orthographicScale: 6,
    sceneState: 'plan',
  },
} as const satisfies Readonly<Record<string, CameraStation>>

const selected = getCameraStation(stations, 'hero-wide')
const selectedState: 'hero' | 'plan' = selected.sceneState
void selectedState

const deterministicClock = createClock({
  mode: 'deterministic',
  stepSeconds: 1 / 60,
})
const liveClock = createClock({ mode: 'live' })
deterministicClock.tick()
liveClock.pause()
liveClock.resume()

const streams = createRandomStreams('capture-seed')
streams.stream('particles').next()
const seedNames: readonly string[] = streams.names()
void seedNames

createStableFrameMarker({
  stableFrame: 12,
  target: {
    setAttribute(_name: string, _value: string) {},
    removeAttribute(_name: string) {},
  },
})

// @ts-expect-error deterministic clocks require an explicit fixed step
createClock({ mode: 'deterministic' })

// @ts-expect-error live clocks cannot receive a deterministic fixed step
createClock({ mode: 'live', stepSeconds: 1 / 60 })

// @ts-expect-error perspective stations require a field of view
const incompleteStation: CameraStation = {
  position: [0, 0, 1],
  target: [0, 0, 0],
  projection: 'perspective',
  sceneState: 'hero',
}
void incompleteStation
