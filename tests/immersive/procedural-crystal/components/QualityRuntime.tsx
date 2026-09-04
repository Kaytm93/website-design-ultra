'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSceneRuntime } from './SceneRuntime.tsx'

/**
 * The single application site for controller-owned quality settings (IP-05B)
 * and the shared telemetry sampler (IP-03).
 *
 * This component transports measurements and applies decisions; it never
 * decides quality itself. The quality controller created by SceneRuntime is
 * the one transition owner:
 *
 * - Once per rendered frame it feeds the measured frame time to the quality
 *   controller and to the telemetry surface. The sample is read from the
 *   injected scene clock (clock.delta), never from a wall clock: in
 *   deterministic mode the fixed 1/60 s step yields a constant sample, so the
 *   controller stays at the declared initial tier, the telemetry document
 *   reports the declared frame-time input, and the capture is reproducible.
 * - On tier/DPR changes it applies the decided DPR imperatively through
 *   gl.setPixelRatio. There is no `dpr` prop on the Canvas and no other
 *   setPixelRatio call: applyDpr is the only DPR writer.
 *
 *   The decision has to be restated after every resize, which is why
 *   applyDpr is called from the size effect too. R3F re-applies its own
 *   viewport.dpr — the Canvas default, not the controller's tier ceiling —
 *   to the renderer whenever it measures the canvas at a new size, so an
 *   imperative pixel ratio written once survives only until the next
 *   resize. That is not a hypothetical here: the verifier's full-page
 *   captures collapse the viewport to 1x1 and restore it, which resizes the
 *   canvas twice per screenshot. A dropped pixel ratio re-rasterises the
 *   frozen reduced-motion still at a different resolution between two shots,
 *   and the reduced-motion gate reads that, correctly, as a page still
 *   changing under prefers-reduced-motion.
 * - On offscreen/hidden pause it stops the render loop via setFrameloop. The
 *   controller owns the visible/paused decision; this component only executes
 *   it.
 * - It attaches the controller's own IntersectionObserver/visibilitychange
 *   wiring to the canvas element and detaches it on unmount.
 * - Deterministic freeze: once readiness has fired, this component stops the
 *   loop, so the canvas keeps presenting exactly the stable frame and
 *   captures are byte-identical.
 *
 * React state is deliberately not touched per frame: subscription callbacks
 * fire only when the tier or DPR actually changes.
 */
export function QualityRuntime() {
  const { quality, telemetry, clock, mode, stableFrameReached } = useSceneRuntime()
  const setFrameloop = useThree((state) => state.setFrameloop)
  const gl = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const canvas = gl.domElement
  const stablePausedRef = useRef(false)

  // Feed one frame-time sample per rendered frame, after the clock tick
  // (SceneRuntime's priority -1 tick runs before every priority-0 subscriber).
  // One sample source: the quality controller and the telemetry surface read
  // the same clock delta, so the declared budget and the observed evidence
  // always describe the same frames.
  useFrame(() => {
    const frameTimeMs = clock.delta * 1000
    quality.recordFrameTime(frameTimeMs)
    telemetry.recordFrameTimeMs(frameTimeMs)
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

  // The one DPR write: every place that needs the decided pixel ratio on the
  // renderer calls this, so there is a single call site to keep honest.
  const applyDpr = useCallback(() => {
    gl.setPixelRatio(quality.qualityState().dpr.value)
  }, [gl, quality])

  // Apply controller decisions: DPR and render-loop pause. Fires only on
  // change, never per frame.
  useEffect(() => {
    const apply = () => {
      applyDpr()
      const frozen = mode === 'deterministic' && stablePausedRef.current
      setFrameloop(quality.snapshot().paused || frozen ? 'never' : 'always')
    }
    apply()
    return quality.onChange(apply)
  }, [applyDpr, setFrameloop, quality, mode])

  // A resize invalidates the measurement window: samples collected at the old
  // size must not decide the new one (adaptive-runtime.md, discard list). It
  // also re-runs the one DPR write, because R3F sizes the renderer from
  // whatever pixel ratio it holds at that moment — the decision has to be
  // restated for the new size, not inherited from it.
  useEffect(() => {
    quality.resetMeasurement()
    applyDpr()
  }, [applyDpr, quality, size.width, size.height])

  // Offscreen and document-hidden pause, owned by the controller.
  useEffect(() => {
    quality.attachVisibility(canvas)
    return () => quality.dispose()
  }, [quality, canvas])

  return null
}
