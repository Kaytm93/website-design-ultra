import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createClock,
  createRandomStreams,
  createStableFrameMarker,
  getCameraStation,
} from '../../references/determinism-runtime.ts'

test('the same fixed clock and seed reproduce one runtime sequence', () => {
  const run = () => {
    const clock = createClock({
      mode: 'deterministic',
      stepSeconds: 1 / 60,
    })
    const particles = createRandomStreams('capture-seed').stream('particles')

    return Array.from({ length: 5 }, () => {
      clock.tick()
      return {
        elapsed: clock.elapsed,
        frame: clock.frame,
        random: particles.next(),
      }
    })
  }

  assert.deepEqual(run(), run())
})

test('an unrelated named stream cannot perturb another subsystem', () => {
  const baselineStreams = createRandomStreams('isolated-seed')
  const baseline = baselineStreams.stream('product-scatter')
  const baselineSequence = Array.from({ length: 5 }, () => baseline.next())

  const expandedStreams = createRandomStreams('isolated-seed')
  expandedStreams.stream('background-dust')
  const afterAddition = expandedStreams.stream('product-scatter')
  const sequenceAfterAddition = Array.from({ length: 5 }, () =>
    afterAddition.next(),
  )

  assert.deepEqual(sequenceAfterAddition, baselineSequence)
})

test('stream metadata is a sorted unique list of stable subsystem names', () => {
  const streams = createRandomStreams('metadata-seed')
  streams.stream('scatter')
  streams.stream('particles')
  streams.stream('scatter')

  assert.deepEqual(streams.names(), ['particles', 'scatter'])
})

test('a stochastic stream cannot be unnamed', () => {
  const streams = createRandomStreams('metadata-seed')

  assert.throws(() => streams.stream('   '), /stream name must be non-empty/)
  assert.deepEqual(streams.names(), [])
})

test('live mode reads its wall clock and clamps a stalled frame', () => {
  const samples = [1_000, 1_016, 2_016]
  const clock = createClock({
    mode: 'live',
    now: () => {
      const sample = samples.shift()
      assert.notEqual(sample, undefined)
      return sample
    },
    targetStepSeconds: 1 / 60,
    maxStepSeconds: 1 / 20,
  })

  clock.tick()
  assert.equal(clock.delta, 0.016)
  assert.equal(clock.frame, 1)

  clock.tick()
  assert.equal(clock.delta, 0.05)
  assert.equal(clock.elapsed, 0.066)
  assert.equal(samples.length, 0)
})

test('live clock resume excludes time spent paused', () => {
  const samples = [1_000, 1_016, 5_016, 5_032]
  const clock = createClock({
    mode: 'live',
    now: () => {
      const sample = samples.shift()
      assert.notEqual(sample, undefined)
      return sample
    },
  })

  clock.tick()
  clock.pause()
  clock.tick()
  assert.equal(clock.frame, 1)
  assert.equal(clock.elapsed, 0.016)

  clock.resume()
  clock.tick()
  assert.equal(clock.frame, 2)
  assert.equal(clock.delta, 0.016)
  assert.equal(clock.elapsed, 0.032)
  assert.equal(samples.length, 0)
})

test('an unknown camera station id fails with available ids', () => {
  const stations = {
    'hero-wide': {
      position: [0, 1.2, 4.8],
      target: [0, 0.8, 0],
      projection: 'perspective',
      fov: 35,
      sceneState: 'hero',
    },
  }

  assert.throws(
    () => getCameraStation(stations, 'missing-shot'),
    /Unknown camera station "missing-shot"\. Available stations: hero-wide/,
  )
})

test('the ready marker is set only after a qualified stable frame renders', () => {
  const attributes = new Map([['data-wdu-ready', 'stale']])
  const root = {
    setAttribute(name, value) {
      attributes.set(name, value)
    },
    removeAttribute(name) {
      attributes.delete(name)
    },
  }
  const marker = createStableFrameMarker({ target: root, stableFrame: 2 })
  const qualified = {
    assetsReady: true,
    cameraStationApplied: true,
    streamsInitialized: true,
  }

  assert.equal(attributes.has('data-wdu-ready'), false)
  assert.equal(
    marker.afterVisibleRender({
      ...qualified,
      streamsInitialized: false,
      frame: 2,
    }),
    false,
  )
  assert.equal(marker.afterVisibleRender({ ...qualified, frame: 1 }), false)
  assert.equal(marker.afterVisibleRender({ ...qualified, frame: 2 }), true)
  assert.equal(attributes.get('data-wdu-ready'), 'true')

  marker.invalidate()
  assert.equal(marker.ready, false)
  assert.equal(attributes.has('data-wdu-ready'), false)
})
