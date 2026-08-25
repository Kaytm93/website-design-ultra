import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  createQualityController,
  TIER_ORDER,
} from '../lib/quality-controller.ts'
import { QUALITY_CONFIG } from '../lib/quality-config.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Test harness: injected time advances explicitly, so every expectation is
 * exact arithmetic on (sample, time) pairs — no wall clock anywhere.
 */
function makeHarness(overrides = {}) {
  const time = { t: 0 }
  const controller = createQualityController({
    now: () => time.t,
    tiers: {
      poster: { maxDpr: 1 },
      low: { maxDpr: 1 },
      medium: { maxDpr: 1.5 },
      high: { maxDpr: 2 },
    },
    initialTier: 'medium',
    maxTier: 'high',
    frameTargetMs: 16.7,
    degradeRatio: 1.25, // degrade threshold 20.875 ms
    upgradeRatio: 0.8, // upgrade threshold 13.36 ms
    degradeWindowMs: 500,
    upgradeWindowMs: 1500,
    cooldownMs: 1000,
    thermalWindowMs: 5000,
    thermalFloorTier: 'low',
    dprStep: 0.25,
    dprFloor: 1,
    sampleWindowFrames: 10,
    persistenceKey: 'wdu.test.quality',
    storage: null,
    ...overrides,
  })
  return { controller, time }
}

/** Feed `count` samples of `frameTimeMs`, advancing injected time by `stepMs` each. */
function feed(controller, time, frameTimeMs, count, stepMs = 10) {
  for (let index = 0; index < count; index += 1) {
    controller.recordFrameTime(frameTimeMs)
    time.t += stepMs
  }
}

function decisions(controller) {
  return controller.decisions().map((decision) => decision.reason)
}

// ── Hysteresis ───────────────────────────────────────────────────────────────

test('degrade fires only after the full degrade window, one DPR step at a time', () => {
  const { controller, time } = makeHarness()
  feed(controller, time, 16.7, 10) // warm-up: buffer fills, no decisions
  assert.equal(controller.snapshot().p95FrameMs, 16.7)
  assert.deepEqual(controller.decisions(), [])

  feed(controller, time, 40, 49) // 490 ms of p95 above 1.25 × target
  assert.equal(controller.qualityState().dpr.value, 1.5, 'window not yet elapsed')
  feed(controller, time, 40, 1) // 500 ms total
  assert.equal(controller.qualityState().dpr.value, 1.25, 'exactly one DPR step')
  assert.equal(controller.qualityState().tier, 'medium')
  assert.deepEqual(decisions(controller), ['degraded-dpr-step'])
})

test('p95 gating: occasional slow frames inside 5% do not trigger degrade', () => {
  const { controller, time } = makeHarness({ sampleWindowFrames: 20 })
  // One 40 ms frame per 20-frame window keeps the nearest-rank p95 at the
  // 19th value, which is a good frame: the condition never holds.
  for (let cycle = 0; cycle < 6; cycle += 1) {
    feed(controller, time, 10, 19)
    feed(controller, time, 40, 1)
  }
  assert.deepEqual(controller.decisions(), [])
  assert.equal(controller.qualityState().dpr.value, 1.5)
})

test('upgrade needs the longer upgrade window plus cooldown (asymmetric hysteresis)', () => {
  const { controller, time } = makeHarness()
  feed(controller, time, 16.7, 10) // warm-up
  feed(controller, time, 40, 50) // degrade step at t = 600
  assert.equal(controller.qualityState().dpr.value, 1.25)

  // The p95 window drains nine bad frames before recovery accumulates, so
  // 158 good frames leave 1490 ms accumulated and 159 land the 1500 ms step.
  feed(controller, time, 10, 158)
  assert.equal(controller.qualityState().dpr.value, 1.25, 'upgrade window not elapsed')
  feed(controller, time, 10, 1)
  assert.equal(controller.qualityState().dpr.value, 1.5)
  assert.deepEqual(decisions(controller), ['degraded-dpr-step', 'recovered-dpr-step'])
})

