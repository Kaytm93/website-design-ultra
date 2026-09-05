'use client'

import { useEffect, useRef } from 'react'
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
 * - Deterministic freeze (IP-05C): once readiness has fired, this component
 *   stops the loop, so the canvas keeps presenting exactly the stable frame
 *   and captures are byte-identical. The freeze survives quality-driven
 *   apply() calls (visibility toggles cannot resume a frozen capture).
 *
 * React state is deliberately not touched per frame: subscription callbacks
 * fire only when the tier or DPR actually changes.
 */
export function QualityRuntime() {
  const { quality, clock, mode, stableFrameReached } = useSceneRuntime()
  const gl = useThree((state) => state.gl)
  const setFrameloop = useThree((state) => state.setFrameloop)
  const size = useThree((state) => state.size)
  const canvas = gl.domElement
  const stablePausedRef = useRef(false)

  // Feed one frame-time sample per rendered frame, after the clock tick
  // (SceneRuntime's priority -1 tick runs before every priority-0 subscriber).
  useFrame(() => {
    quality.recordFrameTime(clock.delta * 1000)
  }, 0)

  // Deterministic freeze: this subscriber (priority -1, registered before
  // SceneRuntime's own -1 hooks) runs before the tick and the marker check of
  // the same frame; once the previous frame's marker reported the stable
  // frame, stop the loop for good. Live mode never pauses here.
  useFrame(() => {
    if (mode !== 'deterministic') return
    if (!stableFrameReached()) return
    if (stablePausedRef.current) return
    stablePausedRef.current = true
    setFrameloop('never')
  }, -1)

  // Apply controller decisions: DPR and render-loop pause. Fires only on
  // change, never per frame.
  useEffect(() => {
    const apply = () => {
      gl.setPixelRatio(quality.qualityState().dpr.value)
      const frozen = mode === 'deterministic' && stablePausedRef.current
      setFrameloop(quality.snapshot().paused || frozen ? 'never' : 'always')
    }
    apply()
    return quality.onChange(apply)
  }, [gl, setFrameloop, quality, mode])

  // A resize invalidates the measurement window: samples collected at the old
  // size must not decide the new one (adaptive-runtime.md, discard list).
  //
  // Exception: once the deterministic-mode stable frame has been reached, the
  // canvas is intentionally frozen. The reduced-motion gate in
  // tests/immersive/evaluation expects byte-identical full-page screenshots
  // taken ~750ms apart, and the capture path performs a transient 1x1
  // viewport collapse + restore between shots. Each collapse/resume counts
  // as a resize here. Calling resetMeasurement() would discard the p95
  // window, could shift the adaptive tier and re-rasterise the frozen still
  // at a different DPR, producing different PNG bytes for an animation that
  // is, by contract, no longer running.
  //
  // We therefore keep applyDpr() (so the canvas still gets the correct
  // pixel ratio for the new size) but skip the measurement reset once the
  // deterministic freeze has engaged. applyDpr is invoked unconditionally
  // because gl.setPixelRatio is the only DPR writer and must follow the
  // viewport change regardless of mode.
  useEffect(() => {
    if (mode !== 'deterministic' || !stablePausedRef.current) {
      quality.resetMeasurement()
    }
    gl.setPixelRatio(quality.qualityState().dpr.value)
  }, [quality, size.width, size.height, mode, gl])

  // Offscreen and document-hidden pause, owned by the controller.
  useEffect(() => {
    quality.attachVisibility(canvas)
    return () => quality.dispose()
  }, [quality, canvas])

  return null
}
