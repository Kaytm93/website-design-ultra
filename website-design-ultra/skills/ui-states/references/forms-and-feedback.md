# Forms and Feedback States

## Field state

```tsx
<input
  id="email"
  name="email"
  aria-invalid={Boolean(error)}
  aria-describedby={error ? 'email-help email-error' : 'email-help'}
  disabled={pending}
/>
<p id="email-help">We use this for account notices.</p>
{error ? <p id="email-error">{error}</p> : null}
```

- Validate at a helpful time; do not announce errors on every keystroke.
- On submit failure, focus the error summary or first invalid field as appropriate.
- Preserve values and explain correction.

## Pending mutation

- Keep the action label recognizable, such as “Saving…” rather than an unlabeled spinner.
- Disable duplicate submission with the native `disabled` attribute.
- Use `aria-disabled` only when intentionally keeping a custom control focusable.
- Allow cancellation when the operation is long and cancellable.

## Success

- Use inline confirmation near the completed task when possible.
- Use `role="status"`/polite announcement for routine success.
- Do not rely on a transient toast as the only record of an important result.

## Error

- Use an inline message linked to the affected field/action.
- Reserve assertive alerts for urgent information.
- Network errors should distinguish offline, timeout, permission, validation, and server failure when known.

## Toast

- Routine update: `role="status"`.
- Urgent failure requiring attention: cautious `role="alert"`.
- Pause the timeout on hover and focus; provide dismiss/action controls when needed.
- Do not steal focus for routine messages.

## Active and selected

Use native states or ARIA that matches the pattern: `aria-pressed`, `aria-selected`, `aria-current`, checked state, or expanded state. Visual styling must not be the only signal.
