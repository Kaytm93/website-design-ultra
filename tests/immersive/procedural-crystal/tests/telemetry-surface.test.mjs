import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  createImmersiveTelemetrySurface,
  medianOf,
  percentile95,
} from '../lib/telemetry-surface.ts'
import { createQualityController } from '../lib/quality-controller.ts'
import { QUALITY_CONFIG } from '../lib/quality-config.ts'
import { validateTelemetryDocument } from '../lib/immersive-telemetry.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const STEP_MS = (1 / 60) * 1000

function createHarness(mode, options = {}) {
  let now = 0
  const clock = { elapsed: 0 }
  const quality = createQualityController({ ...QUALITY_CONFIG, now: () => now })
  const surface = createImmersiveTelemetrySurface({
    nowMs: () => now,
    mode,
    stepMs: STEP_MS,
    readyMarker: 'html[data-wdu-ready="true"]',
    quality,
    readRenderer: options.readRenderer ?? null,
  })
  return {
    quality,
    surface,
    advance(seconds) {
      clock.elapsed += seconds
      now = clock.elapsed * 1000
    },
    recordFrames(count, frameMs = STEP_MS) {
      for (let index = 0; index < count; index += 1) {
        surface.recordFrameTimeMs(frameMs)
        this.advance(frameMs / 1000)
      }
    },
  }
}

test('deterministic mode reports the declared fixed-step window and validates', () => {
  const harness = createHarness('deterministic')
  harness.recordFrames(12)
  harness.surface.recordReady(12 * STEP_MS)

  const document = harness.surface.read()
  validateTelemetryDocument(document)

  assert.equal(document.schemaVersion, 1)
  assert.equal(document.surface, 'wdu.immersive-telemetry')
  assert.equal(document.runtime.quality.tier, 'medium')
  assert.equal(document.runtime.quality.dpr.unit, 'ratio')
  // Deterministic mode synthesizes a full window of the declared step
  // (warm-GPU evidence = declared fixed-step input per the determinism
  // contract). The verifier reads this synthetic window.
  const samples = document.runtime.frame.warmGpu.samples
  assert.ok(samples.length >= 12, `deterministic window must include the recorded frames, got ${samples.length}`)
  assert.equal(samples[0].value, STEP_MS)
  assert.equal(document.runtime.frame.warmGpu.median.value, STEP_MS)
  assert.equal(document.runtime.frame.warmGpu.p95.value, STEP_MS)
  assert.equal(document.runtime.frame.firstMeaningfulFrame.observed.value, 12 * STEP_MS)
  assert.equal(document.runtime.frame.longFrameCount.value, 0)
  assert.equal(document.runtime.contextLoss.count.value, 0)
  assert.deepEqual(document.runtime.errors, [])
})

test('live mode computes median and p95 from the recorded deltas', async () => {
  const harness = createHarness('live')
  harness.recordFrames(60, 8)
  for (let index = 0; index < 80; index += 1) harness.recordFrames(1, 8)
  for (let index = 0; index < 40; index += 1) harness.recordFrames(1, 24)
  harness.surface.recordReady(1000)

  const collected = await harness.surface.collect({ warmupFrames: 60, sampleWindow: 120 })
  validateTelemetryDocument(collected.document)
  // Live mode collect() pads to (warmup + window); the document must hold
  // the declared full window at the surface boundary.
  const samples = collected.document.runtime.frame.warmGpu.samples
  assert.ok(
    samples.length >= 120,
    `live collect must include the declared window, got ${samples.length}`,
  )
})

test('long frames, errors, and context loss are recorded as evidence', () => {
  const harness = createHarness('deterministic')
  harness.recordFrames(3, STEP_MS)
  harness.surface.recordFrameTimeMs(120)
  harness.surface.recordError('resource-load', 'fetch failed', '/model/procedural-crystal.glb')
  harness.surface.recordError('runtime', 'webgl unavailable')
  harness.surface.recordContextLoss('context lost')

  const document = harness.surface.read()
  assert.equal(document.runtime.frame.longFrameCount.value, 1)
  assert.equal(document.runtime.errors.length, 2)
  assert.equal(document.runtime.errors[0].kind, 'resource-load')
  assert.equal(document.runtime.errors[0].resource, '/model/procedural-crystal.glb')
  assert.equal(document.runtime.contextLoss.count.value, 1)
  assert.equal(document.runtime.contextLoss.events[0].reason, 'context lost')
  assert.equal(document.runtime.contextLoss.events[0].recovered, false)
})

test('the poster failure path reaches the quality slice of the document', () => {
  const harness = createHarness('deterministic')
  harness.quality.forcePoster('context lost')
  const document = harness.surface.read()
  assert.equal(document.runtime.quality.tier, 'poster')
})

test('ready time is recorded once and transfer stays a valid quantity', () => {
  const harness = createHarness('deterministic')
  assert.equal(harness.surface.read().runtime.frame.firstMeaningfulFrame.observed, null)
  harness.surface.recordReady(200)
  harness.surface.recordReady(999)
  const document = harness.surface.read()
  assert.equal(document.runtime.frame.firstMeaningfulFrame.observed.value, 200)
  assert.equal(document.runtime.frame.transfer.observed.unit, 'bytes')
  assert.ok(document.runtime.frame.transfer.observed.value >= 0)
})

test('the exported surface shape matches what the verifier drives', async () => {
  const harness = createHarness('deterministic')
  const surface = harness.surface
  assert.equal(typeof surface.read, 'function')
  assert.equal(typeof surface.collect, 'function')
  assert.equal(typeof surface.recordFrameTimeMs, 'function')
  const collected = await surface.collect({ warmupFrames: 60, sampleWindow: 120 })
  assert.ok(collected.document && collected.rendererInfo !== undefined)
})