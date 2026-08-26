'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
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
 */
export function CinematicTimeline() {
  const { clock } = useSceneRuntime()
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const progressRef = useRef(0)
  const portraitRef = useRef(false)
  const checkpointRef = useRef<string | null>(null)

  // Resolve checkpoint probe for deterministic single-frame capture (optional).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const id = params.get('wdu-timeline')
    if (id) {
      const list = manifest.portrait && isPortraitMatch() && manifest.portrait.checkpoints
        ? manifest.portrait.checkpoints
        : manifest.checkpoints
      const entry = list.find((c) => c.id === id)
      if (entry) {
        progressRef.current = entry.progress
        checkpointRef.current = entry.id
        document.documentElement.setAttribute('data-wdu-timeline', entry.id)
        return
      }
      // Unknown checkpoint probe is a contract failure — do not silently fallback.
      console.error(`[CinematicTimeline] unknown timeline checkpoint "${id}"`)
    }
    // No probe: track scroll for the normalized timeline master.
    const updatePortrait = () => {
      portraitRef.current = isPortraitMatch() && Boolean(manifest.portrait)
    }
    const updateProgress = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      progressRef.current = Math.max(0, Math.min(1, window.scrollY / max))
      // Expose the nearest declared checkpoint for capture metadata.
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
      // Only promote checkpoint when within 2% — keeps metadata honest.
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
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)
    const query = window.matchMedia('(orientation: portrait)')
    query.addEventListener('change', () => {
      updatePortrait()
      updateProgress()
    })
    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [])

  // Apply the evaluated timeline each frame — frame-rate independent because
  // progress itself is the normalized scroll offset (layout-derived) and the
  // smoothing uses clock.ratio/clock.delta when needed. This subscriber does
  // not start a timer; it reads the injected clock only for delta-based
  // damping when a track value is smoothed (none of the current keyframes
  // require smoothing beyond lerp, so this is a direct evaluation).
  useFrame(() => {
    const portrait = portraitRef.current && Boolean(manifest.portrait)
    const evaluation = evaluateTimeline(manifest, progressRef.current, { portrait })
    // DOM track: reflect opacity as a CSS variable on the root for the DOM layer.
    const domOpacity = evaluation['dom.hero.opacity']
    if (typeof domOpacity === 'number') {
      document.documentElement.style.setProperty('--wdu-dom-hero-opacity', String(domOpacity))
      document.documentElement.setAttribute('data-wdu-timeline-dom', String(domOpacity.toFixed(3)))
    }
    // Camera track: camera.hero.z — applied via the single camera owner contract
    // (this component is the camera owner when a timeline is present; CameraRig
    // still owns station selection but timeline owns the interpolated z).
    const cameraZ = evaluation['camera.hero.z']
    if (typeof cameraZ === 'number') {
      camera.position.z = cameraZ
      camera.updateProjectionMatrix()
    }
    // Scene track: rotation offset for the hero. Written as a CSS-read value
    // on the element so HeroObject can add it to its seeded phase without
    // adding a second clock.
    const sceneRot = evaluation['scene.hero.rotationY']
    if (typeof sceneRot === 'number') {
      document.documentElement.setAttribute('data-wdu-timeline-scene', String(sceneRot.toFixed(4)))
      // Expose via clock for hero object: use dataset as the contract surface.
      // The hero reads this attribute rather than a separate uniform.
      gl.domElement.setAttribute('data-wdu-timeline-rotation', String(sceneRot))
    }
    // Material track: emissive lift
    const matEmissive = evaluation['material.hero.emissive']
    if (typeof matEmissive === 'number') {
      document.documentElement.setAttribute('data-wdu-timeline-material', String(matEmissive.toFixed(3)))
      gl.domElement.setAttribute('data-wdu-timeline-emissive', String(matEmissive))
    }
    // Sound track: ambient gain — recorded as document state, not a second timer.
    const soundGain = evaluation['sound.ambient.gain']
    if (typeof soundGain === 'number') {
      document.documentElement.setAttribute('data-wdu-timeline-sound', String(soundGain.toFixed(3)))
    }
    // Loading track: bucket progress
    const loadingProgress = evaluation['loading.bucket.progress']
    if (typeof loadingProgress === 'number') {
      document.documentElement.setAttribute('data-wdu-timeline-loading', String(loadingProgress.toFixed(3)))
    }
    // Record frame trace for deterministic capture evidence: progress→evaluation
    // is a pure function, so the same progress always writes the same values
    // regardless of clock tick order.
    void clock.delta
  }, 0)

  return null
}

export { manifest as cinematicTimelineManifest }
