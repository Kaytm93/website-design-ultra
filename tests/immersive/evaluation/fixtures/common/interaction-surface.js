/**
 * Shared interaction surface for the static evaluation fixtures (IP-07B).
 *
 * A static fixture page that includes this script gains the same declared
 * capture state the product-hero fixture implements in React:
 *
 *   html[data-wdu-mode="deterministic"]     deterministic capture state
 *   html[data-wdu-ready="true"]             readiness (declared statically)
 *   html[data-wdu-pointer]                  idle | hover | pressed, driven
 *                                           by pointer events on the scene
 *                                           frame and by wdu:press-start/end
 *                                           from the activation control
 *   html[data-wdu-focus]                    visible | none, focus-visible
 *   html[data-wdu-context="lost"]           WebGL context loss
 *
 * Expected page structure: a .scene-frame element containing a canvas, and
 * a [data-wdu-activation-target] button that dispatches wdu:press-start and
 * wdu:press-end (the starter's ActivationControl pattern). Fixture plumbing
 * for the evaluation suite, never a shipped runtime surface.
 */
(function () {
  'use strict'

  const root = document.documentElement
  root.setAttribute('data-wdu-mode', 'deterministic')
  root.setAttribute('data-wdu-ready', 'true')
  root.setAttribute('data-wdu-pointer', 'idle')

  const frame = document.querySelector('.scene-frame')
  if (frame) {
    frame.addEventListener('pointerenter', () => {
      root.setAttribute('data-wdu-pointer', 'hover')
    })
    frame.addEventListener('pointerleave', () => {
      root.setAttribute('data-wdu-pointer', 'idle')
    })
    frame.addEventListener('pointerdown', () => {
      root.setAttribute('data-wdu-pointer', 'pressed')
    })
    frame.addEventListener('pointerup', () => {
      root.setAttribute('data-wdu-pointer', 'hover')
    })
    frame.addEventListener('pointercancel', () => {
      root.setAttribute('data-wdu-pointer', 'idle')
    })
  }

  window.addEventListener('wdu:press-start', () => {
    root.setAttribute('data-wdu-pointer', 'pressed')
  })
  window.addEventListener('wdu:press-end', () => {
    root.setAttribute('data-wdu-pointer', 'idle')
  })

  const updateFocus = () => {
    const active = document.activeElement
    const visible =
      active !== null && active !== document.body && active.matches(':focus-visible')
    root.setAttribute('data-wdu-focus', visible ? 'visible' : 'none')
  }
  document.addEventListener('focusin', updateFocus)
  document.addEventListener('focusout', updateFocus)
  updateFocus()

  const canvas = frame ? frame.querySelector('canvas') : null
  if (canvas) {
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault()
      root.setAttribute('data-wdu-context', 'lost')
    })
  }
})()
