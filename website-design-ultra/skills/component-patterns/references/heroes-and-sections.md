# Heroes and Sections

## Hero selector

| Content need | Pattern |
|---|---|
| Claim plus product proof | Asymmetric split |
| Brand statement with little media | Type-first |
| Narrative reveal | Curtain/pinned story |
| Publication or portfolio | Editorial composition |
| Premium spatial object | Focused 3D/product hero |
| Technical live proof | Terminal/instrument hero |

## Asymmetric split

Use a 12-column grid and allow the media to anchor differently from the copy:

```html
<section class="grid min-h-[100dvh] grid-cols-12 gap-6 px-6 py-24">
  <div class="col-span-12 md:col-span-7">
    <h1>Concrete product claim</h1>
    <p class="mt-6 max-w-[55ch]">Supporting evidence.</p>
  </div>
  <div class="col-span-12 self-end md:col-span-5">
    <!-- Meaningful media with alt text, or decorative media hidden from AT -->
  </div>
</section>
```

On mobile, define whether media moves above, below, behind, or becomes a different proof asset based on narrative priority. Record the change in the responsive viewport-shot contract; do not merely reduce the desktop grid.

## Type-first

- One strong typographic idea, one supporting paragraph, one action.
- Use meaningful line breaks on large screens and natural wrapping on mobile.
- Background texture/gradient remains decorative and low-cost.

## Editorial composition

- Pair headline, deck, image, caption, and metadata as one composition.
- Use columns and overlaps only when DOM reading order remains logical.
- Drop caps and pull quotes are optional accents, not structural requirements.
- On narrow screens, turn the spread into a deliberate reading stream while preserving image/caption association and moving nonessential metadata later.

## Curtain or pinned story

- Use only when the reveal adds meaning.
- Keep semantic content in normal flow.
- Provide a non-pinned reduced-motion/small-screen version.
- Never hide the main action until the animation completes.

## Focused 3D/product hero

- Use `immersive-3d`.
- DOM owns headline, copy, and CTA.
- Canvas supports the message and has poster/quality fallbacks.
- Reframe camera and crop for mobile.

## Section patterns

- **Evidence rail:** metrics, proof, or logos with a single clear heading.
- **Zig-zag narrative:** alternate media/copy only when sequence matters.
- **Sticky chapter:** one persistent visual, changing semantic chapters.
- **Comparison:** use a real table when values map across repeated fields.
- **Gallery:** media first, caption/title directly associated below.

Avoid repeating the hero’s visual trick in every section.
