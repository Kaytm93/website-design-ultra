# Interface Microcopy

## Action labels

- Name the immediate outcome: “Create report,” “Save billing address,” “Send reset link.”
- Use “Continue” only when the next step is genuinely clear from context.
- Keep destructive verbs explicit; pair them with the affected object.
- Preserve the label while pending: “Saving…” rather than an unlabeled spinner.
- Match visible text and accessible name; extra context may be appended for assistive technology, not contradicted.

## Forms

- Label fields with the requested information, not placeholder-only examples.
- Put format or consequence in help text before an error occurs.
- Error = what happened + how to correct it. Preserve the entered value.
- Avoid blame, jokes, and generic “Invalid input.”

Examples:

| Weak | Better |
|---|---|
| Invalid | Enter a work email such as name@company.com. |
| Something went wrong | We could not save the report. Your changes are still here; try again. |
| Submit | Create workspace |

## State copy

- Loading: name the task only when the delay is perceptible.
- Empty: distinguish first use, no match, cleared data, missing permission, and true zero.
- Success: confirm the completed action and durable result.
- Offline/timeout: state the known condition without inventing the cause.
- Disabled: if the reason is not obvious, explain the prerequisite nearby; do not rely on tooltip-only access.

Marketing demos must say when their content or metrics are illustrative.

## Consent, trust, and risk

- Explain what will happen before permission, payment, deletion, publication, or data sharing.
- Avoid preselected consent and manipulative urgency.
- Put irreversible consequence in the dialog and button label.
- Do not compress legal meaning into friendlier but inaccurate copy.

## Review

Read the interface as a sequence of decisions. Remove copy that neither sets expectation, explains state, proves a claim, nor helps the next action.
