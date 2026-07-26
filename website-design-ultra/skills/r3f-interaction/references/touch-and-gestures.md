# Touch and Gesture System

## Interaction policy

First determine whether the surface is an embedded scene or a dedicated viewer:

| Surface | `touch-action` | Behavior |
|---|---|---|
| Embedded hero/section | `pan-y` | Vertical page scrolling stays the browser's job; horizontal drag may control the scene |
| Horizontally scrolling page | `pan-x` | Horizontal scrolling is preserved; a vertical gesture may be a scene function |
| Dedicated fullscreen viewer | `none` | Custom orbit/pinch possible; offer visible DOM controls and an exit |
| Non-interactive canvas | `auto` | Do not intercept gestures |

Set `touch-action` on the event surface before the gesture starts. A late `preventDefault()` does not replace this decision.

## Gesture state machine

Keep active pointers in a `Map<pointerId, { x, y, startX, startY, type }>` and distinguish:

- `pending`: movement still below threshold,
- `dragging`: one pointer has crossed the drag threshold,
- `pinching`: two pointers define distance and midpoint,
- `cancelled`: browser, context, or app aborted the gesture.

Starting values:

- Mouse/pen drag threshold: 6 CSS pixels.
- Touch drag threshold: 10–12 CSS pixels.
- Fire a tap only when duration and distance stay under the project limits.
- Clamp zoom/orbit; never push the camera through the near plane or the subject.

Adapt thresholds to device and scene scale, but do not mix them with world coordinates.

## Pointer capture

1. Register `pointerdown` only for primary/permitted buttons.
2. Store the pointer and call `setPointerCapture(pointerId)` on the event surface.
3. Update drag/pinch in `pointermove`.
4. Commit tap/selection only in `pointerup`, when no drag or pinch threshold was crossed.
5. Release capture with `releasePointerCapture` and clean up pointers.
6. Treat `pointercancel` and `lostpointercapture` as abort, not as commit.

Clean up on `window.blur`, `visibilitychange`, and component unmount as well. Reset cursor, controls, and temporary selection flags.

## Pinch and zoom

- Start a pinch with exactly two active touch/pen pointers.
- Compute scale from `currentDistance / startDistance`.
- Use the midpoint for optional target panning.
- Dolly the camera or change the control distance; do not animate FOV and distance at the same time.
- Limit min/max distance and keep the subject inside the art-direction shot.
- Ignore the synthetic click after a completed pinch or drag gesture.
- Offer `+`, `−`, reset, and named views as DOM controls.

## Hover fallback

Enable hover only under `@media (hover: hover) and (pointer: fine)`.

- Do not present essential information on hover alone.
- On coarse pointers, use tap to select and a second explicit DOM step for actions.
- Clear stuck hover states after touch, cancel, and pointer leave.
- Keep focus and `aria-pressed`/`aria-selected` as cross-platform states.

## Ownership

- Let exactly one system own orbit, drag, and pinch.
- Disable OrbitControls gestures when a custom recognizer writes the same axes.
- Separate object drag from camera drag with a clear hit test and `stopPropagation`.
- Set `raycast={null}` on decoration and use `<Bvh>` for complex targets.
- Route canvas and DOM control into the same state store.

## Cancellation test

Test:

- drag below/above threshold,
- diagonal scrolling inside an embedded hero,
- a second pointer during drag,
- pinch → losing one pointer,
- browser gesture or system dialog → `pointercancel`,
- capture loss, tab switch, and window blur,
- no hover device,
- keyboard and DOM controls without the canvas.
