'use client'

import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSceneRuntime } from './SceneRuntime.tsx'

/**
 * The single application site for controller-owned quality settings (IP-05B).
 *
 * This component transports measurements and applies decisions; it never
 * decides quality itself. The quality controller created by SceneRuntime is
 * the one transition owner:
 *
 * - Once per rendered frame it feeds the measured frame time. The sample is
 *   read from the injected scene clock (clock.delta), never from a wall clock:
 *   in deterministic mode the fixed 1/60 s step yields a constant sample, so
 *   the controller stays at the declared initial tier and the capture is
 *   reproducible.
 * - On tier/DPR changes it applies the decided DPR imperatively through
 *   gl.setPixelRatio. There is no `dpr` prop on the Canvas and no other
 *   setPixelRatio call: this is the only DPR writer.
 * - On offscreen/hidden pause it stops the render loop via setFrameloop. The
 *   controller owns the visible/paused decision; this component only executes
 *   it.
 * - It attaches the controller's own IntersectionObserver/visibilitychange
 *   wiring to the canvas element and detaches it on unmount.
 *
 * React state is deliberately not touched per frame: subscription callbacks
 * fire only when the tier or DPR actually changes.
 */
export function QualityRuntime() {
  const { quality, clock } = useSceneRuntime()
  const gl = useThree((state) => state.gl)
  const setFrameloop = useThree((state) => state.setFrameloop)
  const size = useThree((state) => state.size)
  const canvas = gl.domElement

  // Feed one frame-time sample per rendered frame, after the clock tick
  // (SceneRuntime registered its priority-0 tick before this component).
  useFrame(() => {
    quality.recordFrameTime(clock.delta * 1000)
  }, 0)

  // Apply controller decisions: DPR and render-loop pause. Fires only on
  // change, never per frame.
  useEffect(() => {
    const apply = () => {
      gl.setPixelRatio(quality.qualityState().dpr.value)
      setFrameloop(quality.snapshot().paused ? 'never' : 'always')
    }
    apply()
    return quality.onChange(apply)
  }, [gl, setFrameloop, quality])

  // A resize invalidates the measurement window: samples collected at the old
  // size must not decide the new one (adaptive-runtime.md, discard list).
  useEffect(() => {
    quality.resetMeasurement()
  }, [quality, size.width, size.height])

  // Offscreen and document-hidden pause, owned by the controller.
  useEffect(() => {
    quality.attachVisibility(canvas)
    return () => quality.dispose()
  }, [quality, canvas])

  return null
}
