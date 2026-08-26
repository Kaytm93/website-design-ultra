import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  createClock,
  createRandomStreams,
  createStableFrameMarker,
  getCameraStation,
} from '../lib/determinism-runtime.ts'
import { resolveMode, resolveStationId } from '../lib/runtime-config.ts'
import { resolveMotionPreference } from '../lib/motion-preference.ts'
import { validateBudgetDeclaration } from '../lib/immersive-telemetry.ts'
import { BUDGET_DECLARATION } from '../lib/budget-declaration.ts'
import { DEVICE_PROFILE } from '../lib/device-profile.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPOSITORY_REFERENCES = join(root, '..', '..', '..', 'references')

test('deterministic mode advances the declared fixed step per frame', () => {
  const clock = createClock({ mode: 'deterministic', stepSeconds: 1 / 60 })
  clock.tick()
  clock.tick()
  clock.tick()
  assert.equal(clock.frame, 3)
  assert.equal(clock.elapsed, 3 / 60)
  assert.equal(clock.delta, 1 / 60)
})

test('named streams are isolated and recorded in sorted order', () => {
  const streams = createRandomStreams('product-hero-seed')
  const a = streams.stream('product-motion')
  const first = a.next()
  streams.stream('later-added')
  const b = streams.stream('product-motion')
  assert.equal(b.next(), first, 'adding an unrelated stream must not perturb this one')
  assert.deepEqual(streams.names(), ['later-added', 'product-motion'])
})

test('an unknown station id fails explicitly with the available ids', () => {
  assert.throws(
    () => getCameraStation({ 'hero-wide': null }, 'missing-shot'),
    /Unknown camera station "missing-shot"/,
  )
})

test('the ready marker gates on the stable frame and all declared state', () => {
  const attributes = new Map()
  const target = {
    setAttribute(name, value) {
      attributes.set(name, value)
    },
    removeAttribute(name) {
      attributes.delete(name)
    },
  }
  const marker = createStableFrameMarker({ target, stableFrame: 2 })
  const qualified = {
    assetsReady: true,
    cameraStationApplied: true,
    streamsInitialized: true,
  }

  assert.equal(marker.ready, false)
  assert.equal(marker.afterVisibleRender({ ...qualified, frame: 1 }), false)
  assert.equal(
    marker.afterVisibleRender({ ...qualified, cameraStationApplied: false, frame: 2 }),
    false,
  )
  assert.equal(
    marker.afterVisibleRender({ ...qualified, assetsReady: false, frame: 2 }),
    false,
    'readiness must gate on model asset readiness',
  )
  assert.equal(marker.afterVisibleRender({ ...qualified, frame: 2 }), true)
  assert.equal(attributes.get('data-wdu-ready'), 'true')

  marker.invalidate()
  assert.equal(marker.ready, false)
  assert.equal(attributes.has('data-wdu-ready'), false)
})

test('runtime mode resolution follows the WDU_DETERMINISTIC contract', () => {
  assert.equal(resolveMode('1'), 'deterministic')
  assert.equal(resolveMode(undefined), 'live')
  assert.equal(resolveMode('0'), 'live')
  assert.equal(resolveMode('yes'), 'live')
  assert.equal(resolveStationId(undefined), 'hero-wide')
  assert.equal(resolveStationId('  hero-portrait  '), 'hero-portrait')
  assert.equal(resolveMotionPreference('1'), 'reduced')
  assert.equal(resolveMotionPreference(undefined), 'full')
  assert.equal(resolveMotionPreference('0'), 'full')
})

test('the declared budget and profile validate against the shared schema', () => {
  const budget = validateBudgetDeclaration(BUDGET_DECLARATION)
  assert.equal(budget.gates.length, 3)
  assert.deepEqual(
    budget.gates.map((gate) => gate.class).sort(),
    [
      'first-meaningful-frame',
      'transfer-before-first-meaningful-frame',
      'warm-gpu-frame-time',
    ],
  )
  assert.equal(budget.frameTarget.frameTime.unit, 'ms')
  assert.ok(DEVICE_PROFILE.network === 'offline', 'the fixture declares an offline load')
  assert.ok(DEVICE_PROFILE.renderer === 'webgl2')
})

test('the copied runtime stays byte-identical to the repository reference', (t) => {
  const reference = join(REPOSITORY_REFERENCES, 'determinism-runtime.ts')
  if (!existsSync(reference)) {
    t.skip('repository reference not present (standalone fixture copy)')
    return
  }
  assert.equal(
    readFileSync(join(root, 'lib', 'determinism-runtime.ts'), 'utf8'),
    readFileSync(reference, 'utf8'),
    'lib/determinism-runtime.ts must stay a byte-identical copy of references/determinism-runtime.ts',
  )
})

test('the copied quality controller stays byte-identical to the repository reference', (t) => {
  const reference = join(REPOSITORY_REFERENCES, 'quality-controller.ts')
  if (!existsSync(reference)) {
    t.skip('repository reference not present (standalone fixture copy)')
    return
  }
  assert.equal(
    readFileSync(join(root, 'lib', 'quality-controller.ts'), 'utf8'),
    readFileSync(reference, 'utf8'),
    'lib/quality-controller.ts must stay a byte-identical copy of references/quality-controller.ts',
  )
})

test('the copied telemetry schema stays byte-identical to the repository reference', (t) => {
  const reference = join(REPOSITORY_REFERENCES, 'immersive-telemetry.ts')
  if (!existsSync(reference)) {
    t.skip('repository reference not present (standalone fixture copy)')
    return
  }
  assert.equal(
    readFileSync(join(root, 'lib', 'immersive-telemetry.ts'), 'utf8'),
    readFileSync(reference, 'utf8'),
    'lib/immersive-telemetry.ts must stay a byte-identical copy of references/immersive-telemetry.ts',
  )
})
