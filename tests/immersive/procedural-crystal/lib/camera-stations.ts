// camera-stations.ts — Two named camera stations (crystal-wide + crystal-portrait).
// The portrait station reframes the procedural crystal for tall viewports
// (IP-05C pattern). CameraRig is the single writer.

import type { CameraStations } from './determinism-runtime.ts'

export const CAMERA_STATIONS: CameraStations = {
  'crystal-wide': {
    position: [0, 0.9, 3.2],
    target: [0, 0.9, 0],
  },
  'crystal-portrait': {
    position: [0, 1.4, 4.0],
    target: [0, 1.2, 0],
  },
}