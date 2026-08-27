'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  getCameraStation,
  type CameraStation,
} from '../lib/determinism-runtime.ts'
import { useSceneRuntime } from './SceneRuntime.tsx'

interface CameraRigProps {
  stations: Readonly<Record<string, CameraStation>>
  stationId: string
}

/**
 * The single camera owner. No other component writes camera position, target,
 * or field of view. The selected station is applied idempotently before every
 * render; in deterministic mode the control is locked, so the capture station
 * never moves. An unknown station id fails explicitly here and keeps readiness
 * unset, per the determinism contract.
 *
 * IP-09C: consumes the evaluated camera.hero.z from the shared timeline ref
 * (written by CinematicTimeline) — the only physical camera writer. When
 * loadingHold is true the timeline rests at progress 0 and the station's
 * native z is used, keeping the loading poster deterministically still.
 */
export function CameraRig({ stations, stationId }: CameraRigProps) {
  const camera = useThree((state) => state.camera)
  const { onCameraApplied, timelineEvaluationRef, loadingHold } = useSceneRuntime()
  const appliedRef = useRef<string | null>(null)
  const lastZRef = useRef<number | null>(null)
  const lastStationRef = useRef<string | null>(null)

  useFrame(() => {
    const station = getCameraStation(stations, stationId)
    const baseZ = station.position[2]
    // Timeline Z overrides station Z when timeline is active and not loading.
    let finalZ = baseZ
    if (!loadingHold) {
      const evaluation = timelineEvaluationRef.current
      const timelineZ = evaluation?.['camera.hero.z']
      if (typeof timelineZ === 'number') {
        finalZ = timelineZ
      }
    }
    const stationChanged = appliedRef.current !== stationId || lastStationRef.current !== stationId
    const zChanged = lastZRef.current === null || lastZRef.current !== finalZ
    if (!stationChanged && !zChanged) {
      // Still ensure onCameraApplied was counted at least once for readiness
      if (lastStationRef.current === null) onCameraApplied()
      return
    }
    camera.position.set(station.position[0], station.position[1], finalZ)
    if ('target' in station && station.target !== undefined) {
      camera.lookAt(station.target[0], station.target[1], station.target[2])
    }
    if (station.projection === 'perspective' && 'fov' in camera && camera.fov !== station.fov) {
      camera.fov = station.fov
      camera.updateProjectionMatrix()
    } else {
      // Timeline Z change may still need projection update if fov is perspective
      camera.updateProjectionMatrix()
    }
    appliedRef.current = stationId
    lastStationRef.current = stationId
    lastZRef.current = finalZ
    onCameraApplied()
  }, 0)

  return null
}
