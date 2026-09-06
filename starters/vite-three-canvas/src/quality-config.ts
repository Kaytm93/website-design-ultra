/**
 * Project-owned quality values for the copied quality controller (IP-05B).
 *
 * The controller file (lib/quality-controller.ts) is the mechanism and holds
 * no quality values. Every number below is filled from the 3d-runtime-quality
 * skill — tier-matrix.md (DPR ceilings) and adaptive-runtime.md (windows,
 * ratios, cooldown, hysteresis invariants) — so the skill stays the single
 * source of truth and this file is the project's declaration of it.
 *
 * Rationale per value:
 * - tiers: poster/low 1.0, medium 1.5, high 2.0 — the tier-matrix.md DPR
 *   column, ceilings only; the matrix's shadow/LOD/particle/PostFX columns
 *   are applied by scene code, not duplicated here.
 * - initialTier 'medium' and maxTier 'high' — the skill's runtime contract.
 * - frameTargetMs 16.7 — a 60 Hz display target declared in ms, never derived
 *   from fps inside the controller.
 * - degradeRatio 1.25 / upgradeRatio 0.8 — the skill's "roughly 1.25 ×
 *   target" and "roughly 0.8 × target" hysteresis thresholds.
 * - degradeWindowMs 2000 < upgradeWindowMs 8000, cooldownMs 10000 — the
 *   skill's asymmetric-window contract: upgrades take longer than downgrades
 *   and a cooldown prevents oscillation.
 * - thermalWindowMs 30000 — sustained frame-time pressure after extended use
 *   (the skill's thermal-throttling downshift); a project-scene choice.
 * - thermalFloorTier 'low' — thermal pressure may drop the scene to Low but
 *   only failure (context loss, missing renderer) reaches Poster.
 * - dprStep 0.25, dprFloor 1 — the skill's "small steps" and CSS-resolution
 *   floor.
 * - sampleWindowFrames 120 — two seconds of frames at the declared 60 Hz
 *   target: the bounded ring buffer the p95 is evaluated on.
 * - persistenceKey — session persistence of the reached auto tier / user pin.
 */

import type { QualityControllerConfig } from './quality-controller.ts'

export const QUALITY_CONFIG: Omit<QualityControllerConfig, 'now'> = {
  tiers: {
    poster: { maxDpr: 1 },
    low: { maxDpr: 1 },
    medium: { maxDpr: 1.5 },
    high: { maxDpr: 2 },
  },
  initialTier: 'medium',
  maxTier: 'high',
  frameTargetMs: 16.7,
  degradeRatio: 1.25,
  upgradeRatio: 0.8,
  degradeWindowMs: 2000,
  upgradeWindowMs: 8000,
  cooldownMs: 10000,
  thermalWindowMs: 30000,
  thermalFloorTier: 'low',
  dprStep: 0.25,
  dprFloor: 1,
  sampleWindowFrames: 120,
  persistenceKey: 'wdu.next-r3f-cinematic.quality',
}
