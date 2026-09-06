/**
 * Geometry determinism, the pose function, the camera stations and the
 * manifest — the parts of the scene that hold without a GPU.
 */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { CAMERA_STATIONS, STATION_IDS, stationForViewport } from '../src/camera-stations.ts'
import { getCameraStation } from '../src/determinism-runtime.ts'
import { HERO_TRIANGLE_COUNT, buildHeroGeometry } from '../src/hero-geometry.ts'
import { HERO_ROTATION_SPEED, dprCeiling, heroRotationY } from '../src/scene-config.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, 'src', 'asset-manifest.json'), 'utf8'))

test('the same seed produces byte-identical geometry', () => {
  const a = buildHeroGeometry('vite-three-canvas-v1')
  const b = buildHeroGeometry('vite-three-canvas-v1')
  assert.deepEqual([...a.positions], [...b.positions])
  assert.deepEqual([...a.normals], [...b.normals])
  assert.deepEqual([...a.heights], [...b.heights])
})

test('a different seed produces different geometry', () => {
  const a = buildHeroGeometry('vite-three-canvas-v1')
  const b = buildHeroGeometry('some-other-seed')
  assert.notDeepEqual([...a.positions], [...b.positions])
  assert.equal(a.triangleCount, b.triangleCount, 'the topology is seeded, the count is not')
})

test('the geometry is well formed and inside the declared triangle budget', () => {
  const hero = buildHeroGeometry()
  assert.equal(hero.triangleCount, HERO_TRIANGLE_COUNT)
  assert.equal(hero.positions.length, hero.triangleCount * 9)
  assert.equal(hero.normals.length, hero.positions.length)
  assert.equal(hero.heights.length, hero.positions.length / 3)
  assert.ok(hero.positions.every(Number.isFinite), 'no NaN may reach a vertex buffer')
  assert.ok(
    hero.heights.every((value) => value >= 0 && value <= 1),
    'the height attribute is a normalized ramp',
  )
  assert.ok(
    hero.triangleCount < 500_000,
    'the immersive-3d desktop triangle budget is the ceiling this must stay under',
  )
})

test('every face normal is a unit vector', () => {
  const hero = buildHeroGeometry()
  for (let index = 0; index < hero.normals.length; index += 3) {
    const length = Math.hypot(hero.normals[index], hero.normals[index + 1], hero.normals[index + 2])
    assert.ok(Math.abs(length - 1) < 1e-5, `normal at ${index} is not unit length: ${length}`)
  }
})

test('reduced motion holds the static pose; full motion advances from the clock', () => {
  const phase = 1.25
  assert.equal(heroRotationY(phase, 0, 'reduced'), phase)
  assert.equal(heroRotationY(phase, 2.5, 'reduced'), phase, 'elapsed never moves a reduced pose')
  assert.equal(heroRotationY(phase, 2.5, 'full'), phase + 2.5 * HERO_ROTATION_SPEED)
  assert.equal(heroRotationY(phase, 0, 'full'), phase)
})

test('the DPR ceiling follows the pointer capability', () => {
  assert.equal(dprCeiling(false), 2)
  assert.equal(dprCeiling(true), 1.5)
})

test('the three camera stations exist and portrait is its own composition', () => {
  assert.deepEqual([...STATION_IDS].sort(), ['hero-detail', 'hero-portrait', 'hero-wide'])
  for (const id of STATION_IDS) {
    const station = getCameraStation(CAMERA_STATIONS, id)
    assert.equal(station.sceneState, 'hero')
    assert.equal(station.projection, 'perspective')
    assert.ok(station.fov > 0 && station.fov < 90)
  }
  const wide = CAMERA_STATIONS['hero-wide']
  const portrait = CAMERA_STATIONS['hero-portrait']
  assert.notDeepEqual(
    [wide.position, wide.target, wide.fov],
    [portrait.position, portrait.target, portrait.fov],
    'the portrait shot must not be the landscape shot reused',
  )
})

test('orientation selects the station, and a capture can override it', () => {
  assert.equal(stationForViewport(1440, 900), 'hero-wide')
  assert.equal(stationForViewport(390, 844), 'hero-portrait')
  assert.equal(stationForViewport(900, 900), 'hero-wide', 'a square viewport is not portrait')
})

test('the manifest declares both posters and they exist on disk', () => {
  assert.equal(manifest.schema, 1)
  assert.deepEqual(manifest.buckets, ['critical', 'progressive'])
  assert.deepEqual(
    manifest.assets.map((asset) => asset.id).sort(),
    ['poster-desktop', 'poster-portrait'],
  )
  for (const asset of manifest.assets) {
    assert.ok(manifest.buckets.includes(asset.bucket), `undeclared bucket: ${asset.id}`)
    assert.equal(typeof asset.purpose, 'string')
    assert.ok(asset.url.startsWith('/'), `asset url must be root-relative: ${asset.id}`)
    assert.ok(
      existsSync(join(root, 'public', asset.url.replace(/^\//, ''))),
      `declared asset missing on disk: ${asset.url}`,
    )
  }
})

test('the scene fetches nothing at runtime', () => {
  for (const file of ['src/scene.ts', 'src/main.ts', 'src/hero-geometry.ts']) {
    const text = readFileSync(join(root, file), 'utf8')
    assert.doesNotMatch(text, /\bfetch\(|TextureLoader|GLTFLoader/, `${file} loads a network asset`)
  }
})

test('the copied runtime modules stay byte-identical to the repository references', () => {
  for (const name of ['quality-controller.ts', 'determinism-runtime.ts']) {
    const reference = readFileSync(join(root, '..', '..', 'references', name), 'utf8')
    const copy = readFileSync(join(root, 'src', name), 'utf8')
    assert.equal(
      copy,
      reference,
      `src/${name} must stay a byte-identical copy of references/${name}`,
    )
  }
})

test('each poster records the hash, station and browser it was captured with', () => {
  for (const asset of manifest.assets) {
    const bytes = readFileSync(join(root, 'public', asset.url.replace(/^\//, '')))
    assert.match(asset.sha256 ?? '', /^[0-9a-f]{64}$/, `${asset.id} has no recorded hash`)
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      asset.sha256,
      `${asset.id} was edited by hand; re-run npm run capture:poster instead`,
    )
    assert.ok(asset.station, `${asset.id} does not say which station drew it`)
    assert.ok(asset.capturedWith, `${asset.id} does not say which browser drew it`)
    assert.ok(asset.width > 0 && asset.height > 0, `${asset.id} has no recorded dimensions`)
  }
})

test('the two posters are different compositions, not one image resized', () => {
  const [desktop, portrait] = ['poster-desktop', 'poster-portrait'].map((id) =>
    manifest.assets.find((asset) => asset.id === id),
  )
  assert.notEqual(desktop.station, portrait.station)
  assert.notEqual(desktop.sha256, portrait.sha256)
  assert.ok(desktop.width > desktop.height, 'the desktop poster is landscape')
  assert.ok(portrait.height > portrait.width, 'the portrait poster is portrait')
})
