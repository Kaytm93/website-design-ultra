# Hotspots, Camera, and Spatial Text

## Hotspots with DOM

Use drei `<Html>` for readable labels:

```tsx
<Html position={[0.4, 0.25, 0]} center distanceFactor={8} occlude>
  <button type="button" onClick={() => setActive('motor')}>
    Motor
  </button>
</Html>
```

If the same control also exists outside the Canvas, prevent duplicate focus stops by choosing one accessible DOM location. For many labels, render `<Html>` only for active/nearby items.

## Camera focus

Use named views and delta-based damping:

```tsx
import { easing } from 'maath'
import { useReducedMotion } from 'motion/react'

function CameraRig({ view }) {
  const reduce = useReducedMotion()
  const target = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    const next = VIEWS[view]
    if (reduce) {
      state.camera.position.set(...next.position)
      target.current.set(...next.target)
    } else {
      easing.damp3(state.camera.position, next.position, 0.4, delta)
      easing.damp3(target.current, next.target, 0.4, delta)
    }
    state.camera.lookAt(target.current)
  })

  return null
}
```

Do not run OrbitControls/CameraControls and a custom rig against the same camera. If using CameraControls, call its transition API and disable smooth travel for reduced motion.

## Spatial text

| Content | Use |
|---|---|
| UI label/control | DOM or `<Html>` |
| Decorative wordmark | drei `<Text>` |
| Rare sculptural type | `<Text3D>` |

All meaningful text also exists in semantic DOM. Preload fonts, verify licenses, and avoid using 3D text as the SEO/accessibility source.
