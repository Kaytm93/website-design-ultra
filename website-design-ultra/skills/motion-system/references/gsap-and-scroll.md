# GSAP, ScrollTrigger, and Lenis

Read this file only for timeline-heavy or pinned storytelling.

## React lifecycle

```tsx
'use client'

import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function PinnedSection() {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const media = gsap.matchMedia()
    const context = gsap.context(() => {
      media.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.to('[data-layer]', {
          yPercent: -30,
          ease: 'none',
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: '+=120%',
            scrub: 0.8,
            pin: true,
          },
        })
      })
    }, root)

    return () => {
      media.revert()
      context.revert()
    }
  }, [])

  return <section ref={root}>{/* content */}</section>
}
```

Refresh after layout-affecting fonts/assets settle. Test focus visibility while pinned.

## Lenis

Use the integration in `scroll-immersion`. If GSAP owns the animation ticker, feed Lenis from `gsap.ticker`; do not also start an independent requestAnimationFrame loop.

## Boundaries

- GSAP may drive DOM and expose normalized progress to R3F.
- R3F may consume progress in `useFrame`.
- Only one system writes the camera or scroll position.
- Use native scrolling for reduced motion.
