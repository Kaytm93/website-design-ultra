# Accessibility of State Changes

The page-level invariants (keyboard, focus visibility, contrast, touch targets,
reduced motion, alt text) are in
`skills/core-rules/references/accessibility.md` and apply whether or not a
component owns state. Do not restate them here. This file covers only what
changes when a component moves between states.

## Announcements

- Prefer native semantics. A `<button disabled>` needs no announcement wrapper.
- `role="status"` is polite; `role="alert"` is assertive. Use assertive only for
  state the user must act on now.
- The live region must exist in the DOM before the state changes. A region
  inserted together with its message is frequently not announced.
- Avoid duplicate live regions and repeatedly reannouncing entire containers.
  Announce the delta, not the surrounding layout.

## Focus across a transition

- Never let focus land on `document.body`. When the focused element is removed —
  a row deleted, a dialog closed, a step replaced — move focus deliberately to
  the nearest stable ancestor or the control that triggered the change.
- Async replacement of content must preserve focus position. Swapping a skeleton
  for real content should not reset the user to the top of the list.
- On a validation failure, move focus to the first invalid control, or to a
  summary that links to it.

## Pending and busy

- Mark the region, not the whole page, with `aria-busy="true"` while it loads.
- A pending submit keeps its accessible name stable. Changing the label from
  "Save" to "Saving…" while also disabling the control removes both the name and
  the focus target.
- Prefer `aria-disabled="true"` over `disabled` for a control that must stay
  reachable so its explanation can be read.

## Errors and validation

- Associate the message with the input via `aria-describedby`, and mark the
  control `aria-invalid="true"`.
- The message text must survive re-render; do not rely on the visual position
  alone to convey which field failed.
- Disabled and read-only differ: read-only stays focusable and is announced,
  disabled is skipped. Choose by whether the user may still read the value.
