# Configurators and GLTF Animation

## Variant state

Keep the selected variant above Canvas so DOM controls and meshes share state. Prefer existing GLTF materials or a small stable material set.

```tsx
function Body({ finish }) {
  const { nodes } = useGLTF('/models/chair.glb')
  const material = useMemo(
    () => new THREE.MeshStandardMaterial(FINISHES[finish]),
    [finish],
  )

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh
      geometry={(nodes.Body as THREE.Mesh).geometry}
      material={material}
    />
  )
}
```

- For frequent switches, keep a stable material and update properties deliberately, or preload a bounded set.
- Use `visible` for frequently toggled already-loaded variants when shader recompilation is costly.
- Do not dispose shared GLTF resources.
- Encode shareable configuration in URL/state when the product flow needs it.

## Animation clips

```tsx
function AnimatedModel({ clip }) {
  const group = useRef<THREE.Group>(null!)
  const { scene, animations } = useGLTF('/models/product.glb')
  const { actions } = useAnimations(animations, group)

  useEffect(() => {
    const action = actions[clip]
    action?.reset().fadeIn(0.25).play()
    return () => {
      action?.fadeOut(0.2)
    }
  }, [actions, clip])

  return <group ref={group}><primitive object={scene} /></group>
}
```

Pause nonessential clips for reduced motion and when offscreen/hidden. If the cached scene is reused, clone appropriately.

## Morph targets

Use frame-rate-independent damping:

```tsx
useFrame((_, delta) => {
  const index = mesh.current.morphTargetDictionary?.smile
  if (index === undefined) return
  mesh.current.morphTargetInfluences![index] = THREE.MathUtils.damp(
    mesh.current.morphTargetInfluences![index],
    target,
    6,
    delta,
  )
})
```

Avoid per-frame React state and keep a nonanimated representation of the selected state.
