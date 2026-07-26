---
name: r3f-interaction
description: Add accessible interaction to R3F scenes. Use for clickable or hoverable meshes, raycasting, hotspots, annotations, viewers, configurators, camera focus, spatial text, drag, pinch/zoom, pointer capture, touch-action, hover fallbacks, or pointer cancellation. Covers shared DOM state, keyboard/touch parity, ownership, and performance.
---

# R3F Interaction Core

Treat Canvas interaction as an enhancement to a semantic DOM interface. Budget/fallbacks come from `immersive-3d`; frame/lifecycle patterns come from `r3f-patterns`.

## Core event pattern

```tsx
function SelectableMesh({ id, active, onSelect }) {
  return (
    <mesh
      onPointerOver={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(id)
      }}
    >
      <meshStandardMaterial color={active ? '#2dd4bf' : '#64748b'} />
    </mesh>
  )
}
```

- Stop propagation when overlapping geometry would otherwise receive the same event.
- Use `onPointerMissed` to clear selection only when that matches the interface.
- Put `<Bvh>` around complex interactive geometry.
- Set `raycast={null}` on decorative/noninteractive objects.
- Use native cursor styles locally; reset global cursor changes in cleanup.
- Commit actions on click/up so pointer cancellation remains possible.

## DOM parity

Every Canvas-only action/state needs an equivalent DOM control sharing one source of truth:

```tsx
export function Viewer({ parts }) {
  const [active, setActive] = useState<string | null>(null)

  return (
    <section aria-labelledby="viewer-title">
      <h2 id="viewer-title">Product details</h2>

      <div aria-hidden="true">
        <Canvas onPointerMissed={() => setActive(null)}>
          <Bvh>
            {parts.map((part) => (
              <SelectableMesh
                key={part.id}
                id={part.id}
                active={active === part.id}
                onSelect={setActive}
              />
            ))}
          </Bvh>
        </Canvas>
      </div>

      <ul>
        {parts.map((part) => (
          <li key={part.id}>
            <button
              type="button"
              aria-pressed={active === part.id}
              onClick={() => setActive(part.id)}
            >
              {part.label}
            </button>
          </li>
        ))}
      </ul>

      <p className="sr-only" role="status">
        {active ? `Selected: ${active}` : 'No selection'}
      </p>
    </section>
  )
}
```

Do not place controls under `role="img"`. If the Canvas conveys additional information, add a concise adjacent description.

## Read only the required reference

- Hotspots, `<Html>`, camera focus, spatial labels/text → [references/hotspots-camera-text.md](references/hotspots-camera-text.md).
- Product variants, material lifecycle, GLTF clips, morph targets → [references/configurator-animation.md](references/configurator-animation.md).
- Drag thresholds, pinch/zoom, pointer capture, `touch-action`, hover fallback, and cancellation → [references/touch-and-gestures.md](references/touch-and-gestures.md).
- Scroll-controlled camera → `scroll-immersion`, not this skill.

## Check

- [ ] Shared state powers both Canvas and DOM controls.
- [ ] Keyboard, touch, pointer cancellation, capture loss, and focus work.
- [ ] Drag/Pinch has one owner, explicit thresholds, clamped zoom, and appropriate `touch-action`.
- [ ] Hover-only information has a tap/focus fallback.
- [ ] Raycasting is limited to interactive geometry.
- [ ] One system owns the camera.
- [ ] Reduced motion removes travel/idle effects without hiding state.
- [ ] Interactive state is announced without duplicate live regions.
- [ ] Relevant GPU/material resources clean up.
