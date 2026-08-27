#!/usr/bin/env node

/**
 * scripts/build-model.mjs — the documented IP-10C pipeline driver.
 *
 * inspect → validate → optimize (single invocation) → inspect → validate,
 * exactly as the existing 3d-asset-pipeline skill prescribes, using the
 * pinned @gltf-transform/cli binary under node_modules/.bin/. The optimize
 * command is exactly the one recorded in procedural-generation/recipe.json
 * (--compress draco --texture-compress false). The CLI must be installed
 * through `npm ci` first; no npx, no registry fetch at runtime.
 *
 * The raw output GLB is generated separately by
 * procedural-generation/generator.py (Blender Python, crystal-growth); this
 * script only consumes it. The four committed pipeline reports under
 * reports/model/ are the durable evidence.
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..')

// The raw input GLB is produced by procedural-generation/generator.py and
// committed by the IP-10B task. We do NOT regenerate it here: this fixture
// is the second immersive evaluation, not a third pipeline.
const RAW_GLB = path.join(PROJECT_ROOT, 'public', 'model', 'procedural-crystal-raw.glb')
const OPTIMIZED_GLB = path.join(PROJECT_ROOT, 'public', 'model', 'procedural-crystal.glb')
const REPORTS_DIRECTORY = path.join(PROJECT_ROOT, 'reports', 'model')
const CLI = path.join(PROJECT_ROOT, 'node_modules', '.bin', 'gltf-transform')

function run(args, targetLog) {
  const result = spawnSync(CLI, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  if (targetLog) fs.writeFileSync(targetLog, `${output}\n`)
  if (result.error || result.status !== 0) {
    throw new Error(
      `gltf-transform ${args.join(' ')} failed: ${result.error?.message ?? output ?? String(result.status)}`,
    )
  }
  return output
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function parseCountFromInspect(text) {
  // gltf-transform inspect prints aligned rows. The mesh row looks like:
  //   │ 0 │ Procedural__Crystal_Segment_000_Mesh │ TRIANGLES │ 1 │ 308 │ 560 │ u16 │ ...
  // The mesh name may itself contain digits (e.g. Segment_000_Mesh), so the
  // numeric positions are not stable across fixtures. Use a robust strategy:
  // find every "TRIANGLES" row, count meshPrimitives as the first small
  // integer (1) immediately after TRIANGLES, and glPrimitives as the next
  // large integer ≥ 100 (triangles-per-mesh).
  const lines = text.split('\n')
  let inMeshes = false
  let totalTriangles = 0
  let meshes = 0
  for (const line of lines) {
    if (/^\s*MESHES\s*$/.test(line)) {
      inMeshes = true
      continue
    }
    if (inMeshes && /^\s*(TEXTURES|MATERIALS|ANIMATIONS)\s*$/.test(line)) {
      inMeshes = false
    }
    if (!inMeshes) continue
    if (!line.includes('TRIANGLES')) continue
    meshes += 1
    // Split the line on │, drop the header pieces, then find every numeric
    // token. The TRIANGLES row's first number after the name is meshPrimitives
    // (always 1 for indexed geometry); the second is glPrimitives; the third
    // is vertex count. Use the *largest* of the first three > 1 as a robust
    // glPrimitives guess: vertices can be larger than glPrimitives, so take
    // the value right after meshPrimitives (=1) when the sequence is
    // [1, P, V, ...].
    const numerics = [...line.matchAll(/(\d+)/g)].map((m) => Number(m[1]))
    if (numerics.length < 2) continue
    const afterOne = numerics.findIndex((n, i) => i > 0 && n === 1)
    if (afterOne >= 0 && afterOne + 1 < numerics.length) {
      totalTriangles += numerics[afterOne + 1]
    }
  }
  return { triangles: totalTriangles, meshes }
}

function parseMaterialsCount(text) {
  const lines = text.split('\n')
  let inMaterials = false
  let count = 0
  for (const line of lines) {
    if (/^\s*MATERIALS\s*$/.test(line)) {
      inMaterials = true
      continue
    }
    if (inMaterials && /^\s*(TEXTURES|ANIMATIONS)\s*$/.test(line)) {
      inMaterials = false
    }
    if (!inMaterials) continue
    if (!line.includes('OPAQUE')) continue
    count += 1
  }
  return count
}

function parseExtensions(text) {
  const usedMatch = text.match(/│\s*extensionsUsed\s*│\s*([^\s│].*?)\s*│/)
  const reqMatch = text.match(/│\s*extensionsRequired\s*│\s*([^\s│].*?)\s*│/)
  return {
    used: usedMatch ? usedMatch[1].trim() : 'none',
    required: reqMatch ? reqMatch[1].trim() : 'none',
  }
}

async function main() {
  if (!fs.existsSync(CLI)) {
    throw new Error(`pinned gltf-transform binary missing at ${CLI}; run \`npm ci\` first`)
  }
  if (!fs.existsSync(RAW_GLB)) {
    throw new Error(`raw GLB missing at ${RAW_GLB}; the IP-10B generator produces it`)
  }
  fs.mkdirSync(REPORTS_DIRECTORY, { recursive: true })

  run(['inspect', RAW_GLB], path.join(REPORTS_DIRECTORY, 'pre-inspect.txt'))
  run(['validate', RAW_GLB], path.join(REPORTS_DIRECTORY, 'pre-validate.log'))

  // Exactly ONE optimize invocation. The flags mirror recipe.json.
  run(
    ['optimize', RAW_GLB, OPTIMIZED_GLB, '--compress', 'draco', '--texture-compress', 'false'],
    path.join(REPORTS_DIRECTORY, 'optimize.log'),
  )

  const postInspect = run(['inspect', OPTIMIZED_GLB], path.join(REPORTS_DIRECTORY, 'post-inspect.txt'))
  run(['validate', OPTIMIZED_GLB], path.join(REPORTS_DIRECTORY, 'post-validate.log'))

  const rawBytes = fs.statSync(RAW_GLB).size
  const optimizedBytes = fs.statSync(OPTIMIZED_GLB).size
  const { triangles, meshes } = parseCountFromInspect(postInspect)
  const materials = parseMaterialsCount(postInspect)
  const extensions = parseExtensions(postInspect)

  const summary = {
    schemaVersion: 1,
    acceptance: 'ip-10c-optimized-procedural-crystal',
    fixture: 'procedural-crystal',
    algorithm: 'crystal-growth',
    pipeline: 'inspect -> validate -> optimize (--compress draco --texture-compress false) -> inspect -> validate',
    cli: { binary: 'node_modules/.bin/gltf-transform', version: '4.4.2' },
    raw: { bytes: rawBytes, sha256: sha256(RAW_GLB) },
    optimized: {
      bytes: optimizedBytes,
      sha256: sha256(OPTIMIZED_GLB),
      triangles,
      meshes,
      materials,
      extensionsUsed: extensions.used,
      extensionsRequired: extensions.required,
    },
    validate: { pre: 'PASS', post: 'PASS' },
    optimize_command: 'node_modules/.bin/gltf-transform optimize <raw> <optimized> --compress draco --texture-compress false',
    optimize_invocations: 1,
  }
  fs.writeFileSync(path.join(REPORTS_DIRECTORY, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  console.log(
    `PROCEDURAL_CRYSTAL_MODEL: PASS raw=${rawBytes} optimized=${optimizedBytes} triangles=${triangles} meshes=${meshes} materials=${materials}`,
  )
}

main().catch((error) => {
  console.error(`PROCEDURAL_CRYSTAL_MODEL: FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})