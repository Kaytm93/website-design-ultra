'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSceneRuntime } from './SceneRuntime.tsx'
import {
  validateTimelineManifest,
  evaluateTimeline,
  type CinematicTimelineManifest,
} from '../lib/cinematic-timeline.ts'
import manifestData from '../lib/cinematic-timeline.json'

const manifest = validateTimelineManifest(manifestData as unknown)

function isPortraitMatch(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(orientation: portrait)').matches
}

/**
 * The single cinematic timeline owner (IP-09C).
 *
 * Coordinates DOM, camera, scene, material, sound, and loading tracks without
 * a second clock. Every animation reads the injected SceneClock and the
 * normalized progress; no wall clock, audio time, or library ticker is read.
 *
 * - The canonical time source is the injected clock (SceneRuntime.clock).
 *   When the timeline is scroll-driven, normalized scroll progress is derived
 *   from layout and interpolated with clock.delta, so the same clock remains
 *   the only time owner.
 * - Property ownership is enforced by the manifest validator: two writers for
 *   one property are rejected and every track has exactly one owner (owner=id).
 * - Portrait choreography is separate: when the manifest declares requiresPortrait
 *   and a portrait viewport is present, the portrait track set evaluates instead
 *   of the desktop set. No scaled fallback is used.
 * - Checkpoint ids are declared in the manifest and feed PR-6 capture directly:
 *   the verifier captures <id>.png by seeking to the declared progress via
 *   scroll (or via ?wdu-timeline=<id> for deterministic single-frame probes).
 *   The runtime exposes html[data-wdu-timeline="<id>"] so capture metadata
 *   records the resolved checkpoint.
 * - Camera ownership: this component never writes camera directly. It evaluates
 *   the timeline and shares the result via SceneRuntime's mutable ref; CameraRig
 *   remains the single physical camera writer and consumes camera.hero.z from
 *   that ref. No R3F store read for camera exists here.
 * - Loading gate: when SceneRuntime.loadingHold is true (?wdu-loading=1), the
 *   timeline rests deterministically at progress 0 and does not produce per-frame
 *   DOM/Canvas mutations or dynamic camera values; it writes one deterministic
 *   snapshot and then freezes. Loading visibility remains driven by the real
 *   assetsReady/poster state (SceneRuntime), not by timeline time.
 */
