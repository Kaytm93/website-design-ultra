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
 */
export function CameraRig({ stations, stationId }: CameraRigProps) {
  const camera = useThree((state) => state.camera)
  const { onCameraApplied } = useSceneRuntime()
  const appliedRef = useRef<string | null>(null)

  useFrame(() => {
    if (appliedRef.current === stationId) return
    const station = getCameraStation(stations, stationId)
    camera.position.set(station.position[0], station.position[1], station.position[2])
    // The orientation variant of CameraStation carries target?: never, so the
    // explicit undefined check narrows past the union's optional member.
    if ('target' in station && station.target !== undefined) {
      camera.lookAt(station.target[0], station.target[1], station.target[2])
    }
    if (station.projection === 'perspective' && 'fov' in camera && camera.fov !== station.fov) {
      camera.fov = station.fov
      camera.updateProjectionMatrix()
    }
    appliedRef.current = stationId
    onCameraApplied()
  }, 0)

  return null
}
