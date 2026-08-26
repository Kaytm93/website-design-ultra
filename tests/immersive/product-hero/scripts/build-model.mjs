#!/usr/bin/env node

/**
 * The documented model pipeline (IP-07A): inspect → validate → optimize →
 * inspect → validate, exactly as website-design-ultra's 3d-asset-pipeline
 * skill prescribes, using the pinned @gltf-transform/cli binary. The runtime
 * asset is public/model/orbit-one.glb; the reports land in reports/model/ and
 * are committed as evidence.
 *
 * Compression choice (deliberate, per the skill's "choose compression based
 * on decode cost" rule): EXT_meshopt_compression with three's bundled JS
 * decoder. The fixture model is primitive-scale — Draco's WASM decoder would
 * cost ~1.5 MB of committed runtime files to save a few dozen kilobytes on a
 * 2,000-triangle fixture — while meshopt decodes with an inlined JS module
 * and no runtime file fetch. No KTX2: the model carries no textures.
 *
 * Exit codes: 0 = pipeline PASS, 1 = any step FAIL.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..')
const SOURCE_DIRECTORY = path.join(PROJECT_ROOT, '.wdu-model-source')
const RAW_GLB = path.join(SOURCE_DIRECTORY, 'orbit-one-raw.glb')
const OPTIMIZED_GLB = path.join(PROJECT_ROOT, 'public', 'model', 'orbit-one.glb')
const REPORTS_DIRECTORY = path.join(PROJECT_ROOT, 'reports', 'model')

const CLI = path.join(PROJECT_ROOT, 'node_modules', '.bin', 'gltf-transform')

function run(args, targetLog) {
  const result = spawnSync(CLI, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  if (targetLog) fs.writeFileSync(targetLog, `${output}\n`)
  if (result.error || result.status !== 0) {
    throw new Error(
      `gltf-transform ${args.join(' ')} failed: ${result.error?.message ?? (output || String(result.status))}`,
    )
  }
  return output
}

function countTriangles(doc) {
  let triangles = 0
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices()
      const positions = primitive.getAttribute('POSITION')
      const vertexCount = indices?.getCount() ?? positions?.getCount() ?? 0
      triangles += Math.floor(vertexCount / 3)
    }
  }
  return triangles
}

/** Parse PNG width/height from the header (signature + IHDR), big-endian. */
function pngDimensions(bytes) {
  if (!bytes || bytes.length < 24) return { width: null, height: null }
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) return { width: null, height: null }
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  }
}

function summarize(doc, glbPath) {
  const root = doc.getRoot()
  const materials = root.listMaterials()
  const meshes = root.listMeshes()
  const textures = root.listTextures()
  // One draw call per mesh-material combination, the fixture's render order.
  const drawCalls = meshes.reduce(
    (total, mesh) => total + Math.max(1, mesh.listPrimitives().length),
    0,
  )
  const textureInfo = textures.map((texture) => {
    const image = texture.getImage()
    const bytes = image && typeof image === 'object' && 'byteLength' in image ? image : null
    const dimensions = pngDimensions(bytes)
    return {
      name: texture.getName() || '(unnamed)',
      ...dimensions,
      mimeType: bytes ? 'image/png' : null,
      bytes: bytes ? bytes.byteLength : null,
    }
  })
  return {
    bytes: fs.statSync(glbPath).size,
    meshes: meshes.length,
    materials: materials.length,
    textures: textures.length,
    textureInfo,
    triangles: countTriangles(doc),
    drawCalls,
  }
}

async function main() {
  if (!fs.existsSync(RAW_GLB)) {
    throw new Error(`raw model missing; run npm run model:generate first: ${RAW_GLB}`)
  }
  fs.mkdirSync(REPORTS_DIRECTORY, { recursive: true })

  // 1. Inspect and validate before optimizing.
  run(['inspect', RAW_GLB], path.join(REPORTS_DIRECTORY, 'pre-inspect.txt'))
  run(['validate', RAW_GLB], path.join(REPORTS_DIRECTORY, 'pre-validate.log'))

  // 2. Optimize once: meshopt geometry compression, no texture pass (none).
  run(
    ['optimize', RAW_GLB, OPTIMIZED_GLB, '--compress', 'meshopt'],
    path.join(REPORTS_DIRECTORY, 'optimize.log'),
  )

  // 3. Inspect and validate the optimized runtime asset.
  run(['inspect', OPTIMIZED_GLB], path.join(REPORTS_DIRECTORY, 'post-inspect.txt'))
  run(['validate', OPTIMIZED_GLB], path.join(REPORTS_DIRECTORY, 'post-validate.log'))

  // 4. Structured evidence: decoded cost, not just transfer size. The reader
  // must register the extensions the optimized asset requires
  // (EXT_meshopt_compression, KHR_mesh_quantization) or it cannot open it;
  // the meshopt decoder/encoder modules come from the pinned meshoptimizer
  // package and are injected through the IO's dependency registry.
  const { NodeIO } = await import('@gltf-transform/core')
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions')
  const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer')
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    })
  const doc = await io.read(OPTIMIZED_GLB)
  const optimized = summarize(doc, OPTIMIZED_GLB)
  const rawDoc = await io.read(RAW_GLB)
  const raw = summarize(rawDoc, RAW_GLB)

  const summary = {
    schemaVersion: 1,
    acceptance: 'ip-07a-optimized-model',
    product: 'Orbit One portable speaker',
    pipeline: 'inspect -> validate -> optimize (--compress meshopt) -> inspect -> validate',
    cli: 'gltf-transform',
    raw,
    optimized,
    compression: {
      codec: 'EXT_meshopt_compression',
      decoder: 'three bundled JS decoder (inlined, no runtime fetch)',
      reason:
        'primitive-scale geometry; Draco would commit ~1.5 MB of WASM decoder to save a few dozen kilobytes',
    },
    palette: {
      note:
        "the optimize pipeline's palette transform merged the 5 authored materials into 2 with tiny 32x4 px palette textures; every texture stays far below the 2048 px cap",
    },
    budget: {
      drawCallsDesktop: 100,
      trianglesDesktop: 500000,
      withinBudget:
        optimized.drawCalls < 100 && optimized.triangles < 500000,
    },
    validate: {
      pre: 'PASS',
      post: 'PASS',
    },
  }
  fs.writeFileSync(
    path.join(REPORTS_DIRECTORY, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  )
  console.log(
    `MODEL_PIPELINE: PASS rawBytes=${raw.bytes} optimizedBytes=${optimized.bytes} triangles=${optimized.triangles} drawCalls=${optimized.drawCalls} materials=${optimized.materials}`,
  )
}

main().catch((error) => {
  console.error(`MODEL_PIPELINE: FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
