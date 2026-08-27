import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  validateTimelineManifest,
  evaluateTimeline,
  createTimelineController,
  timelineCheckpointFileName,
  CINEMATIC_TIMELINE_SCHEMA_VERSION,
  CINEMATIC_TIMELINE_SURFACE_ID,
  TIMELINE_TRACK_KINDS,
} from '../../references/cinematic-timeline.ts'
import { createClock } from '../../references/determinism-runtime.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function read(p: string): string {
  return readFileSync(p, 'utf8')
}

function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    surface: 'wdu.cinematic-timeline',
    project: 'test-timeline',
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
    checkpoints: [
      { id: 'timeline-0', progress: 0 },
      { id: 'timeline-50', progress: 0.5 },
      { id: 'timeline-100', progress: 1 },
    ],
    ...overrides,
  }
}

// ── Schema basics ────────────────────────────────────────────────────────────

test('valid manifest passes schema and surface version', () => {
  const m = validateTimelineManifest(validManifest())
  assert.equal(m.schemaVersion, CINEMATIC_TIMELINE_SCHEMA_VERSION)
  assert.equal(m.surface, CINEMATIC_TIMELINE_SURFACE_ID)
  assert.deepEqual(m.range, [0, 1])
  assert.equal(m.clock, 'injected')
  assert.equal(m.modeInput, 'WDU_DETERMINISTIC=1')
})

test('timeline coordinates all six owner kinds without a second clock', () => {
  const m = validateTimelineManifest(validManifest())
  const kinds = new Set(m.tracks.map((t) => t.kind))
  for (const k of TIMELINE_TRACK_KINDS) {
    assert.ok(kinds.has(k), `missing ${k} track`)
  }
  // No wall clock path in the reference
  const src = read(resolve(ROOT, '..', 'references', 'cinematic-timeline.ts'))
  assert.doesNotMatch(src, /performance\.now/)
  assert.doesNotMatch(src, /Date\.now/)
  assert.doesNotMatch(src, /new Date\(\)/)
  assert.doesNotMatch(src, /setInterval|setTimeout.*clock/)
})

