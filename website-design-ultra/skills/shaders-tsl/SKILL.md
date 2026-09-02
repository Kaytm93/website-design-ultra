---
name: shaders-tsl
description: Build custom Three.js materials and effects with TSL or GLSL. Use for WebGPU/WebGL2 node materials, Fresnel, noise, displacement, dissolve, gradients, iridescence, shader performance, or renderer-specific postprocessing. Prefer TSL when the selected feature works on every required backend.
---

# TSL and Shader Materials

Use shaders to support art direction, not to add arbitrary movement. Verify the current Three API before copying a recipe because TSL and WebGPU evolve quickly.

## Renderer decision

- Use `WebGLRenderer` for the broadest mature Three/R3F ecosystem.
- Use `WebGPURenderer` for TSL, node materials, or WebGPU features. It can fall back to WebGL2 for compatible features.
- Compute, some effects, and some node features may be WebGPU-only. Provide a controlled fallback.
- `@react-three/postprocessing`/classic EffectComposer is not the WebGPU postprocessing stack. Use Three’s node/TSL postprocessing APIs with `WebGPURenderer`.
- Read [references/webgpu-feature-matrix.md](references/webgpu-feature-matrix.md) whenever WebGPU, its WebGL2 fallback, node postprocessing, or compute is selected.

## R3F WebGPU setup

```tsx
'use client'

import { Canvas } from '@react-three/fiber'
import * as THREE from 'three/webgpu'

export function ShaderScene() {
  return (
    <Canvas
      gl={async (props) => {
        const renderer = new THREE.WebGPURenderer({
          ...props,
          antialias: true,
        } as any)
        await renderer.init()
        return renderer
      }}
      camera={{ position: [0, 0, 4] }}
    >
      <mesh>
        <icosahedronGeometry args={[1.4, 16]} />
        <FresnelMaterial />
      </mesh>
    </Canvas>
  )
}
```

## TSL material lifecycle

Create node materials once and dispose them:

```tsx
import { useEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'
import {
  color,
  dot,
  mix,
  normalView,
  oneMinus,
  positionViewDirection,
  pow,
} from 'three/tsl'

function FresnelMaterial() {
  const material = useMemo(() => {
    const value = pow(
      oneMinus(dot(normalView, positionViewDirection).clamp()),
      3,
    )
    const next = new THREE.MeshStandardNodeMaterial({ roughness: 0.3 })
    next.colorNode = mix(color('#0a0a0a'), color('#10b981'), value)
    next.emissiveNode = color('#10b981').mul(value.mul(0.6))
    return next
  }, [])

  useEffect(() => () => material.dispose(), [material])

  return <primitive object={material} attach="material" />
}
```

## Core rules

- Prefer one TSL graph for compatible WebGPU and WebGL2 backends.
- Update TSL `uniform()` values or material refs; never use React state per frame.
- Freeze or replace time-driven effects for reduced motion.
- Test shader compilation on every required backend; a successful WebGPU compile does not prove fallback compatibility.
- Keep per-fragment noise, transparent overdraw, transmission, and large fullscreen effects inside the performance budget.
- Preserve color-space and tone-mapping intent when mixing textures, colors, and postprocessing.

## Conditional references

- Read [references/module-index.md](references/module-index.md) before writing a shader by hand: eighteen modules already exist as running code with a copyable file, and the index names the one to copy.
- Read [references/tsl-cheatsheet.md](references/tsl-cheatsheet.md) only when implementing a TSL graph or checking an API name.
- Read [references/webgpu-feature-matrix.md](references/webgpu-feature-matrix.md) for every WebGPU feature decision and update its feature record after testing.
- Use `r3f-patterns` for Canvas/resource lifecycle and `3d-runtime-quality` for all tiers and adaptation.
- Use `immersive-3d` for fallback and budget requirements.

## Check

- [ ] Renderer and backend requirements are explicit.
- [ ] WebGL2 fallback uses only compatible features.
- [ ] Each selected feature records TSL-postprocessing and compute dependencies.
- [ ] Postprocessing matches the renderer.
- [ ] Material and render-target resources are disposed.
- [ ] Motion can freeze without losing meaning.
- [ ] Shader cost and visual output were tested on mobile and desktop.
