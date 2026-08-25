import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  TELEMETRY_GATE_CLASSES,
  TELEMETRY_SCHEMA_VERSION,
  TELEMETRY_SURFACE_ID,
  validateTelemetryDocument,
} from '../../../references/immersive-telemetry.ts'

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = path.resolve(
  TEST_DIRECTORY,
  '../../../website-design-ultra/skills/3d-runtime-quality/references/telemetry-schema.json',
)

function readFixture(name = 'valid-30fps.json') {
  return JSON.parse(
    fs.readFileSync(path.join(TEST_DIRECTORY, 'fixtures', name), 'utf8'),
  )
}

test('the schema accepts a justified 30fps and 33ms project budget', () => {
  const document = validateTelemetryDocument(readFixture())

  assert.equal(document.schemaVersion, TELEMETRY_SCHEMA_VERSION)
  assert.equal(document.surface, TELEMETRY_SURFACE_ID)
  assert.equal(document.deviceProfile.id, 'mid-range-desktop-chromium-webgl2')
  assert.equal(document.budget.frameTarget.rate.value, 30)
  assert.equal(document.budget.frameTarget.rate.unit, 'fps')
  assert.equal(document.budget.frameTarget.frameTime.value, 33)
  assert.equal(document.budget.frameTarget.frameTime.unit, 'ms')
  assert.equal(document.budget.frameTarget.justification.length > 0, true)
  assert.deepEqual(
    document.budget.gates.map((gate) => gate.class),
    [...TELEMETRY_GATE_CLASSES],
  )
})

test('the schema rejects a measurement without an explicit unit', () => {
  assert.throws(
    () => validateTelemetryDocument(readFixture('invalid-missing-units.json')),
    /frameTarget\.frameTime.*unit/,
  )
})

test('the schema rejects a declaration without a device profile', () => {
  assert.throws(
    () => validateTelemetryDocument(
      readFixture('invalid-missing-device-profile.json'),
    ),
    /deviceProfile.*required|requires deviceProfile/,
  )
})

test('the schema rejects an implicit frame threshold derived from fps', () => {
  assert.throws(
    () => validateTelemetryDocument(
      readFixture('invalid-implicit-frame-threshold.json'),
    ),
    /frameTarget\.frameTime.*explicit|implicit|declare.*frameTime/i,
  )
})

test('the schema rejects a fourth gate class', () => {
  assert.throws(
    () => validateTelemetryDocument(readFixture('invalid-fourth-gate.json')),
    /exactly three gate classes|unknown gate class|three gate/i,
  )
})

test('renderer and context counters are evidence, not gate declarations', () => {
  const document = validateTelemetryDocument(readFixture())

  assert.equal(document.runtime.frame.longFrameCount.unit, 'count')
  assert.equal(document.runtime.renderer.counters.drawCalls.unit, 'count')
  assert.equal(document.runtime.quality.tier, 'medium')
  assert.equal(document.runtime.quality.dpr.unit, 'ratio')
  assert.equal(document.runtime.contextLoss.count.unit, 'count')
  assert.deepEqual(document.runtime.errors, [])
  assert.equal(Object.hasOwn(document.runtime, 'gates'), false)
})

test('the installed schema is versioned and names only the three gate classes', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'))

  assert.equal(schema.$id, 'wdu://immersive-telemetry/v1')
  assert.equal(schema.properties.schemaVersion.const, TELEMETRY_SCHEMA_VERSION)
  assert.equal(schema.properties.surface.const, TELEMETRY_SURFACE_ID)
  assert.equal(schema.$defs.budget.properties.gates.minItems, 3)
  assert.equal(schema.$defs.budget.properties.gates.maxItems, 3)
  assert.deepEqual(
    schema.$defs.gate.properties.class.enum,
    [...TELEMETRY_GATE_CLASSES],
  )
})
