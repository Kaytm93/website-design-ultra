import type { CameraStation } from './determinism-runtime.ts'

/**
 * Named camera stations, owned by the one camera owner (CameraRig). Each id is
 * public capture metadata: a verifier requests a station id before scene
 * initialization and the shot below is applied in full. Adding a station is an
 * intentional capture-contract change.
 *
 * hero-portrait is the portrait reframe: the product is pulled back and aimed
 * higher so the speaker and its base stack inside a tall frame, per
 * 3d-art-direction's portrait-shot rule. Live mode selects it by orientation;
 * deterministic capture requests it by id (WDU_STATION=hero-portrait).
 */
export const CAMERA_STATIONS = {
  'hero-wide': {
    position: [0, 0.9, 4.2],
    target: [0, 0.45, 0],
    projection: 'perspective',
    fov: 35,
    sceneState: 'hero',
  },
  'hero-detail': {
    position: [0.75, 0.35, 2.0],
    target: [0, 0.45, 0],
    projection: 'perspective',
    fov: 30,
    sceneState: 'hero',
  },
  'hero-portrait': {
    position: [0, 1.25, 5.2],
    target: [0, 0.6, 0],
    projection: 'perspective',
    fov: 33,
    sceneState: 'hero',
  },
} as const satisfies Readonly<Record<string, CameraStation>>

export const STATION_LABELS: Readonly<Record<string, string>> = {
  'hero-wide': 'Wide',
  'hero-detail': 'Detail',
  'hero-portrait': 'Portrait',
}
