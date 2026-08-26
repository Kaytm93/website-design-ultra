/**
 * Project-owned quality values for the copied quality controller (IP-05B).
 *
 * The controller file (lib/quality-controller.ts) is the mechanism and holds
 * no quality values. Every number below is filled from the 3d-runtime-quality
 * skill — tier-matrix.md (DPR ceilings) and adaptive-runtime.md (windows,
 * ratios, cooldown, hysteresis invariants) — so the skill stays the single
 * source of truth and this file is the project's declaration of it.
 *
 * The values mirror the starter's declaration: the fixture exercises the same
 * shared surface against the same declared tier matrix.
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
  persistenceKey: 'wdu.product-hero.quality',
}
