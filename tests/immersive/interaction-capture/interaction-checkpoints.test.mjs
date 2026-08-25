import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  CHECKPOINT_ID_PATTERN,
  CHECKPOINT_KINDS,
  CHECKPOINT_SCHEMA_VERSION,
  CHECKPOINT_SURFACE_ID,
  CLICK_PHASES,
  HOVER_PHASES,
  checkpointFileName,
  validateCheckpointManifest,
} from '../../../references/interaction-checkpoints.ts'

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, '../../..')
const SCHEMA_PATH = path.resolve(
  REPOSITORY_ROOT,
  'website-design-ultra/skills/core-rules/references/interaction-checkpoints.schema.json',
)
const STARTER_MANIFEST_PATH = path.resolve(
  REPOSITORY_ROOT,
  'starters/next-r3f-cinematic/lib/interaction-checkpoints.json',
)
const VERIFIER_PATH = path.resolve(
  REPOSITORY_ROOT,
  'website-design-ultra/scripts/verify-browser.mjs',
)

function readFixture(name) {
  return JSON.parse(
    readFileSync(path.join(TEST_DIRECTORY, 'fixtures', name), 'utf8'),
  )
}

function readStarterManifest() {
  return JSON.parse(readFileSync(STARTER_MANIFEST_PATH, 'utf8'))
}

test('the starter manifest is a valid checkpoint declaration', () => {
  const manifest = validateCheckpointManifest(readStarterManifest())

  assert.equal(manifest.schemaVersion, CHECKPOINT_SCHEMA_VERSION)
  assert.equal(manifest.surface, CHECKPOINT_SURFACE_ID)
  assert.equal(manifest.project, 'next-r3f-cinematic')
  assert.equal(manifest.modeInput, 'WDU_DETERMINISTIC=1')
  assert.equal(manifest.readyMarker, 'html[data-wdu-ready="true"]')
  assert.ok(manifest.checkpoints.length >= 12)
})

test('hover declares before/during/after and click declares before/peak/recovered', () => {
  const manifest = validateCheckpointManifest(readStarterManifest())

  const hover = manifest.checkpoints.filter((entry) => entry.interaction === 'hover')
  const click = manifest.checkpoints.filter((entry) => entry.interaction === 'click')
  const scroll = manifest.checkpoints.filter((entry) => entry.interaction === 'scroll')
  const states = manifest.checkpoints.filter((entry) =>
    ['loading', 'ready', 'failure'].includes(entry.interaction),
  )

  assert.deepEqual(
    hover.map((entry) => entry.phase),
    [...HOVER_PHASES],
  )
  assert.deepEqual(
    click.map((entry) => entry.phase),
    [...CLICK_PHASES],
  )
  assert.ok(
    scroll.length >= 1 && scroll.every((entry) => entry.progress >= 0 && entry.progress <= 1),
    'scroll uses declared normalized progress in [0, 1]',
  )
  assert.deepEqual(
    states.map((entry) => entry.interaction).sort(),
    ['failure', 'loading', 'ready'],
  )
  const failure = states.find((entry) => entry.interaction === 'failure')
  assert.equal(failure.action, 'lose-webgl-context')
  const loading = states.find((entry) => entry.interaction === 'loading')
  assert.equal(loading.url, '?wdu-loading=1')
})

test('deterministic filenames are derived from checkpoint ids', () => {
  const manifest = validateCheckpointManifest(readStarterManifest())

  for (const entry of manifest.checkpoints) {
    assert.equal(checkpointFileName(entry.id), `${entry.id}.png`)
    assert.match(entry.id, CHECKPOINT_ID_PATTERN)
  }
  assert.throws(() => checkpointFileName('Not-An-Id'), /cannot name a deterministic file/)
})

