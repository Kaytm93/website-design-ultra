'use client'

import { useCallback } from 'react'

/**
 * The keyboard and touch activation surface (IP-06B). Pointer input reaches
 * the hero through the canvas; keyboard and touch reach the SAME product
 * outcome — the declared pressed pose — through this semantic DOM control.
 * Pressing the button (pointer, touch, Enter, or Space) dispatches
 * wdu:press-start; releasing dispatches wdu:press-end. HeroObject maps both
 * to the same capture state as its canvas pointer handlers, so the keyboard
 * and touch checkpoint peaks wait for the identical declared state
 * (html[data-wdu-pointer="pressed"]) as the pointer click peak.
 *
 * The control stays interactive in deterministic mode: the press state is a
 * transient declared interaction state (like the pointer hover/press), never
 * a persisted capture contract, so input may move it during capture without
 * breaking determinism. Focus-visible is recorded on the document root by
 * SceneClient for the focus checkpoints.
 */
export function ActivationControl() {
  const start = useCallback(() => {
    window.dispatchEvent(new CustomEvent('wdu:press-start'))
  }, [])
  const end = useCallback(() => {
    window.dispatchEvent(new CustomEvent('wdu:press-end'))
  }, [])

  return (
    <div className="activation-control">
      <button
        type="button"
        data-wdu-activation-target
        onPointerDown={start}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            if (event.repeat) return
            event.preventDefault()
            start()
          }
        }}
        onKeyUp={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            end()
          }
        }}
      >
        Press the hero
      </button>
      <p className="activation-note">
        Keyboard and touch reach the same pressed pose as pointing at the hero.
      </p>
    </div>
  )
}
