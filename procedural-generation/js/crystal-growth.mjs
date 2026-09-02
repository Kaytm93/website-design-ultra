#!/usr/bin/env node

/**
 * Deterministic, dependency-free crystal-growth generator for the procedural
 * geometry source stage. It writes a standards-compliant glTF 2.0 binary and a
 * provenance report; the existing 3d-asset-pipeline still owns inspect,
 * validate, and optimize after this file has finished.
 */

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const SCRIPT_VERSION = '1.0.0'
export const COLLECTION_NAME = 'Procedural__Crystal'
export const DEFAULT_OPTIONS = Object.freeze({
  shape: 'crystal',
  seed: 1337,
  iterations: 6,
  facets: 96,
  outputDir: null,
  glbPath: null,
  reportPath: null,
})

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const MAX_SEED = 0xffffffff
const SHAPE_ALIASES = Object.freeze({
  crystal: 'crystal',
  'crystal-growth': 'crystal',
  quartz: 'quartz',
  cluster: 'cluster',
  spike: 'spike',
})

const SHAPE_PROFILES = Object.freeze({
  crystal: Object.freeze({
    branching: 2,
    spread: 0.24,
    length: 0.92,
    radius: 0.14,
    taper: 0.34,
    twist: 0.15,
  }),
  quartz: Object.freeze({
    branching: 2,
    spread: 0.17,
    length: 1.05,
    radius: 0.12,
    taper: 0.28,
    twist: 0.08,
  }),
  cluster: Object.freeze({
    branching: 3,
    spread: 0.38,
    length: 0.72,
    radius: 0.11,
    taper: 0.42,
    twist: 0.24,
  }),
  spike: Object.freeze({
    branching: 1,
    spread: 0.06,
    length: 1.16,
    radius: 0.16,
    taper: 0.2,
    twist: 0.03,
  }),
})

function failOption(message) {
  throw new TypeError(`Invalid crystal-growth option: ${message}`)
}

function integerOption(value, name, minimum, maximum) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    failOption(`${name} must be an integer from ${minimum} to ${maximum}`)
  }
  return number
}

function normalizedShape(value) {
  const shape = String(value ?? '').trim().toLowerCase()
  const canonical = SHAPE_ALIASES[shape]
  if (!canonical) {
    failOption(`shape must be one of ${Object.keys(SHAPE_PROFILES).join(', ')}`)
  }
  return canonical
}

export function normalizeOptions(input = {}) {
  const options = { ...DEFAULT_OPTIONS, ...input }
  return {
    shape: normalizedShape(options.shape),
    seed: integerOption(options.seed, 'seed', 0, MAX_SEED),
    iterations: integerOption(options.iterations, 'iterations', 1, 6),
    facets: integerOption(options.facets, 'facets', 3, 256),
    outputDir: options.outputDir ?? null,
    glbPath: options.glbPath ?? null,
    reportPath: options.reportPath ?? null,
  }
}

function splitOption(token) {
  const equals = token.indexOf('=')
  if (equals === -1) return [token, null]
  return [token.slice(0, equals), token.slice(equals + 1)]
}

function requiredValue(argv, index, inline, option) {
  if (inline !== null) return [inline, index]
  const next = argv[index + 1]
  if (next === undefined || next.startsWith('--')) {
    throw new TypeError(`Missing value for ${option}`)
  }
  return [next, index + 1]
}

/** Parse the standalone generator CLI without relying on a package. */
export function parseOptions(argv = []) {
  const options = { ...DEFAULT_OPTIONS }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--help' || token === '-h') {
      options.help = true
      continue
    }
    if (!token.startsWith('--')) {
      throw new TypeError(`Unexpected argument ${token}`)
    }
    const [option, inline] = splitOption(token)
    const [value, consumedIndex] = requiredValue(argv, index, inline, option)
    index = consumedIndex
    switch (option) {
      case '--shape':
        options.shape = value
        break
      case '--seed':
        options.seed = value
        break
      case '--iterations':
        options.iterations = value
        break
      case '--facets':
        options.facets = value
        break
      case '--output-dir':
      case '--output':
        options.outputDir = value
        break
      case '--glb':
      case '--glb-path':
        options.glbPath = value
        break
      case '--report':
      case '--report-path':
        options.reportPath = value
        break
      default:
        throw new TypeError(`Unknown option ${option}`)
    }
  }
  if (options.help) return options
  return normalizeOptions(options)
}

