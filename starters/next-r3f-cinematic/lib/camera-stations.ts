import type { CameraStation } from './determinism-runtime.ts'

/**
 * Named camera stations, owned by the one camera owner (CameraRig). Each id is
 * public capture metadata: a verifier requests a station id before scene
 * initialization and the shot below is applied in full. Adding a station is an
 * intentional capture-contract change.
 */
export const CAMERA_STATIONS = {
  'hero-wide': {
    position: [0, 1.1, 4.6],
    target: [0, 0.4, 0],
    projection: 'perspective',
    fov: 35,
    sceneState: 'hero',
  },
  'hero-detail': {
    position: [0.9, 0.5, 2.1],
    target: [0, 0.3, 0],
    projection: 'perspective',
    fov: 30,
    sceneState: 'hero',
  },
} as const satisfies Readonly<Record<string, CameraStation>>

export const STATION_LABELS: Readonly<Record<string, string>> = {
  'hero-wide': 'Wide',
  'hero-detail': 'Detail',
}
