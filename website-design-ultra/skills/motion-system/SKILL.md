---
name: motion-system
description: Select and implement purposeful website motion. Use for transitions, hover/tap feedback, enter/exit animation, Motion for React, GSAP, ScrollTrigger, Lenis, springs, easing, choreography, or motion accessibility. Load only the reference for the chosen runtime.
---

# Motion System

Motion communicates state, hierarchy, causality, or spatial continuity. Remove it when it only delays the user.

## 1. Select a profile

- **Productivity:** fast, restrained, interruptible.
- **Polished marketing:** clear entrances/exits and optical refinement.
- **Expressive:** selective play, scroll choreography, or experimental CSS.

For named profiles, durations, easings, and spring presets, read [references/profiles-and-tokens.md](references/profiles-and-tokens.md).

## 2. Select one owner per subtree

| Need | Runtime |
|---|---|
| Hover, focus, simple state feedback | CSS |
| React state/layout/gesture animation | Motion (`motion/react`) |
| Pinned or timeline-heavy storytelling | GSAP + ScrollTrigger |
| Smooth document scroll | Lenis, optionally driven by the selected animation ticker |
| R3F frame animation | R3F `useFrame` |

Libraries may exist on the same page behind explicit component boundaries. Do not let two clocks write the same property, camera, or scroll position.

## 3. Invariants

- Animate named properties, never `transition: all`.
- Prefer `transform`, `opacity`, and compositor-friendly effects.
- Use React state for discrete UI state, not continuous pointer/frame values.
- Make animations interruptible and clean up effects/tickers.
- Respect reduced motion at the runtime boundary.
- Persistent nonessential movement must be pausable.
- Hover is enhancement; provide focus, touch, and tap behavior.
- Do not hide essential content by default when failed JS could leave it invisible.

## 4. Runtime references

- **Motion for React, layout, presence, gestures:** read [references/motion-react.md](references/motion-react.md).
- **GSAP, ScrollTrigger, Lenis boundaries:** read [references/gsap-and-scroll.md](references/gsap-and-scroll.md).
- **Motion written inside a render loop (`useFrame`, a scene clock, a canvas system):** read [references/frame-rate-independence.md](references/frame-rate-independence.md). A duration-based library needs none of it.
- **3D camera/object animation:** use `r3f-patterns`, `r3f-interaction`, or `scroll-immersion`.

Do not read all references for a simple CSS transition.

## 5. Motion-gap review

Search conditional UI, then decide whether continuity is useful:

```bash
rg -n "\{.*(&&|\?).*<" --glob '*.{tsx,jsx}' .
```

Not every conditional render needs animation. Prioritize:

- Modals, drawers, popovers: maintain spatial continuity and manage focus.
- Mode/view switches: animate only when it clarifies the relationship.
- Loading/content replacement: avoid layout jumps.
- Validation/status: announce state first; animation is secondary.

## 6. Default CSS

```css
.interactive {
  transition:
    transform 180ms var(--ease-ui),
    opacity 180ms var(--ease-ui),
    color 180ms var(--ease-ui),
    background-color 180ms var(--ease-ui);
}

@media (prefers-reduced-motion: reduce) {
  .interactive {
    transition-duration: 0.01ms;
  }
}
```

## Check

- [ ] Motion has a user-facing purpose.
- [ ] One runtime owns each animated subtree/property.
- [ ] Durations match interaction frequency.
- [ ] Enter, exit, interruption, and cleanup were considered.
- [ ] Keyboard, touch, reduced motion, and pause behavior work.
- [ ] No `transition: all`, per-frame React state, or fixed-factor damping.
