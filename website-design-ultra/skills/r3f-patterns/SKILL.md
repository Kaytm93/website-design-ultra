---
name: r3f-patterns
description: Production patterns for React Three Fiber scenes. Use for R3F Canvas setup, render loops, GLTF loading, instancing, postprocessing integration, resource lifecycle, or React/Next.js 3D integration. Route runtime tiers and adaptation to 3d-runtime-quality and read only the linked framework or asset reference needed.
---

# React Three Fiber — Production Core

Verify package compatibility before coding. As a baseline, R3F v8 pairs with React 18 and v9 with React 19; do not infer compatibility from a stale example.

## Install

Install only required packages:

```bash
npm i three @react-three/fiber @react-three/drei
# WebGL postprocessing only when selected:
npm i @react-three/postprocessing
# Development profiling:
npm i -D r3f-perf
```

## Core Canvas

```tsx
'use client'

import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { Suspense } from 'react'

export function Scene() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 6], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <Environment preset="city" />
        <Model />
      </Suspense>
    </Canvas>
  )
}
```

Keep the DOM loading/poster layer outside the Canvas so it remains accessible.
For production, self-host a licensed environment map instead of relying on a preset CDN.

## Render-loop rules

1. Use `useFrame` for frame work.
2. Mutate refs; never call React state setters every frame.
3. Use `delta` with `MathUtils.damp` or `maath/easing`; avoid fixed-factor lerps.
4. Reuse expensive resources and dispose resources created outside R3F’s declarative lifecycle.
5. Pause or switch to `frameloop="demand"` when the scene is offscreen, hidden, or static.

```tsx
function FloatingObject() {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame((state, delta) => {
    ref.current.rotation.y += delta * 0.25
    ref.current.position.y = THREE.MathUtils.damp(
      ref.current.position.y,
      Math.sin(state.clock.elapsedTime) * 0.1,
      6,
      delta,
    )
  })

  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.5, 6]} />
      <meshStandardMaterial color="#10b981" roughness={0.25} />
    </mesh>
  )
}
```

Prefer declarative geometry/material elements because R3F owns their lifecycle. If using `useMemo(() => new THREE.Material())`, dispose it in an effect cleanup.

## GLTF baseline

```tsx
import { Clone, useGLTF } from '@react-three/drei'
import type { ThreeElements } from '@react-three/fiber'

export function Model(props: ThreeElements['group']) {
  const { scene } = useGLTF('/models/product.glb')
  return <Clone object={scene} {...props} />
}

useGLTF.preload('/models/product.glb')
```

- Use `<Clone>` or a generated `gltfjsx` component when the cached scene may appear more than once.
- A `<primitive>` is not automatically deep-cloned and externally created resources need deliberate disposal.
- Configure Draco, Meshopt, or KTX2 support explicitly when the asset uses it.

## Conditional references

- **Next.js, client boundary, lazy loading, multiple views:** read [references/nextjs.md](references/nextjs.md).
- **Instancing, renderer-specific postprocessing, asset lifecycle:** read [references/performance-and-assets.md](references/performance-and-assets.md).
- **Poster/Low/Medium/High, DPR, shadows, LOD, particles, hysteresis:** use `3d-runtime-quality`.
- **Camera, light, materials, tone mapping, mobile shot:** use `3d-art-direction`.
- **Clickable meshes, hotspots, camera states:** use `r3f-interaction`.
- **WebGPU/TSL:** use `shaders-tsl`; do not assume WebGL EffectComposer compatibility.

## Accessibility and robustness

- Decorative scene with equivalent DOM content: mark the Canvas wrapper `aria-hidden="true"`.
- Informative scene: provide a concise accessible description adjacent to the Canvas.
- Interactive scene: provide equivalent DOM controls and state announcements via `r3f-interaction`.
- On `webglcontextlost`, show the poster/fallback; attach and remove listeners with cleanup.
- Do not put interactive DOM controls inside an ancestor with `role="img"`.

## Check

- [ ] React/R3F/Three versions verified.
- [ ] `useFrame` work is delta-based and state-free.
- [ ] DPR and quality follow one `3d-runtime-quality` controller within the `immersive-3d` budget.
- [ ] Assets preload without blocking initial DOM content.
- [ ] Reused GLTF scenes are cloned; custom GPU resources are disposed.
- [ ] Renderer-specific postprocessing is compatible.
- [ ] Hidden/offscreen work pauses.
- [ ] DOM alternative and interaction parity exist.
