# R3F with Next.js

Read this reference only for Next.js or multiple Canvas slots.

## App Router client boundary

`ssr: false` is valid only in a Client Component. Keep the page as a Server Component and introduce a small client loader:

```tsx
// components/SceneClient.tsx
'use client'

import dynamic from 'next/dynamic'

const Scene = dynamic(() => import('./Scene').then((module) => module.Scene), {
  ssr: false,
  loading: () => (
    <div
      className="min-h-[60dvh] bg-zinc-950"
      role="status"
      aria-label="3D-Ansicht wird geladen"
    />
  ),
})

export function SceneClient() {
  return <Scene />
}
```

```tsx
// app/page.tsx — remains a Server Component
import { SceneClient } from '@/components/SceneClient'

export default function Page() {
  return <SceneClient />
}
```

Keep `'use client'` at the smallest boundary that owns the dynamic import and browser APIs.

## Lazy activation

- Render useful DOM content and a poster immediately.
- Mount the Canvas near the viewport with `IntersectionObserver`.
- Disconnect the observer in cleanup.
- If a mounted scene is static, invalidate on demand rather than rendering continuously.

## Multiple 3D regions

Prefer one shared Canvas with drei `<View track={ref}>` for multiple page regions. Put `<View.Port />` in the Canvas and set `eventSource` to the common DOM wrapper. Verify clipping, pointer coordinates, and scroll offsets at each breakpoint.