test('every track has exactly one owner and duplicate writers are rejected', () => {
  const good = validateTimelineManifest(validManifest())
  assert.equal(good.tracks.length, 6)
  for (const t of good.tracks) {
    assert.equal(t.owner, t.id, `track ${t.id} owner must equal id`)
  }
  // Conflicting-owner fixture: two writers for one property
  assert.throws(
    () =>
      validateTimelineManifest(
        validManifest({
          tracks: [
            { id: 'dom-a', kind: 'dom', property: 'dom.hero.opacity', owner: 'dom-a', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
            { id: 'dom-b', kind: 'dom', property: 'dom.hero.opacity', owner: 'dom-b', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
            { id: 'camera-hero-z', kind: 'camera', property: 'camera.hero.z', owner: 'camera-hero-z', keyframes: [{ progress: 0, value: 6 }, { progress: 1, value: 2 }] },
            { id: 'scene-hero-rotation', kind: 'scene', property: 'scene.hero.rotationY', owner: 'scene-hero-rotation', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
            { id: 'material-hero-emissive', kind: 'material', property: 'material.hero.emissive', owner: 'material-hero-emissive', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
            { id: 'sound-ambient-gain', kind: 'sound', property: 'sound.ambient.gain', owner: 'sound-ambient-gain', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
            { id: 'loading-bucket-progress', kind: 'loading', property: 'loading.bucket.progress', owner: 'loading-bucket-progress', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          ],
        }),
      ),
    /Two writers for one property are rejected/,
  )
  // Owner mismatch fixture
  assert.throws(
    () =>
      validateTimelineManifest(
        validManifest({
          tracks: [
            { id: 'dom-hero-opacity', kind: 'dom', property: 'dom.hero.opacity', owner: 'wrong-owner', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
            { id: 'camera-hero-z', kind: 'camera', property: 'camera.hero.z', owner: 'camera-hero-z', keyframes: [{ progress: 0, value: 6 }, { progress: 1, value: 2 }] },
            { id: 'scene-hero-rotation', kind: 'scene', property: 'scene.hero.rotationY', owner: 'scene-hero-rotation', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
            { id: 'material-hero-emissive', kind: 'material', property: 'material.hero.emissive', owner: 'material-hero-emissive', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
            { id: 'sound-ambient-gain', kind: 'sound', property: 'sound.ambient.gain', owner: 'sound-ambient-gain', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
            { id: 'loading-bucket-progress', kind: 'loading', property: 'loading.bucket.progress', owner: 'loading-bucket-progress', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          ],
        }),
      ),
    /owner must equal the track id/,
  )
})

test('portrait choreography: separate track set required when portrait is declared', () => {
  // Valid portrait manifest
  const withPortrait = validateTimelineManifest(
    validManifest({
      portrait: {
        tracks: [
          { id: 'dom-hero-opacity', kind: 'dom', property: 'dom.hero.opacity', owner: 'dom-hero-opacity', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          { id: 'camera-hero-z-portrait', kind: 'camera', property: 'camera.hero.z', owner: 'camera-hero-z-portrait', keyframes: [{ progress: 0, value: 7 }, { progress: 1, value: 3 }] },
          { id: 'scene-hero-rotation', kind: 'scene', property: 'scene.hero.rotationY', owner: 'scene-hero-rotation', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 0.9 }] },
          { id: 'material-hero-emissive', kind: 'material', property: 'material.hero.emissive', owner: 'material-hero-emissive', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          { id: 'sound-ambient-gain', kind: 'sound', property: 'sound.ambient.gain', owner: 'sound-ambient-gain', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
          { id: 'loading-bucket-progress', kind: 'loading', property: 'loading.bucket.progress', owner: 'loading-bucket-progress', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
        ],
        checkpoints: [
          { id: 'timeline-0', progress: 0 },
          { id: 'timeline-50', progress: 0.5 },
          { id: 'timeline-100', progress: 1 },
        ],
      },
      requiresPortrait: true,
    }),
  )
  assert.ok(withPortrait.portrait, 'portrait present')
  assert.equal(withPortrait.portrait!.tracks.length, 6)

  // portrait-required fixture: requiresPortrait true but no portrait declared
  assert.throws(
    () => validateTimelineManifest(validManifest({ requiresPortrait: true })),
    /separate portrait choreography is required/,
  )
  // portrait declared but empty tracks
  assert.throws(
    () =>
      validateTimelineManifest(
        validManifest({
          portrait: { tracks: [] },
          requiresPortrait: true,
        }),
      ),
    /portrait\.tracks must be a non-empty array/,
  )
  // portrait that omits a required kind (e.g. no sound) must be rejected
  assert.throws(
    () =>
      validateTimelineManifest(
        validManifest({
          portrait: {
            tracks: [
              { id: 'dom-hero-opacity', kind: 'dom', property: 'dom.hero.opacity', owner: 'dom-hero-opacity', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1 }] },
              { id: 'camera-hero-z-portrait', kind: 'camera', property: 'camera.hero.z', owner: 'camera-hero-z-portrait', keyframes: [{ progress: 0, value: 7 }, { progress: 1, value: 3 }] },
              // missing scene/material/sound/loading
            ],
          },
        }),
      ),
    /portrait choreography must declare at least one scene track/,
  )
})

test('checkpoint ids are deterministic filenames and feed PR-6 capture directly', () => {
  const m = validateTimelineManifest(validManifest())
  for (const c of m.checkpoints) {
    assert.equal(timelineCheckpointFileName(c.id), `${c.id}.png`)
    assert.match(c.id, /^[a-z0-9][a-z0-9-]*$/)
  }
  assert.throws(() => timelineCheckpointFileName('Bad-Id'), /cannot name a deterministic file/)
  // Checkpoints must be sorted and include both ends
  assert.throws(
    () =>
      validateTimelineManifest(
        validManifest({
          checkpoints: [
            { id: 'timeline-100', progress: 1 },
            { id: 'timeline-0', progress: 0 },
          ],
        }),
      ),
    /must be sorted by ascending progress/,
  )
  assert.throws(
    () =>
      validateTimelineManifest(
        validManifest({
          checkpoints: [{ id: 'timeline-0', progress: 0 }],
        }),
      ),
    /at least 2 entries/,
  )
})

test('deterministic seek: same progress always yields identical evaluation', () => {
  const manifest = validateTimelineManifest(validManifest())
  const a = evaluateTimeline(manifest, 0.33)
  const b = evaluateTimeline(manifest, 0.33)
  const c = evaluateTimeline(manifest, 0.33)
  assert.deepEqual(a, b)
  assert.deepEqual(b, c)
  // Different progresses diverge
  const d = evaluateTimeline(manifest, 0.75)
  assert.notDeepEqual(a, d)
  // Order of prior seeks does not affect result (pure function)
  evaluateTimeline(manifest, 0.9)
  evaluateTimeline(manifest, 0.1)
  assert.deepEqual(evaluateTimeline(manifest, 0.33), a)
})

test('deterministic seek with injected clock: controller seek is pure and captures by checkpoint id', () => {
  const manifest = validateTimelineManifest(validManifest())
  const clock = createClock({ mode: 'deterministic', stepSeconds: 1 / 60 })
  clock.tick()
  const controller = createTimelineController(manifest, clock)
  const byProgress = controller.seek(0.5)
  const byCheckpoint = controller.checkpoint('timeline-50')
  assert.deepEqual(byProgress, byCheckpoint)
  // Repeated checkpoint seeks are identical regardless of elapsed ticks
  clock.tick()
  clock.tick()
  assert.deepEqual(controller.checkpoint('timeline-50'), byProgress)
  // Unknown checkpoint fails explicitly
  assert.throws(() => controller.checkpoint('missing'), /Unknown timeline checkpoint/)
})

test('timeline uses no second clock — lab experiment and starter component reference the injected clock only', () => {
  const lab = read(resolve(ROOT, 'src/experiments/cinematic-timeline.ts'))
  const starter = read(resolve(ROOT, '..', 'starters/next-r3f-cinematic/components/CinematicTimeline.tsx'))
  const reference = read(resolve(ROOT, '..', 'references/cinematic-timeline.ts'))
  for (const [name, src] of [
    ['lab experiment', lab],
    ['starter component', starter],
    ['reference', reference],
  ] as const) {
    assert.doesNotMatch(src, /performance\.now/, `${name} must not create a second clock`)
    assert.doesNotMatch(src, /Date\.now\(\)/, `${name} must not read wall clock`)
    assert.doesNotMatch(src, /new Date\(\)/, `${name} must not read wall clock`)
  }
  // The reference and experiment evaluate via seek(progress) — progress is the external
  // normalized input, not a second ticker.
  assert.match(reference, /evaluateTimeline\(manifest, progress/)
  assert.match(starter, /evaluateTimeline\(manifest, progressRef\.current/)
  assert.match(lab, /evaluateTimeline\(LAB_MANIFEST, progress/)
})

test('lab and starter manifests stay in sync on checkpoint ids and portrait requirement', () => {
  const starterManifest = validateTimelineManifest(JSON.parse(read(resolve(ROOT, '..', 'starters/next-r3f-cinematic/lib/cinematic-timeline.json'))))
  assert.equal(starterManifest.requiresPortrait, true)
  assert.ok(starterManifest.portrait)
  // Ensure starter checkpoint ids match the interaction manifest for PR-6 direct feed.
  const interaction = JSON.parse(read(resolve(ROOT, '..', 'starters/next-r3f-cinematic/lib/interaction-checkpoints.json')))
  const timelineIds = new Set(starterManifest.checkpoints.map((c) => c.id))
  const interactionIds = new Set(interaction.checkpoints.map((c: { id: string }) => c.id))
  for (const id of timelineIds) {
    assert.ok(interactionIds.has(id), `timeline checkpoint ${id} must feed PR-6 capture directly (present in interaction manifest)`)
  }
})
