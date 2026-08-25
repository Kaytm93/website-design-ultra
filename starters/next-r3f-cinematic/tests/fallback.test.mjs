import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { CAMERA_STATIONS } from '../lib/camera-stations.ts'
import { getCameraStation } from '../lib/determinism-runtime.ts'
import {
  MOTION_STORAGE_KEY,
  readStoredMotionPreference,
  resolveMotionPreference,
  writeStoredMotionPreference,
} from '../lib/motion-preference.ts'
import { HERO_ROTATION_SPEED, heroRotationY } from '../lib/scene-config.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('WDU_REDUCED_MOTION=1 is the only value that selects reduced motion', () => {
  assert.equal(resolveMotionPreference('1'), 'reduced')
  assert.equal(resolveMotionPreference(undefined), 'full')
  assert.equal(resolveMotionPreference('0'), 'full')
  assert.equal(resolveMotionPreference('yes'), 'full')
})

test('the stored motion choice is preserved and corrupt values are ignored', () => {
  const stored = new Map()
  const storage = {
    getItem: (key) => (stored.has(key) ? stored.get(key) : null),
    setItem: (key, value) => stored.set(key, value),
  }
  assert.equal(readStoredMotionPreference(storage), null)
  writeStoredMotionPreference(storage, 'reduced')
  assert.equal(readStoredMotionPreference(storage), 'reduced')
  assert.equal(stored.get(MOTION_STORAGE_KEY), 'reduced')

  assert.equal(readStoredMotionPreference({ getItem: () => 'smooth' }), null)
  assert.equal(readStoredMotionPreference(null), null)
  assert.doesNotThrow(() => writeStoredMotionPreference(null, 'full'))
})

test('reduced motion holds the static pose; full motion advances from the clock', () => {
  const phase = 1.25
  assert.equal(HERO_ROTATION_SPEED, 0.4)
  assert.equal(heroRotationY(phase, 0, 'reduced'), phase)
  assert.equal(heroRotationY(phase, 2.5, 'reduced'), phase, 'elapsed never moves a reduced pose')
  assert.equal(heroRotationY(phase, 2.5, 'full'), phase + 2.5 * HERO_ROTATION_SPEED)
  assert.equal(heroRotationY(phase, 0, 'full'), phase)
})

test('the portrait camera station exists and is a valid hero station', () => {
  const station = getCameraStation(CAMERA_STATIONS, 'hero-portrait')
  assert.equal(station.sceneState, 'hero')
  assert.equal(station.projection, 'perspective')
  assert.ok(station.fov > 0)
  assert.equal(getCameraStation(CAMERA_STATIONS, 'hero-wide').sceneState, 'hero')
  assert.deepEqual(Object.keys(CAMERA_STATIONS).sort(), [
    'hero-detail',
    'hero-portrait',
    'hero-wide',
  ])
})

test('both poster variants are declared in the asset manifest and exist on disk', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'lib', 'asset-manifest.json'), 'utf8'))
  const posters = manifest.assets.filter((asset) => asset.id.startsWith('poster-'))
  assert.deepEqual(
    posters.map((poster) => poster.id).sort(),
    ['poster-desktop', 'poster-portrait'],
  )
  for (const poster of posters) {
    assert.equal(poster.bucket, 'critical', 'the fallback must not be deferred')
    assert.equal(poster.kind, 'image')
    assert.ok(poster.url.startsWith('/'), `${poster.id} url must be root-relative`)
    const file = join(root, 'public', poster.url.replace(/^\//, ''))
    assert.ok(existsSync(file), `missing poster on disk: ${poster.url}`)
    const svg = readFileSync(file, 'utf8')
    assert.ok(svg.includes('<svg'), `${poster.id} is a real SVG document`)
    assert.doesNotMatch(svg, /<text|<foreignObject/, 'posters bake no text into the SVG')
  }
})

test('motion-preference resolution reads no wall clock and no environment', () => {
  const source = readFileSync(join(root, 'lib', 'motion-preference.ts'), 'utf8')
  assert.ok(!/performance\.now|Date\.now/.test(source), 'no wall-clock path')
  assert.ok(!/process\.env/.test(source), 'no environment reads: the boundary owns env')
})
