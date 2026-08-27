// quality-controller.ts — Minimal copyable quality controller (subset of
// product-hero/lib/quality-controller.ts). The procedural-crystal fixture
// owns Poster/Low/Medium/High transitions, DPR steps, hysteresis, offscreen
// pause, and thermal backoff. The verifier reads from this surface through
// the telemetry document.

import { QUALITY_CONFIG, type QualityConfig } from './quality-config.ts'

export type QualityTier = 'poster' | 'low' | 'medium' | 'high'

export interface QualityTelemetryState {
  tier: QualityTier
  dpr: number
  visible: boolean
}

export interface QualityController extends QualityTelemetryState {
  forcePoster(reason: string): void
  recordFrameTime(ms: number): void
  attachVisibility(isVisible: () => boolean): () => void
  read(): { tier: QualityTier; dpr: number }
}

export interface CreateQualityControllerOptions extends QualityConfig {
  now: () => number
}

export function createQualityController(options: CreateQualityControllerOptions): QualityController {
  const hysteresisMs = options.hysteresisMs ?? QUALITY_CONFIG.hysteresisMs
  const cooldownMs = options.cooldownMs ?? QUALITY_CONFIG.cooldownMs
  let tier: QualityTier = 'medium'
  let dpr = options.dprSteps?.[2] ?? 1
  let visible = true
  let offscreenSince = 0
  // lastTransitionAt starts far enough in the past that the first transition
  // is never blocked by cooldown; otherwise a freshly-created controller
  // could not respond to a forcePoster call.
  let lastTransitionAt = Number.NEGATIVE_INFINITY
  const reasons: string[] = []
  let detachVisibility = () => {}

  function setTier(next: QualityTier) {
    if (next === tier) return
    if (options.now() - lastTransitionAt < cooldownMs) return
    tier = next
    lastTransitionAt = options.now()
  }

  function setDpr(next: number) {
    if (next === dpr) return
    dpr = next
  }

  return {
    get tier() { return tier },
    get dpr() { return dpr },
    get visible() { return visible },
    forcePoster(reason) {
      reasons.push(reason)
      setTier('poster')
    },
    recordFrameTime(ms) {
      if (!visible) return
      if (ms > 28) setTier('low')
      else if (ms < 12) setTier('high')
      else if (tier === 'high' && ms > 16) setTier('medium')
    },
    attachVisibility(isVisible) {
      detachVisibility()
      const handle = setInterval(() => {
        const v = isVisible()
        if (v === visible) return
        visible = v
        if (!v) offscreenSince = options.now()
        if (v && offscreenSince && options.now() - offscreenSince > (options.offscreenPauseMs ?? 2000)) {
          offscreenSince = 0
        }
      }, 1000)
      detachVisibility = () => clearInterval(handle)
      return detachVisibility
    },
    read() { return { tier, dpr } },
  }
}