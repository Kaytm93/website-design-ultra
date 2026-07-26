# Navigation, Forms, and Overlays

## Navigation

- Use semantic `<nav aria-label="…">`.
- Keep logo/home, primary destinations, and primary action visually distinct.
- Fixed/floating navigation must not obscure focused content.
- Mobile navigation requires focus management, Escape close, scroll-lock cleanup, and a visible close button.
- Backdrop blur is optional; verify contrast over every background.

## Forms

```tsx
<div>
  <label htmlFor="email">Email address</label>
  <input
    id="email"
    name="email"
    type="email"
    aria-describedby="email-help email-error"
    aria-invalid={Boolean(error)}
    disabled={pending}
  />
  <p id="email-help">Used only for account notices.</p>
  {error ? <p id="email-error">{error}</p> : null}
</div>
```

- Use native controls, labels, autocomplete, input types, and validation semantics.
- Associate help and errors with `aria-describedby`.
- Use `disabled` for unavailable native controls; use `aria-disabled` only when the element remains intentionally focusable.
- Preserve entered values after validation or network failure.
- Button loading keeps its accessible name and prevents duplicate submission.

## Dialogs and drawers

- Use a tested dialog primitive or native `<dialog>` where appropriate.
- Label the dialog, move focus inside, contain focus, close on Escape, and restore focus.
- Exit animation must finish without delaying focus restoration or leaving an inert overlay.
- Reduced motion may keep opacity but removes travel/scale.

## Toasts

- Use `role="status"` for success/information and cautious `role="alert"` for urgent failure.
- Do not move focus to routine toasts.
- Provide dismissal when the message persists or contains an action.
- Pause expiration while pointer or keyboard focus is within the toast.
- Keep critical errors inline near the affected task as well.

## Touch and focus

- Minimum practical target: 44×44 CSS px where possible.
- Do not remove outlines without a visible replacement.
- Use `:focus-visible` and test focus against every surface.
- Pointer-only spotlight, ripple, or directional hover remains decoration; the underlying control works identically without it.
