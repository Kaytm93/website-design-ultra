import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  validateTimelineManifest,
  evaluateTimeline,
  createTimelineController,
  timelineCheckpointFileName,
} from '../lib/cinematic-timeline.ts'
import { validateCheckpointManifest } from '../lib/interaction-checkpoints.ts'
import { createClock } from '../lib/determinism-runtime.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readJson(file) {
  return JSON.parse(readFileSync(join(root, file), 'utf8'))
}

test('the starter timeline manifest is valid and owns all six kinds without a second clock', () => {
  const manifest = validateTimelineManifest(readJson('lib/cinematic-timeline.json'))
  assert.equal(manifest.project, 'next-r3f-cinematic')
  assert.equal(manifest.modeInput, 'WDU_DETERMINISTIC=1')
  assert.equal(manifest.clock, 'injected')
  const kinds = new Set(manifest.tracks.map((t) => t.kind))
  for (const k of ['dom', 'camera', 'scene', 'material', 'sound', 'loading']) {
    assert.ok(kinds.has(k), `missing ${k} track`)
  }
})

test('the starter timeline is a byte-identical copy of the reference', () => {
  const reference = readFileSync(join(root, '..', '..', 'references', 'cinematic-timeline.ts'), 'utf8')
  const copy = readFileSync(join(root, 'lib', 'cinematic-timeline.ts'), 'utf8')
  assert.equal(copy, reference, 'lib/cinematic-timeline.ts must stay a byte-identical copy of references/cinematic-timeline.ts')
})

