// quality-config.ts — Quality tier thresholds for the procedural-crystal
// fixture. Poster is reached on context loss / missing WebGL; Low/Medium/High
// are hysteresis-driven by frame-time. Values stay in 3d-runtime-quality
// canonically; this file just freezes them for the fixture's device profile.

export interface QualityConfig {
  tiers: { poster: number; low: number; medium: number; high: number }
  dprSteps: number[]
  hysteresisMs: number
  cooldownMs: number
  offscreenPauseMs: number
  thermalBackoffMs: number
}

export const QUALITY_CONFIG: QualityConfig = {
  tiers: { poster: 0, low: 1, medium: 2, high: 3 },
  dprSteps: [0.5, 0.75, 1, 1.25],
  hysteresisMs: 250,
  cooldownMs: 1500,
  offscreenPauseMs: 2000,
  thermalBackoffMs: 4000,
}