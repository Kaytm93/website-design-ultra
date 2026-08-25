'use client'

import { useEffect, useRef } from 'react'

/**
 * The deterministic pointer-target anchor (IP-06A). HeroObject writes the
 * projected normalized device coordinates of a point on the hero's tube to
 * the canvas element; this DOM component converts them to a 2x2 px capture
 * anchor the verifier can address with a plain CSS selector
 * (`[data-wdu-pointer-target]`). The verifier moves the pointer to the
 * anchor's center; the ray through that pixel hits the tube.
 *
 * The anchor is decorative capture surface: pointer-events are disabled so it
 * never intercepts input, and it is hidden from the accessibility tree. The
 * position is a pure function of the frozen camera and pose, so it is
 * byte-identical across deterministic runs.
 */
export function PointerTargetAnchor() {
  const anchorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = 0
    let lastLeft = -1
    let lastTop = -1

    const update = () => {
      frame = requestAnimationFrame(update)
      const anchor = anchorRef.current
      // R3F puts the className on a wrapper div; the canvas itself is
      // unclassed, so address it inside the scene frame.
      const canvas = document.querySelector<HTMLCanvasElement>('.scene-frame canvas')
      if (!anchor || !canvas) return
      const ndcX = canvas.getAttribute('data-wdu-pointer-x')
      const ndcY = canvas.getAttribute('data-wdu-pointer-y')
      if (ndcX === null || ndcY === null) return
      const valueX = Number(ndcX)
      const valueY = Number(ndcY)
      if (!Number.isFinite(valueX) || !Number.isFinite(valueY)) return
      const frameElement = canvas.parentElement
      if (!frameElement) return
      const width = frameElement.clientWidth
      const height = frameElement.clientHeight
      if (width === 0 || height === 0) return
      const left = Math.round((valueX * 0.5 + 0.5) * width)
      const top = Math.round((-valueY * 0.5 + 0.5) * height)
      if (left === lastLeft && top === lastTop) return
      lastLeft = left
      lastTop = top
      anchor.style.left = `${left}px`
      anchor.style.top = `${top}px`
    }

    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      ref={anchorRef}
      className="pointer-target-anchor"
      data-wdu-pointer-target
      aria-hidden="true"
    />
  )
}
