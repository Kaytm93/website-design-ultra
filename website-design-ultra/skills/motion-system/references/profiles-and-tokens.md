# Motion Profiles and Tokens

Read this file only when selecting a motion identity or concrete timing.

## Profiles

### Emil — restraint and speed

- High-frequency UI: 100–200ms.
- Keyboard-committed actions should not introduce avoidable waiting.
- Enter from `scale(.96)` or higher; avoid theatrical scale-from-zero.
- Prefer interruptible transitions.

Best for productivity, dashboards, forms, and navigation.

### Jakub — production polish

- Enter with small opacity/translate/blur changes.
- Exit is shorter and subtler than enter.
- Refine icon swaps, transform origins, shadows, and optical alignment.
- Avoid bounce unless it communicates a physical or celebratory state.

Best default for marketing, commerce, and product presentation.

### Jhey — expressive CSS

- Prefer capable native CSS before adding JavaScript.
- Use `@property`, `linear()`, and scroll-driven animation with fallbacks.
- Allow squash, rotation, and play only where the brand supports it.

Best for creative, cultural, educational, or experimental work.

## Context mapping

| Context | Primary | Optional accent |
|---|---|---|
| Productivity/dashboard | Emil | Jakub for onboarding/status |
| Marketing/e-commerce | Jakub | Jhey for one showcase moment |
| Editorial/portfolio | Jakub or Jhey | Emil for navigation/forms |
| Kids/education | Jhey | Jakub for clarity |

## Durations

| Pattern | Range |
|---|---|
| Button/toggle feedback | 100–200ms |
| Popover/tab/modal transition | 180–350ms |
| List entrance | 250–450ms |
| Page/hero transition | 400–700ms |
| Persistent idle cycle | 2–6s plus pause control |

## Easing family

Choose one primary family:

```css
:root {
  --ease-ui: cubic-bezier(.4, 0, .2, 1);
  --ease-expressive: cubic-bezier(.16, 1, .3, 1);
  --ease-soft: cubic-bezier(.25, 1, .5, 1);
}
```

Use modern `linear()` curves only with a tested fallback.

## Motion spring presets

```ts
export const springs = {
  default: { type: 'spring', stiffness: 100, damping: 20 },
  snappy: { type: 'spring', stiffness: 400, damping: 30 },
  playful: { type: 'spring', stiffness: 200, damping: 15, mass: 0.8 },
} as const
```

Tune against the actual rendered element; presets are starting points.