test('neutral frames between the thresholds reset both continuous windows', () => {
  const { controller, time } = makeHarness()
  feed(controller, time, 16.7, 10)
  feed(controller, time, 40, 30) // 300 ms degraded
  feed(controller, time, 16.7, 20) // neutral: resets the degrade window
  feed(controller, time, 40, 30) // 300 ms degraded again, window restarted
  assert.deepEqual(controller.decisions(), [], 'no continuous 500 ms stretch ever formed')
  assert.equal(controller.qualityState().dpr.value, 1.5)
})

// ── Cooldown and one-step-per-decision ───────────────────────────────────────

test('cooldown gates every measured change: one step per window plus cooldown', () => {
  const { controller, time } = makeHarness()
  feed(controller, time, 16.7, 10) // t = 100
  feed(controller, time, 40, 50) // step 1 at t = 600: dpr 1.25
  feed(controller, time, 40, 50) // t = 1100: window elapsed but cooldown active
  assert.equal(controller.qualityState().dpr.value, 1.25, 'cooldown blocks the second step')
  feed(controller, time, 40, 50) // t = 1600: cooldown (until 1600) elapsed
  assert.equal(controller.qualityState().dpr.value, 1.0, 'second step lands at the floor')
})

test('a single sample can never move more than one step', () => {
  const { controller, time } = makeHarness()
  feed(controller, time, 16.7, 10) // warm-up, t = 100
  time.t += 1000 // one long gap: 1000 ms of degraded time in a single sample
  controller.recordFrameTime(40)
  assert.equal(controller.qualityState().dpr.value, 1.25, 'one step, not two')
  assert.equal(controller.decisions().length, 1)
})

test('degrade walks the full ladder to poster, one step per decision', () => {
  const { controller, time } = makeHarness()
  feed(controller, time, 16.7, 10) // t = 100
  feed(controller, time, 40, 50) // t = 600:  dpr 1.5 → 1.25
  feed(controller, time, 40, 100) // t = 1600: dpr 1.25 → 1.0
  feed(controller, time, 40, 100) // t = 2600: medium → low
  feed(controller, time, 40, 100) // t = 3600: low → poster
  assert.equal(controller.qualityState().tier, 'poster')
  assert.equal(controller.qualityState().dpr.value, 1)
  assert.deepEqual(decisions(controller), [
    'degraded-dpr-step',
    'degraded-dpr-step',
    'degraded-tier-step',
    'degraded-poster',
  ])
  feed(controller, time, 40, 200) // poster is the floor: no further steps
  assert.equal(controller.decisions().length, 4)
})

// ── Recovery ─────────────────────────────────────────────────────────────────

test('recovery climbs from poster back to high, DPR stepping on the way', () => {
  const { controller, time } = makeHarness()
  feed(controller, time, 16.7, 10)
  feed(controller, time, 40, 350) // to poster (4 steps, every 1000 ms)
  assert.equal(controller.qualityState().tier, 'poster')

  // Ten samples drain the bad frames from the p95 window, then the upgrade
  // window (1500 ms) plus the degrade-step cooldown must elapse.
  feed(controller, time, 10, 150)
  assert.equal(controller.qualityState().tier, 'poster', 'upgrade window not elapsed')
  feed(controller, time, 10, 10) // t = 5200: poster → low
  assert.equal(controller.qualityState().tier, 'low')
  feed(controller, time, 10, 150) // low → medium
  feed(controller, time, 10, 150) // dpr 1.0 → 1.25
  feed(controller, time, 10, 150) // dpr 1.25 → 1.5
  feed(controller, time, 10, 150) // medium → high
  feed(controller, time, 10, 150) // dpr 1.5 → 1.75
  feed(controller, time, 10, 150) // dpr 1.75 → 2.0
  assert.equal(controller.qualityState().tier, 'high')
  assert.equal(controller.qualityState().dpr.value, 2)
  assert.deepEqual(decisions(controller), [
    'degraded-dpr-step',
    'degraded-dpr-step',
    'degraded-tier-step',
    'degraded-poster',
    'recovered-from-poster',
    'recovered-tier-step',
    'recovered-dpr-step',
    'recovered-dpr-step',
    'recovered-tier-step',
    'recovered-dpr-step',
    'recovered-dpr-step',
  ])
})

