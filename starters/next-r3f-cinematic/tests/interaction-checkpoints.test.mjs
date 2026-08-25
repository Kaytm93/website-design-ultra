import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  AUDIO_STATES,
  CHECKPOINT_KINDS,
  CHECKPOINT_SCHEMA_VERSION,
  CLICK_PHASES,
  FOCUS_PHASES,
  HOVER_PHASES,
  KEYBOARD_PHASES,
  TOUCH_PHASES,
  checkpointFileName,
  validateCheckpointManifest,
} from '../lib/interaction-checkpoints.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readManifest() {
  return JSON.parse(readFileSync(join(root, 'lib', 'interaction-checkpoints.json'), 'utf8'))
}

test('the checkpoint manifest is valid and complete (IP-06A acceptance)', () => {
  const manifest = validateCheckpointManifest(readManifest())

  assert.equal(manifest.schemaVersion, CHECKPOINT_SCHEMA_VERSION)
  assert.equal(manifest.modeInput, 'WDU_DETERMINISTIC=1')

  const hover = manifest.checkpoints.filter((entry) => entry.interaction === 'hover')
  const click = manifest.checkpoints.filter((entry) => entry.interaction === 'click')
  assert.deepEqual(
    hover.map((entry) => entry.phase),
    [...HOVER_PHASES],
    'hover must declare before, during, and after',
  )
  assert.deepEqual(
    click.map((entry) => entry.phase),
    [...CLICK_PHASES],
    'click must declare before, peak, and recovered',
  )

  const scroll = manifest.checkpoints.filter((entry) => entry.interaction === 'scroll')
  assert.ok(scroll.length >= 3, 'scroll must declare at least three normalized progress values')
  for (const entry of scroll) {
    assert.ok(entry.progress >= 0 && entry.progress <= 1)
    assert.equal(checkpointFileName(entry.id), `${entry.id}.png`)
  }

  const states = manifest.checkpoints.filter((entry) =>
    ['loading', 'ready', 'failure'].includes(entry.interaction),
  )
  assert.deepEqual(
    states.map((entry) => entry.interaction).sort(),
    ['failure', 'loading', 'ready'],
  )

  const ids = manifest.checkpoints.map((entry) => entry.id)
  assert.equal(new Set(ids).size, ids.length, 'checkpoint ids must be unique')
})

test('focus, keyboard, and touch groups are complete and reach the click outcome (IP-06B)', () => {
  const manifest = validateCheckpointManifest(readManifest())

  const focus = manifest.checkpoints.filter((entry) => entry.interaction === 'focus')
  const keyboard = manifest.checkpoints.filter((entry) => entry.interaction === 'keyboard')
  const touch = manifest.checkpoints.filter((entry) => entry.interaction === 'touch')
  const click = manifest.checkpoints.filter((entry) => entry.interaction === 'click')

  assert.deepEqual(
    focus.map((entry) => entry.phase),
    [...FOCUS_PHASES],
    'focus must declare before, during, and after',
  )
  assert.deepEqual(
    keyboard.map((entry) => entry.phase),
    [...KEYBOARD_PHASES],
    'keyboard must declare before, peak, and recovered',
  )
  assert.deepEqual(
    touch.map((entry) => entry.phase),
    [...TOUCH_PHASES],
    'touch must declare before, peak, and recovered',
  )

  // Keyboard and touch reach the same product outcome as pointer input: all
  // three peak entries wait for the identical declared pressed state, and
  // the recovered entries for the identical idle state.
  const clickPeak = click.find((entry) => entry.phase === 'peak')
  const keyboardPeak = keyboard.find((entry) => entry.phase === 'peak')
  const touchPeak = touch.find((entry) => entry.phase === 'peak')
  assert.ok(clickPeak && keyboardPeak && touchPeak)
  assert.equal(keyboardPeak.waitFor, clickPeak.waitFor)
  assert.equal(touchPeak.waitFor, clickPeak.waitFor)
  assert.equal(keyboardPeak.waitFor, 'html[data-wdu-pointer="pressed"]')

  const clickRecovered = click.find((entry) => entry.phase === 'recovered')
  const keyboardRecovered = keyboard.find((entry) => entry.phase === 'recovered')
  const touchRecovered = touch.find((entry) => entry.phase === 'recovered')
  assert.ok(clickRecovered && keyboardRecovered && touchRecovered)
  assert.equal(keyboardRecovered.waitFor, clickRecovered.waitFor)
  assert.equal(touchRecovered.waitFor, clickRecovered.waitFor)

  // The focus during condition is the target's own focus-visible state.
  const focusDuring = focus.find((entry) => entry.phase === 'during')
  assert.ok(focusDuring)
  assert.equal(focusDuring.waitFor, '[data-wdu-activation-target]:focus-visible')
})

