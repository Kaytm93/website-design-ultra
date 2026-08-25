import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  CHECKPOINT_KINDS,
  CHECKPOINT_SCHEMA_VERSION,
  CLICK_PHASES,
  HOVER_PHASES,
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
    [...CHECKPOINT_KINDS].length === 6,
    'the six interaction kinds are the declared surface',
  )
})
