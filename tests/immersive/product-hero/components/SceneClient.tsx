'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MotionControl } from './MotionControl.tsx'
import { Poster } from './Poster.tsx'
import { SceneErrorBoundary } from './SceneErrorBoundary.tsx'
import {
  readStoredMotionPreference,
  systemPrefersReducedMotion,
  writeStoredMotionPreference,
} from '../lib/motion-preference.ts'
import {
  DEFAULT_STATION_ID,
  type MotionPreference,
  type RuntimeMode,
} from '../lib/runtime-config.ts'
import type { QualityTelemetryState } from '../lib/quality-controller.ts'

const SceneCanvas = dynamic(() => import('./SceneCanvas.tsx').then((m) => m.SceneCanvas), {
  ssr: false,
  loading: () => (
    <div className="scene-loading" role="status">
      Loading the 3D scene…
    </div>
  ),
})

interface SceneClientProps {
  mode: RuntimeMode
  stationId: string
  /** Resolved at the application boundary from WDU_REDUCED_MOTION. */
  motion: MotionPreference
}

function safeStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null // privacy mode or disabled storage
  }
}

/** True when a WebGL2/WebGL context can be created on this browser. */
function webglSupported(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      canvas.getContext('webgl2') ?? canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl'),
    )
  } catch {
    return false
  }
}

/** The viewport orientation, live from the media query. */
function usePortrait(): boolean {
  const [portrait, setPortrait] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)')
    const update = () => setPortrait(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return portrait
}

/**
 * The smallest client boundary and the fallback/lifecycle composition owner:
 *
 * - camera-station choice in live mode (portrait viewports start on the named
 *   hero-portrait station); deterministic mode keeps the WDU_STATION value,
 * - the visible motion control (DOM), resolved from the stored user choice,
 *   then the system preference; deterministic mode keeps the boundary value,
 * - the art-directed poster: revealed behind loading, at the poster quality
 *   tier, when WebGL is unavailable, and on context loss — never a blank
 *   frame,
 * - context-loss recovery: the restore action remounts the canvas with a
 *   fresh context,
 * - the remount surface (wdu:remount-scene) that route-transition and
 *   lifecycle verification drives.
 *
 * The canvas mounts only in the browser; all controls and copy are semantic
 * DOM outside it. A browser without WebGL gets the poster plus the DOM copy —
 * the fallback never depends on GLB decode.
 */
