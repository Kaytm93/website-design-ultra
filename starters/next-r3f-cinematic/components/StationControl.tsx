'use client'

import { CAMERA_STATIONS, STATION_LABELS } from '../lib/camera-stations.ts'
import type { RuntimeMode } from '../lib/runtime-config.ts'

interface StationControlProps {
  mode: RuntimeMode
  stationId: string
  onSelect: (stationId: string) => void
}

/**
 * Semantic DOM control outside the canvas. In deterministic mode the stations
 * are locked for capture: input must not move the camera while the stable
 * frame sequence runs (determinism contract, section 5).
 */
export function StationControl({ mode, stationId, onSelect }: StationControlProps) {
  const locked = mode === 'deterministic'

  return (
    <fieldset className="station-control" disabled={locked}>
      <legend>Camera station</legend>
      <div className="station-options">
        {Object.keys(CAMERA_STATIONS).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={stationId === id}
            onClick={() => onSelect(id)}
          >
            {STATION_LABELS[id] ?? id}
          </button>
        ))}
      </div>
      <p className="station-note">
        {locked
          ? 'Deterministic mode: the capture station is locked.'
          : 'Choose the camera station applied by CameraRig.'}
      </p>
    </fieldset>
  )
}
