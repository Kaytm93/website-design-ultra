# R3F Performance and Asset Patterns

Read the relevant section only.

## Contents

- Instancing
- Renderer-specific postprocessing
- GLTF and GPU-resource lifecycle
- Context loss

## Instancing

Use instances for repeated geometry/material pairs:

```tsx
import { Instance, Instances } from '@react-three/drei'

function Field({ transforms }: { transforms: [number, number, number][] }) {
  return (
    <Instances limit={transforms.length}>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshStandardMaterial color="#0ea5e9" />
      {transforms.map((position, index) => (
        <Instance key={index} position={position} />
      ))}
    </Instances>
  )
}
```

Generate random transforms once with `useMemo`; do not regenerate them during render.

## Postprocessing by renderer

### WebGLRenderer

`@react-three/postprocessing` is valid for WebGLRenderer:

```tsx
import { Bloom, EffectComposer } from '@react-three/postprocessing'

<EffectComposer>
  <Bloom intensity={0.45} luminanceThreshold={0.9} mipmapBlur />
</EffectComposer>
```

Use bloom only for controlled emissive values.

### WebGPURenderer

Do not reuse the WebGL EffectComposer stack. Use Three’s node/TSL postprocessing APIs and verify each effect against the current Three release. Some WebGPU-only features do not run on the WebGL2 fallback backend.

Route all tier values, hysteresis, DPR, shadow, LOD and particle decisions to `3d-runtime-quality`. Consult the feature matrix in `shaders-tsl` before enabling a WebGPU effect.

## Asset lifecycle

- `useGLTF` caches results. Clone scenes that need independent transforms, materials, skeletons, or mutations.
- Prefer generated `gltfjsx` nodes for targeted material/visibility changes.
- Dispose materials, geometries, textures, render targets, and controls created imperatively.
- Never dispose shared cached GLTF resources while another instance still uses them.
- Pause animation mixers and controls when hidden.

## Context loss

Attach listeners from a component that owns cleanup:

```tsx
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

function ContextLossBridge({ onLost }: { onLost: () => void }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const canvas = gl.domElement
    const handleLost = (event: Event) => {
      event.preventDefault()
      onLost()
    }

    canvas.addEventListener('webglcontextlost', handleLost)
    return () => canvas.removeEventListener('webglcontextlost', handleLost)
  }, [gl, onLost])

  return null
}
```
