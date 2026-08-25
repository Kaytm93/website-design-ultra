'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MotionControl } from './MotionControl.tsx'
import { PointerTargetAnchor } from './PointerTargetAnchor.tsx'
import { Poster } from './Poster.tsx'
import { StationControl } from './StationControl.tsx'
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
 * The smallest client boundary and the fallback/lifecycle composition owner
 * (IP-05C):
 *
 * - camera-station choice in live mode (portrait viewports start on the named
 *   hero-portrait station), with the station control in the DOM,
 * - the visible motion control (DOM), resolved from the stored user choice,
 *   then the system preference; deterministic mode keeps the boundary value,
 * - the art-directed poster: revealed behind loading, at the poster quality
 *   tier, and on context loss — never a blank frame,
 * - context-loss recovery: the restore action remounts the canvas with a
 *   fresh context,
 * - the remount surface (wdu:remount-scene) that route-transition and
 *   lifecycle verification drives.
 *
 * The canvas mounts only in the browser; all controls and copy are semantic
 * DOM outside it.
 */
export function SceneClient({ mode, stationId: initialStationId, motion: initialMotion }: SceneClientProps) {
  const portrait = usePortrait()
  const [stationId, setStationId] = useState(initialStationId)
  const [motion, setMotion] = useState<MotionPreference>(initialMotion)
  const [quality, setQuality] = useState<QualityTelemetryState | null>(null)
  const [contextLost, setContextLost] = useState(false)
  const [mountKey, setMountKey] = useState(0)
  const [everReady, setEverReady] = useState(false)
  const userPickedStationRef = useRef(false)
  // Declared loading capture state (IP-06A): the ?wdu-loading=1 capture
  // entry holds asset readiness so the composed loading surface (the poster)
  // stays visible deterministically. The canvas is client-only, so this
  // never reaches server-rendered HTML and cannot cause a hydration mismatch.
  const [loadingHold] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('wdu-loading'),
  )

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
  // transition would. scripts/verify-ip05c.mjs uses it to assert that
  // repeated mount/unmount cycles do not grow renderer resources.
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
    if (contextLost) root.setAttribute('data-wdu-context', 'lost')
    else root.removeAttribute('data-wdu-context')
  }, [stationId, motion, contextLost])

  // The composed fallback: the poster covers the frame while the canvas has
  // not rendered its stable frame, while quality is at the poster tier, and
  // while the WebGL context is lost. Everything else — copy, controls — stays
  // in the DOM around the frame.
  const posterVisible = !everReady || contextLost || quality?.tier === 'poster'

  return (
    <div className="scene-client">
      <div className="scene-controls">
        <StationControl
          mode={mode}
          stationId={stationId}
          onSelect={(id) => {
            userPickedStationRef.current = true
            setStationId(id)
          }}
        />
        <MotionControl mode={mode} motion={motion} onChange={changeMotion} />
      </div>
      <div className="scene-frame">
        <Poster variant={portrait ? 'portrait' : 'desktop'} visible={posterVisible} />
        <SceneCanvas
          key={mountKey}
          mode={mode}
          stationId={stationId}
          motion={motion}
          loadingHold={loadingHold}
          onQualityChange={onQualityChange}
          onContextLost={onContextLost}
        />
        <PointerTargetAnchor />
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
