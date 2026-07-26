# Async Data States

## Loading

- Prefer a layout-matching skeleton when shape is known.
- Keep the container’s accessible name and set `aria-busy="true"` on the region.
- Hide decorative skeleton pieces from assistive technology.
- Use a spinner only for compact indeterminate actions or short app boot.
- Respect reduced motion; shimmer may become a static tonal placeholder.

```tsx
<section aria-busy={loading} aria-labelledby="results-title">
  <h2 id="results-title">Search results</h2>
  {loading ? (
    <>
      <span className="sr-only" role="status">Loading results</span>
      <ResultsSkeleton aria-hidden="true" />
    </>
  ) : (
    <Results />
  )}
</section>
```

## Empty

Distinguish:

- first-use empty,
- filtered/no-match,
- user-cleared,
- permission-limited,
- genuinely zero data.

Explain why it is empty and provide only a relevant next action. A decorative illustration is optional.

## Error

- State what failed in task language.
- Preserve previous/stale content when it is still useful.
- Offer retry only when retry can help.
- Avoid `role="alert"` around a large region that repeatedly rerenders.
- Log technical detail separately from the user-facing message.

## Stale and partial data

For refresh failures, show existing data with a non-destructive notice. Do not replace useful content with a full-page error.

## Suspense/streaming

Fallback dimensions should match final content. Keep meaningful headings and navigation outside the suspended boundary where possible.
