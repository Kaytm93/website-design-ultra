import type { CameraStation } from './determinism-runtime.ts'

/**
 * Named camera stations, owned by the single camera owner in scene.ts.
 *
 * Each id is public capture metadata: a verifier requests a station id before
 * scene initialization and the shot below is applied in full. Adding a station
 * is an intentional capture-contract change.
 *
 * `hero-portrait` is the portrait composition, not the wide shot cropped: the
 * camera pulls back and aims higher so the shard cluster stacks inside a tall
 * frame. Live mode selects it by orientation; deterministic capture requests it
 * by id.
 */
export const CAMERA_STATIONS = {
  'hero-wide': {
    position: [1.0, 1.15, 3.5],
    target: [0.42, 0.72, 0],
    projection: 'perspective',
    fov: 36,
    sceneState: 'hero',
  },
  'hero-detail': {
    position: [1.5, 0.85, 2.1],
    target: [0.5, 0.78, 0],
    projection: 'perspective',
    fov: 30,
    sceneState: 'hero',
  },
  'hero-portrait': {
    position: [0.35, 1.3, 3.9],
    target: [0.42, 0.8, 0],
    projection: 'perspective',
    fov: 34,
    sceneState: 'hero',
  },
} as const satisfies Readonly<Record<string, CameraStation>>

export type StationId = keyof typeof CAMERA_STATIONS

export const STATION_LABELS: Readonly<Record<StationId, string>> = {
  'hero-wide': 'Wide',
  'hero-detail': 'Detail',
  'hero-portrait': 'Portrait',
}

export const STATION_IDS = Object.keys(CAMERA_STATIONS) as readonly StationId[]

/** Orientation selects the live station; capture selects it by id instead. */
export function stationForViewport(width: number, height: number): StationId {
  return height > width ? 'hero-portrait' : 'hero-wide'
}
