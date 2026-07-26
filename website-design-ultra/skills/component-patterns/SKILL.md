---
name: component-patterns
description: Select and implement non-generic website components. Use for heroes, sections, bento grids, cards, marquees, sticky stacks, navigation, forms, dialogs, toasts, spotlight, glass, tilt, or magnetic interactions. Load only the reference containing the requested component family.
---

# Component Pattern Router

Select patterns after direction, content hierarchy, and state requirements are known.

## Read only the needed family

| Request | Reference |
|---|---|
| Hero, section composition, editorial layout, sticky story | [references/heroes-and-sections.md](references/heroes-and-sections.md) |
| Bento, feature grid, cards, visual demos, data stream | [references/bento-and-cards.md](references/bento-and-cards.md) |
| Navigation, form, modal/dialog, toast, interaction shell | [references/navigation-forms-overlays.md](references/navigation-forms-overlays.md) |

Do not load all three for a single component.

## Selection rules

- Match the content shape before the aesthetic label.
- Use `content-design` first when claims, proof, labels, or state copy are unresolved.
- Use one signature pattern per viewport; let supporting sections become quieter.
- For full pages or signature sections, load `core-rules`’ responsive recomposition reference and define viewport-specific priority, media, and interaction.
- Prefer semantic structure and natural document flow.
- Every hover/pointer effect needs focus and touch behavior.
- Persistent motion needs reduced-motion and pause behavior.
- Apply `ui-states` only when the component owns relevant async, validation, mutation, or interactive state.

## Composition checks

- Does the pattern clarify the primary action?
- Is the mobile composition reprioritized while DOM, visual, and focus order remain coherent?
- Can the layout survive longer copy, localization, and missing media?
- Does it still work without animation, hover, or JavaScript enhancement?
- Are cards actually grouping related content?

## Output

Return the selected pattern, semantic structure, responsive behavior, applicable states, and only the dependencies it needs.