export function SceneClient({ mode, stationId: initialStationId, motion: initialMotion }: SceneClientProps) {
  const portrait = usePortrait()
  const [stationId, setStationId] = useState(initialStationId)
  const [motion, setMotion] = useState<MotionPreference>(initialMotion)
  const [quality, setQuality] = useState<QualityTelemetryState | null>(null)
  const [contextLost, setContextLost] = useState(false)
  const [mountKey, setMountKey] = useState(0)
  const [everReady, setEverReady] = useState(false)
  // Resolved after mount: the server render cannot know the browser's WebGL
  // capability, and the initial HTML must not diverge from the first client
  // render (hydration). The poster covers the frame until the canvas mounts.
  const [webglAvailable, setWebglAvailable] = useState(false)
  const userPickedStationRef = useRef(false)

  useEffect(() => {
    setWebglAvailable(webglSupported())
  }, [])

  // Live mode: portrait viewports start on the named portrait station unless
  // the user has explicitly picked one. Deterministic mode never
  // auto-switches: WDU_STATION is the capture contract.
  useEffect(() => {
    if (mode !== 'live') return
    if (userPickedStationRef.current) return
    setStationId(portrait ? 'hero-portrait' : DEFAULT_STATION_ID)
  }, [portrait, mode])

  // Live mode: resolve the motion preference from the stored user choice,
  // then the system preference. System changes count only while no explicit
  // choice is stored. Deterministic mode keeps the WDU_REDUCED_MOTION value
  // and never reads storage.
  useEffect(() => {
    if (mode === 'deterministic') return
    const storage = safeStorage()
    setMotion(
      readStoredMotionPreference(storage) ??
        (systemPrefersReducedMotion() ? 'reduced' : 'full'),
    )
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onSystemChange = (event: MediaQueryListEvent) => {
      if (readStoredMotionPreference(safeStorage()) === null) {
        setMotion(event.matches ? 'reduced' : 'full')
      }
    }
    query.addEventListener('change', onSystemChange)
    return () => query.removeEventListener('change', onSystemChange)
  }, [mode])

  const changeMotion = useCallback((next: MotionPreference) => {
    setMotion(next)
    writeStoredMotionPreference(safeStorage(), next)
  }, [])

  const onQualityChange = useCallback((state: QualityTelemetryState) => setQuality(state), [])
  const onContextLost = useCallback(() => setContextLost(true), [])

  // The DOM action of the context-loss contract: mount a fresh canvas. The
  // new context is a new bootstrap — deterministic in both modes.
  const restoreScene = useCallback(() => {
    setContextLost(false)
    setMountKey((key) => key + 1)
  }, [])

  // The route-transition / lifecycle verification surface: dispatching
  // wdu:remount-scene unmounts and remounts the canvas exactly like a route
  // transition would.
  useEffect(() => {
    const onRemount = () => setMountKey((key) => key + 1)
    window.addEventListener('wdu:remount-scene', onRemount)
    return () => window.removeEventListener('wdu:remount-scene', onRemount)
  }, [])

  // A fresh canvas mount starts hidden behind the poster until its stable
  // frame renders (html[data-wdu-ready="true"]).
  useEffect(() => {
    setEverReady(false)
  }, [mountKey])

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      if (root.getAttribute('data-wdu-ready') === 'true') setEverReady(true)
    })
    observer.observe(root, { attributes: true, attributeFilter: ['data-wdu-ready'] })
    return () => observer.disconnect()
  }, [mountKey])

  // Capture metadata mirrors the live state; in deterministic mode these are
  // the values the layout already rendered from the environment.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-wdu-station', stationId)
    root.setAttribute('data-wdu-motion', motion)
    root.setAttribute('data-wdu-webgl', webglAvailable ? 'available' : 'unavailable')
    if (contextLost) root.setAttribute('data-wdu-context', 'lost')
    else root.removeAttribute('data-wdu-context')
  }, [stationId, motion, contextLost, webglAvailable])

  // The composed fallback: the poster covers the frame while the canvas has
  // not rendered its stable frame, while quality is at the poster tier, while
  // WebGL is unavailable, and while the context is lost. Everything else —
  // copy, controls — stays in the DOM around the frame.
  const posterVisible =
    !webglAvailable || !everReady || contextLost || quality?.tier === 'poster'

  return (
    <div className="scene-client">
      <div className="scene-controls">
        <MotionControl mode={mode} motion={motion} onChange={changeMotion} />
        <p className="station-note">
          Station: <code data-wdu-station-label>{stationId}</code>
        </p>
      </div>
      <div className="scene-frame">
        <Poster variant={portrait ? 'portrait' : 'desktop'} visible={posterVisible} />
        {webglAvailable ? (
          <SceneErrorBoundary onError={() => {}}>
            <SceneCanvas
              key={mountKey}
              mode={mode}
              stationId={stationId}
              motion={motion}
              onQualityChange={onQualityChange}
              onContextLost={onContextLost}
            />
          </SceneErrorBoundary>
        ) : (
          <p className="webgl-note" role="status">
            WebGL is unavailable in this browser. The poster shows the product;
            copy and controls stay in the page.
          </p>
        )}
        {contextLost ? (
          <div className="context-panel" role="alert">
            <h3>Scene context lost</h3>
            <p>
              The WebGL context behind this scene was lost. The poster stays as
              the composed fallback; restore the scene to mount a fresh context.
            </p>
            <button type="button" className="restore-button" onClick={restoreScene}>
              Restore scene
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
