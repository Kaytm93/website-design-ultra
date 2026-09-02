import type { CameraStation } from './determinism-runtime.ts'

/**
 * Named camera stations, owned by the one camera owner (CameraRig). Each id is
 * public capture metadata: a verifier requests a station id before scene
 * initialization and the shot below is applied in full. Adding a station is an
 * intentional capture-contract change.
 *
 * hero-portrait is the portrait composition (IP-05C): the subject is pulled
 * back and aimed higher so the knot and pedestal stack inside a tall frame,
 * per 3d-art-direction's portrait-shot rule. Live mode selects it by
 * orientation; deterministic capture requests it by id.
 */
export const CAMERA_STATIONS = {
  'hero-wide': {
    position: [0, 0.8, 4.6],
    target: [0, 0.25, 0],
    projection: 'perspective',
    fov: 34,
    sceneState: 'hero',
  },
  'hero-detail': {
    position: [0.65, 0.5, 2.8],
    target: [0, 0.55, 0],
    projection: 'perspective',
    fov: 30,
    sceneState: 'hero',
  },
  'hero-portrait': {
    position: [0, 1.2, 5.8],
    target: [0, 0.45, 0],
    projection: 'perspective',
    fov: 32,
    sceneState: 'hero',
  },
} as const satisfies Readonly<Record<string, CameraStation>>

export const STATION_LABELS: Readonly<Record<string, string>> = {
  'hero-wide': 'Wide',
  'hero-detail': 'Detail',
  'hero-portrait': 'Portrait',
}
