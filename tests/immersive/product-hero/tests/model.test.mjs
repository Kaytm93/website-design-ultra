import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir) {
  const entries = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (entry === 'node_modules' || entry === '.next' || entry === '.wdu-model-source') continue
    if (statSync(full).isDirectory()) {
      entries.push(...walk(full))
    } else {
      entries.push(join(dir, entry))
    }
  }
  return entries
}

function relativePaths() {
  return walk(root)
    .map((file) => file.slice(root.length + 1).replaceAll('\\', '/'))
    .sort()
}

test('the optimized model exists, is small, and is the manifest-declared asset', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'lib', 'asset-manifest.json'), 'utf8'))
  const model = manifest.assets.find((asset) => asset.id === 'orbit-one-model')
  assert.ok(model, 'the manifest declares the model asset')

  const glbPath = join(root, 'public', model.url.replace(/^\//, ''))
  assert.ok(existsSync(glbPath), `model file must exist at ${model.url}`)
  const bytes = statSync(glbPath).size
  assert.ok(bytes > 0 && bytes < 1_000_000, `model must be under 1 MB, got ${bytes} bytes`)
})

test('the committed pipeline summary proves the documented pipeline ran', () => {
  const summaryPath = join(root, 'reports', 'model', 'summary.json')
  assert.ok(existsSync(summaryPath), 'reports/model/summary.json must be committed')
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))

  assert.equal(summary.acceptance, 'ip-07a-optimized-model')
  assert.equal(summary.validate.pre, 'PASS')
  assert.equal(summary.validate.post, 'PASS')
  assert.ok(summary.compression.codec.includes('meshopt'))
  assert.ok(summary.optimized.bytes > 0)

  // immersive-3d §3 desktop budget: under 100 draw calls, under 500k visible
  // triangles. The fixture must stay far below both.
  assert.ok(
    summary.optimized.drawCalls < 100,
    `draw calls ${summary.optimized.drawCalls} must stay under the 100 desktop budget`,
  )
  assert.ok(
    summary.optimized.triangles < 500_000,
    `triangles ${summary.optimized.triangles} must stay under the 500k desktop budget`,
  )
  assert.ok(summary.optimized.materials >= 2, 'the product must carry real materials')
  // The optimize pipeline's palette transform merges the 5 authored materials
  // into 2 with tiny palette textures; every texture must stay far below the
  // immersive-3d 2048 px cap and add negligible transfer.
  assert.ok(
    summary.optimized.textures <= 2,
    `palette textures must be at most 2, got ${summary.optimized.textures}`,
  )
  for (const texture of summary.optimized.textureInfo ?? []) {
    assert.ok(
      texture.width <= 2048 && texture.height <= 2048,
      `texture ${texture.name} must stay under the 2048 px cap`,
    )
  }
})

test('pipeline evidence files are committed alongside the model', () => {
  for (const file of [
    'pre-inspect.txt',
    'pre-validate.log',
    'optimize.log',
    'post-inspect.txt',
    'post-validate.log',
    'summary.json',
  ]) {
    const path = join(root, 'reports', 'model', file)
    assert.ok(existsSync(path), `reports/model/${file} must be committed`)
    const content = readFileSync(path, 'utf8')
    assert.ok(content.trim().length > 0, `reports/model/${file} must not be empty`)
  }
  const postValidate = readFileSync(join(root, 'reports', 'model', 'post-validate.log'), 'utf8')
  assert.ok(
    postValidate.includes('No errors found.'),
    'post-optimize validation must report no errors',
  )
})

test('every manifest asset is local and exists under public/', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'lib', 'asset-manifest.json'), 'utf8'))
  assert.ok(manifest.assets.length >= 4, 'the manifest lists every runtime asset')
  for (const asset of manifest.assets) {
    assert.ok(asset.url.startsWith('/'), `${asset.id}: url must be a local path`)
    const file = join(root, 'public', asset.url.replace(/^\//, ''))
    assert.ok(
      existsSync(file) && statSync(file).isFile(),
      `${asset.id}: ${asset.url} must exist under public/`,
    )
  }
})

test('no remote asset or undeclared fetch path exists in the fixture sources', () => {
  // package-lock.json records registry URLs and next-env.d.ts is generated
  // tooling with a docs link; neither is a runtime surface. Every runtime
  // source must stay fully local.
  const sourceFiles = relativePaths().filter(
    (file) =>
      /\.(ts|tsx|mjs|json|md)$/.test(file) &&
      file !== 'package-lock.json' &&
      file !== 'next-env.d.ts' &&
      !file.startsWith('reports/'),
  )
  for (const file of sourceFiles) {
    const content = readFileSync(join(root, file), 'utf8')
    // Localhost URLs (the fixture driver's own server) are local by
    // definition; any other http(s) URL is a remote asset fetch.
    assert.ok(
      !/https?:\/\/(?!127\.0\.0\.1|localhost|\[::1\])/.test(content),
      `${file} must not contain a remote url: a fresh checkout must install, build, and load offline`,
    )
  }
})