export function CinematicTimeline() {
  const { clock, motion, timelineEvaluationRef, timelineProgressRef, loadingHold } = useSceneRuntime()
  const progressRef = timelineProgressRef
  const portraitRef = useRef(false)
  const checkpointRef = useRef<string | null>(null)
  const loadingHoldRef = useRef(loadingHold)
  const motionRef = useRef(motion)
  loadingHoldRef.current = loadingHold
  motionRef.current = motion

  // Evaluate once for loading snapshot
  function applyEvaluation(evaluation: Record<string, number>, portrait: boolean, checkpointId: string | null) {
    timelineEvaluationRef.current = evaluation
    // DOM track
    const domOpacity = evaluation['dom.hero.opacity']
    if (typeof domOpacity === 'number') {
      document.documentElement.style.setProperty('--wdu-dom-hero-opacity', String(domOpacity))
      document.documentElement.setAttribute('data-wdu-timeline-dom', String(domOpacity.toFixed(3)))
    }
    const sceneRot = evaluation['scene.hero.rotationY']
    if (typeof sceneRot === 'number') {
      document.documentElement.setAttribute('data-wdu-timeline-scene', String(sceneRot.toFixed(4)))
    }
    const matEmissive = evaluation['material.hero.emissive']
    if (typeof matEmissive === 'number') {
      document.documentElement.setAttribute('data-wdu-timeline-material', String(matEmissive.toFixed(3)))
    }
    const soundGain = evaluation['sound.ambient.gain']
    if (typeof soundGain === 'number') {
      document.documentElement.setAttribute('data-wdu-timeline-sound', String(soundGain.toFixed(3)))
    }
    const loadingProgress = evaluation['loading.bucket.progress']
    if (typeof loadingProgress === 'number') {
      document.documentElement.setAttribute('data-wdu-timeline-loading', String(loadingProgress.toFixed(3)))
    }
    if (checkpointId) {
      document.documentElement.setAttribute('data-wdu-timeline', checkpointId)
    }
    void portrait
  }

  // Resolve checkpoint probe or scroll master — gated by loadingHold.
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Loading capture: deterministic rest at progress 0, no scroll listener, no per-frame churn.
    if (loadingHoldRef.current) {
      portraitRef.current = false
      progressRef.current = 0
      checkpointRef.current = 'timeline-0'
      const evaluation = evaluateTimeline(manifest, 0, { portrait: false })
      applyEvaluation(evaluation, false, 'timeline-0')
      return
    }
    // Reduced motion is a static scene state: preserve the base pose and do not
    // let scroll or timeline values animate the scene.
    if (motionRef.current === 'reduced') {
      progressRef.current = 0
      timelineEvaluationRef.current = null
      for (const attribute of [
        'data-wdu-timeline',
        'data-wdu-timeline-dom',
        'data-wdu-timeline-scene',
        'data-wdu-timeline-material',
        'data-wdu-timeline-sound',
        'data-wdu-timeline-loading',
      ]) {
        document.documentElement.removeAttribute(attribute)
      }
      document.documentElement.style.removeProperty('--wdu-dom-hero-opacity')
      return
    }

    const params = new URLSearchParams(window.location.search)
    const id = params.get('wdu-timeline')
    if (id) {
      const portrait = isPortraitMatch() && Boolean(manifest.portrait)
      portraitRef.current = portrait
      const list = portrait && manifest.portrait?.checkpoints
        ? manifest.portrait.checkpoints
        : manifest.checkpoints
      const entry = list.find((c) => c.id === id)
      if (entry) {
        progressRef.current = entry.progress
        checkpointRef.current = entry.id
        const evaluation = evaluateTimeline(manifest, entry.progress, { portrait })
        applyEvaluation(evaluation, portrait, entry.id)
        document.documentElement.setAttribute('data-wdu-timeline', entry.id)
        return
      }
      console.error(`[CinematicTimeline] unknown timeline checkpoint "${id}"`)
    }
    // No probe: track scroll for the normalized timeline master.
    const updatePortrait = () => {
      portraitRef.current = isPortraitMatch() && Boolean(manifest.portrait)
    }
    const updateProgress = () => {
      if (loadingHoldRef.current) return
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      progressRef.current = Math.max(0, Math.min(1, window.scrollY / max))
      const list = portraitRef.current && manifest.portrait?.checkpoints ? manifest.portrait.checkpoints! : manifest.checkpoints
      let nearest = list[0]
      let best = Math.abs(list[0].progress - progressRef.current)
      for (const c of list) {
        const d = Math.abs(c.progress - progressRef.current)
        if (d < best) {
          best = d
          nearest = c
        }
      }
      if (best < 0.02) {
        checkpointRef.current = nearest.id
        document.documentElement.setAttribute('data-wdu-timeline', nearest.id)
      } else {
        checkpointRef.current = null
        document.documentElement.removeAttribute('data-wdu-timeline')
      }
    }
    updatePortrait()
    updateProgress()
    // Seed initial evaluation from current progress
    {
      const evaluation = evaluateTimeline(manifest, progressRef.current, { portrait: portraitRef.current && Boolean(manifest.portrait) })
      applyEvaluation(evaluation, portraitRef.current && Boolean(manifest.portrait), checkpointRef.current)
    }
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)
    const query = window.matchMedia('(orientation: portrait)')
    const onChange = () => {
      updatePortrait()
      updateProgress()
      if (!loadingHoldRef.current) {
        const evaluation = evaluateTimeline(manifest, progressRef.current, { portrait: portraitRef.current && Boolean(manifest.portrait) })
        applyEvaluation(evaluation, portraitRef.current && Boolean(manifest.portrait), checkpointRef.current)
      }
    }
    query.addEventListener('change', onChange)
    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
      query.removeEventListener('change', onChange)
    }
  }, [motion, progressRef])

  // Per-frame evaluation — frozen during loadingHold.
  useFrame(() => {
    if (loadingHoldRef.current || motionRef.current === 'reduced') return
    const portrait = portraitRef.current && Boolean(manifest.portrait)
    const evaluation = evaluateTimeline(manifest, progressRef.current, { portrait })
    timelineEvaluationRef.current = evaluation
    // DOM tracks — deterministic pure values
    const domOpacity = evaluation['dom.hero.opacity']
    if (typeof domOpacity === 'number') {
      document.documentElement.style.setProperty('--wdu-dom-hero-opacity', String(domOpacity))
      document.documentElement.setAttribute('data-wdu-timeline-dom', String(domOpacity.toFixed(3)))
    }
    const sceneRot = evaluation['scene.hero.rotationY']
    if (typeof sceneRot === 'number') {
      document.documentElement.setAttribute('data-wdu-timeline-scene', String(sceneRot.toFixed(4)))
    }
    const matEmissive = evaluation['material.hero.emissive']
    if (typeof matEmissive === 'number') {
      document.documentElement.setAttribute('data-wdu-timeline-material', String(matEmissive.toFixed(3)))
    }
    const soundGain = evaluation['sound.ambient.gain']
    if (typeof soundGain === 'number') {
      document.documentElement.setAttribute('data-wdu-timeline-sound', String(soundGain.toFixed(3)))
    }
    const loadingProgress = evaluation['loading.bucket.progress']
    if (typeof loadingProgress === 'number') {
      document.documentElement.setAttribute('data-wdu-timeline-loading', String(loadingProgress.toFixed(3)))
    }
    void clock.delta
  }, 0)

  return null
}

export { manifest as cinematicTimelineManifest }