test('every track has exactly one owner and two writers for one property are rejected', () => {
  const manifest = validateTimelineManifest(readJson('lib/cinematic-timeline.json'))
  for (const t of manifest.tracks) {
    assert.equal(t.owner, t.id)
  }
  // Conflicting-owner fixture
  assert.throws(
    () =>
      validateTimelineManifest({
        schemaVersion: 1,
        surface: 'wdu.cinematic-timeline',
        project: 'fixture',
        modeInput: 'WDU_DETERMINISTIC=1',
        clock: 'injected',
        range: [0, 1],
        tracks: [
          { id: 'dom-a', kind: 'dom', property: 'dom.hero.opacity', owner: 'dom-a', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          { id: 'dom-b', kind: 'dom', property: 'dom.hero.opacity', owner: 'dom-b', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          { id: 'camera-hero-z', kind: 'camera', property: 'camera.hero.z', owner: 'camera-hero-z', keyframes: [{ progress: 0, value: 6 }, { progress: 1, value: 2 }] },
          { id: 'scene-hero-rotation', kind: 'scene', property: 'scene.hero.rotationY', owner: 'scene-hero-rotation', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          { id: 'material-hero-emissive', kind: 'material', property: 'material.hero.emissive', owner: 'material-hero-emissive', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          { id: 'sound-ambient-gain', kind: 'sound', property: 'sound.ambient.gain', owner: 'sound-ambient-gain', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          { id: 'loading-bucket-progress', kind: 'loading', property: 'loading.bucket.progress', owner: 'loading-bucket-progress', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
        ],
        checkpoints: [{ id: 'timeline-0', progress: 0 }, { id: 'timeline-100', progress: 1 }],
      }),
    /Two writers for one property are rejected/,
  )
})

test('portrait-required fixture: requiresPortrait without portrait is rejected and with portrait passes', () => {
  const manifest = readJson('lib/cinematic-timeline.json')
  assert.equal(manifest.requiresPortrait, true)
  assert.ok(manifest.portrait, 'starter must declare portrait choreography when requiresPortrait is true')
  validateTimelineManifest(manifest)
  // Negative fixture
  assert.throws(
    () =>
      validateTimelineManifest({
        schemaVersion: 1,
        surface: 'wdu.cinematic-timeline',
        project: 'fixture',
        modeInput: 'WDU_DETERMINISTIC=1',
        clock: 'injected',
        range: [0, 1],
        tracks: [
          { id: 'dom-hero-opacity', kind: 'dom', property: 'dom.hero.opacity', owner: 'dom-hero-opacity', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          { id: 'camera-hero-z', kind: 'camera', property: 'camera.hero.z', owner: 'camera-hero-z', keyframes: [{ progress: 0, value: 6 }, { progress: 1, value: 2 }] },
          { id: 'scene-hero-rotation', kind: 'scene', property: 'scene.hero.rotationY', owner: 'scene-hero-rotation', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          { id: 'material-hero-emissive', kind: 'material', property: 'material.hero.emissive', owner: 'material-hero-emissive', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          { id: 'sound-ambient-gain', kind: 'sound', property: 'sound.ambient.gain', owner: 'sound-ambient-gain', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          { id: 'loading-bucket-progress', kind: 'loading', property: 'loading.bucket.progress', owner: 'loading-bucket-progress', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
        ],
        checkpoints: [{ id: 'timeline-0', progress: 0 }, { id: 'timeline-100', progress: 1 }],
        requiresPortrait: true,
      }),
    /separate portrait choreography is required/,
  )
})

test('deterministic seek tests: same progress yields identical evaluation across controller and pure function', () => {
  const manifest = validateTimelineManifest(readJson('lib/cinematic-timeline.json'))
  const pureA = evaluateTimeline(manifest, 0.5)
  const pureB = evaluateTimeline(manifest, 0.5)
  assert.deepEqual(pureA, pureB)
  const clock = createClock({ mode: 'deterministic', stepSeconds: 1 / 60 })
  const controller = createTimelineController(manifest, clock)
  // Controller seek must match pure seek
  assert.deepEqual(controller.seek(0), evaluateTimeline(manifest, 0))
  assert.deepEqual(controller.seek(0.5), pureA)
  assert.deepEqual(controller.seek(1), evaluateTimeline(manifest, 1))
  // Portrait seek is deterministic and distinct from desktop at same progress
  const desktop = evaluateTimeline(manifest, 0.5)
  const portrait = evaluateTimeline(manifest, 0.5, { portrait: true })
  assert.notDeepEqual(desktop, portrait, 'portrait choreography must be a distinct reframe, not a copy')
})

test('interaction capture by timeline checkpoint id: declared checkpoint ids feed PR-6 capture directly', () => {
  const timeline = validateTimelineManifest(readJson('lib/cinematic-timeline.json'))
  const interaction = validateCheckpointManifest(readJson('lib/interaction-checkpoints.json'))
  const interactionIds = new Set(interaction.checkpoints.map((c) => c.id))
  for (const cp of timeline.checkpoints) {
    assert.ok(interactionIds.has(cp.id), `timeline checkpoint ${cp.id} must be a capture checkpoint in interaction manifest`)
    assert.equal(timelineCheckpointFileName(cp.id), `${cp.id}.png`)
    // The verifier's deterministic filename contract must match the timeline's
    const entry = interaction.checkpoints.find((c) => c.id === cp.id)
    assert.ok(entry, `interaction checkpoint ${cp.id} missing`)
    // Scroll checkpoints carry progress that equals the timeline progress
    assert.equal(entry.progress, cp.progress)
  }
  // Checkpoint capture via controller
  const clock = createClock({ mode: 'deterministic', stepSeconds: 1 / 60 })
  const controller = createTimelineController(timeline, clock)
  for (const cp of timeline.checkpoints) {
    const bySeek = controller.seek(cp.progress)
    const byCheckpoint = controller.checkpoint(cp.id)
    assert.deepEqual(byCheckpoint, bySeek, `checkpoint ${cp.id} seek must equal progress seek`)
  }
})

test('the cinematic timeline component is mounted in the starter and uses only the injected clock', () => {
  const canvas = readFileSync(join(root, 'components/SceneCanvas.tsx'), 'utf8')
  const component = readFileSync(join(root, 'components/CinematicTimeline.tsx'), 'utf8')
  const reference = readFileSync(join(root, '..', '..', 'references/cinematic-timeline.ts'), 'utf8')
  assert.ok(canvas.includes('CinematicTimeline'), 'SceneCanvas must mount CinematicTimeline')
  assert.ok(component.includes('evaluateTimeline'), 'component must evaluate the timeline')
  assert.ok(component.includes('data-wdu-timeline'), 'component must expose checkpoint capture metadata')
  assert.ok(!/performance\.now/.test(component), 'component must not start a second clock')
  assert.ok(!/Date\.now/.test(component), 'component must not read wall clock')
  assert.ok(!/performance\.now/.test(reference), 'reference must not start a second clock')
})
