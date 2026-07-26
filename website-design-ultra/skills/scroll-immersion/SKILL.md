---
name: scroll-immersion
description: Build scroll-driven 3D stories with one coordinated timing source. Use for Lenis, GSAP ScrollTrigger, drei ScrollControls/useScroll, pinned scenes, scrubbed camera paths, parallax, responsive scroll choreography, or reduced-motion scroll fallbacks.
---

# Scroll Immersion

Scroll should reveal spatial meaning, not merely move decoration.

## Choose one scroll master

| Need | Master |
|---|---|
| Native document plus smooth inertia | Lenis |
| DOM and Canvas timeline/pinning | Lenis + GSAP ticker/ScrollTrigger |
| Self-contained Canvas scroll area | drei `ScrollControls` |

Do not run Lenis and `ScrollControls` as competing masters. A separate animation library may consume progress, but one source owns scroll time.

## Lenis with GSAP

```tsx
'use client'

import { ReactLenis, type LenisRef } from 'lenis/react'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function SmoothScrollRoot() {
  const lenisRef = useRef<LenisRef>(null)

  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    if (reduce.matches) return

    const update = (time: number) => {
      lenisRef.current?.lenis?.raf(time * 1000)
    }
    const sync = () => ScrollTrigger.update()

    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    lenisRef.current?.lenis?.on('scroll', sync)

    return () => {
      gsap.ticker.remove(update)
      lenisRef.current?.lenis?.off('scroll', sync)
    }
  }, [])

  return <ReactLenis root options={{ autoRaf: false }} ref={lenisRef} />
}
```

Import `lenis/dist/lenis.css`. Use `ScrollTrigger.scrollerProxy()` only for a custom/proxied scroll container that needs explicit getters/setters; it is not automatically required for root Lenis.

For a production preference toggle, respond to media-query changes and mount/unmount smooth scrolling rather than reading the preference only once.

## R3F ScrollControls

Use delta-based damping:

```tsx
import { Scroll, ScrollControls, useScroll } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function Rig() {
  const scroll = useScroll()

  useFrame((state, delta) => {
    const progress = scroll.offset
    state.camera.position.z = THREE.MathUtils.damp(
      state.camera.position.z,
      6 - progress * 4,
      6,
      delta,
    )
    state.camera.position.y = THREE.MathUtils.damp(
      state.camera.position.y,
      progress * 2,
      6,
      delta,
    )
    state.camera.lookAt(0, 0, 0)
  })

  return null
}

<ScrollControls pages={3} damping={0.25}>
  <Model />
  <Rig />
  <Scroll html>{/* semantic sections */}</Scroll>
</ScrollControls>
```

Do not combine this rig with controls that also write the camera.

## GSAP section lifecycle

Use `gsap.context()` and responsive `gsap.matchMedia()`. Revert both on cleanup. Refresh ScrollTrigger after fonts, images, and layout-affecting assets settle.

## Reduced motion and accessibility

- With reduced motion: disable smooth scrolling, parallax, continuous scrubbing, and animated camera travel.
- Preserve native scrolling and jump between meaningful scene states.
- Keep headings, copy, links, and controls in semantic DOM order.
- Provide a visible pause/disable-motion control for persistent nonessential motion.
- Avoid long pinning on small screens; never trap keyboard or touch scrolling.
- Define a separate portrait shot and shorter choreography with `3d-art-direction`; do not scale the desktop camera path into mobile.

## Check

- [ ] One scroll master owns timing.
- [ ] Camera/object damping uses `delta`.
- [ ] GSAP/Lenis subscriptions and tickers clean up.
- [ ] Breakpoints use distinct choreography where needed.
- [ ] Portrait composition is a deliberate reframe, not a smaller desktop path.
- [ ] Native-scroll reduced-motion path preserves the story.
- [ ] Pinning does not obscure focus or trap input.
