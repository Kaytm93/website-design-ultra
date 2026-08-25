import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  AUDIO_STATES,
  CHECKPOINT_KINDS,
  FOCUS_PHASES,
  KEYBOARD_PHASES,
  TOUCH_PHASES,
  validateCheckpointManifest,
} from '../../../references/interaction-checkpoints.ts'

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, '../../..')
const VERIFIER_PATH = path.resolve(
  REPOSITORY_ROOT,
  'website-design-ultra/scripts/verify-browser.mjs',
)
const STARTER_MANIFEST_PATH = path.resolve(
  REPOSITORY_ROOT,
  'starters/next-r3f-cinematic/lib/interaction-checkpoints.json',
)
const SOUND_FIXTURE_DIRECTORY = path.join(TEST_DIRECTORY, 'fixtures', 'sound-present')
const SOUND_MANIFEST_PATH = path.join(SOUND_FIXTURE_DIRECTORY, 'manifest.json')

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

test('IP-06B adds exactly the four input and audio kinds to the surface', () => {
  assert.deepEqual(
    [...CHECKPOINT_KINDS],
    [
      'hover',
      'click',
      'scroll',
      'loading',
      'ready',
      'failure',
      'focus',
      'keyboard',
      'touch',
      'audio',
    ],
  )
  assert.deepEqual([...FOCUS_PHASES], ['before', 'during', 'after'])
  assert.deepEqual([...KEYBOARD_PHASES], ['before', 'peak', 'recovered'])
  assert.deepEqual([...TOUCH_PHASES], ['before', 'peak', 'recovered'])
  assert.deepEqual([...AUDIO_STATES], ['locked', 'enabled', 'muted', 'returning'])
})

test('the sound-present fixture declares the full audio arc and validates', () => {
  const manifest = validateCheckpointManifest(readJson(SOUND_MANIFEST_PATH))
  const audio = manifest.checkpoints.filter((entry) => entry.interaction === 'audio')
  assert.deepEqual(
    audio.map((entry) => entry.state),
    ['locked', 'enabled', 'muted', 'returning'],
  )

  const enabled = audio.find((entry) => entry.state === 'enabled')
  assert.equal(enabled.unlock, '[data-wdu-audio-unlock]')
  assert.equal(enabled.voiceLimit, 4)
  assert.equal(enabled.trigger, '[data-wdu-audio-trigger]')
  assert.equal(enabled.repeats, 8)

  const muted = audio.find((entry) => entry.state === 'muted')
  assert.equal(muted.target, '[data-wdu-audio-mute]')
  assert.equal(muted.persist, 'wdu:audio')

  const returning = audio.find((entry) => entry.state === 'returning')
  assert.equal(returning.target, '[data-wdu-audio-mute]')
  assert.equal(returning.persist, 'wdu:audio')

  const ready = manifest.checkpoints.find((entry) => entry.interaction === 'ready')
  assert.ok(ready)
  for (const entry of manifest.checkpoints) {
    assert.equal(
      entry.url,
      '?wdu-deterministic=1',
      'every sound-fixture entry declares the capture entry point',
    )
  }
})

test('the silent starter manifest and the sound fixture cover both suite sides', () => {
  const silent = validateCheckpointManifest(readJson(STARTER_MANIFEST_PATH))
  const sound = validateCheckpointManifest(readJson(SOUND_MANIFEST_PATH))

  const silentAudio = silent.checkpoints.filter((entry) => entry.interaction === 'audio')
  const soundAudio = sound.checkpoints.filter((entry) => entry.interaction === 'audio')
  assert.deepEqual(silentAudio, [], 'sound absent: no audio checkpoint is declared')
  assert.ok(soundAudio.length >= 4, 'sound present: the audio states are declared')
})

test('the verifier implements generic input drivers and never hardcodes a fixture', () => {
  const source = readFileSync(VERIFIER_PATH, 'utf8')

  // Generic driver surfaces, keyed only by the manifest's selectors.
  for (const marker of [
    'focusTargetSnippet',
    'blurTargetSnippet',
    'keyDownSnippet',
    'keyUpSnippet',
    'touchStartSnippet',
    'touchEndSnippet',
    'audioUnlockSnippet',
    'audioPressTargetSnippet',
    'audioStorageEvidenceSnippet',
    'audioVoiceBurstSnippet',
    'audioReturningSnippet',
    'audioStateEvidenceSnippet',
  ]) {
    assert.ok(source.includes(marker), `the verifier must implement ${marker}`)
  }

  // The drivers are input-generic: they must not name a concrete fixture
  // selector, state value, or checkpoint id.
  for (const concrete of [
    'wdu:audio',
    'data-wdu-audio-unlock',
    'data-wdu-audio-mute',
    'data-wdu-audio-trigger',
    'audio-locked',
    'audio-enabled',
    'audio-muted',
    'audio-returning',
    'fixture-ready',
    'hero-keyboard',
    'hero-touch',
    'hero-focus',
    'data-wdu-activation-target',
  ]) {
    assert.ok(
      !source.includes(concrete),
      `the verifier must not hardcode the fixture surface ${concrete}`,
    )
  }

  // Audio runs only through the manifest loop: the driver branch is inside
  // the per-entry dispatch and there is no standalone audio invocation.
  const branchStart = source.indexOf("entry.interaction === 'audio'")
  const captureCall = source.indexOf("invoke(session, 'screenshot'")
  assert.ok(branchStart > 0 && captureCall > branchStart)
})

test('the sound fixture runtime records the declared audio evidence surface', () => {
  const runtime = readFileSync(path.join(SOUND_FIXTURE_DIRECTORY, 'audio-runtime.js'), 'utf8')
  for (const marker of [
    "data-wdu-audio",
    "data-wdu-audio-context",
    "data-wdu-audio-restored",
    "data-wdu-voices",
    "data-wdu-voice-attempts",
    "data-wdu-voice-clamped",
    'wdu:audio',
    'AudioContext',
  ]) {
    assert.ok(runtime.includes(marker), `the fixture runtime must record ${marker}`)
  }
  // Nothing plays before the unlock gesture: the trigger is gated on the
  // enabled state.
  assert.ok(runtime.includes("audioState !== 'enabled'"))
})