class RandomStream {
  constructor(seed) {
    this.state = (seed >>> 0) || 0x6d2b79f5
  }

  next() {
    let state = this.state
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    this.state = state >>> 0
    return this.state / 0x100000000
  }

  range(minimum, maximum) {
    return minimum + (maximum - minimum) * this.next()
  }
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function scale(vector, amount) {
  return [vector[0] * amount, vector[1] * amount, vector[2] * amount]
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function length(vector) {
  return Math.sqrt(dot(vector, vector))
}

function unit(vector) {
  const magnitude = length(vector)
  if (magnitude < 1e-12) return [0, 0, 1]
  return scale(vector, 1 / magnitude)
}

function rotateGrowthDirection(direction, spread, azimuth) {
  const d = unit(direction)
  const reference = Math.abs(d[2]) > 0.94 ? [1, 0, 0] : [0, 0, 1]
  const axisX = unit(cross(d, reference))
  const axisY = unit(cross(axisX, d))
  const radial = add(scale(axisX, Math.cos(azimuth)), scale(axisY, Math.sin(azimuth)))
  return unit(add(scale(d, Math.cos(spread)), scale(radial, Math.sin(spread))))
}

class PrimitiveBuilder {
  constructor(name, materialIndex) {
    this.name = name
    this.materialIndex = materialIndex
    this.positions = []
    this.normals = []
    this.indices = []
    this.segmentCount = 0
  }

  addVertex(position, normal) {
    this.positions.push(position[0], position[1], position[2])
    this.normals.push(normal[0], normal[1], normal[2])
    return this.positions.length / 3 - 1
  }

  addSegment(start, direction, segmentLength, radiusBase, radiusTip, facets, phase) {
    const d = unit(direction)
    const reference = Math.abs(d[2]) > 0.94 ? [1, 0, 0] : [0, 0, 1]
    const axisX = unit(cross(d, reference))
    const axisY = unit(cross(axisX, d))
    const end = add(start, scale(d, segmentLength))
    const baseCenter = this.addVertex(start, scale(d, -1))
    const baseRing = []
    const tipRing = []

    for (let facet = 0; facet < facets; facet += 1) {
      const angle = phase + (Math.PI * 2 * facet) / facets
      const radial = unit(add(scale(axisX, Math.cos(angle)), scale(axisY, Math.sin(angle))))
      const sideNormal = unit(add(scale(radial, 0.96), scale(d, 0.12)))
      baseRing.push(this.addVertex(add(start, scale(radial, radiusBase)), sideNormal))
      tipRing.push(this.addVertex(add(end, scale(radial, radiusTip)), sideNormal))
    }

    const tipCenter = this.addVertex(end, d)
    for (let facet = 0; facet < facets; facet += 1) {
      const next = (facet + 1) % facets
      const baseA = baseRing[facet]
      const baseB = baseRing[next]
      const tipA = tipRing[facet]
      const tipB = tipRing[next]

      // Side wall.
      this.indices.push(baseA, baseB, tipB, baseA, tipB, tipA)
      // Both caps keep every growth segment a closed, independently movable
      // crystal facet; this also makes the topology statistic unambiguous.
      this.indices.push(baseCenter, baseB, baseA)
      this.indices.push(tipCenter, tipA, tipB)
    }
    this.segmentCount += 1
    return end
  }

  get vertexCount() {
    return this.positions.length / 3
  }

  get triangleCount() {
    return this.indices.length / 3
  }
}

function nonEmptyBuilders(builders) {
  return builders.filter((builder) => builder.triangleCount > 0)
}

function calculateBounds(values) {
  const minimum = [Infinity, Infinity, Infinity]
  const maximum = [-Infinity, -Infinity, -Infinity]
  for (let index = 0; index < values.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], values[index + axis])
      maximum[axis] = Math.max(maximum[axis], values[index + axis])
    }
  }
  return { minimum, maximum }
}

function hashText(value) {
  return createHash('sha256').update(value).digest('hex')
}

function hashTypedArrays(builders, field) {
  const serialized = builders.map((builder) => builder[field])
  return hashText(JSON.stringify(serialized))
}

