import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'


const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pluginRoot = join(root, '..', '..', 'website-design-ultra')

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

test('J-C1 replaces the procedural starter hero and its documentation', () => {
  const forbidden = ['torus', 'Knot'].join('')
  const forbiddenWords = /torus[ -]?knot/i
  const productionFiles = walk(root).filter((file) => !file.includes('/tests/'))
  for (const file of productionFiles) {
    if (!/\.(md|ts|tsx|json|svg)$/.test(file)) continue
    assert.doesNotMatch(readFileSync(file, 'utf8'), forbiddenWords, `${file} still names ${forbidden}`)
  }
})

test('J-C1 loads the procedural crystal GLB with physical materials and local HDRI', () => {
  const hero = read('components/HeroObject.tsx')
  const canvas = read('components/SceneCanvas.tsx')
  const manifest = JSON.parse(read('lib/asset-manifest.json'))

  assert.match(hero, /GLTFLoader/)
  assert.match(hero, /DRACOLoader/)
  assert.match(hero, /MeshPhysicalMaterial/)
  assert.match(hero, /MODEL_ASSET_URL/)
  assert.match(hero, /setDecoderPath\('\/draco\/'\)/)
  assert.match(hero, /RGBELoader/)
  assert.match(hero, /scene\.environment/)
  assert.match(hero, /HDRI_ASSET_URL/)
  assert.match(canvas, /<Canvas[\s\S]*shadows/)
  assert.match(canvas, /directionalLight[\s\S]*castShadow/)

  const model = manifest.assets.find((asset) => asset.id === 'crystal-model')
  const hdri = manifest.assets.find((asset) => asset.id === 'studio-small-08-hdri')
  assert.equal(model?.url, '/model/procedural-crystal.glb')
  assert.equal(hdri?.url, '/assets/studio_small_08_1k.hdr')
  assert.equal(hdri?.license, 'CC0')
  assert.ok(existsSync(join(root, 'public', model.url.slice(1))))
  assert.ok(existsSync(join(root, 'public', hdri.url.slice(1))))
  // A standalone export (marked by wdu-source.json) has no plugin tree next to
  // it; there the repository's own tests/templates/sync.test.mjs owns this copy.
  if (!existsSync(join(root, 'wdu-source.json'))) {
    assert.ok(existsSync(join(pluginRoot, 'templates', 'assets', 'studio_small_08_1k.hdr')))
  }
})

/**
 * The station ids the scene actually defines, read from the scene rather than
 * restated here: renaming a station must break the poster contract, not slip
 * past a copy of the old list.
 */
function sceneStationIds() {
  const source = read('lib/camera-stations.ts')
  const block = /export const CAMERA_STATIONS = \{([\s\S]*?)\n\} as const/.exec(source)
  assert.ok(block, 'lib/camera-stations.ts must export a CAMERA_STATIONS object')
  return [...block[1].matchAll(/^\s{2}'([^']+)':/gm)].map((match) => match[1])
}

/** IHDR is the first chunk of every PNG; width and height are bytes 16-23. */
function readPngSize(file) {
  const bytes = readFileSync(file)
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    `${file} is not a PNG`,
  )
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

test('J-C1 renders the posters from the crystal scene instead of drawing them', () => {
  // The poster is what a visitor sees while the canvas loads, after a lost
  // context, and at the poster quality tier. A hand-drawn one says whatever its
  // author remembered: this starter shipped a single symmetric shard in a blue
  // glow while the scene rendered a branched crystal, off centre, over a hard
  // cast shadow. Nothing tied the two together, so nothing caught the drift.
  // These assertions are that tie — the poster is a capture, its hash is
  // declared, and the capture script that produced it is committed.
  const manifest = JSON.parse(read('lib/asset-manifest.json'))
  const stations = { 'poster-desktop': 'hero-wide', 'poster-portrait': 'hero-portrait' }

  for (const [id, station] of Object.entries(stations)) {
    const asset = manifest.assets.find((entry) => entry.id === id)
    assert.ok(asset, `${id} is not declared in the manifest`)
    assert.match(asset.url, /\.png$/, `${id} must be a rendered capture, not a drawing`)

    const file = join(root, 'public', asset.url.slice(1))
    assert.ok(existsSync(file), `${id} is declared but missing on disk`)
    assert.equal(
      createHash('sha256').update(readFileSync(file)).digest('hex'),
      asset.sha256,
      `${id} on disk does not match the hash the manifest declares — recapture ` +
        'it with `npm run capture:poster` rather than editing it by hand',
    )

    // The capture record names the run: which station composed it, and how
    // large the frame was. A poster whose station drifts from the scene's own
    // is the failure this test exists to catch.
    assert.equal(asset.capture?.station, station, `${id} must be captured from ${station}`)
    assert.deepEqual(
      readPngSize(file),
      { width: asset.capture.width, height: asset.capture.height },
      `${id} on disk is not the size its capture record claims`,
    )
    assert.ok(
      sceneStationIds().includes(asset.capture.station),
      `${id} names a camera station the scene does not define`,
    )
  }

  // The capture is reproducible because the script is committed, not because
  // someone still has the browser tab open.
  const script = read('scripts/capture-poster.mjs')
  assert.match(script, /WDU_DETERMINISTIC/)
  assert.match(script, /data-wdu-ready/)
  assert.match(script, /hero-wide/)
  assert.match(script, /hero-portrait/)
  assert.match(
    JSON.parse(read('package.json')).scripts['capture:poster'],
    /capture-poster\.mjs/,
    'the capture must be runnable by name, not remembered',
  )

  assert.match(read('components/Poster.tsx'), /poster-desktop/)
  assert.match(read('components/Poster.tsx'), /poster-portrait/)
})
