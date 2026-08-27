// camera-stations.ts — Two named camera stations (crystal-wide +
// crystal-portrait) plus a detail station. The portrait station reframes the
// procedural crystal for tall viewports (IP-05C pattern). CameraRig is the
// single writer.
//
// Mirrors product-hero/lib/camera-stations.ts so the typed CameraStation
// shape (sceneState + projection + fov) lines up with the shared
// determinism-runtime and the verifier's capture contract.

import type { CameraStation } from './determinism-runtime.ts'

export const CAMERA_STATIONS = {
  'crystal-wide': {
    position: [0, 0.9, 3.2],
    target: [0, 0.9, 0],
    projection: 'perspective',
    fov: 35,
    sceneState: 'crystal',
  },
  'crystal-detail': {
    position: [0.5, 0.4, 1.8],
    target: [0, 0.5, 0],
    projection: 'perspective',
    fov: 30,
    sceneState: 'crystal',
  },
  'crystal-portrait': {
    position: [0, 1.4, 4.0],
    target: [0, 1.2, 0],
    projection: 'perspective',
    fov: 33,
    sceneState: 'crystal',
  },
} as const satisfies Readonly<Record<string, CameraStation>>

export const STATION_LABELS: Readonly<Record<string, string>> = {
  'crystal-wide': 'Wide',
  'crystal-detail': 'Detail',
  'crystal-portrait': 'Portrait',
}