/**
 * Entry point: bind the DOM, the lifecycle and the scene, then get out of the way.
 *
 * The page already renders without this file. The heading, the copy, the poster
 * image and the controls are in `index.html` and are visible before any script
 * runs — that is the DOM parallel layer the fallback contract requires, not a
 * `<noscript>` afterthought. This module upgrades that page with a canvas; it
 * never becomes the page.
 */

import { createLifecycle, type MediaQueryLike } from './lifecycle.ts'
import { resolveMotionPreference, readStoredMotionPreference, writeStoredMotionPreference } from './motion-preference.ts'
import type { MotionPreference } from './motion-preference.ts'
import { createQualityController } from './quality-controller.ts'
import { QUALITY_CONFIG } from './quality-config.ts'
import { CAMERA_STATIONS, STATION_LABELS, stationForViewport, type StationId } from './camera-stations.ts'
import { createScene } from './scene.ts'

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`missing required element: ${selector}`)
  return element
}

function boot(): void {
  const root = requireElement<HTMLElement>('[data-scene-root]')
  const canvas = requireElement<HTMLCanvasElement>('[data-scene-canvas]')
  const posterLayer = requireElement<HTMLElement>('[data-scene-poster]')
  const motionButton = requireElement<HTMLButtonElement>('[data-motion-toggle]')
  const stationList = requireElement<HTMLElement>('[data-station-controls]')

  const params = new URLSearchParams(window.location.search)
  const deterministic = params.get('wdu') === 'deterministic'
  const requestedStation = params.get('station') as StationId | null

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)') as MediaQueryLike
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches

  const stored = readStoredMotionPreference(window.localStorage)
  let motion: MotionPreference =
    stored ?? (reducedMotionQuery.matches ? 'reduced' : resolveMotionPreference(undefined))

  const size = () => ({
    width: root.clientWidth || window.innerWidth,
    height: root.clientHeight || window.innerHeight,
  })

  const initial = size()
  const station =
    requestedStation && requestedStation in CAMERA_STATIONS
      ? requestedStation
      : stationForViewport(initial.width, initial.height)

  let scene: ReturnType<typeof createScene>
  try {
    scene = createScene({
      canvas,
      markerTarget: document.documentElement,
      station,
      motion,
      deterministic,
      coarsePointer,
      width: initial.width,
      height: initial.height,
    })
  } catch {
    // No WebGL, no context, no renderer. The poster layer is already on the
    // page; all that is left is to stop hiding it and leave the DOM alone.
    root.dataset.sceneState = 'poster'
    posterLayer.hidden = false
    return
  }

  // The controller owns the tier and the DPR; the scene only applies what it is
  // told. `attachVisibility` wires its own IntersectionObserver and
  // visibilitychange listener onto the canvas, so measurement stops for the
  // same reasons the loop does.
  const quality = createQualityController({ ...QUALITY_CONFIG, now: () => performance.now() })
  const unsubscribeQuality = quality.onChange((state) => scene.setDpr(state.dpr.value))
  quality.attachVisibility(canvas)
  scene.setDpr(quality.qualityState().dpr.value)

  const lifecycle = createLifecycle({
    host: {
      onRunStateChange(state) {
        root.dataset.runState = state
        if (state === 'running') requestAnimationFrame(pump)
      },
      onReducedMotionChange(reduced) {
        if (readStoredMotionPreference(window.localStorage)) return
        motion = reduced ? 'reduced' : 'full'
        scene.setMotion(motion)
        syncMotionButton()
      },
      onContextChange(lost) {
        root.dataset.sceneState = lost ? 'poster' : 'live'
        posterLayer.hidden = !lost
        // Context loss is failure, not measured pressure: it goes straight to
        // poster rather than stepping down a tier at a time.
        if (lost) quality.forcePoster('webglcontextlost')
      },
    },
    reducedMotionQuery,
    visibility: {
      get hidden() {
        return document.hidden
      },
      addEventListener: (type, listener) => document.addEventListener(type, listener),
      removeEventListener: (type, listener) => document.removeEventListener(type, listener),
    },
  })

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    lifecycle.setContextLost(true)
  })
  canvas.addEventListener('webglcontextrestored', () => lifecycle.setContextLost(false))

  const observer = new IntersectionObserver(
    ([entry]) => lifecycle.setOffscreen(!entry?.isIntersecting),
    { threshold: 0 },
  )
  observer.observe(root)

  const onResize = () => {
    const next = size()
    scene.resize(next.width, next.height)
    // A resize changes the cost of every subsequent frame, so the samples
    // taken before it no longer describe the scene being measured.
    quality.resetMeasurement()
  }
  window.addEventListener('resize', onResize, { passive: true })

  let lastFrameStart = performance.now()
  const pump = () => {
    if (lifecycle.runState !== 'running') return
    const start = performance.now()
    quality.recordFrameTime(start - lastFrameStart)
    lastFrameStart = start
    scene.renderFrame()
    requestAnimationFrame(pump)
  }

  function syncMotionButton(): void {
    motionButton.setAttribute('aria-pressed', String(motion === 'reduced'))
    motionButton.textContent = motion === 'reduced' ? 'Motion: reduced' : 'Motion: full'
  }

  motionButton.addEventListener('click', () => {
    motion = motion === 'reduced' ? 'full' : 'reduced'
    writeStoredMotionPreference(window.localStorage, motion)
    scene.setMotion(motion)
    document.documentElement.setAttribute('data-wdu-motion', motion)
    syncMotionButton()
  })

  for (const [id, label] of Object.entries(STATION_LABELS)) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.dataset.station = id
    button.addEventListener('click', () => {
      scene.applyStation(id as StationId)
      publish(id as StationId)
      for (const sibling of stationList.querySelectorAll('button')) {
        sibling.setAttribute('aria-pressed', String(sibling === button))
      }
    })
    button.setAttribute('aria-pressed', String(id === station))
    stationList.append(button)
  }

  // Capture metadata, published where a verifier reads it: which station was
  // applied and which motion preference the frame was drawn under. A capture
  // that cannot state these is a screenshot, not evidence.
  const publish = (id: StationId) => {
    document.documentElement.setAttribute('data-wdu-station', id)
    document.documentElement.setAttribute('data-wdu-motion', motion)
  }
  publish(station)

  syncMotionButton()
  root.dataset.sceneState = 'live'
  posterLayer.hidden = true
  requestAnimationFrame(pump)

  window.addEventListener('pagehide', () => {
    observer.disconnect()
    window.removeEventListener('resize', onResize)
    unsubscribeQuality()
    lifecycle.dispose()
    scene.dispose()
  })
}

boot()
