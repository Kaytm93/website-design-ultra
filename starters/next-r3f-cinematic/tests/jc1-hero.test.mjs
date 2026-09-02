import assert from 'node:assert/strict'
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
  assert.ok(existsSync(join(pluginRoot, 'templates', 'assets', 'studio_small_08_1k.hdr')))
})

test('J-C1 keeps the poster assets aligned to the crystal scene', () => {
  const desktop = read('public/poster-desktop.svg')
  const portrait = read('public/poster-portrait.svg')
  for (const poster of [desktop, portrait]) {
    assert.match(poster, /crystal/i)
    assert.match(poster, /#7aa2f7|#bb9af7/)
    assert.doesNotMatch(poster, /<text|<foreignObject/)
  }
  assert.match(read('components/Poster.tsx'), /poster-desktop/)
  assert.match(read('components/Poster.tsx'), /poster-portrait/)
})
