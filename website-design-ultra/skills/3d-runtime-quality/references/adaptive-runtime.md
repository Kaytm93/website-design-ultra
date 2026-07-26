# Adaptive Runtime and Quality Hysteresis

## Contents

- Initial tier
- Measurement
- Hysteresis
- Offscreen and hidden pause
- Runtime ownership

## Initial tier

Start with Medium by default unless a conservative project signal requires Low or Poster. Use these signals only as an upper bound:

- `prefers-reduced-motion` controls motion, not image quality automatically.
- `navigator.deviceMemory`, `hardwareConcurrency`, Save-Data, and DPR are hints, not benchmarks.
- A missing renderer or repeated context loss leads directly to Poster.
- An explicit user setting takes precedence and must be preserved.

## Measurement

1. Wait for asset load, shader compile, and at least two stable seconds.
2. Collect frame times in a bounded ring buffer.
3. Evaluate a high percentile rather than the average alone.
4. Discard samples on `document.hidden`, offscreen, resize, DevTools pause, or immediately after a tier change.
5. Keep measuring after extended use so thermal throttling can trigger a downshift.

Do not react with React state every frame. Update only the infrequent tier state.

## Hysteresis

Use asymmetric windows:

- degrade: high frame-time percentile stays at least 2 seconds above roughly `1.25 × target`,
- upgrade: the value stays at least 8 seconds below roughly `0.8 × target`,
- cooldown: at least 10 seconds after every change,
- step: at most one tier step per decision,
- cap: respect user choice, battery mode, and the project maximum tier.

Adapt the numbers to the scene, but keep `upgrade-window > degrade-window`. Store the reached auto tier in `sessionStorage` so navigation does not restart at High.

```ts
type Tier = 'poster' | 'low' | 'medium' | 'high'

type QualityDecision = {
  tier: Tier
  source: 'user' | 'initial' | 'measured' | 'failure'
  changedAt: number
}
```

Log every decision with its reason in development logs, not per frame.

## Offscreen and hidden pause

Combine `IntersectionObserver` and `visibilitychange`:

- `visible = intersecting && document.visibilityState === 'visible'`
- R3F: set `frameloop="never"` or `"demand"` for still scenes and invalidate when they reappear.
- Vanilla: stop with `renderer.setAnimationLoop(null)` and restart in a controlled way when the scene reappears.
- Pause AnimationMixer, controls, particle simulation, video textures, audio, and quality measurement.
- Preserve the last semantic state; do not blindly remount the whole experience.

Observe the actual canvas wrapper and disconnect observers/listeners in cleanup.

## Runtime ownership

Derive every switch from one profile:

```ts
const QUALITY = {
  low: { dpr: 1, shadow: 0, lod: 2, post: false, particles: 80 },
  medium: { dpr: 1.5, shadow: 1024, lod: 1, post: 'minimal', particles: 400 },
  high: { dpr: 2, shadow: 2048, lod: 0, post: 'full', particles: 1200 },
} as const
```

- Limit rerenders to tier changes.
- Mutate runtime uniforms/refs for continuous values.
- Batch expensive changes into one switch and avoid parallel recompiles.
- In development, show a small diagnostic with tier, DPR, frame percentile, draw calls, and visible triangles.
- Remove the diagnostic from production.