test('invalid fixtures are rejected with the phase-completeness rules', () => {
  assert.throws(
    () => validateCheckpointManifest(readFixture('invalid-hover-missing-after.json')),
    /hover group fixture-hover must declare exactly the phases before, during, after/,
  )
  assert.throws(
    () => validateCheckpointManifest(readFixture('invalid-click-missing-peak.json')),
    /click group fixture-click must declare exactly the phases before, peak, recovered/,
  )
})

test('invalid fixtures are rejected for id, kind, progress, and mode contract breaks', () => {
  assert.throws(
    () => validateCheckpointManifest(readFixture('invalid-scroll-progress.json')),
    /progress must be a normalized number in \[0, 1\]/,
  )
  assert.throws(
    () => validateCheckpointManifest(readFixture('invalid-duplicate-id.json')),
    /declared more than once/,
  )
  assert.throws(
    () => validateCheckpointManifest(readFixture('invalid-id-pattern.json')),
    /must match/,
  )
  assert.throws(
    () => validateCheckpointManifest(readFixture('invalid-kind.json')),
    /must be one of/,
  )
  assert.throws(
    () => validateCheckpointManifest(readFixture('invalid-mode-input.json')),
    /modeInput must be WDU_DETERMINISTIC=1/,
  )
  assert.throws(
    () => validateCheckpointManifest(readFixture('invalid-unknown-property.json')),
    /unknown property speed/,
  )
  assert.throws(
    () => validateCheckpointManifest(readFixture('invalid-group-target-mismatch.json')),
    /must target one selector across all phases/,
  )
  assert.throws(
    () => validateCheckpointManifest(readFixture('invalid-empty-checkpoints.json')),
    /non-empty array/,
  )
})

test('the installed schema is versioned and matches the reference constants', async () => {
  const { validateCheckpointManifest: verifyValidator } = await import(
    pathToFileURL(VERIFIER_PATH).href
  )

  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
  assert.equal(schema.$id, 'wdu://interaction-checkpoints/v1')
  assert.equal(schema.properties.schemaVersion.const, CHECKPOINT_SCHEMA_VERSION)
  assert.equal(schema.properties.surface.const, CHECKPOINT_SURFACE_ID)
  assert.deepEqual(schema.$defs.hover.properties.phase.enum, [...HOVER_PHASES])
  assert.deepEqual(schema.$defs.click.properties.phase.enum, [...CLICK_PHASES])
  assert.equal(schema.properties.modeInput.const, 'WDU_DETERMINISTIC=1')
  assert.equal(schema.$defs.id.pattern, CHECKPOINT_ID_PATTERN.source)

  // The verifier's embedded validator is bound to the same fixture set.
  assert.ok(verifyValidator(readStarterManifest()))
  for (const name of [
    'invalid-hover-missing-after.json',
    'invalid-click-missing-peak.json',
    'invalid-scroll-progress.json',
    'invalid-duplicate-id.json',
    'invalid-id-pattern.json',
    'invalid-kind.json',
    'invalid-mode-input.json',
    'invalid-unknown-property.json',
    'invalid-group-target-mismatch.json',
    'invalid-empty-checkpoints.json',
  ]) {
    assert.throws(
      () => verifyValidator(readFixture(name)),
      undefined,
      `verifier validator must reject ${name}`,
    )
  }
})

test('no starter checkpoint is hardcoded in the verifier', () => {
  const manifest = validateCheckpointManifest(readStarterManifest())
  const verifierSource = readFileSync(VERIFIER_PATH, 'utf8')

  for (const entry of manifest.checkpoints) {
    assert.ok(
      !verifierSource.includes(entry.id),
      `verifier must not hardcode checkpoint id ${entry.id}`,
    )
    assert.ok(
      !verifierSource.includes(entry.target ?? '__NO_TARGET__'),
      `verifier must not hardcode the target selector of ${entry.id}`,
    )
  }
  assert.ok(
    !verifierSource.includes('hero-hover') && !verifierSource.includes('hero-click'),
    'the verifier must not name a concrete interaction group',
  )
})
