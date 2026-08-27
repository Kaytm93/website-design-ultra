import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  createClock,
  createRandomStreams,
  createStableFrameMarker,
  getCameraStation,
} from '../lib/determinism-runtime.ts'
import { CAMERA_STATIONS } from '../lib/camera-stations.ts'
import { resolveMode, resolveStationId, resolveMotionPreference } from '../lib/runtime-config.ts'
import {
  medianOf,
  percentile95,
} from '../lib/telemetry-surface.ts'
import { validateBudgetDeclaration } from '../lib/immersive-telemetry.ts'
import { BUDGET_DECLARATION } from '../lib/budget-declaration.ts'
import { DEVICE_PROFILE } from '../lib/device-profile.ts'

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
  const streams = createRandomStreams('procedural-crystal-seed')
  const a = streams.stream('scene-clock')
  const first = a.next()
  streams.stream('later-added')
  const b = streams.stream('scene-clock')
  assert.equal(b.next(), first, 'adding an unrelated stream must not perturb this one')
  assert.deepEqual(streams.names().sort(), ['later-added', 'scene-clock'])
})

test('an unknown station id fails explicitly with the available ids', () => {
  assert.throws(
    () => getCameraStation(CAMERA_STATIONS, 'missing-shot'),
    /Unknown camera station "missing-shot"/,
  )
})

test('the ready marker gates on the stable frame and all declared state', () => {
  const attributes = new Map()
  const target = {
    setAttribute(name, value) { attributes.set(name, value) },
    removeAttribute(name) { attributes.delete(name) },
  }
  const marker = createStableFrameMarker({ target, stableFrame: 2 })
  const qualified = { assetsReady: true, cameraStationApplied: true, streamsInitialized: true }

  assert.equal(marker.ready, false)
  assert.equal(marker.afterVisibleRender({ ...qualified, frame: 1 }), false)
  assert.equal(marker.afterVisibleRender({ ...qualified, cameraStationApplied: false, frame: 2 }), false)
  assert.equal(marker.afterVisibleRender({ ...qualified, assetsReady: false, frame: 2 }), false, 'readiness must gate on assets')
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
  assert.equal(resolveStationId(undefined), 'crystal-wide')
  assert.equal(resolveStationId('  crystal-portrait  '), 'crystal-portrait')
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
  assert.equal(DEVICE_PROFILE.network, 'offline', 'the fixture declares an offline load')
  assert.equal(DEVICE_PROFILE.renderer, 'webgl2')
})

test('percentile95 and medianOf follow the shared nearest-rank rule', () => {
  assert.equal(percentile95([1, 2, 3, 4]), 4)
  assert.equal(percentile95([1, 2, 3, 4, 5]), 5)
  assert.equal(percentile95([1, 1, 1, 9, 9]), 9)
  assert.equal(medianOf([3, 1, 2]), 2)
  assert.equal(medianOf([4, 1, 3, 2]), 2.5)
  assert.equal(medianOf([]), null)
})

test('the optimized GLB is a real Draco-compressed file and a sane size', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'lib', 'asset-manifest.json'), 'utf8'))
  const model = manifest.assets.find((asset) => asset.id === 'crystal-model')
  const glbPath = join(root, 'public', model.url.replace(/^\//, ''))
  assert.ok(existsSync(glbPath))
  const bytes = statSync(glbPath).size
  assert.ok(bytes > 1000, `optimized GLB should be > 1 KB, got ${bytes}`)
  assert.ok(bytes < 50000, `optimized GLB should be < 50 KB, got ${bytes}`)
})

test('the committed summary reports decoded stats below the declared budgets', () => {
  const summary = JSON.parse(readFileSync(join(root, 'reports', 'model', 'summary.json'), 'utf8'))
  const optimized = summary.optimized
  assert.ok(optimized.triangles < 500_000, 'optimized triangles must stay under desktop budget')
  assert.ok(optimized.triangles < 150_000, 'optimized triangles must stay under mobile budget')
  assert.ok(optimized.materials >= 1 && optimized.materials <= 100, 'optimized material count must stay within draw-call budget')
})