# Parallel DOM Layer

The mechanism that satisfies `core-rules` §4 when the canvas owns the page. It
is one layer with three jobs: carry the content, carry the controls, and carry
focus. `r3f-patterns` fixes the roles on the canvas element itself; this file
covers the layer around it.

## Pick the shape first

| Shape | The DOM holds | Suits |
|---|---|---|
| Chrome | navigation, actions, legal text, visible on top of the canvas | most canvas-first sites |
| Mirror | a visually hidden copy of every section's content, kept in sync with scene state | scenes whose content is genuinely spatial |
| Static twin | a separate, fully rendered HTML route with the same content | heavy scenes, crawlers, and low-end devices |

Chrome and Mirror are usually combined: visible chrome for what the visitor
acts on, a hidden mirror for what the scene says. A Static twin is the only
shape a crawler and a text browser read, so choose it whenever the content has
to be found rather than only experienced.

## Hidden does not mean removed

A mirror layer stays in the accessibility tree and stays focusable. `display:
none`, `visibility: hidden`, and `hidden` all remove it, which defeats the
purpose.

```css
.visually-hidden:not(:focus-within) {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

Keep the mirror in reading order in the source. A mirror appended after the
canvas reads as an appendix; a mirror before it reads as the page.

## Focus model

Focus is the field most often left unfilled, and the one a keyboard-only run
exposes in seconds.

1. **Entry.** A skip control is the first focusable element: it jumps past the
   experience to the content or to the static twin. Announce it visibly on
   focus.
2. **Inside.** Every scene target that responds to a pointer has a DOM
   counterpart in the tab order. Hover-only affordances need a focus behavior
   or they do not exist for a keyboard.
3. **State change.** When a section becomes active, move focus deliberately or
   not at all — never both, and never per frame. Announce the new section once
   through a polite live region, with the section name only.
4. **Exit.** Focus leaves the experience without a trap. Test with Tab and
   Shift+Tab from both ends.

## Input parity

Fill one row per gesture the scene accepts. A gesture without both columns is
not shippable.

| Pointer gesture | Keyboard | Touch |
|---|---|---|
| Drag to orbit | arrow keys on the focused scene control, with a stated step | one-finger drag, `touch-action` declared |
| Wheel to advance | Page Up / Page Down, Home / End | vertical swipe |
| Click a hotspot | Enter or Space on its DOM counterpart | tap with a target of at least 24 by 24 CSS pixels |
| Hover to reveal | focus reveals the same content | tap reveals, and a second tap or an explicit close dismisses |

`r3f-interaction` owns pointer capture, cancellation, and gesture mechanics.
This table only fixes that each gesture has an equivalent.

## What the canvas cannot inherit

- `forced-colors` and `prefers-contrast` reach CSS, never pixels a shader wrote.
  The chrome layer has to remain legible when the system repaints it, so keep
  text, focus rings, and controls in DOM rather than in the scene.
- The reader's font size scales DOM text and leaves scene text unchanged. Any
  scene text that carries meaning needs a DOM twin that does scale.
- Machine translation rewrites DOM text only. A single-language canvas is a
  single-language page.

## Verification

A canvas-first build is verified with four runs, not one screenshot:

1. Keyboard only, no pointer, from the first tab stop to the last.
2. A screen reader over the mirror layer: every section reachable, announced
   once, in reading order.
3. Forced colors on: chrome, focus rings, and text stay legible.
4. WebGL disabled: the poster route from `immersive-3d` §5 renders the
   statement and the primary action.

Record all four with `/verify`, alongside the desktop, mobile, and
reduced-motion captures the 3D gate already requires.

## Regulatory note

In the EU, Directive 2019/882 applies from 28 June 2025, implemented in Germany
as the Barrierefreiheitsstärkungsgesetz. It covers defined consumer-facing
products and services — e-commerce among them — rather than every website, and
it exempts microenterprises providing services. Whether a given project is in
scope is a question for the client's counsel, not for this file. The point that
does belong here: a canvas-only page has no defensible position if it is in
scope, and the parallel layer is what makes the question answerable at all.
