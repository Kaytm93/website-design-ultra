'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Activation control routes keyboard and touch into the same pressed state as
 * a pointer press on the scene frame. Its presence in the DOM is what the
 * focus/touch checkpoints wait on.
 */
export function ActivationControl() {
  const ref = useRef<HTMLButtonElement>(null)
  const [pressed, setPressed] = useState(false)
  useEffect(() => {
    const onPress = () => {
      setPressed(true)
      window.dispatchEvent(new Event('wdu:press-start'))
    }
    const onRelease = () => {
      setPressed(false)
      window.dispatchEvent(new Event('wdu:press-end'))
    }
    const node = ref.current
    if (!node) return
    node.addEventListener('pointerdown', onPress)
    node.addEventListener('pointerup', onRelease)
    node.addEventListener('pointerleave', onRelease)
    node.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        onPress()
      }
    })
    node.addEventListener('keyup', (event) => {
      if (event.key === ' ' || event.key === 'Enter') onRelease()
    })
    return () => {
      node.removeEventListener('pointerdown', onPress)
      node.removeEventListener('pointerup', onRelease)
      node.removeEventListener('pointerleave', onRelease)
    }
  }, [])
  return (
    <button
      ref={ref}
      type="button"
      data-wdu-activation-target
      aria-pressed={pressed}
      className="restore-button"
    >
      Activate crystal
    </button>
  )
}