/*
 * Copyable runtime quality controller reference (IP-05B).
 *
 * This file has zero runtime dependencies: it imports nothing, requires no
 * framework, and reads no wall clock. It belongs outside the installed
 * website-design-ultra plugin payload (docs/adr/ADR-011) and is copied into an
 * application rather than installed as a package. The starter keeps a
 * byte-identical copy at starters/next-r3f-cinematic/lib/quality-controller.ts
 * and its test suite fails if the copies drift.
 *
 * WHAT THIS FILE OWNS — the mechanism, never the values:
 *   - Poster/Low/Medium/High tier transitions (one step per decision)
 *   - DPR steps within a tier and across tier changes (small, capped steps)
 *   - Hysteresis: asymmetric degrade/upgrade windows evaluated on the p95 of a
 *     bounded ring buffer of frame times
 *   - Cooldown after every change, so a step cannot be immediately reversed
 *   - Offscreen / document-hidden pause of measurement and decisions
 *   - Thermal backoff: sustained frame-time pressure (even intermittent) that
 *     accumulates over a long window and forces a downshift
 *
 * WHERE THE VALUES LIVE — 3d-runtime-quality owns every number:
 *   The tier DPR ceilings, the frame target, the window lengths, the ratios,
 *   the DPR step, the floors, and the thermal window are all supplied through
 *   `config`. The plugin skill `3d-runtime-quality` and its references
 *   (tier-matrix.md, adaptive-runtime.md) are the single source of truth for
 *   those values; a project fills the config from them. This file contains no
 *   quality values of its own beyond structural constants (tier order, units).
 *
 * DETERMINISM (IP-02):
 *   Time is injected. `config.now` is required; the controller never reads
 *   wall-clock time itself. Deterministic mode passes a clock-derived time
 *   source (frame × fixed step) and a declared frame-time input, which makes
 *   every decision a pure function of the input sequence: same samples, same
 *   clock, same decisions. Live mode passes a wall-clock source.
 *
 * TELEMETRY SURFACE (IP-03):
 *   `qualityState()` returns the exact `runtime.quality` shape of the shared
 *   immersive telemetry surface (`references/immersive-telemetry.ts`): one
 *   active tier and a capped DPR as a `ratio` quantity. The controller is the
 *   one owner of tier-derived runtime settings; the renderer and verifier read
 *   this slice and never decide quality themselves.
 *
 * REACT BOUNDARY:
 *   This is a plain factory over closures. A render loop feeds
 *   `recordFrameTime` once per frame; `onChange` fires only when the tier or
 *   DPR actually changes, so an integration can update React state (or, better,
 *   imperative renderer settings) on change instead of per frame.
 *
 * EXAMPLE CONFIG (the starter's values, filled from 3d-runtime-quality):
 *
 *   createQualityController({
 *     now: () => clock.elapsed * 1000,
 *     tiers: {
 *       poster: { maxDpr: 1 },
 *       low:    { maxDpr: 1 },
 *       medium: { maxDpr: 1.5 },
 *       high:   { maxDpr: 2 },
 *     },
 *     initialTier: 'medium',
 *     maxTier: 'high',
 *     frameTargetMs: 16.7,
 *     degradeRatio: 1.25,
 *     upgradeRatio: 0.8,
 *     degradeWindowMs: 2000,
 *     upgradeWindowMs: 8000,
 *     cooldownMs: 10000,
 *     thermalWindowMs: 30000,
 *     thermalFloorTier: 'low',
 *     dprStep: 0.25,
 *     dprFloor: 1,
 *     sampleWindowFrames: 120,
 *     persistenceKey: 'wdu.next-r3f-cinematic.quality',
 *   })
 */

/** Structural tier order, poster first. This is the mechanism's only "value". */
export const TIER_ORDER = ['poster', 'low', 'medium', 'high'] as const
export type QualityTier = (typeof TIER_ORDER)[number]