// ── Visibility / offscreen pause ─────────────────────────────────────────────

test('hidden state pauses measurement and decisions entirely', () => {
  const { controller, time } = makeHarness()
  controller.setVisibility(false)
  assert.equal(controller.snapshot().paused, true)
  feed(controller, time, 40, 200) // would degrade instantly if measured
  assert.deepEqual(controller.decisions(), [])
  assert.equal(controller.qualityState().dpr.value, 1.5)

  controller.setVisibility(true)
  assert.equal(controller.snapshot().paused, false)
  feed(controller, time, 16.7, 10) // buffer refills from zero
  feed(controller, time, 40, 50) // then the normal window applies
  assert.equal(controller.qualityState().dpr.value, 1.25)
})

test('samples before a hide and stale windows are discarded on return', () => {
  const { controller, time } = makeHarness()
  feed(controller, time, 16.7, 10)
  feed(controller, time, 40, 30) // 300 ms degraded: window not elapsed
  controller.setVisibility(false)
  feed(controller, time, 40, 100) // hidden: all ignored
  controller.setVisibility(true) // measurement restarts from zero
  // The refill samples are warm-up: time accumulates only once the buffer is
  // full again, so the 500 ms window needs 59 bad samples (490 ms at 58).
  feed(controller, time, 40, 58)
  assert.equal(controller.qualityState().dpr.value, 1.5, 'degrade window restarted')
  feed(controller, time, 40, 1)
  assert.equal(controller.qualityState().dpr.value, 1.25)
})

test('attachVisibility is a safe no-op without a DOM', () => {
  const { controller } = makeHarness()
  assert.doesNotThrow(() => controller.attachVisibility({}))
  assert.doesNotThrow(() => controller.dispose())
  assert.doesNotThrow(() => controller.dispose()) // idempotent
})

// ── Thermal backoff ──────────────────────────────────────────────────────────

test('intermittent pressure never meets the degrade window but still triggers thermal backoff', () => {
  const { controller, time } = makeHarness()
  feed(controller, time, 16.7, 10) // warm-up

  // 30 bad frames (300 ms of degraded p95) then 30 neutral frames (resets the
  // continuous degrade window). The degrade window of 500 ms never completes,
  // but total degraded time crosses thermalWindowMs after ~17 cycles.
  let cycles = 0
  while (controller.decisions().length === 0 && cycles < 60) {
    feed(controller, time, 40, 30)
    feed(controller, time, 16.7, 30)
    cycles += 1
  }
  assert.ok(cycles < 60, 'thermal backoff must fire within 60 cycles')
  assert.ok(controller.snapshot().thermal, 'thermal flag is set')
  assert.ok(decisions(controller)[0].startsWith('thermal-'), 'first step is thermal, not degraded')
  assert.equal(controller.qualityState().tier, 'medium')
  assert.equal(controller.qualityState().dpr.value, 1.25, 'one DPR step from thermal pressure')
})

test('thermal pressure stops at the declared thermal floor tier', () => {
  const { controller, time } = makeHarness()
  feed(controller, time, 16.7, 10)
  // Push thermal steps until the floor: 1.5 → 1.25 → 1.0 → medium → low.
  let guard = 0
  while (controller.qualityState().tier !== 'low' && guard < 120) {
    feed(controller, time, 40, 30)
    feed(controller, time, 16.7, 30)
    guard += 1
  }
  assert.equal(controller.qualityState().tier, 'low')
  // Continued *intermittent* pressure: the continuous degrade window never
  // completes (300 ms stretches), so only thermal could step — and the floor
  // blocks it. Tier must hold at low.
  const decisionsBefore = controller.decisions().length
  for (let cycle = 0; cycle < 20; cycle += 1) {
    feed(controller, time, 40, 30)
    feed(controller, time, 16.7, 30)
  }
  assert.equal(controller.qualityState().tier, 'low', 'thermal floor holds: never poster')
  assert.equal(controller.decisions().length, decisionsBefore, 'no step under floor pressure')
  assert.ok(
    !decisions(controller).some((reason) => reason.includes('poster')),
    'thermal pressure never reaches poster',
  )
})

