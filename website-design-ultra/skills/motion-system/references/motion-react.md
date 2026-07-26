# Motion for React

Read this file only when the selected runtime is Motion.

## Install and import

```bash
npm i motion
```

```tsx
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
```

At the app’s client motion boundary:

```tsx
<MotionConfig reducedMotion="user">
  {children}
</MotionConfig>
```

Use `useReducedMotion()` when animation logic, not only transform/layout animation, must change.

## Presence

```tsx
<AnimatePresence initial={false}>
  {open ? (
    <motion.div
      key="panel"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
    />
  ) : null}
</AnimatePresence>
```

Presence does not replace focus management, dialog semantics, or state announcements.

## Continuous pointer values

Use motion values, not React state:

```tsx
const x = useMotionValue(0)
const smoothX = useSpring(x, { stiffness: 150, damping: 18 })
```

Use pointer events rather than mouse-only events, disable magnetic/tilt behavior for coarse pointers, and reset values on pointer leave/cancel.

## Layout animation

- Use `layout` for local reflow.
- Use `layoutId` for a deliberate shared-element transition.
- Stable keys are required.
- Avoid animating large layout trees when a small wrapper communicates the same change.

## Loading and failure

Do not render critical content initially invisible unless it becomes visible without client JavaScript. Prefer enhancement after hydration or keep the final CSS state as the baseline.
