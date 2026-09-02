import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, 'lib', 'asset-manifest.json'), 'utf8'))

test('the manifest declares schema 1 and the two loading buckets', () => {
  assert.equal(manifest.schema, 1)
  assert.deepEqual(manifest.buckets, ['critical', 'progressive'])
  assert.equal(typeof manifest.description, 'string')
})

test('every declared asset carries the contract fields and exists on disk', () => {
  assert.ok(Array.isArray(manifest.assets))
  assert.ok(manifest.assets.length >= 1, 'a scaffold with no declared asset is not a manifest')

  for (const asset of manifest.assets) {
    assert.ok(typeof asset.id === 'string' && asset.id.length > 0, 'asset id required')
    assert.ok(typeof asset.kind === 'string' && asset.kind.length > 0, 'asset kind required')
    assert.ok(
      typeof asset.url === 'string' && asset.url.startsWith('/'),
      `asset url must be a root-relative path: ${asset.id}`,
    )
    assert.ok(
      manifest.buckets.includes(asset.bucket),
      `asset bucket must be declared: ${asset.id}`,
    )
    assert.equal(typeof asset.purpose, 'string', 'asset purpose required')

    const file = join(root, 'public', asset.url.replace(/^\//, ''))
    assert.ok(existsSync(file), `declared asset missing on disk: ${asset.url}`)
  }
})

test('the manifest declares the model, HDRI, decoder, brand mark, and poster assets', () => {
  assert.deepEqual(
    manifest.assets.map((asset) => asset.id).sort(),
    [
      'brand-mark',
      'crystal-model',
      'draco-decoder-js',
      'draco-decoder-wasm',
      'draco-decoder-wrapper',
      'poster-desktop',
      'poster-portrait',
      'studio-small-08-hdri',
    ],
    'changing the declared asset set is an intentional manifest change',
  )
  const page = readFileSync(join(root, 'app', 'page.tsx'), 'utf8')
  assert.ok(page.includes('/brand-mark.svg'), 'the page must reference the declared asset')
  const poster = readFileSync(join(root, 'components', 'Poster.tsx'), 'utf8')
  assert.ok(
    poster.includes('poster-desktop') && poster.includes('poster-portrait'),
    'the poster component must reference the declared poster ids',
  )
})