function hashGeometry(builders) {
  const hash = createHash('sha256')
  for (const builder of builders) {
    hash.update(Buffer.from(new Float32Array(builder.positions).buffer))
    hash.update(Buffer.from(new Float32Array(builder.normals).buffer))
    const indexArray = builder.vertexCount > 65535
      ? new Uint32Array(builder.indices)
      : new Uint16Array(builder.indices)
    hash.update(Buffer.from(indexArray.buffer))
  }
  return hash.digest('hex')
}

function buildMaterialStatistics() {
  return [
    {
      name: 'Procedural__Crystal_Material',
      textures: [],
      texture_count: 0,
      dimensions: [],
    },
    {
      name: 'Procedural__Crystal_Tip_Material',
      textures: [],
      texture_count: 0,
      dimensions: [],
    },
  ]
}

function buildGeometryStatistics(builders) {
  const objects = builders.map((builder) => ({
    name: builder.name,
    vertices: builder.vertexCount,
    triangles: builder.triangleCount,
    material: builder.materialIndex === 0
      ? 'Procedural__Crystal_Material'
      : 'Procedural__Crystal_Tip_Material',
    segments: builder.segmentCount,
  }))
  const vertexCount = objects.reduce((sum, object) => sum + object.vertices, 0)
  const triangleCount = objects.reduce((sum, object) => sum + object.triangles, 0)
  const materialCount = 2
  return {
    object_count: objects.length,
    vertex_count: vertexCount,
    triangle_count: triangleCount,
    triangles: triangleCount,
    material_count: materialCount,
    draw_call_count: objects.length,
    mesh_count: objects.length,
    collection_names: [COLLECTION_NAME],
    objects,
  }
}

function createReport(parameters, builders, glbBuffer = null) {
  const geometry = buildGeometryStatistics(builders)
  const topologyHash = hashTypedArrays(builders, 'indices')
  const geometryHash = hashGeometry(builders)
  const report = {
    schemaVersion: 1,
    status: 'PASS',
    generator: {
      script: 'procedural-generation/js/crystal-growth.mjs',
      implementation: 'node-standard-library',
      version: SCRIPT_VERSION,
    },
    input_contract: {
      algorithm: 'crystal-growth',
      shape: parameters.shape,
      seed: parameters.seed,
      iterations: parameters.iterations,
      facets: parameters.facets,
      collection: COLLECTION_NAME,
    },
    parameters: {
      shape: parameters.shape,
      seed: parameters.seed,
      iterations: parameters.iterations,
      facets: parameters.facets,
    },
    geometry_statistics: {
      ...geometry,
      topology_hash: topologyHash,
      geometry_hash: geometryHash,
    },
    topology_statistics: {
      vertices: geometry.vertex_count,
      triangles: geometry.triangle_count,
      meshes: geometry.mesh_count,
      materials: geometry.material_count,
      topology_hash: topologyHash,
    },
    topology_hash: topologyHash,
    geometry_hash: geometryHash,
    material_statistics: buildMaterialStatistics(),
    output: {
      glb: 'crystal-growth.glb',
      report: 'report.json',
      bytes: glbBuffer ? glbBuffer.length : null,
      sha256: glbBuffer ? createHash('sha256').update(glbBuffer).digest('hex') : null,
    },
    provenance: {
      catalogue_entry: 'crystal-growth',
      source: 'JavaScript procedural generator; Blender remains an alternative source implementation',
      deterministic_prng: 'xorshift32 with an explicit seed',
      source_units: 'scene units',
      web_output_is_derived: true,
    },
    handoff: {
      next_pipeline: '3d-asset-pipeline',
      unchanged: true,
      contract: 'inspect -> validate -> optimize -> inspect -> validate',
      note: 'The existing handoff owns optimization; this generator only produces the source GLB.',
    },
  }
  return report
}

class BinaryPacker {
  constructor() {
    this.parts = []
    this.length = 0
  }

  add(typedArray, target) {
    const alignment = (4 - (this.length % 4)) % 4
    if (alignment) {
      this.parts.push(Buffer.alloc(alignment))
      this.length += alignment
    }
    const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength)
    const view = {
      byteOffset: this.length,
      byteLength: bytes.length,
      target,
    }
    this.parts.push(bytes)
    this.length += bytes.length
    return view
  }

  toBuffer() {
    return Buffer.concat(this.parts, this.length)
  }
}

function addBufferView(bufferViews, packer, typedArray, target) {
  const view = packer.add(typedArray, target)
  bufferViews.push({ buffer: 0, ...view })
  return bufferViews.length - 1
}

