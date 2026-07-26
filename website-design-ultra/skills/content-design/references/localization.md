# Localization and Transcreation

## Model content

- Store message meaning separately from layout and presentation.
- Use stable message IDs; avoid concatenating translated fragments.
- Keep variables semantic and documented: `{itemCount}`, `{renewalDate}`, `{planName}`.
- Use ICU/CLDR-capable plural, select, date, time, number, currency, and relative-time formatting.
- Never assume English word order, grammatical gender, plural rules, address order, or name structure.

## Layout stress contract

Test at least:

- 30–50% text expansion for compact English labels,
- very short strings that expose fragile alignment,
- multi-line buttons and navigation where permitted,
- long unbreakable product names/URLs,
- right-to-left direction,
- CJK line breaking and font fallback,
- 200% zoom and increased text spacing.

Do not solve expansion by shrinking below readable sizes, clipping, fixed heights, or replacing all labels with unlabeled icons.

## Translate versus transcreate

- Translate functional labels, requirements, errors, prices, and legal meaning precisely.
- Transcreate slogans, idioms, rhythm, and cultural references only with an approved intent/claim brief.
- Preserve claim confidence. A qualified source claim must not become absolute in another locale.
- Record locale-specific exclusions, regulatory wording, and unavailable features.

## Asset and direction changes

Localization may require more than strings:

- change crop or image when gestures, text-in-image, cultural meaning, or reading direction changes,
- mirror directional UI where the platform convention requires it, not logos or media indiscriminately,
- choose fonts with real script coverage and compatible tone,
- recompose navigation and hero balance for text expansion rather than forcing the source layout.

## Handoff

Provide message IDs, source copy, intent, variables, character limits only when technically unavoidable, screenshots/context, and approved terminology. Mark machine-generated translations as drafts until reviewed by a qualified speaker for the target context.
