import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  validateTimelineManifest,
  evaluateTimeline,
  createTimelineController,
  timelineCheckpointFileName,
} from '../../../references/cinematic-timeline.ts'
import { validateCheckpointManifest } from '../../../references/interaction-checkpoints.ts'
import { createClock } from '../../../references/determinism-runtime.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function fixture(name) {
  return readJson(join(here, 'fixtures', name))
}

test('valid fixture passes and covers all six kinds without a second clock', () => {
  const m = validateTimelineManifest(fixture('valid-cinematic-timeline.json'))
  assert.equal(m.surface, 'wdu.cinematic-timeline')
  assert.equal(m.clock, 'injected')
  assert.equal(m.modeInput, 'WDU_DETERMINISTIC=1')
  assert.deepEqual(m.range, [0, 1])
  const kinds = new Set(m.tracks.map((t) => t.kind))
  for (const k of ['dom', 'camera', 'scene', 'material', 'sound', 'loading']) {
    assert.ok(kinds.has(k), `missing ${k}`)
  }
  for (const t of m.tracks) assert.equal(t.owner, t.id)
})

test('conflicting-owner fixture is rejected: two writers for one property', () => {
  assert.throws(() => validateTimelineManifest(fixture('conflicting-owner.json')), /Two writers for one property are rejected/)
})

test('portrait-required fixture: requiresPortrait without portrait is rejected', () => {
  assert.throws(() => validateTimelineManifest(fixture('portrait-required.json')), /separate portrait choreography is required/)
  // valid fixture with portrait passes and is genuinely different
  const valid = validateTimelineManifest(fixture('valid-cinematic-timeline.json'))
  assert.ok(valid.portrait)
  const desktop = evaluateTimeline(valid, 0.5)
  const portrait = evaluateTimeline(valid, 0.5, { portrait: true })
  assert.notDeepEqual(desktop, portrait, 'portrait must be genuinely different, not scaled')
})

test('deterministic seek: same progress yields identical evaluation', () => {
  const manifest = validateTimelineManifest(fixture('valid-cinematic-timeline.json'))
  const a = evaluateTimeline(manifest, 0.5)
  const b = evaluateTimeline(manifest, 0.5)
  assert.deepEqual(a, b)
  const clock = createClock({ mode: 'deterministic', stepSeconds: 1 / 60 })
  const controller = createTimelineController(manifest, clock)
  assert.deepEqual(controller.seek(0.5), a)
  clock.tick(); clock.tick()
  assert.deepEqual(controller.seek(0.5), a)
  assert.deepEqual(controller.checkpoint('timeline-50'), a)
})

test('interaction capture by timeline checkpoint id: ids and progress match PR-6 manifest', () => {
  const timeline = validateTimelineManifest(readJson(join(root, 'starters/next-r3f-cinematic/lib/cinematic-timeline.json')))
  const interaction = validateCheckpointManifest(readJson(join(root, 'starters/next-r3f-cinematic/lib/interaction-checkpoints.json')))
  const byId = new Map(interaction.checkpoints.map((c) => [c.id, c]))
  for (const cp of timeline.checkpoints) {
    const entry = byId.get(cp.id)
    assert.ok(entry, `timeline checkpoint ${cp.id} must exist in interaction manifest`)
    assert.equal(entry.progress, cp.progress, `progress mismatch for ${cp.id}`)
    assert.equal(timelineCheckpointFileName(cp.id), `${cp.id}.png`)
  }
  // Deterministic seek by id is pure
  const clock = createClock({ mode: 'deterministic', stepSeconds: 1 / 60 })
  const controller = createTimelineController(timeline, clock)
  for (const cp of timeline.checkpoints) {
    assert.deepEqual(controller.checkpoint(cp.id), controller.seek(cp.progress))
  }
})

test('timeline reference has no second clock', () => {
  const src = readFileSync(join(root, 'references/cinematic-timeline.ts'), 'utf8')
  assert.doesNotMatch(src, /performance\.now/)
  assert.doesNotMatch(src, /Date\.now/)
})