test('recovery clears the thermal flag and climbs normally', () => {
  const { controller, time } = makeHarness()
  feed(controller, time, 16.7, 10)
  let guard = 0
  while (!controller.snapshot().thermal && guard < 120) {
    feed(controller, time, 40, 30)
    feed(controller, time, 16.7, 30)
    guard += 1
  }
  assert.ok(controller.snapshot().thermal)
  feed(controller, time, 10, 300) // sustained recovery
  assert.equal(controller.snapshot().thermal, false, 'upgrade step clears the thermal flag')
  assert.ok(controller.qualityState().tier !== 'medium' || controller.qualityState().dpr.value > 1.25)
})

// ── Deterministic mode ───────────────────────────────────────────────────────

test('deterministic mode: identical samples and injected time yield identical decisions', () => {
  const script = [
    [16.7, 10],
    [40, 55],
    [10, 160],
    [30, 70],
    [16.7, 40],
    [45, 90],
    [10, 220],
  ]
  const run = () => {
    const { controller, time } = makeHarness()
    for (const [frameTimeMs, count] of script) {
      feed(controller, time, frameTimeMs, count)
    }
    return {
      state: controller.qualityState(),
      decisions: controller.decisions(),
      snapshot: controller.snapshot(),
    }
  }
  assert.deepEqual(run(), run(), 'two runs of the same input sequence are identical')
})

