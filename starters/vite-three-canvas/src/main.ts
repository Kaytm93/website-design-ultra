/** The semantic page exists first; this module owns its optional scene. */
import { createLifecycle, type MediaQueryLike } from './lifecycle.ts'
import { readStoredMotionPreference, writeStoredMotionPreference } from './motion-preference.ts'
import type { MotionPreference } from './motion-preference.ts'
import { createQualityController } from './quality-controller.ts'
import { QUALITY_CONFIG } from './quality-config.ts'
import { CAMERA_STATIONS, STATION_LABELS, stationForViewport, type StationId } from './camera-stations.ts'
import { createScene } from './scene.ts'
import { createFrameLoop } from './frame-loop.ts'

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`missing required element: ${selector}`)
  return element
}

function safeStorage(): Storage | null {
  try { return window.localStorage } catch { return null }
}

function boot(): void {
  const root = requireElement<HTMLElement>('[data-scene-root]')
  const canvas = requireElement<HTMLCanvasElement>('[data-scene-canvas]')
  const posterLayer = requireElement<HTMLElement>('[data-scene-poster]')
  const motionButton = requireElement<HTMLButtonElement>('[data-motion-toggle]')
  const stationList = requireElement<HTMLElement>('[data-station-controls]')
  const params = new URLSearchParams(window.location.search)
  const deterministic = params.get('wdu') === 'deterministic'
  const requestedStation = params.get('station')
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)') as MediaQueryLike
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const storage = deterministic ? null : safeStorage()
  let explicitMotion = readStoredMotionPreference(storage)
  let motion: MotionPreference = deterministic
    ? (params.get('reduced-motion') === '1' ? 'reduced' : 'full')
    : explicitMotion ?? (reducedMotionQuery.matches ? 'reduced' : 'full')
  const size = () => ({ width: root.clientWidth || window.innerWidth, height: root.clientHeight || window.innerHeight })
  const initial = size()
  let station = stationForViewport(initial.width, initial.height)
  let automaticStation = !requestedStation
  if (requestedStation) {
    if (!Object.hasOwn(CAMERA_STATIONS, requestedStation)) {
      root.dataset.sceneState = 'poster'
      root.dataset.sceneError = 'unknown-station'
      motionButton.disabled = true
      return
    }
    station = requestedStation as StationId
  }
  document.documentElement.dataset.wduMode = deterministic ? 'deterministic' : 'live'

  let scene: ReturnType<typeof createScene>
  try {
    scene = createScene({ canvas, markerTarget: document.documentElement, station, motion,
      deterministic, coarsePointer, width: initial.width, height: initial.height })
  } catch {
    root.dataset.sceneState = 'poster'
    posterLayer.hidden = false
    motionButton.disabled = true
    return
  }

  const events = new AbortController()
  const quality = createQualityController({ ...QUALITY_CONFIG,
    now: () => scene.clock.elapsed * 1000, ...(deterministic ? { storage: null } : {}) })
  if (coarsePointer) quality.setMaxTier('medium')
  let suspended = false
  let disposed = false
  let sync = () => {}
  const loop = createFrameLoop({
    request: (callback) => requestAnimationFrame(callback),
    cancel: (id) => cancelAnimationFrame(id),
    render() {
      scene.renderFrame()
      quality.recordFrameTime(scene.clock.delta * 1000)
      sync()
    },
    continuous: () => !scene.marker.ready || (!deterministic && motion === 'full'),
    onPause: () => scene.clock.pause(),
    onResume: () => { scene.clock.resume(); quality.resetMeasurement() },
  })
  let beforeLoss = quality.snapshot()
  const lifecycle = createLifecycle({
    host: {
      onRunStateChange(state) {
        quality.setVisibility(state === 'running')
        sync()
      },
      onReducedMotionChange(reduced) {
        if (deterministic || explicitMotion !== null) return
        motion = reduced ? 'reduced' : 'full'
        scene.setMotion(motion)
        publish()
        loop.invalidate()
      },
      onContextChange(lost) {
        scene.marker.invalidate()
        if (lost) {
          beforeLoss = quality.snapshot()
          quality.forcePoster('webglcontextlost')
        } else {
          quality.setUserTier(beforeLoss.tier)
          if (beforeLoss.source !== 'user') quality.clearUserTier()
        }
        sync()
      },
    },
    reducedMotionQuery,
    visibility: {
      get hidden() { return document.hidden },
      addEventListener: (type, listener) => document.addEventListener(type, listener),
      removeEventListener: (type, listener) => document.removeEventListener(type, listener),
    },
  })
  sync = () => {
    if (disposed) return
    const poster = lifecycle.contextLost || quality.qualityState().tier === 'poster'
    root.dataset.sceneState = poster ? 'poster' : 'live'
    posterLayer.hidden = !poster && scene.marker.ready
    const paused = suspended || lifecycle.runState !== 'running' || poster
    root.dataset.runState = paused ? 'paused' : 'running'
    loop.setPaused(paused)
  }
  let appliedDpr = 0
  const applyQuality = () => {
    const dpr = quality.qualityState().dpr.value
    if (dpr !== appliedDpr) { appliedDpr = dpr; scene.setDpr(dpr); loop.invalidate() }
    sync()
  }
  const unsubscribeQuality = quality.onChange(applyQuality)
  quality.setVisibility(lifecycle.runState === 'running')
  applyQuality()

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    lifecycle.setContextLost(true)
  }, { signal: events.signal })
  canvas.addEventListener('webglcontextrestored', () => lifecycle.setContextLost(false), { signal: events.signal })
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(
    ([entry]) => lifecycle.setOffscreen(!entry?.isIntersecting), { threshold: 0 })
  observer?.observe(root)

  function publish(): void {
    document.documentElement.dataset.wduStation = station
    document.documentElement.dataset.wduMotion = motion
    motionButton.setAttribute('aria-pressed', String(motion === 'reduced'))
    motionButton.textContent = motion === 'reduced' ? 'Motion: reduced' : 'Motion: full'
    for (const button of stationList.querySelectorAll<HTMLButtonElement>('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.station === station))
    }
  }
  const onResize = () => {
    const next = size()
    scene.resize(next.width, next.height)
    if (automaticStation) { station = stationForViewport(next.width, next.height); scene.applyStation(station) }
    quality.resetMeasurement()
    publish()
    loop.invalidate()
  }
  window.addEventListener('resize', onResize, { passive: true, signal: events.signal })
  motionButton.disabled = deterministic
  motionButton.addEventListener('click', () => {
    explicitMotion = motion = motion === 'reduced' ? 'full' : 'reduced'
    writeStoredMotionPreference(storage, motion)
    scene.setMotion(motion)
    publish()
    loop.invalidate()
  }, { signal: events.signal })
  for (const [id, label] of Object.entries(STATION_LABELS)) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.dataset.station = id
    button.disabled = deterministic
    button.addEventListener('click', () => {
      automaticStation = false
      station = id as StationId
      scene.applyStation(station)
      publish()
      loop.invalidate()
    }, { signal: events.signal })
    stationList.append(button)
  }
  publish()
  sync()

  window.addEventListener('pagehide', (event) => {
    if (event.persisted) { suspended = true; sync(); return }
    disposed = true
    loop.dispose()
    events.abort()
    observer?.disconnect()
    unsubscribeQuality()
    quality.dispose()
    lifecycle.dispose()
    scene.dispose()
  }, { signal: events.signal })
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return
    suspended = false
    lifecycle.syncVisibility()
    scene.marker.invalidate()
    sync()
    loop.invalidate()
  }, { signal: events.signal })
}

boot()
