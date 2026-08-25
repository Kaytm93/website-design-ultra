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

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

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
  const streams = createRandomStreams('starter-seed')
  const a = streams.stream('hero-motion')
  const first = a.next()
  streams.stream('later-added')
  const b = streams.stream('hero-motion')
  assert.equal(b.next(), first, 'adding an unrelated stream must not perturb this one')
  assert.deepEqual(streams.names(), ['hero-motion', 'later-added'])
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
  assert.equal(resolveStationId('  hero-detail  '), 'hero-detail')
})

test('the copied runtime stays byte-identical to the repository reference', (t) => {
  const reference = join(root, '..', '..', 'references', 'determinism-runtime.ts')
  if (!existsSync(reference)) {
    t.skip('repository reference not present (standalone starter copy)')
    return
  }
  assert.equal(
    readFileSync(join(root, 'lib', 'determinism-runtime.ts'), 'utf8'),
    readFileSync(reference, 'utf8'),
    'lib/determinism-runtime.ts must stay a byte-identical copy of references/determinism-runtime.ts',
  )
})
