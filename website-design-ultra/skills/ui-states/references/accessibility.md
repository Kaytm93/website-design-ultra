# Accessibility Invariants

## Keyboard and focus

- All non-path-dependent functionality must work with a keyboard.
- DOM/tab order follows the visual and reading order.
- Focus remains visible and unobscured by sticky/fixed UI.
- Dialogs, menus, tabs, and disclosures follow their established interaction pattern.

```css
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
}
```

Validate the focus indicator against every touched background.

## Contrast and color

- Normal text: at least 4.5:1.
- Large text: at least 3:1.
- Meaningful UI graphics, boundaries, and states: at least 3:1 where required.
- Focus indicators: at least 3:1 against adjacent colors in focused and unfocused states; test every surface crossed by the ring.
- Error text follows normal text contrast; error icons/boundaries need 3:1 when they communicate the state.
- Disabled controls are exempt from WCAG contrast minimums, but target 3:1 for text/icons and add a non-color affordance when product constraints permit.
- Composite translucent foreground/surface colors over the actual backdrop in sRGB before calculating glass contrast.
- Do not use color as the only state/error cue.
- Test forced-colors/high-contrast modes when the audience or product requires them.

## Touch and pointer

- Target approximately 44×44 CSS px where possible.
- Provide a single-pointer alternative for multipoint/path gestures.
- Support pointer cancellation; commit destructive actions on click/up, not pointer-down.
- Hover behavior is optional enhancement.

## Reduced and persistent motion

Use a global policy plus component logic:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

For Motion:

```tsx
import { MotionConfig } from 'motion/react'

<MotionConfig reducedMotion="user">{children}</MotionConfig>
```

Also:

- pause/stop nonessential automatic movement that persists,
- remove parallax and camera travel for reduced motion,
- keep functional progress indicators understandable,
- avoid unsafe flashing.

## Images and canvas

- Meaningful images need contextual alt text; decorative images use empty alt.
- Canvas content needs an equivalent description.
- Canvas interaction needs equivalent DOM controls and shared state.
- Do not nest interactive controls under `role="img"`.

## Announcements

- Prefer native semantics.
- `role="status"` is polite; `role="alert"` is assertive.
- Avoid duplicate live regions and repeatedly reannouncing entire containers.
