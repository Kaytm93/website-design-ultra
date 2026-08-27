'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivationControl } from './ActivationControl.tsx'
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

const ClientCanvas = dynamic(
  () => import('./ClientCanvas.tsx').then((m) => ({ default: m.ClientCanvas })),
  { ssr: false, loading: () => <div className="scene-loading" role="status">Loading the 3D scene…</div> },
)

interface SceneClientProps {
  mode: RuntimeMode
  stationId: string
  motion: MotionPreference
}

function safeStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

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
 * The fallback/lifecycle composition owner. The canvas mounts only when WebGL
 * is available; otherwise the poster plus DOM copy stays in place. Context
 * loss and poster quality tier also reveal the poster.
 */
export function SceneClient({ mode, stationId: initialStationId, motion: initialMotion }: SceneClientProps) {
  const portrait = usePortrait()
  const [stationId, setStationId] = useState(initialStationId)
  const [motion, setMotion] = useState(initialMotion)
  const [quality, setQuality] = useState<QualityTelemetryState | null>(null)
  const [contextLost, setContextLost] = useState(false)
  const [mountKey, setMountKey] = useState(0)
  const [everReady, setEverReady] = useState(false)
  const [pointerState, setPointerState] = useState<'idle' | 'hover' | 'pressed'>('idle')
  const [webglAvailable, setWebglAvailable] = useState(false)
  const userPickedStationRef = useRef(false)

  useEffect(() => {
    setWebglAvailable(webglSupported())
  }, [])

  useEffect(() => {
    if (mode !== 'live') return
    if (userPickedStationRef.current) return
    setStationId(portrait ? 'crystal-portrait' : DEFAULT_STATION_ID)
  }, [portrait, mode])

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

  const restoreScene = useCallback(() => {
    setContextLost(false)
    setMountKey((key) => key + 1)
  }, [])

  useEffect(() => {
    const onRemount = () => setMountKey((key) => key + 1)
    window.addEventListener('wdu:remount-scene', onRemount)
    return () => window.removeEventListener('wdu:remount-scene', onRemount)
  }, [])

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

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-wdu-station', stationId)
    root.setAttribute('data-wdu-motion', motion)
    root.setAttribute('data-wdu-webgl', webglAvailable ? 'available' : 'unavailable')
    if (contextLost) root.setAttribute('data-wdu-context', 'lost')
    else root.removeAttribute('data-wdu-context')
  }, [stationId, motion, contextLost, webglAvailable])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-wdu-pointer', pointerState)
  }, [pointerState])

  useEffect(() => {
    const start = () => setPointerState('pressed')
    const end = () => setPointerState('idle')
    window.addEventListener('wdu:press-start', start)
    window.addEventListener('wdu:press-end', end)
    return () => {
      window.removeEventListener('wdu:press-start', start)
      window.removeEventListener('wdu:press-end', end)
    }
  }, [])

  useEffect(() => {
    const update = () => {
      const active = document.activeElement
      const visible =
        active !== null && active !== document.body && active.matches(':focus-visible')
      document.documentElement.setAttribute('data-wdu-focus', visible ? 'visible' : 'none')
    }
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    update()
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [])

  const posterVisible =
    !webglAvailable || !everReady || contextLost || quality?.tier === 'poster'

  return (
    <div className="scene-client">
      <div className="scene-controls">
        <ActivationControl />
        <MotionControl mode={mode} motion={motion} onChange={changeMotion} />
        <p className="station-note">
          Station: <code data-wdu-station-label>{stationId}</code>
        </p>
      </div>
      <div
        className="scene-frame"
        onPointerEnter={() => setPointerState('hover')}
        onPointerLeave={() => setPointerState('idle')}
        onPointerDown={() => setPointerState('pressed')}
        onPointerUp={() => setPointerState('hover')}
        onPointerCancel={() => setPointerState('idle')}
      >
        <Poster variant={portrait ? 'portrait' : 'desktop'} visible={posterVisible} />
        {webglAvailable ? (
          <SceneErrorBoundary>
            <ClientCanvas
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
            WebGL is unavailable in this browser. The poster shows the crystal;
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