function addAccessor(accessors, bufferView, componentType, count, type, bounds = null) {
  const accessor = { bufferView, componentType, count, type }
  if (bounds) {
    accessor.min = bounds.minimum
    accessor.max = bounds.maximum
  }
  accessors.push(accessor)
  return accessors.length - 1
}

function addBuilderToGltf(builder, bufferViews, accessors, packer) {
  const positions = new Float32Array(builder.positions)
  const normals = new Float32Array(builder.normals)
  const maxIndex = builder.indices.reduce((maximum, index) => Math.max(maximum, index), 0)
  const indices = maxIndex > 65535
    ? new Uint32Array(builder.indices)
    : new Uint16Array(builder.indices)
  const positionView = addBufferView(bufferViews, packer, positions, 34962)
  const normalView = addBufferView(bufferViews, packer, normals, 34962)
  const indexView = addBufferView(bufferViews, packer, indices, 34963)
  const positionAccessor = addAccessor(
    accessors,
    positionView,
    5126,
    builder.vertexCount,
    'VEC3',
    calculateBounds(builder.positions),
  )
  const normalAccessor = addAccessor(accessors, normalView, 5126, builder.vertexCount, 'VEC3')
  const indexAccessor = addAccessor(
    accessors,
    indexView,
    maxIndex > 65535 ? 5125 : 5123,
    indices.length,
    'SCALAR',
  )
  return {
    name: builder.name,
    primitives: [{
      attributes: { POSITION: positionAccessor, NORMAL: normalAccessor },
      indices: indexAccessor,
      material: builder.materialIndex,
      mode: 4,
    }],
  }
}

function paddedChunk(bytes, paddingByte) {
  const padding = (4 - (bytes.length % 4)) % 4
  if (!padding) return bytes
  return Buffer.concat([bytes, Buffer.alloc(padding, paddingByte)])
}

function buildGlb(builders, parameters) {
  const packer = new BinaryPacker()
  const bufferViews = []
  const accessors = []
  const meshes = []
  for (const builder of builders) {
    meshes.push(addBuilderToGltf(builder, bufferViews, accessors, packer))
  }
  const children = meshes.map((mesh, index) => ({
    name: mesh.name.replace(/_Mesh$/, ''),
    mesh: index,
  }))
  const gltf = {
    asset: {
      version: '2.0',
      generator: 'website-design-ultra procedural-generation/js',
    },
    scene: 0,
    scenes: [{ name: COLLECTION_NAME, nodes: [0] }],
    nodes: [{
      name: COLLECTION_NAME,
      children: children.map((_child, index) => index + 1),
      extras: {
        procedural: true,
        algorithm: 'crystal-growth',
        shape: parameters.shape,
        seed: parameters.seed,
        iterations: parameters.iterations,
        facets: parameters.facets,
      },
    }, ...children],
    meshes,
    materials: [
      {
        name: 'Procedural__Crystal_Material',
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: [0.16, 0.48, 0.92, 1],
          metallicFactor: 0.18,
          roughnessFactor: 0.26,
        },
      },
      {
        name: 'Procedural__Crystal_Tip_Material',
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: [0.62, 0.86, 1, 1],
          metallicFactor: 0.08,
          roughnessFactor: 0.2,
        },
      },
    ],
    accessors,
    bufferViews,
    buffers: [{ byteLength: packer.length }],
  }
  const json = paddedChunk(Buffer.from(JSON.stringify(gltf), 'utf8'), 0x20)
  const binary = paddedChunk(packer.toBuffer(), 0)
  const totalLength = 12 + 8 + json.length + 8 + binary.length
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(totalLength, 8)
  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(json.length, 0)
  jsonHeader.writeUInt32LE(0x4e4f534a, 4)
  const binaryHeader = Buffer.alloc(8)
  binaryHeader.writeUInt32LE(binary.length, 0)
  binaryHeader.writeUInt32LE(0x004e4942, 4)
  return {
    buffer: Buffer.concat([header, jsonHeader, json, binaryHeader, binary]),
    gltf,
  }
}

