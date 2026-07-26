# Bento and Cards

## Bento layout

Bento is appropriate when each cell demonstrates a distinct capability. Vary spans by importance, not randomly.

```tsx
export function FeatureGrid({ features }) {
  return (
    <section aria-labelledby="features-title" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <h2 id="features-title">Built for the actual workflow.</h2>
        <div className="mt-12 grid grid-cols-12 gap-6">
          {features.map((feature) => (
            <article
              key={feature.id}
              className={feature.featured
                ? 'col-span-12 md:col-span-8'
                : 'col-span-12 md:col-span-4'}
            >
              <div className="min-h-64 rounded-3xl border p-8">
                {feature.demo}
              </div>
              <h3 className="mt-5">{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
```

## Demonstration archetypes

Load/implement only the archetype needed:

1. **Intelligent list:** user-triggered or pausable reordering; stable keys and `layout`.
2. **Command input:** realistic prompt/result states; stop decorative typing for reduced motion.
3. **Live status:** distinguish real data from illustrative demo data.
4. **Data stream:** duplicate groups for a seamless loop and provide pause controls.
5. **Contextual UI:** reveal tools in response to a clear user action.

## Card decision

Use a card when background, border, or elevation communicates a genuine group or interaction boundary. Otherwise prefer:

- heading plus divider,
- definition list,
- editorial row,
- table,
- whitespace and alignment.

## Pointer-reactive cards

- Use pointer events and CSS variables or motion values, not React state per frame.
- Provide a static focus-visible treatment.
- Disable tilt/magnetic behavior for coarse pointers and reduced motion.
- Do not make a decorative wrapper steal clicks from nested controls.

## Glass

Validate composited contrast against the real background. Restrict blur to a few surfaces; include a solid fallback for unsupported or forced-color modes.

## Marquee/data stream

- Duplicate complete groups rather than individual indexed children.
- Include the gap in the loop distance to prevent a jump.
- Pause on explicit control; hover/focus pause alone is insufficient.
- Render all essential content outside the moving-only presentation.

## Loading demos

Marketing demonstrations are not application state. Do not add fake spinners or fake live metrics merely to create movement.