test('the controller reads no wall clock and imports nothing (zero dependency)', () => {
  const source = readFileSync(join(root, 'lib', 'quality-controller.ts'), 'utf8')
  assert.ok(!/performance\.now/.test(source), 'no performance.now path')
  assert.ok(!/Date\.now/.test(source), 'no Date.now path')
  assert.ok(!/^\s*import\s/m.test(source), 'no imports: the file is self-contained')
  assert.ok(!/require\s*\(/.test(source), 'no CommonJS require')
})

// ── IP-03 telemetry surface ──────────────────────────────────────────────────

test('qualityState exposes the IP-03 runtime.quality slice with units', () => {
  const { controller } = makeHarness()
  assert.deepEqual(controller.qualityState(), {
    tier: 'medium',
    dpr: { value: 1.5, unit: 'ratio' },
  })
  for (const tier of TIER_ORDER) {
    controller.setUserTier(tier)
    const state = controller.qualityState()
    assert.equal(state.tier, tier)
    assert.equal(state.dpr.unit, 'ratio')
    assert.ok(state.dpr.value >= 1, 'DPR never drops below the CSS-resolution floor')
  }
})

test('onChange fires only on tier or DPR changes, and unsubscribes', () => {
  const { controller, time } = makeHarness()
  let calls = 0
  let lastState = null
  const unsubscribe = controller.onChange((state) => {
    calls += 1
    lastState = state
  })
  feed(controller, time, 16.7, 10)
  feed(controller, time, 40, 30) // window not elapsed: no change
  assert.equal(calls, 0, 'sample feeding alone never notifies')
  feed(controller, time, 40, 20)
  assert.equal(calls, 1, 'one notification for one DPR step')
  assert.deepEqual(lastState, { tier: 'medium', dpr: { value: 1.25, unit: 'ratio' } })

  unsubscribe()
  feed(controller, time, 40, 150) // another step while unsubscribed
  assert.equal(calls, 1, 'unsubscribed listeners are not called')
})

// ── User tier, caps, failure, persistence ────────────────────────────────────

test('an explicit user tier is applied immediately, pinned, and persisted', () => {
  const stored = new Map()
  const storage = {
    getItem: (key) => (stored.has(key) ? stored.get(key) : null),
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  }
  const { controller, time } = makeHarness({ storage })
  controller.setUserTier('high')
  assert.equal(controller.qualityState().tier, 'high')
  assert.equal(controller.qualityState().dpr.value, 2)
  assert.equal(controller.snapshot().source, 'user')

  feed(controller, time, 40, 400) // heavy pressure: the pin holds
  assert.equal(controller.qualityState().tier, 'high', 'user choice is preserved')

  controller.clearUserTier()
  assert.equal(controller.snapshot().source, 'measured')
  assert.equal(stored.has('wdu.test.quality'), false, 'the pin is removed from storage')
  feed(controller, time, 16.7, 10) // fresh measurement window
  feed(controller, time, 40, 50)
  assert.equal(controller.qualityState().dpr.value, 1.75, 'adaptation resumes from the pin')
})

test('session persistence restores a reached auto tier and a user pin', () => {
  const seed = (value) => ({
    storage: {
      getItem: () => value,
      setItem: () => {},
      removeItem: () => {},
    },
  })

  const degraded = makeHarness(seed(JSON.stringify({ tier: 'low', source: 'measured' })))
  assert.equal(degraded.controller.qualityState().tier, 'low', 'restarts at the reached tier')

  const aboveInitial = makeHarness(seed(JSON.stringify({ tier: 'high', source: 'measured' })))
  assert.equal(
    aboveInitial.controller.qualityState().tier,
    'medium',
    'a measured restore never exceeds the declared initial tier',
  )

  const pinned = makeHarness(seed(JSON.stringify({ tier: 'high', source: 'user' })))
  assert.equal(pinned.controller.qualityState().tier, 'high')
  feed(pinned.controller, pinned.time, 40, 300)
  assert.equal(pinned.controller.qualityState().tier, 'high', 'restored pin still holds')

  const garbage = makeHarness(seed('{not json'))
  assert.equal(garbage.controller.qualityState().tier, 'medium', 'corrupt storage is a fresh start')
  const bogusTier = makeHarness(seed(JSON.stringify({ tier: 'ultra', source: 'measured' })))
  assert.equal(bogusTier.controller.qualityState().tier, 'medium', 'unknown tiers are ignored')
})

test('maxTier caps measured upgrades and setMaxTier clamps immediately', () => {
  const { controller, time } = makeHarness({ maxTier: 'medium' })
  feed(controller, time, 16.7, 10)
  feed(controller, time, 40, 250) // three steps: dpr 1.25, dpr 1.0, medium → low
  assert.equal(controller.qualityState().tier, 'low')
  feed(controller, time, 10, 160) // drain + upgrade window: low → medium
  assert.equal(controller.qualityState().tier, 'medium', 'recovery stops at the project cap')
  feed(controller, time, 10, 150) // dpr 1.0 → 1.25
  feed(controller, time, 10, 150) // dpr 1.25 → 1.5
  feed(controller, time, 10, 2000) // cap reached: no further step possible
  assert.equal(controller.qualityState().tier, 'medium', 'never exceeds maxTier')
  assert.equal(controller.qualityState().dpr.value, 1.5)

  controller.setMaxTier('low') // battery-mode clamp
  assert.equal(controller.qualityState().tier, 'low')
  assert.equal(controller.qualityState().dpr.value, 1)
  assert.ok(decisions(controller).includes('max-tier-cap'))
})

test('forcePoster is the failure path: immediate, failure source, recoverable, not persisted', () => {
  const stored = new Map()
  const storage = {
    getItem: (key) => (stored.has(key) ? stored.get(key) : null),
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  }
  const { controller, time } = makeHarness({ storage })
  feed(controller, time, 16.7, 10) // a measured tier was reached and persisted
  feed(controller, time, 40, 50)
  const before = stored.get('wdu.test.quality')

  controller.forcePoster('context lost')
  assert.equal(controller.qualityState().tier, 'poster')
  assert.equal(controller.qualityState().dpr.value, 1)
  assert.equal(controller.snapshot().source, 'failure')
  assert.equal(controller.decisions().at(-1).reason, 'failure-poster')
  assert.equal(controller.decisions().at(-1).note, 'context lost')
  assert.equal(stored.get('wdu.test.quality'), before, 'failure is not persisted')

  feed(controller, time, 40, 200) // poster: nothing further to degrade
  assert.equal(controller.decisions().length, 2)
  feed(controller, time, 10, 300) // recovery is still possible
  assert.equal(controller.qualityState().tier, 'low')
})

test('the decision log stays bounded', () => {
  const { controller } = makeHarness()
  for (let index = 0; index < 40; index += 1) {
    controller.setUserTier(index % 2 === 0 ? 'high' : 'low')
  }
  assert.ok(controller.decisions().length <= 32)
})

// ── Config validation (mechanism invariants) ─────────────────────────────────

test('invalid configs are rejected explicitly', () => {
  const base = () => ({
    now: () => 0,
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
    degradeWindowMs: 500,
    upgradeWindowMs: 1500,
    cooldownMs: 1000,
    thermalWindowMs: 5000,
    thermalFloorTier: 'low',
    dprStep: 0.25,
    dprFloor: 1,
    sampleWindowFrames: 10,
    persistenceKey: 'wdu.test.quality',
  })
  assert.throws(() => createQualityController({ ...base(), now: undefined }), /injected now/)
  assert.throws(
    () => createQualityController({ ...base(), upgradeRatio: 1.3 }),
    /upgradeRatio must be below degradeRatio/,
  )
  assert.throws(
    () => createQualityController({ ...base(), upgradeWindowMs: 400 }),
    /upgradeWindowMs must be greater than degradeWindowMs/,
  )
  assert.throws(
    () =>
      createQualityController({
        ...base(),
        tiers: { ...base().tiers, poster: { maxDpr: 0.5 } },
      }),
    /not be below dprFloor/,
  )
  assert.throws(
    () =>
      createQualityController({
        ...base(),
        tiers: { ...base().tiers, high: { maxDpr: 1.4 } },
      }),
    /non-decreasing/,
  )
  assert.throws(
    () => createQualityController({ ...base(), initialTier: 'ultra' }),
    /must be one of/,
  )
  assert.throws(
    () => createQualityController({ ...base(), initialTier: 'high', maxTier: 'medium' }),
    /initialTier must not exceed maxTier/,
  )
  assert.throws(() => createQualityController({ ...base(), dprFloor: 0.5 }), /at least 1/)
})

// ── Starter project values ───────────────────────────────────────────────────

test('the starter quality config satisfies the 3d-runtime-quality invariants', () => {
  assert.equal(QUALITY_CONFIG.initialTier, 'medium')
  assert.ok(QUALITY_CONFIG.upgradeWindowMs > QUALITY_CONFIG.degradeWindowMs)
  assert.ok(QUALITY_CONFIG.cooldownMs >= QUALITY_CONFIG.upgradeWindowMs)
  assert.ok(QUALITY_CONFIG.upgradeRatio < QUALITY_CONFIG.degradeRatio)
  assert.ok(QUALITY_CONFIG.dprFloor >= 1)
  assert.ok(QUALITY_CONFIG.sampleWindowFrames >= 3)
  const order = TIER_ORDER
  for (let index = 1; index < order.length; index += 1) {
    assert.ok(
      QUALITY_CONFIG.tiers[order[index]].maxDpr >= QUALITY_CONFIG.tiers[order[index - 1]].maxDpr,
    )
  }
  assert.doesNotThrow(() => createQualityController({ ...QUALITY_CONFIG, now: () => 0 }))
})

// ── Copy discipline and distribution boundary ────────────────────────────────

test('the starter copy stays byte-identical to the repository reference', (t) => {
  const reference = join(root, '..', '..', 'references', 'quality-controller.ts')
  if (!existsSync(reference)) {
    t.skip('repository reference not present (standalone starter copy)')
    return
  }
  assert.equal(
    readFileSync(join(root, 'lib', 'quality-controller.ts'), 'utf8'),
    readFileSync(reference, 'utf8'),
    'lib/quality-controller.ts must stay a byte-identical copy of references/quality-controller.ts',
  )
})

test('the reference is a copied file, not an npm package', (t) => {
  const references = join(root, '..', '..', 'references')
  if (!existsSync(references)) {
    t.skip('repository references not present (standalone starter copy)')
    return
  }
  assert.equal(
    existsSync(join(references, 'package.json')),
    false,
    'references/ must never gain a package.json',
  )
  const controllerSource = readFileSync(join(references, 'quality-controller.ts'), 'utf8')
  assert.ok(!/^\s*import\s/m.test(controllerSource), 'the reference imports nothing')
})
