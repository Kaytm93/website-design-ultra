'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import type { Camera } from 'three'
import { CAMERA_STATIONS } from '../lib/camera-stations.ts'
import { getCameraStation, type SceneClock } from '../lib/determinism-runtime.ts'

/**
 * The single camera owner. Applies the selected station before every render;
 * reports completion through onCameraApplied so the stable-frame marker can
 * gate readiness on it.
 */
export function CameraRig({
  stationId,
  clock,
  onCameraApplied,
}: {
  stationId: string
  clock: SceneClock
  onCameraApplied: () => void
}) {
  const camera = useThree((state) => state.camera as Camera)
  const reportedRef = useRef(false)
  useEffect(() => {
    const station = getCameraStation(CAMERA_STATIONS, stationId)
    camera.position.set(station.position[0], station.position[1], station.position[2])
    camera.lookAt(station.target[0], station.target[1], station.target[2])
    if ('updateProjectionMatrix' in camera) {
      (camera as unknown as { updateProjectionMatrix: () => void }).updateProjectionMatrix()
    }
    if (!reportedRef.current) {
      reportedRef.current = true
      onCameraApplied()
    }
  }, [camera, stationId, onCameraApplied, clock])
  return null
}