---
name: ui-states
description: Design and verify applicable interface states for components with data, validation, mutations, or interaction. Use for loading, empty, error, success, disabled, active, focus, accessibility, reduced motion, forms, toasts, or async UI. Load only the reference matching the component’s state type.
---

# UI State Router

Do not force every state onto every component. First identify what the component owns.

## Applicability matrix

| Component behavior | Required review |
|---|---|
| Fetches async data | loading, empty, error, stale/retry, success content |
| Submits/mutates | idle, pending, success, error, duplicate prevention |
| Validates input | default, focus, invalid, valid, disabled/read-only |
| Toggles/selects | default, hover/touch, focus, active/selected, disabled |
| Static presentation | semantics, responsive behavior, focus only if interactive |

## Read only the needed reference

- Async content, skeletons, empty and network failure → [references/async-data.md](references/async-data.md).
- Forms, pending actions, success, errors, toasts → [references/forms-and-feedback.md](references/forms-and-feedback.md).
- Announcing a state change, focus across a transition, pending/busy, error
  association → [references/accessibility.md](references/accessibility.md).
  Keyboard, contrast, touch targets, and reduced motion are page invariants and
  live in `skills/core-rules/references/accessibility.md`.

Accessibility invariants apply whenever relevant, but do not load unrelated state examples.

## State design rules

- Preserve layout and context during transitions.
- Tell the user what happened and what they can do next.
- Use semantic state first; animation is optional enhancement.
- Do not fabricate “live” state for decorative marketing demos.
- Disabled and read-only are different states.
- Error recovery must preserve user input whenever safe.

## Check

- [ ] Applicable states were derived from behavior, not a universal checklist.
- [ ] State names and transitions are explicit.
- [ ] Pending actions prevent accidental duplication.
- [ ] Errors are associated with the affected control/content.
- [ ] Keyboard, touch, focus, contrast, and reduced motion pass.
- [ ] Loading and failure do not erase useful context.
