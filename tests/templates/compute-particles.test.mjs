import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const templatePath = path.join(repoRoot, 'website-design-ultra', 'templates', 'particles', 'compute-particles.ts')
const cheatsheetPath = path.join(repoRoot, 'website-design-ultra', 'skills', 'shaders-tsl', 'references', 'tsl-cheatsheet.md')
const fallbackPath = path.join(repoRoot, 'lab', 'src', 'experiments', 'particle-toy.ts')
const labMainPath = path.join(repoRoot, 'lab', 'src', 'main.ts')
const labComputePath = path.join(repoRoot, 'lab', 'src', 'experiments', 'compute-particles.ts')
const verifierPath = path.join(repoRoot, 'lab', 'scripts', 'verify-compute-webgpu.mjs')

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

test('compute particle template is a copyable TSL kernel with storage-backed morph and velocity color', () => {
  assert.ok(fs.existsSync(templatePath), 'compute-particles.ts is missing')
  const source = read(templatePath)

  for (const symbol of ['Fn', 'storage', 'instanceIndex', 'computeKernel']) {
    assert.match(source, new RegExp(`\\b${symbol}\\b`), `missing TSL symbol ${symbol}`)
  }
  assert.match(source, /storage\s*\(/, 'storage buffer declaration missing')
  assert.match(source, /instanceIndex(?:\.add|\.mul|\b)/, 'instanceIndex is not used for addressing')
  assert.match(source, /computeKernel\s*\(/, 'computeKernel declaration missing')
  assert.match(source, /velocityColor|velocity.*color|color.*velocity/i, 'velocity color mapping missing')
  assert.match(source, /morphA|morph.*A/i, 'morph target A missing')
  assert.match(source, /morphB|morph.*B/i, 'morph target B missing')
  assert.match(source, /morphProgress|morph.*progress/i, 'morph progress missing')
  assert.match(source, /qualityProfile\.particles|particleCount|count/i, 'particle count input missing')
  assert.match(source, /computeAsync|compute\(/, 'runtime compute dispatch missing')
  assert.match(source, /dispose|cleanup/i, 'resource cleanup missing')
})

test('TSL cheatsheet documents compute primitives and remains within the compact reference budget', () => {
  const source = read(cheatsheetPath)
  assert.ok(Buffer.byteLength(source, 'utf8') <= 4096, 'TSL cheatsheet exceeds 4 KB')
  for (const term of ['Fn', 'storage', 'instanceIndex', 'computeKernel', 'computeAsync', 'morph', 'velocity']) {
    assert.match(source, new RegExp(`\\b${term}\\b`, 'i'), `cheatsheet missing ${term}`)
  }
})

test('WebGPU lab fixture routes the compute template and exposes device-backed evidence', () => {
  assert.ok(fs.existsSync(labComputePath), 'compute WebGPU lab fixture is missing')
  const main = read(labMainPath)
  const fixture = read(labComputePath)
  assert.match(main, /['"]compute-particles['"]/, 'lab route is missing')
  assert.match(fixture, /compute-particles\.ts/, 'fixture does not exercise the copyable template')
  for (const marker of ['GPUDevice', 'webgpu-device', 'compute-dispatch', 'UNAVAILABLE']) {
    assert.match(fixture, new RegExp(marker, 'i'), `fixture missing ${marker} evidence`)
  }
})

test('dedicated WebGPU verifier uses Chromium headless and preserves UNAVAILABLE semantics', () => {
  assert.ok(fs.existsSync(verifierPath), 'compute WebGPU verifier is missing')
  const source = read(verifierPath)
  assert.match(source, /chromium\.launch/)
  assert.match(source, /--enable-unsafe-webgpu/)
  assert.match(source, /UNAVAILABLE/)
  assert.match(source, /process\.exitCode\s*=\s*2/)
})

test('existing WebGL2 ping-pong fallback remains the fallback implementation', () => {
  const source = read(fallbackPath)
  assert.match(source, /HalfFloatType/)
  assert.match(source, /renderer\.setRenderTarget\(writePosLife\)/)
  assert.match(source, /renderer\.setRenderTarget\(writeVelSeed\)/)
  assert.match(source, /swapState\(\)/)
  assert.match(source, /floatSupported/)
  assert.match(source, /showPosterFallback/)
})
