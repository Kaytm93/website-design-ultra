# Hierarchy and Loading

## Semantic scale

```css
:root {
  --text-hero:     600 clamp(2.5rem, 6vw, 4.5rem) / 1.05;
  --text-display:  600 clamp(2rem, 4.5vw, 3rem) / 1.1;
  --text-title:    600 clamp(1.75rem, 3vw, 2.25rem) / 1.15;
  --text-subtitle: 500 1.25rem / 1.4;
  --text-body:     400 1rem / 1.55;
  --text-small:    400 0.875rem / 1.5;
  --text-caption:  500 0.8125rem / 1.4;
  --text-micro:    500 0.75rem / 1.3;
}
```

Treat these as starting points. Change ratios for the selected direction and content; keep body copy at least 1rem unless an existing accessible system defines otherwise.

## Layout behavior

- Keep prose near `45–75ch`; use about `65ch` as a default, not a universal maximum.
- Let mobile display copy wrap naturally. Use manual breaks only at scoped viewports and remove them for localization.
- Pair `clamp()` with a layout that can grow vertically; fluid type alone is not responsive art direction.
- Align icons optically to the x-height rather than mechanically to the text box.
- Use `font-variant-numeric: tabular-nums` where columns of figures must align.
- Test 200% zoom, longest localized navigation, large dynamic type, and missing-font fallback.
- Avoid widows/orphans in editorial display copy only when the solution does not hard-code one language.

## Loading

Self-host only files whose license permits web embedding and redistribution with the application:

```css
@font-face {
  font-family: "Project Sans";
  src: url("/fonts/project-sans-latin.woff2") format("woff2");
  font-weight: 300 800;
  font-style: normal;
  font-display: swap;
}
```

- Preload only the above-the-fold subset actually used.
- Prefer WOFF2 and subset by verified language coverage; retain required license files when redistributing OFL fonts.
- Match fallback metrics with `size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override` when the measured CLS warrants it.
- Do not download a remotely served font and self-host it unless that distribution license explicitly permits it.
- Avoid loading every weight, script, or variable axis.

## Implementation check

- [ ] Heading levels reflect document structure, not visual size.
- [ ] Line length and vertical rhythm survive narrow and wide containers.
- [ ] Font failure keeps content readable and layout stable.
- [ ] Locale expansion does not clip labels or force fixed-height containers.
- [ ] Real italics/bold and required glyphs are present.
