#!/usr/bin/env node

/**
 * Generates the Orbit One product model (IP-07A provenance source).
 *
 * A deterministic, dependency-free-of-the-pipeline procedure: five primitives
 * assembled from the product spec below, exported with three's GLTFExporter to
 * .wdu-model-source/orbit-one-raw.glb (gitignored). The runtime asset is the
 * OPTIMIZED output of scripts/build-model.mjs, never this raw export.
 *
 * The product spec is part of the fixture's capture metadata: same script,
 * same spec, same GLB bytes. Change a dimension here only as an intentional
 * model-contract change, and re-run the pipeline afterwards.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  Vector2,
} from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

/**
 * Minimal FileReader polyfill for Node: the exporter's GLB path reads Blobs
 * through FileReader.readAsArrayBuffer. Node has Blob but no FileReader;
 * Blob.arrayBuffer() is the exact equivalent.
 */
class FileReaderPolyfill {
  result = null
  readAsArrayBuffer(blob) {
    blob
      .arrayBuffer()
      .then((buffer) => {
        this.result = buffer
        this.onloadend?.()
      })
      .catch(() => {
        this.onerror?.()
      })
  }
}
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = FileReaderPolyfill
}

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..')
const SOURCE_DIRECTORY = path.join(PROJECT_ROOT, '.wdu-model-source')
const RAW_OUTPUT = path.join(SOURCE_DIRECTORY, 'orbit-one-raw.glb')

/**
 * Orbit One — a 380 g portable speaker, 98 mm tall.
 *
 * Body profile (radius, height) in metres, lathed around Y: a slightly
 * flared base, straight sides, a rounded shoulder. Five materials total:
 * body, grille, control ring, LED, base.
 */
const BODY_PROFILE = [
  new Vector2(0.30, -0.42),
  new Vector2(0.32, -0.34),
  new Vector2(0.32, 0.16),
  new Vector2(0.28, 0.38),
  new Vector2(0.22, 0.44),
]

function createModel() {
  const group = new Group()
  group.name = 'OrbitOne'

  const bodyMaterial = new MeshStandardMaterial({
    name: 'OrbitOne.BodyMaterial',
    color: 0x2f333d,
    roughness: 0.55,
    metalness: 0.25,
  })
  const grilleMaterial = new MeshStandardMaterial({
    name: 'OrbitOne.GrilleMaterial',
    color: 0x191b21,
    roughness: 0.95,
    metalness: 0.0,
  })
  const ringMaterial = new MeshStandardMaterial({
    name: 'OrbitOne.RingMaterial',
    color: 0xc8764a,
    roughness: 0.32,
    metalness: 0.75,
  })
  const ledMaterial = new MeshStandardMaterial({
    name: 'OrbitOne.LedMaterial',
    color: 0xffd9a0,
    emissive: 0xffb86b,
    emissiveIntensity: 2.2,
    roughness: 0.4,
  })
  const baseMaterial = new MeshStandardMaterial({
    name: 'OrbitOne.BaseMaterial',
    color: 0x101216,
    roughness: 0.8,
    metalness: 0.05,
  })

  const body = new Mesh(new LatheGeometry(BODY_PROFILE, 64), bodyMaterial)
  body.name = 'OrbitOne.Body'

  const grille = new Mesh(new CylinderGeometry(0.295, 0.30, 0.28, 64), grilleMaterial)
  grille.name = 'OrbitOne.Grille'
  grille.position.y = -0.02

  const ring = new Mesh(new TorusGeometry(0.17, 0.014, 16, 64), ringMaterial)
  ring.name = 'OrbitOne.ControlRing'
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.435

  const led = new Mesh(new CylinderGeometry(0.02, 0.02, 0.012, 24), ledMaterial)
  led.name = 'OrbitOne.Led'
  led.position.y = 0.465

  const base = new Mesh(new CylinderGeometry(0.34, 0.36, 0.07, 64), baseMaterial)
  base.name = 'OrbitOne.Base'
  base.position.y = -0.455

  group.add(body, grille, ring, led, base)
  return group
}

async function exportGlb(scene, target) {
  const exporter = new GLTFExporter()
  const result = await new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (gltf) => resolve(gltf),
      (error) => reject(error),
      { binary: true },
    )
  })
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, Buffer.from(result))
}

async function main() {
  const model = createModel()
  await exportGlb(model, RAW_OUTPUT)
  const bytes = fs.statSync(RAW_OUTPUT).size
  console.log(`MODEL_GENERATE: OK raw=${RAW_OUTPUT} bytes=${bytes}`)
}

main().catch((error) => {
  console.error(`MODEL_GENERATE: FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
