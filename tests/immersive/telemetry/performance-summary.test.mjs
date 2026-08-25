import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildPerformanceSummary,
  calculateMedian,
  calculateP95,
  collectFixedFrameWindow,
  sumTransferBeforeMeaningfulFrame,
} from '../../../website-design-ultra/scripts/verify-browser.mjs'

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  fs.readFileSync(
    path.join(TEST_DIRECTORY, 'fixtures', 'valid-30fps.json'),
    'utf8',
  ),
)
const sampleFixture = JSON.parse(
  fs.readFileSync(
    path.join(TEST_DIRECTORY, 'fixtures', 'performance-samples.json'),
    'utf8',
  ),
)

const availableCapabilities = {
  browser: { status: 'AVAILABLE', backend: 'offline-test' },
  gpu: { status: 'AVAILABLE', renderer: 'webgl2' },
  telemetry: { status: 'AVAILABLE' },
}

function completeDocument() {
  const document = structuredClone(fixture)
  const warmGate = document.budget.gates.find(
    (gate) => gate.class === 'warm-gpu-frame-time',
  )
  warmGate.warmup = { value: sampleFixture.warmupFrames, unit: 'frames' }
  warmGate.sampleWindow = { value: sampleFixture.sampleWindow, unit: 'frames' }
  document.runtime.frame.warmGpu.samples = sampleFixture.samplesMs.map((value) => ({
    value,
    unit: 'ms',
  }))
  document.runtime.frame.warmGpu.median = null
  document.runtime.frame.warmGpu.p95 = null
  document.runtime.frame.firstMeaningfulFrame.observed = {
    value: sampleFixture.meaningfulFrameAtMs,
    unit: 'ms',
  }
  document.runtime.frame.transfer.observed = {
    value: 412000,
    unit: 'bytes',
  }
  return document
}

test('median is deterministic for odd and even fixed windows', () => {
  assert.equal(calculateMedian([16, 18, 17, 19, 21]), 18)
  assert.equal(calculateMedian([10, 20, 30, 40]), 25)
})

test('p95 uses the declared nearest-rank calculation', () => {
  assert.equal(calculateP95([16, 18, 17, 19, 21]), 21)
  assert.equal(calculateP95(Array.from({ length: 20 }, (_, index) => index + 1)), 19)
})

test('the fixed frame window rejects a short sample instead of padding it', () => {
  assert.throws(
    () => collectFixedFrameWindow([16, 18], 3),
    /exactly 3 frame samples.*received 2/,
  )
  assert.deepEqual(collectFixedFrameWindow(sampleFixture.samplesMs, 5), [
    16,
    18,
    17,
    19,
    21,
  ])
})

test('transfer measurement excludes resources that finish after the meaningful frame', () => {
  assert.equal(
    sumTransferBeforeMeaningfulFrame(
      sampleFixture.resourceEntries,
      sampleFixture.meaningfulFrameAtMs,
    ),
    300,
  )
})

test('performance summary recomputes frame statistics and preserves renderer.info evidence', () => {
  const summary = buildPerformanceSummary({
    document: completeDocument(),
    rendererInfo: {
      memory: { geometries: 8, textures: 4 },
      render: { calls: 42, triangles: 120000 },
      programs: ['program-a', 'program-b'],
    },
    capabilities: availableCapabilities,
    evidenceSource: 'window.__WDU_IMMERSIVE_TELEMETRY__',
    transferObservation: {
      observed: { value: 300, unit: 'bytes' },
      markerAt: { value: sampleFixture.meaningfulFrameAtMs, unit: 'ms' },
      resourcesConsidered: 2,
      resourcesIgnoredAfterMarker: 1,
    },
  })

  assert.equal(summary.status, 'PASS')
  assert.equal(summary.comparison.status, 'PASS')
  assert.equal(summary.observed.warmGpuFrameTime.median.value, 18)
  assert.equal(summary.observed.warmGpuFrameTime.p95.value, 21)
  assert.equal(summary.observed.warmGpuFrameTime.collected.value, 5)
  assert.deepEqual(summary.evidence.rendererInfo, {
    memory: { geometries: 8, textures: 4 },
    render: { calls: 42, triangles: 120000 },
    programs: ['program-a', 'program-b'],
  })
  assert.equal(summary.evidence.transfer.resourcesIgnoredAfterMarker, 1)
  assert.equal(Object.hasOwn(summary, 'generatedAt'), false)
  assert.equal(JSON.stringify(summary), JSON.stringify(buildPerformanceSummary({
    document: completeDocument(),
    rendererInfo: {
      memory: { geometries: 8, textures: 4 },
      render: { calls: 42, triangles: 120000 },
      programs: ['program-a', 'program-b'],
    },
    capabilities: availableCapabilities,
    evidenceSource: 'window.__WDU_IMMERSIVE_TELEMETRY__',
    transferObservation: {
      observed: { value: 300, unit: 'bytes' },
      markerAt: { value: sampleFixture.meaningfulFrameAtMs, unit: 'ms' },
      resourcesConsidered: 2,
      resourcesIgnoredAfterMarker: 1,
    },
  })))
})

test('invalid budget units and a missing device profile stay unavailable', () => {
  const invalidUnits = completeDocument()
  invalidUnits.budget.gates[2].target.unit = 'ms'
  const invalidUnitsSummary = buildPerformanceSummary({ document: invalidUnits })
  assert.equal(invalidUnitsSummary.status, 'UNAVAILABLE')
  assert.match(invalidUnitsSummary.unavailable.surface, /invalid telemetry document/i)

  const missingProfile = completeDocument()
  delete missingProfile.deviceProfile
  const missingProfileSummary = buildPerformanceSummary({ document: missingProfile })
  assert.equal(missingProfileSummary.status, 'UNAVAILABLE')
  assert.match(missingProfileSummary.unavailable.surface, /invalid telemetry document/i)
})

test('missing measurements stay explicit and cannot pass the comparison', () => {
  const document = completeDocument()
  document.runtime.frame.firstMeaningfulFrame.observed = null
  document.runtime.frame.transfer.observed = null

  const summary = buildPerformanceSummary({
    document,
    rendererInfo: null,
    capabilities: availableCapabilities,
    evidenceSource: 'window.__WDU_IMMERSIVE_TELEMETRY__',
  })

  assert.equal(summary.status, 'UNAVAILABLE')
  assert.equal(summary.comparison.gates['first-meaningful-frame'].status, 'UNAVAILABLE')
  assert.equal(summary.comparison.gates['transfer-before-first-meaningful-frame'].status, 'UNAVAILABLE')
  assert.deepEqual(summary.observed.firstMeaningfulFrame.observed, {
    value: null,
    unit: 'ms',
  })
  assert.deepEqual(summary.observed.transferBeforeFirstMeaningfulFrame.observed, {
    value: null,
    unit: 'bytes',
  })
  assert.match(summary.unavailable.firstMeaningfulFrame, /not available/i)
  assert.match(summary.unavailable.transferBeforeFirstMeaningfulFrame, /not available/i)
})
