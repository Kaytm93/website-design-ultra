---
name: color-palettes
description: "Select, adapt, or audit accessible website color systems. Use only when color itself is chosen, changed, or audited: brand and accent colors, palette or theme selection, light/dark modes, semantic color tokens, contrast validation, or one of the plugin’s 20 curated palettes. A page type alone — landing page, dashboard, portfolio — is not a color decision and does not activate this skill. Load only the palette family relevant to the chosen direction."
---

# Color Palettes

Choose colors by role and context. Do not load all palette files.

## 1. Select one family

| Need | Read |
|---|---|
| SaaS, enterprise, Apple, Swiss, developer tools | [references/neutral-product.md](references/neutral-product.md) |
| Editorial, natural, lifestyle, travel, wellness | [references/editorial-natural.md](references/editorial-natural.md) |
| Brutalist, retro, Y2K, cyberpunk, playful, glass | [references/expressive.md](references/expressive.md) |

Each reference contains complete tokens and suitable use cases.

## 2. Semantic roles

Every selected palette must expose at least:

```css
:root {
  --color-bg: ...;
  --color-surface: ...;
  --color-border: ...;
  --color-text: ...;
  --color-text-muted: ...;
  --color-action: ...;
  --color-on-action: ...;
  --color-focus: ...;
  --color-danger: ...;
  --color-on-danger: ...;
  --color-disabled: ...;
}
```

The curated palettes include `danger` and `disabled` so the validator can exercise real states. Add `warning`, `success`, and their `on-*` colors only when the interface needs those semantics. `disabled` is the text/icon token on the declared base surfaces; opacity alone is not the state signal.

## 3. Invariants

- Body text must meet WCAG AA 4.5:1; target 7:1 where the brand permits.
- Large text and meaningful UI graphics must meet their applicable contrast thresholds.
- Validate `on-action` against `action`; never assume white works.
- Validate error text/icon against both base surfaces and `on-danger` against a filled danger surface.
- Use one dominant action color. Additional direction colors may be decorative or semantic, not competing calls to action.
- Test focus colors against every surface they touch.
- Treat `border` as a meaningful component boundary with 3:1 contrast; create a separate decorative divider token if a quieter line is needed.
- Disabled controls are WCAG contrast exceptions, but target 3:1 for their text/icons and add a non-color cue so the state remains understandable.
- For translucent surfaces and borders, calculate the composited sRGB color over the declared background before measuring.
- Preserve color meaning without relying on color alone.
- Check both default and interactive states.

## 4. Direction exceptions

Pure black, highly saturated decorative colors, or several supporting colors are valid when a selected direction requires them. They do not override contrast, focus, or state semantics.

## 5. Output

Return the chosen palette as semantic CSS variables and mention:

- palette/direction,
- dominant action color,
- any decorative-only colors,
- one separate verified-contrast statement per required pair, naming the pair:
  `text/bg`, `on-action/action`, `border/surface`, `focus/every surface it
  touches`, `danger/surface` with `on-danger/danger`, `disabled/surface`, and
  one statement per composited translucent surface. Omitting a pair is a gap,
  not brevity — say `not applicable` and why if a pair genuinely has no use,
- light/dark or forced-colors behavior when relevant.

## Check

- [ ] Only one palette family reference was loaded.
- [ ] Semantic roles, not raw color names, drive components.
- [ ] Text, action, border/graphics, focus, disabled, and error states were checked.
- [ ] Decorative colors are not mistaken for action colors.
- [ ] Contrast was calculated rather than estimated visually.