/**
 * One tier's profile. The only field the controller reads is the DPR ceiling;
 * shadow/LOD/particle/PostFX values are applied by the scene from the same
 * project matrix and are owned by 3d-runtime-quality, not duplicated here.
 */
export interface TierProfile {
  /** DPR ceiling for this tier, e.g. medium 1.5. Never below dprFloor. */
  readonly maxDpr: number
}

/** The project-supplied tier matrix (the values, owned by 3d-runtime-quality). */
export type QualityTierMatrix = Readonly<Record<QualityTier, TierProfile>>

/** Where the current tier came from. Mirrors 3d-runtime-quality's QualityDecision. */
export type QualitySource = 'user' | 'initial' | 'measured' | 'failure'

/** Bounded, timestamped transition log entry. Timestamps come from injected time. */
export interface QualityDecision {
  readonly at: number
  readonly from: QualityTier
  readonly to: QualityTier
  readonly dpr: number
  readonly reason: string
  /** Optional caller-supplied context, e.g. the context-loss reason for forcePoster. */
  readonly note?: string
}

/** Minimal storage adapter for session persistence; sessionStorage-shaped. */
export interface QualityStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * All mechanism parameters. Every quality value is required — this file owns
 * no defaults — so the controller can never silently invent a tier matrix or
 * a window length. Values are filled from 3d-runtime-quality (tier-matrix.md,
 * adaptive-runtime.md, and the skill's runtime contract block).
 */
export interface QualityControllerConfig {
  /** Injected time source in milliseconds. Required: the controller reads no wall clock. */
  readonly now: () => number
  /** Project tier matrix; the DPR ceilings come from 3d-runtime-quality tier-matrix.md. */
  readonly tiers: QualityTierMatrix
  /** Tier the experience starts at before any measurement. */
  readonly initialTier: QualityTier
  /** Cap for measured upgrades and battery clamps. Explicit user picks may exceed it. */
  readonly maxTier: QualityTier
  /** Declared frame-time target in ms (never derived from fps inside this file). */
  readonly frameTargetMs: number
  /** Degrade threshold = frameTargetMs × degradeRatio (skill: roughly 1.25). */
  readonly degradeRatio: number
  /** Upgrade threshold = frameTargetMs × upgradeRatio (skill: roughly 0.8). */
  readonly upgradeRatio: number
  /** p95 must stay above the degrade threshold this long before one step down. */
  readonly degradeWindowMs: number
  /** p95 must stay below the upgrade threshold this long before one step up. */
  readonly upgradeWindowMs: number
  /** No measured change within this long after any change. */
  readonly cooldownMs: number
  /** Total degraded time that forces a thermal downshift, even when intermittent. */
  readonly thermalWindowMs: number
  /** Thermal pressure never steps below this tier; only failure reaches poster. */
  readonly thermalFloorTier: QualityTier
  /** DPR moves in steps of this size (skill: for example 0.25). */
  readonly dprStep: number
  /** DPR never goes below this (skill: CSS resolution, 1.0). */
  readonly dprFloor: number
  /** Ring-buffer length of frame-time samples before decisions are allowed. */
  readonly sampleWindowFrames: number
  /** sessionStorage key for the reached-auto-tier / user-pin persistence. */
  readonly persistenceKey: string
  /** Storage adapter; defaults to sessionStorage when available, null disables. */
  readonly storage?: QualityStorage | null
  /**
   * Optional scheduler injection for the lifecycle test (IP-10C). Defaults
   * to the real `setInterval` / `clearInterval`. A fake scheduler must
   * expose `setInterval(handle: () => void, ms: number)` and
   * `clearInterval(handle: unknown)`; the controller calls these from
   * attachVisibility(function form).
   */
  readonly scheduler?: {
    setInterval: (handle: () => void, ms: number) => unknown
    clearInterval: (handle: unknown) => void
  }
}

/** The IP-03 telemetry slice: exact `runtime.quality` shape (tier + ratio DPR). */
export interface QualityTelemetryState {
  readonly tier: QualityTier
  readonly dpr: Readonly<{ value: number; unit: 'ratio' }>
}

/** Full internal state, for diagnostics and tests. Not the telemetry surface. */
export interface QualityControllerSnapshot {
  readonly tier: QualityTier
  readonly dpr: number
  readonly source: QualitySource
  readonly visible: boolean
  readonly paused: boolean
  readonly thermal: boolean
  readonly lastDecision: QualityDecision | null
  readonly cooldownRemainingMs: number
  readonly p95FrameMs: number | null
}

export interface QualityController {
  /** Feed one measured frame time (ms). Called once per rendered frame. */
  recordFrameTime(frameTimeMs: number): void
  /** Offscreen/hidden pause. While hidden, samples and decisions stop. */
  setVisibility(visible: boolean): void
  /** Explicit user pick: applied immediately, pinned, persisted, suspends measured steps. */
  setUserTier(tier: QualityTier): void
  /** Remove the user pin and resume measured adaptation from the current state. */
  clearUserTier(): void
  /** Cap for measured upgrades / battery clamp. Clamps the current tier immediately. */
  setMaxTier(tier: QualityTier): void
  /** Failure path (context loss, missing renderer): straight to poster, source 'failure'. */
  forcePoster(reason?: string): void
  /** Drop buffered samples and accumulators (integration calls this on resize). */
  resetMeasurement(): void
  /** The IP-03 telemetry slice: { tier, dpr: { value, unit: 'ratio' } }. */
  qualityState(): QualityTelemetryState
  /** Diagnostic state. Never render this per frame. */
  snapshot(): QualityControllerSnapshot
  /** Bounded transition log (most recent last). */
  decisions(): readonly QualityDecision[]
  /** Subscribe to tier/DPR changes only. Returns an unsubscribe function. */
  onChange(listener: (state: QualityTelemetryState) => void): () => void
  /** Wire IntersectionObserver + visibilitychange onto a canvas element. */
  attachVisibility(target: Element): void
  /** Detach DOM observers. Idempotent. */
  dispose(): void
}

const EPSILON = 1e-6
const MAX_DECISIONS = 32
const THREE_DECIMALS = 1e3

function requireTier(value: unknown, label: string): QualityTier {
  if (typeof value !== 'string' || !(TIER_ORDER as readonly string[]).includes(value)) {
    throw new Error(`${label} must be one of ${TIER_ORDER.join(', ')}`)
  }
  return value as QualityTier
}

function requirePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`)
  }
  return value
}

function tierIndex(tier: QualityTier): number {
  return TIER_ORDER.indexOf(tier)
}

/** Round DPR so 0.25 steps never accumulate binary-float drift in the log. */
function roundDpr(value: number): number {
  return Math.round(value * THREE_DECIMALS) / THREE_DECIMALS
}

/**
 * Deterministic nearest-rank p95, matching the telemetry verifier's rule:
 * ceil(sampleCount × 0.95), 1-based rank into the sorted samples.
 */
function percentile95(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b)
  const rank = Math.max(1, Math.ceil(sorted.length * 0.95))
  return sorted[rank - 1] ?? 0
}

function readStored(storage: QualityStorage | null, key: string): unknown {
  if (storage === null) return null
  try {
    const raw = storage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as unknown
  } catch {
    return null // corrupted or unavailable storage is a fresh start, never a crash
  }
}

function writeStored(
  storage: QualityStorage | null,
  key: string,
  value: { tier: QualityTier; source: QualitySource; at: number },
): void {
  if (storage === null) return
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable (private mode, iframe sandbox); persistence
    // is an optimization, not a contract.
  }
}

function removeStored(storage: QualityStorage | null, key: string): void {
  if (storage === null) return
  try {
    storage.removeItem(key)
  } catch {
    // Same non-fatal treatment as writeStored.
  }
}

/**
 * Resolve the starting tier from session persistence (3d-runtime-quality:
 * "Store the reached auto tier in sessionStorage so navigation does not
 * restart at High"). A stored user pin wins; a stored measured tier restarts
 * at the degraded level but never above the declared initial tier.
 */
function resolveInitialState(
  config: QualityControllerConfig,
  now: () => number,
): { tier: QualityTier; dpr: number; source: QualitySource; userTier: QualityTier | null } {
  const stored = readStored(config.storage ?? null, config.persistenceKey)
  if (stored !== null && typeof stored === 'object' && stored !== null) {
    const record = stored as Record<string, unknown>
    if (typeof record.tier === 'string' && TIER_ORDER.includes(record.tier as QualityTier)) {
      const storedTier = record.tier as QualityTier
      const storedSource = record.source
      if (storedSource === 'user') {
        return {
          tier: storedTier,
          dpr: config.tiers[storedTier].maxDpr,
          source: 'user',
          userTier: storedTier,
        }
      }
      if (storedSource === 'measured') {
        const restored =
          tierIndex(storedTier) <= tierIndex(config.initialTier)
            ? storedTier
            : config.initialTier
        return {
          tier: restored,
          dpr: Math.min(config.tiers[restored].maxDpr, config.tiers[storedTier].maxDpr),
          source: 'initial',
          userTier: null,
        }
      }
    }
  }
  return {
    tier: config.initialTier,
    dpr: config.tiers[config.initialTier].maxDpr,
    source: 'initial',
    userTier: null,
  }
}

/** Validate the mechanism parameters and the matrix invariants the skill declares. */
function validateConfig(config: QualityControllerConfig): void {
  if (typeof config.now !== 'function') {
    throw new Error('quality controller requires an injected now() time source')
  }
  if (typeof config.persistenceKey !== 'string' || config.persistenceKey.trim().length === 0) {
    throw new Error('quality controller requires a non-empty persistenceKey')
  }
  requirePositive(config.frameTargetMs, 'frameTargetMs')
  requirePositive(config.degradeRatio, 'degradeRatio')
  requirePositive(config.upgradeRatio, 'upgradeRatio')
  requirePositive(config.degradeWindowMs, 'degradeWindowMs')
  requirePositive(config.upgradeWindowMs, 'upgradeWindowMs')
  requirePositive(config.thermalWindowMs, 'thermalWindowMs')
  requirePositive(config.dprStep, 'dprStep')
  if (!Number.isFinite(config.cooldownMs) || config.cooldownMs < 0) {
    throw new Error('cooldownMs must be a finite non-negative number')
  }
  if (config.upgradeRatio >= config.degradeRatio) {
    throw new Error(
      'upgradeRatio must be below degradeRatio so the upgrade threshold is stricter than the degrade threshold',
    )
  }
  if (config.upgradeWindowMs <= config.degradeWindowMs) {
    throw new Error(
      'upgradeWindowMs must be greater than degradeWindowMs (upgrades take longer than downgrades)',
    )
  }
  if (!Number.isFinite(config.dprFloor) || config.dprFloor < 1) {
    throw new Error('dprFloor must be at least 1 (CSS resolution)')
  }
  if (!Number.isSafeInteger(config.sampleWindowFrames) || config.sampleWindowFrames < 3) {
    throw new Error('sampleWindowFrames must be a safe integer of at least 3')
  }
  requireTier(config.initialTier, 'initialTier')
  const maxTier = requireTier(config.maxTier, 'maxTier')
  const floor = requireTier(config.thermalFloorTier, 'thermalFloorTier')
  if (tierIndex(config.initialTier) > tierIndex(maxTier)) {
    throw new Error('initialTier must not exceed maxTier')
  }
  if (tierIndex(floor) > tierIndex(maxTier)) {
    throw new Error('thermalFloorTier must not exceed maxTier')
  }
  for (const tier of TIER_ORDER) {
    const profile = config.tiers[tier]
    if (!profile || typeof profile.maxDpr !== 'number' || !Number.isFinite(profile.maxDpr)) {
      throw new Error(`tiers.${tier}.maxDpr must be a finite number`)
    }
    if (profile.maxDpr < config.dprFloor - EPSILON) {
      throw new Error(`tiers.${tier}.maxDpr must not be below dprFloor`)
    }
  }
  for (let index = 1; index < TIER_ORDER.length; index += 1) {
    if (config.tiers[TIER_ORDER[index]].maxDpr < config.tiers[TIER_ORDER[index - 1]].maxDpr) {
      throw new Error('tier maxDpr values must be non-decreasing from poster to high')
    }
  }
}

export function createQualityController(config: QualityControllerConfig): QualityController {
  validateConfig(config)

  const storage = config.storage === undefined ? defaultStorage() : config.storage
  const now = config.now
  const degradeThreshold = config.frameTargetMs * config.degradeRatio
  const upgradeThreshold = config.frameTargetMs * config.upgradeRatio

  const initial = resolveInitialState(config, now)
  let tier: QualityTier = initial.tier
  let dpr: number = initial.dpr
  let source: QualitySource = initial.source
  let userTier: QualityTier | null = initial.userTier
  let maxTier: QualityTier = config.maxTier

  let visible = true
  let thermal = false
  let degradeMs = 0
  let upgradeMs = 0
  let thermalMs = 0
  let cooldownUntilMs = 0
  let lastSampleAtMs: number | null = null
  let lastP95: number | null = null
  const samples: number[] = []
  const decisions: QualityDecision[] = []
  const listeners = new Set<(state: QualityTelemetryState) => void>()

  let visibilityHandler: (() => void) | null = null
  let visibilityObserver: IntersectionObserver | null = null
  let detach = () => {}
  let disposed = false

  function logDecision(from: QualityTier, to: QualityTier, reason: string, note?: string): void {
    decisions.push({ at: now(), from, to, dpr, reason, ...(note !== undefined ? { note } : {}) })
    if (decisions.length > MAX_DECISIONS) decisions.shift()
  }

  function persist(): void {
    if (source === 'user' || source === 'measured') {
      writeStored(storage, config.persistenceKey, { tier, source, at: now() })
    }
  }

  /** The IP-03 telemetry slice. Defined before notify so both can share it. */
  function qualityState(): QualityTelemetryState {
    return { tier, dpr: { value: dpr, unit: 'ratio' } }
  }

  function notify(): void {
    const state = qualityState()
    listeners.forEach((listener) => listener(state))
  }

  function resetMeasurement(): void {
    samples.length = 0
    degradeMs = 0
    upgradeMs = 0
    thermalMs = 0
    lastSampleAtMs = null
    lastP95 = null
  }

  /** One step down: DPR first (small steps), then one tier, poster last. */
  function stepDown(thermalStep: boolean): void {
    const from = tier
    const prefix = thermalStep ? 'thermal' : 'degraded'
    if (dpr > config.dprFloor + EPSILON) {
      dpr = roundDpr(Math.max(config.dprFloor, dpr - config.dprStep))
      logDecision(from, from, `${prefix}-dpr-step`)
    } else {
      const to = TIER_ORDER[tierIndex(from) - 1]
      const reason = to === 'poster' ? `${prefix}-poster` : `${prefix}-tier-step`
      tier = to
      dpr = Math.min(dpr, config.tiers[tier].maxDpr)
      logDecision(from, to, reason)
      if (tier === 'poster') thermal = false
    }
    persist()
    notify()
  }

  /** One step up: out of poster first, then DPR toward the ceiling, then one tier. */
  function stepUp(): void {
    const from = tier
    if (from === 'poster') {
      const to = TIER_ORDER[1]
      tier = to
      dpr = Math.min(dpr, config.tiers[tier].maxDpr)
      logDecision(from, to, 'recovered-from-poster')
    } else if (dpr < config.tiers[tier].maxDpr - EPSILON) {
      dpr = roundDpr(Math.min(config.tiers[tier].maxDpr, dpr + config.dprStep))
      logDecision(from, from, 'recovered-dpr-step')
    } else {
      const to = TIER_ORDER[tierIndex(from) + 1]
      tier = to
      dpr = Math.min(dpr, config.tiers[tier].maxDpr)
      logDecision(from, to, 'recovered-tier-step')
    }
    thermal = false
    persist()
    notify()
  }

  function canStepDown(thermalStep: boolean): boolean {
    if (tier === 'poster') return false
    if (dpr > config.dprFloor + EPSILON) return true
    // At the DPR floor the only remaining step is a tier step.
    if (thermalStep && tier === config.thermalFloorTier) return false
    return true
  }

  function canStepUp(): boolean {
    if (tierIndex(tier) >= tierIndex(maxTier)) {
      return dpr < config.tiers[tier].maxDpr - EPSILON
    }
    return true
  }

  /** Evaluate at most one step per sample, after the ring buffer is warm. */
  function decide(sampleDeltaMs: number, sampleP95: number): void {
    if (source === 'user') return // explicit user picks suspend measured adaptation

    const degraded = sampleP95 > degradeThreshold
    const recovered = sampleP95 < upgradeThreshold

    if (degraded) {
      degradeMs += sampleDeltaMs
      thermalMs += sampleDeltaMs
      upgradeMs = 0
      const cooldownElapsed = now() >= cooldownUntilMs
      if (degradeMs >= config.degradeWindowMs && cooldownElapsed && canStepDown(false)) {
        stepDown(false)
        degradeMs = 0
        cooldownUntilMs = now() + config.cooldownMs
      } else if (thermalMs >= config.thermalWindowMs && cooldownElapsed && canStepDown(true)) {
        // Thermal backoff: total degraded time crossed the long window even if
        // no single stretch was long enough for the degrade window.
        thermal = true
        stepDown(true)
        degradeMs = 0
        thermalMs = 0
        cooldownUntilMs = now() + config.cooldownMs
      }
      return
    }

    if (recovered) {
      upgradeMs += sampleDeltaMs
      degradeMs = 0
      if (upgradeMs >= config.upgradeWindowMs && now() >= cooldownUntilMs && canStepUp()) {
        stepUp()
        upgradeMs = 0
        thermalMs = 0
        cooldownUntilMs = now() + config.cooldownMs
      }
      return
    }

    // Between the thresholds: neither condition holds, so both continuous
    // windows reset. Thermal pressure is intentionally not reset here.
    degradeMs = 0
    upgradeMs = 0
  }

  function setVisibility(nextVisible: boolean): void {
    const changed = visible !== nextVisible
    visible = nextVisible
    if (changed && !visible) {
      // Hidden: stop measuring. Samples collected while hidden would be bogus
      // (rAF is throttled), so they are dropped and never accumulated.
      resetMeasurement()
    } else if (changed && visible) {
      // Fresh start on return: the next decision needs a full warm buffer and
      // full windows again. Never resume mid-window with stale samples.
      resetMeasurement()
    }
  }

  return {
    recordFrameTime(frameTimeMs: number): void {
      if (!visible) return
      if (!Number.isFinite(frameTimeMs) || frameTimeMs < 0) return
      const nowMs = now()
      const sampleDeltaMs = lastSampleAtMs === null ? 0 : Math.max(0, nowMs - lastSampleAtMs)
      lastSampleAtMs = nowMs

      samples.push(frameTimeMs)
      if (samples.length > config.sampleWindowFrames) samples.shift()
      if (samples.length < config.sampleWindowFrames) return // warm-up: no decisions yet

      lastP95 = percentile95(samples)
      decide(sampleDeltaMs, lastP95)
    },

    setVisibility,

    setUserTier(nextTier: QualityTier): void {
      requireTier(nextTier, 'user tier')
      const previous = tier
      userTier = nextTier
      source = 'user'
      tier = nextTier
      dpr = config.tiers[tier].maxDpr
      thermal = false
      resetMeasurement()
      cooldownUntilMs = now() + config.cooldownMs
      logDecision(previous, tier, 'user', `explicit user tier ${tier}`)
      persist()
      notify()
    },

    clearUserTier(): void {
      if (userTier === null) return
      userTier = null
      source = 'measured'
      removeStored(storage, config.persistenceKey)
      // No tier change: no decision entry, no notify. Measured adaptation
      // resumes from the current state on the next samples.
    },

    setMaxTier(nextMax: QualityTier): void {
      requireTier(nextMax, 'max tier')
      maxTier = nextMax
      // A battery-mode or project cap is a constraint, not an adaptation: it
      // clamps the current tier (and the user pin) immediately.
      if (userTier !== null && tierIndex(userTier) > tierIndex(maxTier)) {
        userTier = maxTier
      }
      if (tierIndex(tier) > tierIndex(maxTier)) {
        const previous = tier
        tier = maxTier
        dpr = Math.min(dpr, config.tiers[tier].maxDpr)
        cooldownUntilMs = now() + config.cooldownMs
        logDecision(previous, tier, 'max-tier-cap', `maxTier clamped to ${maxTier}`)
        persist()
        notify()
      }
    },

    forcePoster(reason?: string): void {
      const previous = tier
      tier = 'poster'
      dpr = config.tiers.poster.maxDpr
      source = 'failure'
      thermal = false
      resetMeasurement()
      cooldownUntilMs = now() + config.cooldownMs
      logDecision(previous, tier, 'failure-poster', reason)
      notify()
      // Failure is not persisted: a context loss on this page must not pin the
      // next page to poster.
    },

    resetMeasurement,

    qualityState,

    snapshot(): QualityControllerSnapshot {
      return {
        tier,
        dpr,
        source,
        visible,
        paused: !visible,
        thermal,
        lastDecision: decisions[decisions.length - 1] ?? null,
        cooldownRemainingMs: Math.max(0, cooldownUntilMs - now()),
        p95FrameMs: lastP95,
      }
    },

    decisions(): readonly QualityDecision[] {
      return [...decisions]
    },

    onChange(listener: (state: QualityTelemetryState) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    attachVisibility(target: Element | (() => boolean)): () => void {
      if (disposed) return () => {}
      if (typeof document === 'undefined' && typeof target !== 'function') return () => {}
      const scheduler = config.scheduler ?? {
        setInterval: (handle: () => void, ms: number) => setInterval(handle, ms),
        clearInterval: (handle: unknown) => clearInterval(handle as ReturnType<typeof setInterval>),
      }
      // Function form: test-only scheduler-injectable path that returns a
      // detach handle so the lifecycle test can prove schedule/clear balance.
      if (typeof target === 'function') {
        let isVisible = target()
        const handle = scheduler.setInterval(() => {
          const v = target()
          if (v !== isVisible) {
            isVisible = v
            setVisibility(v)
          }
        }, 1000)
        detach = () => {
          scheduler.clearInterval(handle)
        }
        return detach
      }
      // Element form: the production path that watches document visibility
      // plus an IntersectionObserver on the canvas element.
      visibilityHandler = () => {
        setVisibility(document.visibilityState === 'visible')
      }
      document.addEventListener('visibilitychange', visibilityHandler)
      if (typeof IntersectionObserver !== 'undefined') {
        visibilityObserver = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              setVisibility(
                entry.isIntersecting && document.visibilityState === 'visible',
              )
            }
          },
          { threshold: 0 },
        )
        visibilityObserver.observe(target)
      }
      detach = () => {
        if (visibilityHandler !== null && typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', visibilityHandler)
          visibilityHandler = null
        }
        if (visibilityObserver !== null) {
          visibilityObserver.disconnect()
          visibilityObserver = null
        }
      }
      return detach
    },

    dispose() {
      detach()
    },
  }
}

/** sessionStorage when it exists; persistence is disabled where it does not. */
function defaultStorage(): QualityStorage | null {
  if (typeof globalThis.sessionStorage === 'undefined') return null
  return globalThis.sessionStorage
}
