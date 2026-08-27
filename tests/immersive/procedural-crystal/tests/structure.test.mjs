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
    if (entry === 'node_modules' || entry === '.next' || entry === '.wdu-crystal-source' || entry === '.ip10c-source') continue
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

test('the fixture structure declares exactly one asset manifest', () => {
  const files = relativePaths()
  const manifests = files.filter(
    (file) =>
      ['app/', 'components/', 'lib/', 'public/'].some((prefix) => file.startsWith(prefix)) &&
      /manifest/i.test(file),
  )
  assert.deepEqual(manifests, ['lib/asset-manifest.json'])
})

test('the one optimized model is declared and local', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'lib', 'asset-manifest.json'), 'utf8'))
  const model = manifest.assets.find((asset) => asset.id === 'crystal-model')
  assert.ok(model, 'the manifest must declare the crystal asset')
  assert.equal(model.kind, 'model')
  assert.ok(model.url.startsWith('/'), 'model url must be a local path')
  const glbPath = join(root, 'public', model.url.replace(/^\//, ''))
  assert.ok(existsSync(glbPath), `model file must exist at ${model.url}`)
  const bytes = statSync(glbPath).size
  assert.ok(bytes > 0 && bytes < 1_000_000, `model must be under 1 MB, got ${bytes} bytes`)
})

test('the three Draco decoder files are committed under public/draco/', () => {
  for (const name of ['draco_decoder.wasm', 'draco_wasm_wrapper.js', 'draco_decoder.js']) {
    const path = join(root, 'public', 'draco', name)
    assert.ok(existsSync(path), `committed decoder missing: ${name}`)
    assert.ok(statSync(path).size > 100, `decoder file ${name} unexpectedly small`)
  }
})

test('the asset manifest declares every Draco decoder file', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'lib', 'asset-manifest.json'), 'utf8'))
  const decoderUrls = manifest.assets
    .filter((asset) => asset.kind === 'decoder')
    .map((asset) => asset.url)
  for (const url of ['/draco/draco_decoder.wasm', '/draco/draco_wasm_wrapper.js', '/draco/draco_decoder.js']) {
    assert.ok(decoderUrls.includes(url), `manifest must declare decoder ${url}`)
  }
})

test('ProductModel wires DRACOLoader.setDecoderPath to the local /draco/ directory', () => {
  const text = readFileSync(join(root, 'components', 'ProductModel.tsx'), 'utf8')
  assert.ok(text.includes('DRACOLoader'), 'ProductModel must use DRACOLoader')
  assert.ok(text.includes("setDecoderPath('/draco/')"), 'decoder path must be the committed /draco/ directory')
})

test('no Vite starter, no particle template, no remote fetches in the fixture', () => {
  const files = relativePaths()
  assert.ok(!files.some((file) => /vite\.config/.test(file)), 'no vite.config may exist')
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  assert.ok(!('vite' in deps), 'vite must not be a dependency')
  assert.ok(!('@react-three/drei' in deps), 'no network-fetching helpers in the matrix')
  // Scan scene source only — skip Next.js reference types (next-env.d.ts)
  // and any pure-type files where the regex would false-positive on a
  // generic global declaration.
  const scanned = relativePaths().filter(
    (f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('tests/') && !f.endsWith('next-env.d.ts'),
  )
  for (const file of scanned) {
    const source = readFileSync(join(root, file), 'utf8')
    // The fixture documents DRACOLoader.setDecoderPath('/draco/') which is a
    // local served path; that string contains '//' but no remote URL.
    // Strip the explicit /draco/ literal before checking for http(s) URLs.
    const scrubbed = source.replace(/setDecoderPath\('\/draco\/'\)/g, "setDecoderPath('')")
    assert.ok(!/https?:\/\//.test(scrubbed), `${file} must not contain a remote url`)
    assert.ok(!/\bfetch\(/.test(scrubbed), `${file} must not fetch at runtime`)
  }
})

test('the fixture declares exactly two named camera stations', () => {
  const text = readFileSync(join(root, 'lib', 'camera-stations.ts'), 'utf8')
  assert.ok(text.includes('crystal-wide'), 'must declare crystal-wide station')
  assert.ok(text.includes('crystal-portrait'), 'must declare crystal-portrait station')
})

test('the committed pipeline summary proves the documented pipeline ran', () => {
  const summaryPath = join(root, 'reports', 'model', 'summary.json')
  assert.ok(existsSync(summaryPath), 'reports/model/summary.json must be committed')
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
  assert.equal(summary.acceptance, 'ip-10c-optimized-procedural-crystal')
  assert.equal(summary.validate.pre, 'PASS')
  assert.equal(summary.validate.post, 'PASS')
  assert.ok(summary.optimized.triangles > 0)
  assert.ok(summary.optimized.triangles < 500_000, 'optimized triangles must stay under desktop budget')
  assert.ok(summary.optimized.extensionsUsed.includes('KHR_draco_mesh_compression'))
  assert.equal(summary.optimize_invocations, 1)
  assert.ok(summary.optimize_command.includes('--compress draco'))
  assert.ok(summary.optimize_command.includes('--texture-compress false'))
})

test('every raw inspect/validate report is committed', () => {
  for (const name of ['pre-inspect.txt', 'pre-validate.log', 'post-inspect.txt', 'post-validate.log']) {
    const path = join(root, 'reports', 'model', name)
    assert.ok(existsSync(path), `reports/model/${name} must be committed`)
  }
})

test('the post-inspect log declares the Draco extension on the optimized GLB', () => {
  const post = readFileSync(join(root, 'reports', 'model', 'post-inspect.txt'), 'utf8')
  assert.ok(post.includes('KHR_draco_mesh_compression'), 'optimized GLB must declare Draco extension')
})