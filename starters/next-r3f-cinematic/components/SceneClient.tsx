'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { StationControl } from './StationControl.tsx'
import type { RuntimeMode } from '../lib/runtime-config.ts'

const SceneCanvas = dynamic(() => import('./SceneCanvas.tsx').then((m) => m.SceneCanvas), {
  ssr: false,
  loading: () => (
    <div className="scene-loading" role="status">
      Loading the 3D scene…
    </div>
  ),
})

interface SceneClientProps {
  mode: RuntimeMode
  stationId: string
}

/**
 * The smallest client boundary. It owns the camera-station choice in live
 * mode, renders the station control in the DOM outside the canvas, and mounts
 * the canvas only in the browser.
 */
export function SceneClient({ mode, stationId: initialStationId }: SceneClientProps) {
  const [stationId, setStationId] = useState(initialStationId)

  return (
    <div className="scene-client">
      <StationControl mode={mode} stationId={stationId} onSelect={setStationId} />
      <div className="scene-frame">
        <SceneCanvas mode={mode} stationId={stationId} />
      </div>
    </div>
  )
}
