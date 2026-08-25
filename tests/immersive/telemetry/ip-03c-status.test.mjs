import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildPerformanceSummary,
  createTelemetryCollectionScript,
} from '../../../website-design-ultra/scripts/verify-browser.mjs'

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, '../../..')
const VERIFY_BROWSER = path.join(
  REPOSITORY_ROOT,
  'website-design-ultra/scripts/verify-browser.mjs',
)
const baseDocument = JSON.parse(
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
const cases = JSON.parse(
  fs.readFileSync(
    path.join(TEST_DIRECTORY, 'fixtures', 'ip-03c-status-cases.json'),
    'utf8',
  ),
)

const availableCapabilities = cases.pass.capabilities

function completeDocument() {
  const document = structuredClone(baseDocument)
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

function mergePatch(target, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return target
  const output = target && typeof target === 'object' && !Array.isArray(target)
    ? target
    : {}
  for (const [key, value] of Object.entries(patch)) {
    output[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergePatch(output[key], value)
      : structuredClone(value)
  }
  return output
}

function buildCase(caseDefinition) {
  const document = caseDefinition.documentFixture === null
    ? null
    : mergePatch(completeDocument(), caseDefinition.documentPatch)
  return buildPerformanceSummary({
    document,
    capabilities: caseDefinition.capabilities,
    rendererInfo: {
      memory: { geometries: 8, textures: 4 },
      render: { calls: 42, triangles: 120000 },
      programs: ['program-a', 'program-b'],
    },
    transferObservation: {
      observed: { value: 300, unit: 'bytes' },
      markerAt: { value: sampleFixture.meaningfulFrameAtMs, unit: 'ms' },
      resourcesConsidered: 2,
      resourcesIgnoredAfterMarker: 1,
    },
    collection: {
      method: 'offline-fixture',
      warmupFrames: sampleFixture.warmupFrames,
      sampleWindow: sampleFixture.sampleWindow,
    },
  })
}

test('offline IP-03C fixtures distinguish PASS, FAIL, and UNAVAILABLE', () => {
  for (const [name, caseDefinition] of Object.entries(cases)) {
    const summary = buildCase(caseDefinition)
    assert.equal(summary.status, caseDefinition.expectedStatus, name)
    assert.equal(summary.comparison.status === 'PASS' && summary.status === 'PASS', caseDefinition.expectedStatus === 'PASS', name)
    assert.ok(JSON.stringify(summary).length > 0, `${name} must emit a non-empty summary`)

    if (caseDefinition.expectedEvidence) {
      assert.equal(
        summary.failureEvidence.resourceFailures.length,
        caseDefinition.expectedEvidence.resourceFailures,
        `${name} resource failures`,
      )
      assert.equal(
        summary.failureEvidence.shaderCompileErrors.length,
        caseDefinition.expectedEvidence.shaderCompileErrors,
        `${name} shader errors`,
      )
      assert.equal(
        summary.failureEvidence.longFrames.count.value,
        caseDefinition.expectedEvidence.longFrameCount,
        `${name} long frames`,
      )
      assert.equal(
        summary.failureEvidence.contextLoss.count.value,
        caseDefinition.expectedEvidence.contextLossCount,
        `${name} context loss`,
      )
    }

    if (caseDefinition.expectedUnavailable) {
      const capability = summary.capabilities[caseDefinition.expectedUnavailable]
      assert.equal(capability.status, 'UNAVAILABLE', `${name} capability status`)
      assert.match(
        summary.unavailable[caseDefinition.expectedUnavailable],
        /available|missing|absent|unavailable|compatible/i,
        `${name} capability reason`,
      )
      assert.notEqual(summary.status, 'PASS', `${name} cannot pass`)
    }
  }

  const shader = buildCase(cases['fail-shader-compile'])
  assert.equal(shader.failureEvidence.shaderCompileErrors[0].resource, 'material:hero-fresnel')
  const contextLoss = buildCase(cases['fail-context-loss'])
  assert.equal(contextLoss.failureEvidence.contextLoss.events[0].recovered, false)
  const gpu = buildCase(cases['unavailable-gpu'])
  assert.deepEqual(gpu.capabilities.gpu.evidence, {
    webgpu: false,
    webgl2: false,
    webgl: false,
  })
  const surface = buildCase(cases['unavailable-telemetry-surface'])
  assert.equal(surface.capabilities.telemetry.evidence, 'window.__WDU_IMMERSIVE_TELEMETRY__ is absent')
})

test('the browser collection script includes an explicit GPU capability probe', () => {
  const source = createTelemetryCollectionScript()
  assert.match(source, /requestAdapter|webgl2/)
  assert.match(source, /capabilities/)
  assert.match(source, /telemetry surface is not available/)
  assert.match(source, /const telemetryDocument = collectedDocument/)
  assert.doesNotMatch(source, /const document = collectedDocument/)
})

test('an explicitly missing browser CLI cannot fall through to another backend', () => {
  const result = spawnSync(process.execPath, [VERIFY_BROWSER, '--probe'], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      WDU_PLAYWRIGHT_CLI: '/definitely/missing/wdu-playwright-cli',
    },
  })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  assert.equal(result.status, 2)
  assert.match(output, /VERIFY_RUNTIME: UNAVAILABLE/)
  assert.match(output, /browser.?cli|compatible CLI|explicit/i)
})

test('malformed runtime evidence is unavailable even when budget gates pass', () => {
  const document = completeDocument()
  document.runtime.contextLoss.events = null

  const summary = buildPerformanceSummary({
    document,
    capabilities: availableCapabilities,
    rendererInfo: {
      memory: { geometries: 8, textures: 4 },
      render: { calls: 42, triangles: 120000 },
      programs: ['program-a', 'program-b'],
    },
    evidenceSource: 'window.__WDU_IMMERSIVE_TELEMETRY__',
    transferObservation: {
      observed: { value: 300, unit: 'bytes' },
      markerAt: { value: sampleFixture.meaningfulFrameAtMs, unit: 'ms' },
      resourcesConsidered: 2,
      resourcesIgnoredAfterMarker: 1,
    },
    collection: {
      method: 'offline-fixture',
      warmupFrames: sampleFixture.warmupFrames,
      sampleWindow: sampleFixture.sampleWindow,
    },
  })

  assert.equal(summary.status, 'UNAVAILABLE')
  assert.match(summary.unavailable.surface, /invalid telemetry document/i)
})

test('an unavailable browser capture writes a non-empty non-pass summary', () => {
  const outputDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wdu-ip-03c-no-browser-'),
  )
  try {
    const result = spawnSync(
      process.execPath,
      [
        VERIFY_BROWSER,
        '--url',
        'http://127.0.0.1:9/unreachable',
        '--out',
        outputDirectory,
      ],
      {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          WDU_PLAYWRIGHT_CLI: '/definitely/missing/wdu-playwright-cli',
        },
      },
    )
    assert.equal(result.status, 2)
    const summary = JSON.parse(
      fs.readFileSync(path.join(outputDirectory, 'performance-summary.json'), 'utf8'),
    )
    const capture = JSON.parse(
      fs.readFileSync(path.join(outputDirectory, 'capture.json'), 'utf8'),
    )
    assert.equal(summary.status, 'UNAVAILABLE')
    assert.equal(summary.capabilities.browser.status, 'UNAVAILABLE')
    assert.match(summary.unavailable.browser, /compatible|missing|unavailable/i)
    assert.ok(fs.statSync(path.join(outputDirectory, 'performance-summary.json')).size > 0)
    assert.equal(capture.status, 'UNAVAILABLE')
  } finally {
    fs.rmSync(outputDirectory, { force: true, recursive: true })
  }
})