test('a silent deliverable declares no audio checkpoints (IP-06B)', () => {
  const manifest = validateCheckpointManifest(readManifest())
  const audio = manifest.checkpoints.filter((entry) => entry.interaction === 'audio')
  assert.deepEqual(audio, [], 'the starter ships no sound, so no audio checkpoint may exist')
  assert.ok(
    [...AUDIO_STATES].length === 4,
    'the audio state surface is locked/enabled/muted/returning',
  )
})

test('hover and click groups target the declared pointer anchor', () => {
  const manifest = validateCheckpointManifest(readManifest())
  const anchored = manifest.checkpoints.filter(
    (entry) => entry.interaction === 'hover' || entry.interaction === 'click',
  )
  assert.ok(anchored.length > 0)
  for (const entry of anchored) {
    assert.equal(entry.target, '[data-wdu-pointer-target]')
  }
})

test('the loading capture state is a declared project entry point', () => {
  const manifest = validateCheckpointManifest(readManifest())
  const loading = manifest.checkpoints.find((entry) => entry.interaction === 'loading')
  assert.equal(loading.url, '?wdu-loading=1')
  assert.equal(loading.waitFor, '.scene-poster:not([hidden])')
})

test('the copied checkpoint validator stays byte-identical to the repository reference', (t) => {
  const reference = join(root, '..', '..', 'references', 'interaction-checkpoints.ts')
  if (!existsSync(reference)) {
    t.skip('repository reference not present (standalone starter copy)')
    return
  }
  assert.equal(
    readFileSync(join(root, 'lib', 'interaction-checkpoints.ts'), 'utf8'),
    readFileSync(reference, 'utf8'),
    'lib/interaction-checkpoints.ts must stay a byte-identical copy of references/interaction-checkpoints.ts',
  )
})

test('the pointer interaction surface is wired into the scene (IP-06A)', () => {
  const hero = readFileSync(join(root, 'components', 'HeroObject.tsx'), 'utf8')
  assert.ok(hero.includes('onPointerOver'), 'hover state must be wired')
  assert.ok(hero.includes('onPointerDown'), 'press state must be wired')
  assert.ok(hero.includes('onPointerUp'))
  assert.ok(hero.includes('onPointerOut'))
  assert.ok(hero.includes("setAttribute('data-wdu-pointer'"), 'the pointer state must be recorded')
  assert.ok(hero.includes('invalidateCaptureState'), 'capture-state changes must invalidate readiness')
  assert.ok(hero.includes('data-wdu-pointer-x'), 'the projected pointer target must be recorded')

  const runtime = readFileSync(join(root, 'components', 'SceneRuntime.tsx'), 'utf8')
  assert.ok(runtime.includes('invalidateCaptureState'))

  const anchor = readFileSync(join(root, 'components', 'PointerTargetAnchor.tsx'), 'utf8')
  assert.ok(anchor.includes('data-wdu-pointer-target'), 'the DOM capture anchor must exist')

  const client = readFileSync(join(root, 'components', 'SceneClient.tsx'), 'utf8')
  assert.ok(client.includes('PointerTargetAnchor'), 'the anchor must be mounted in the frame')
  assert.ok(client.includes('wdu-loading'), 'the loading capture state must be wired')
  assert.ok(client.includes('loadingHold'))
  assert.ok(client.includes('ActivationControl'), 'the activation surface must be mounted')
  assert.ok(
    client.includes("data-wdu-focus"),
    'focus-visible must be recorded on the document root',
  )

  const activation = readFileSync(join(root, 'components', 'ActivationControl.tsx'), 'utf8')
  assert.ok(activation.includes('data-wdu-activation-target'), 'the activation control must exist')
  assert.ok(activation.includes('wdu:press-start'), 'press start must dispatch')
  assert.ok(activation.includes('wdu:press-end'), 'press end must dispatch')
  assert.ok(activation.includes('onKeyDown'), 'keyboard activation must be wired')
  assert.ok(activation.includes('onPointerDown'), 'touch/pointer activation must be wired')

  assert.ok(
    hero.includes("addEventListener('wdu:press-start'"),
    'the hero must consume the activation bridge',
  )
  assert.ok(
    hero.includes("addEventListener('wdu:press-end'"),
    'the hero must consume the release bridge',
  )

  const config = readFileSync(join(root, 'lib', 'scene-config.ts'), 'utf8')
  for (const marker of [
    'POINTER_HOVER_SCALE',
    'POINTER_PRESSED_SCALE',
    'POINTER_HOVER_EMISSIVE',
    'POINTER_PRESSED_EMISSIVE',
    'POINTER_ANCHOR_LOCAL',
  ]) {
    assert.ok(config.includes(marker), `${marker} must be declared capture metadata`)
  }

  assert.ok(
    [...CHECKPOINT_KINDS].length === 10,
    'the ten interaction kinds are the declared surface',
  )
})