/** Build deterministic geometry and the GLB in memory. */
export function generateCrystal(input = {}) {
  const parameters = normalizeOptions(input)
  const profile = SHAPE_PROFILES[parameters.shape]
  const random = new RandomStream(parameters.seed)
  const base = new PrimitiveBuilder('Procedural__Crystal_Base_Mesh', 0)
  const tips = new PrimitiveBuilder('Procedural__Crystal_Tips_Mesh', 1)
  let activeTips = [{ position: [0, 0, 0], direction: [0, 0, 1] }]

  for (let iteration = 0; iteration < parameters.iterations; iteration += 1) {
    const nextTips = []
    const radiusBase = profile.radius * Math.pow(0.7, iteration)
    const radiusTip = radiusBase * profile.taper
    for (const active of activeTips) {
      for (let branch = 0; branch < profile.branching; branch += 1) {
        const azimuth = random.range(0, Math.PI * 2)
        const spread = profile.spread * random.range(0.72, 1.28) * (1 + iteration * 0.025)
        const direction = rotateGrowthDirection(active.direction, spread, azimuth)
        const segmentLength = profile.length
          * (1 + iteration * 0.055)
          * random.range(0.9, 1.1)
        const phase = random.range(0, Math.PI * 2) + profile.twist * iteration
        const target = iteration === parameters.iterations - 1 ? tips : base
        const end = target.addSegment(
          active.position,
          direction,
          segmentLength,
          radiusBase,
          radiusTip,
          parameters.facets,
          phase,
        )
        if (iteration + 1 < parameters.iterations) {
          nextTips.push({ position: end, direction })
        }
      }
    }
    activeTips = nextTips
  }

  const builders = nonEmptyBuilders([base, tips])
  const geometry = buildGeometryStatistics(builders)
  if (geometry.triangle_count < 1) {
    throw new Error('crystal-growth produced no triangles')
  }
  const glb = buildGlb(builders, parameters)
  const report = createReport(parameters, builders, glb.buffer)
  return {
    parameters,
    builders,
    geometry,
    glb: glb.buffer,
    gltf: glb.gltf,
    report,
  }
}

function resolveOutputPaths(options) {
  const outputDir = options.outputDir
    ? path.resolve(String(options.outputDir))
    : SCRIPT_DIRECTORY
  const glbPath = options.glbPath
    ? path.resolve(String(options.glbPath))
    : path.join(outputDir, 'crystal-growth.glb')
  const reportPath = options.reportPath
    ? path.resolve(String(options.reportPath))
    : path.join(outputDir, 'report.json')
  if (glbPath === reportPath) throw new TypeError('GLB and report paths must be different')
  return { outputDir, glbPath, reportPath }
}

/** Generate and persist the GLB plus its hash/statistics report. */
export async function writeGeneration(input = {}) {
  const options = normalizeOptions(input)
  const paths = resolveOutputPaths(options)
  const generated = generateCrystal(options)
  const report = {
    ...generated.report,
    output: {
      ...generated.report.output,
      glb: path.basename(paths.glbPath),
      report: path.basename(paths.reportPath),
      bytes: generated.glb.length,
      sha256: createHash('sha256').update(generated.glb).digest('hex'),
    },
  }
  await mkdir(paths.outputDir, { recursive: true })
  await mkdir(path.dirname(paths.glbPath), { recursive: true })
  await mkdir(path.dirname(paths.reportPath), { recursive: true })
  await writeFile(paths.glbPath, generated.glb)
  await writeFile(paths.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return { ...generated, report, ...paths }
}

export function usage() {
  return `Usage: node procedural-generation/js/crystal-growth.mjs [options]\n\nOptions:\n  --shape <crystal|quartz|cluster|spike>\n  --seed <0..4294967295>\n  --iterations <1..6>\n  --facets <3..256>\n  --output-dir <directory>\n  --glb <path>\n  --report <path>\n\nDefaults write crystal-growth.glb and report.json beside this script.`
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  try {
    const options = parseOptions(process.argv.slice(2))
    if (options.help) {
      process.stdout.write(`${usage()}\n`)
    } else {
      const result = await writeGeneration(options)
      process.stdout.write(
        `CRYSTAL_GROWTH_JS: PASS shape=${result.parameters.shape} seed=${result.parameters.seed} `
        + `iterations=${result.parameters.iterations} facets=${result.parameters.facets} `
        + `triangles=${result.geometry.triangle_count} glb=${result.glbPath} report=${result.reportPath}\n`,
      )
    }
  } catch (error) {
    process.stderr.write(`CRYSTAL_GROWTH_JS: FAIL ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
