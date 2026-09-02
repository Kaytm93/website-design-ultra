import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  DEFAULT_OPTIONS,
  generateCrystal,
  parseOptions,
  writeGeneration,
} from './crystal-growth.mjs'

function readJsonChunk(glb) {
  assert.equal(glb.readUInt32LE(0), 0x46546c67, 'GLB magic must be glTF')
  assert.equal(glb.readUInt32LE(4), 2, 'GLB version must be 2')
  const jsonLength = glb.readUInt32LE(12)
  assert.equal(glb.readUInt32LE(16), 0x4e4f534a, 'first GLB chunk must be JSON')
  return JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8').trim())
}

test('the CLI exposes shape, seed, iterations, and facets as validated parameters', () => {
  const options = parseOptions([
    '--shape', 'quartz',
    '--seed', '4242',
    '--iterations', '5',
    '--facets', '48',
  ])

  assert.deepEqual(options, {
    ...DEFAULT_OPTIONS,
    shape: 'quartz',
    seed: 4242,
    iterations: 5,
    facets: 48,
  })
  assert.throws(() => parseOptions(['--facets', '2']), /facets must be an integer from 3/)
  assert.throws(() => parseOptions(['--iterations', '0']), /iterations must be an integer from 1/)
  assert.throws(() => parseOptions(['--shape', 'unknown']), /shape must be one of/)
})

test('the default crystal exceeds the 20,000 triangle production floor', () => {
  const generated = generateCrystal(DEFAULT_OPTIONS)

  assert.ok(generated.geometry.triangle_count >= 20_000)
  assert.equal(generated.geometry.material_count, 2)
  assert.equal(generated.geometry.draw_call_count, 2)
  assert.equal(generated.geometry.collection_names[0], 'Procedural__Crystal')
})

test('the same seed and parameters produce identical topology statistics', () => {
  const first = generateCrystal({ ...DEFAULT_OPTIONS, seed: 987654 })
  const second = generateCrystal({ ...DEFAULT_OPTIONS, seed: 987654 })
  const different = generateCrystal({ ...DEFAULT_OPTIONS, seed: 987655 })

  assert.deepEqual(first.geometry, second.geometry)
  assert.equal(first.report.topology_hash, second.report.topology_hash)
  assert.notEqual(first.report.geometry_hash, different.report.geometry_hash)
})

test('writeGeneration emits a valid GLB and a report bound to that GLB', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'wdu-crystal-js-'))
  try {
    const result = await writeGeneration({
      ...DEFAULT_OPTIONS,
      outputDir,
    })
    const glb = await readFile(result.glbPath)
    const report = JSON.parse(await readFile(result.reportPath, 'utf8'))
    const gltf = readJsonChunk(glb)

    assert.equal(report.status, 'PASS')
    assert.equal(report.input_contract.shape, DEFAULT_OPTIONS.shape)
    assert.equal(report.input_contract.seed, DEFAULT_OPTIONS.seed)
    assert.equal(report.input_contract.iterations, DEFAULT_OPTIONS.iterations)
    assert.equal(report.input_contract.facets, DEFAULT_OPTIONS.facets)
    assert.ok(report.geometry_statistics.triangle_count >= 20_000)
    assert.equal(report.output.glb, 'crystal-growth.glb')
    assert.equal(report.output.report, 'report.json')
    assert.equal(report.output.bytes, glb.length)
    assert.equal(gltf.asset.generator, 'website-design-ultra procedural-generation/js')
    assert.equal(gltf.meshes.length, 2)
    assert.equal(gltf.materials.length, 2)
    assert.equal(gltf.extensionsUsed, undefined)
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})

test('facets and iterations change topology while preserving the generation contract', () => {
  const low = generateCrystal({ ...DEFAULT_OPTIONS, iterations: 4, facets: 12 })
  const high = generateCrystal({ ...DEFAULT_OPTIONS, iterations: 5, facets: 24 })

  assert.ok(high.geometry.triangle_count > low.geometry.triangle_count)
  assert.equal(low.parameters.facets, 12)
  assert.equal(high.parameters.iterations, 5)
  assert.equal(low.report.handoff.next_pipeline, '3d-asset-pipeline')
})

test('the committed JS report round-trips against its GLB artifact', async () => {
  const glb = await readFile(new URL('./crystal-growth.glb', import.meta.url))
  const report = JSON.parse(await readFile(new URL('./report.json', import.meta.url), 'utf8'))
  const sha256 = createHash('sha256').update(glb).digest('hex')

  assert.equal(report.status, 'PASS')
  assert.equal(report.output.bytes, glb.length)
  assert.equal(report.output.sha256, sha256)
  assert.equal(report.geometry_statistics.triangle_count, 48_384)
  assert.equal(report.generator.script, 'procedural-generation/js/crystal-growth.mjs')
})

test('the procedural-crystal fixture raw model is the JS generator output', async () => {
  const fixturePath = new URL(
    '../../tests/immersive/procedural-crystal/public/model/procedural-crystal-raw.glb',
    import.meta.url,
  )
  const fixtureGlb = await readFile(fixturePath)
  const gltf = readJsonChunk(fixtureGlb)

  assert.equal(gltf.asset.generator, 'website-design-ultra procedural-generation/js')
  assert.equal(gltf.nodes[0].extras.procedural, true)
  assert.equal(gltf.nodes[0].extras.algorithm, 'crystal-growth')
  assert.equal(gltf.nodes[0].extras.seed, DEFAULT_OPTIONS.seed)
  assert.equal(gltf.nodes[0].extras.iterations, DEFAULT_OPTIONS.iterations)
  assert.equal(gltf.nodes[0].extras.facets, DEFAULT_OPTIONS.facets)
  const committedSource = await readFile(new URL('./crystal-growth.glb', import.meta.url))
  assert.deepEqual(fixtureGlb, committedSource, 'fixture raw GLB must be copied from the committed JS generator output')
})
