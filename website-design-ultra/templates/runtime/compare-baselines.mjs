#!/usr/bin/env node

/**
 * IP-06C offline baseline comparison.
 *
 * Compares two deterministic capture sets — a committed baseline and a
 * candidate run — produced by the checkpoint verifier
 * (website-design-ultra/scripts/verify-browser.mjs --checkpoints) and
 * classifies every difference into exactly one of four buckets:
 *
 * - structural-regression: the capture surface changed shape (checkpoint
 *   ids, viewport, project, capture files, decodability);
 * - perceptual-difference: both sides are deterministic and pixels differ
 *   outside every declared mask. The score is evidence of change, never an
 *   aesthetic verdict, taste, or approval;
 * - expected-dynamic-variation: differences inside a mask the project
 *   declared as varying;
 * - nondeterministic-content: differences the capture metadata itself
 *   records as not deterministically resolved, or inside a mask declared
 *   nondeterministic.
 *
 * A deterministic mismatch is never routed into a dynamic bucket: without a
 * declared mask it is a perceptual difference; with one it is that mask's
 * declared class. The comparison refuses to run — and reports UNAVAILABLE —
 * when either side lacks deterministic capture metadata (checkpoints.json
 * with schemaVersion, surface, and modeInput WDU_DETERMINISTIC=1).
 *
 * Exit codes: 0 = PASS (no unexpected difference), 1 = FAIL (structural or
 * perceptual difference outside declared masks/tolerances, or a capture that
 * did not resolve deterministic mode), 2 = UNAVAILABLE (comparison refused).
 *
 * The PNG codec is deliberately small and dependency-free: 8-bit, non-interlaced
 * PNG only, matching what the verifier writes. Everything else is refused.
 */

import { deflateSync, inflateSync } from 'node:zlib'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BASELINE_COMPARISON_SCHEMA_VERSION,
  BASELINE_COMPARISON_SURFACE_ID,
  EVIDENCE_STATEMENT,
  validateComparisonDeclaration,
} from './baseline-comparison.ts'

const CHECKPOINT_SCHEMA_VERSION = 1
const CHECKPOINT_SURFACE_ID = 'wdu.interaction-checkpoints'
const CHECKPOINT_MODE_INPUT = 'WDU_DETERMINISTIC=1'

export const REPORT_SCHEMA_VERSION = 1
export const REPORT_SURFACE_ID = 'wdu.baseline-comparison'

/** Strict default when the declaration names no tolerance; always named in the report. */
export const DEFAULT_TOLERANCE = Object.freeze({
  id: 'strict-default',
  maxChannelDelta: 0,
  maxChangedFraction: 0,
  maxMeanAbsDifference: 0,
  source:
    'built-in strict default (zero tolerance); documented in determinism.md section 8 and compare-baselines.mjs',
})

export class ComparisonUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ComparisonUnavailableError'
  }
}

/* ------------------------------------------------------------------ */
/* PNG codec (8-bit, non-interlaced)                                   */
/* ------------------------------------------------------------------ */

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const COLOR_TYPE_GRAY = 0
const COLOR_TYPE_RGB = 2
const COLOR_TYPE_GRAY_ALPHA = 4
const COLOR_TYPE_RGBA = 6

const CHANNELS_BY_COLOR_TYPE = {
  [COLOR_TYPE_GRAY]: 1,
  [COLOR_TYPE_RGB]: 3,
  [COLOR_TYPE_GRAY_ALPHA]: 2,
  [COLOR_TYPE_RGBA]: 4,
}

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])))
  return Buffer.concat([length, typeBytes, data, crc])
}

/**
 * Encodes RGBA pixel data as an 8-bit, non-interlaced RGBA PNG with filter 0
 * scanlines. Exported so fixtures and tests can build capture PNGs without a
 * browser or a package dependency.
 */
export function encodePng(width, height, rgba) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('PNG dimensions must be positive integers')
  }
  if (!Buffer.isBuffer(rgba) || rgba.length !== width * height * 4) {
    throw new Error('RGBA buffer length must equal width * height * 4')
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = COLOR_TYPE_RGBA
  header[10] = 0 // compression
  header[11] = 0 // filter method
  header[12] = 0 // interlace

  const stride = width * 4
  const raw = Buffer.alloc(height * (1 + stride))
  for (let y = 0; y < height; y += 1) {
    raw[y * (1 + stride)] = 0 // filter: none
    rgba.copy(raw, y * (1 + stride) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/**
 * Decodes an 8-bit, non-interlaced PNG to { width, height, rgba }.
 * Grayscale, grayscale+alpha, RGB, and RGBA are supported; indexed color,
 * 16-bit depth, and interlacing are refused as unsupported.
 */
export function readPngPixels(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 33) {
    throw new Error('not a PNG file')
  }
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error('not a PNG file')
  }
  let offset = 8
  let width = 0
  let height = 0
  let colorType = -1
  let bitDepth = 0
  let interlace = 0
  const idat = []
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString('ascii', offset + 4, offset + 8)
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    if (offset + 12 + length > bytes.length) {
      throw new Error(`truncated PNG chunk ${type}`)
    }
    if (type === 'IHDR') {
      if (data.length !== 13) throw new Error('malformed PNG IHDR chunk')
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }
  if (width < 1 || height < 1 || width > 16384 || height > 16384) {
    throw new Error(`unsupported PNG dimensions ${width}x${height}`)
  }
  if (bitDepth !== 8) {
    throw new Error(`unsupported PNG bit depth ${bitDepth}; only 8-bit PNG is comparable`)
  }
  if (interlace !== 0) {
    throw new Error('interlaced PNG is not supported')
  }
  const channels = CHANNELS_BY_COLOR_TYPE[colorType]
  if (channels === undefined) {
    throw new Error(`unsupported PNG color type ${colorType}`)
  }
  const inflated = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const expected = height * (1 + stride)
  if (inflated.length !== expected) {
    throw new Error(`PNG scanline data length ${inflated.length} does not match ${expected}`)
  }

  const rgba = Buffer.alloc(width * height * 4)
  const previous = Buffer.alloc(stride)
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + stride)
    const filter = inflated[rowStart]
    if (filter > 4) throw new Error(`unsupported PNG filter type ${filter}`)
    const row = inflated.subarray(rowStart + 1, rowStart + 1 + stride)
    const unfiltered = Buffer.alloc(stride)
    for (let i = 0; i < stride; i += 1) {
      const raw = row[i]
      const a = i >= channels ? unfiltered[i - channels] : 0
      const b = previous[i]
      const c = i >= channels ? previous[i - channels] : 0
      let value = raw
      if (filter === 1) value = (raw + a) & 0xff
      else if (filter === 2) value = (raw + b) & 0xff
      else if (filter === 3) value = (raw + Math.floor((a + b) / 2)) & 0xff
      else if (filter === 4) value = (raw + paeth(a, b, c)) & 0xff
      unfiltered[i] = value
    }
    const outStart = y * width * 4
    for (let x = 0; x < width; x += 1) {
      const inIndex = x * channels
      const outIndex = outStart + x * 4
      if (colorType === COLOR_TYPE_GRAY) {
        const v = unfiltered[inIndex]
        rgba[outIndex] = v
        rgba[outIndex + 1] = v
        rgba[outIndex + 2] = v
        rgba[outIndex + 3] = 255
      } else if (colorType === COLOR_TYPE_GRAY_ALPHA) {
        const v = unfiltered[inIndex]
        rgba[outIndex] = v
        rgba[outIndex + 1] = v
        rgba[outIndex + 2] = v
        rgba[outIndex + 3] = unfiltered[inIndex + 1]
      } else if (colorType === COLOR_TYPE_RGB) {
        rgba[outIndex] = unfiltered[inIndex]
        rgba[outIndex + 1] = unfiltered[inIndex + 1]
        rgba[outIndex + 2] = unfiltered[inIndex + 2]
        rgba[outIndex + 3] = 255
      } else {
        rgba[outIndex] = unfiltered[inIndex]
        rgba[outIndex + 1] = unfiltered[inIndex + 1]
        rgba[outIndex + 2] = unfiltered[inIndex + 2]
        rgba[outIndex + 3] = unfiltered[inIndex + 3]
      }
    }
    previous.set(unfiltered)
  }
  return { width, height, rgba }
}

/* ------------------------------------------------------------------ */
/* Pixel metrics                                                       */
/* ------------------------------------------------------------------ */

/**
 * Computes per-pixel and aggregate metrics between two RGBA buffers of equal
 * dimensions. A pixel counts as changed when any channel differs by more
 * than maxChannelDelta. The highlight buffer dims unchanged pixels and marks
 * changed pixels red, for the diff artifact.
 */
export function diffMetrics(one, other, width, height, maxChannelDelta) {
  if (one.length !== width * height * 4 || other.length !== width * height * 4) {
    throw new Error('RGBA buffers must match the declared dimensions')
  }
  const totalPixels = width * height
  const deltas = new Uint16Array(totalPixels)
  const highlight = Buffer.alloc(one.length)
  let changedPixels = 0
  let meanAbs = 0
  let observedMaxDelta = 0
  for (let i = 0; i < totalPixels; i += 1) {
    const o = i * 4
    const d0 = Math.abs(one[o] - other[o])
    const d1 = Math.abs(one[o + 1] - other[o + 1])
    const d2 = Math.abs(one[o + 2] - other[o + 2])
    const d3 = Math.abs(one[o + 3] - other[o + 3])
    const max = Math.max(d0, d1, d2, d3)
    deltas[i] = max
    meanAbs += (d0 + d1 + d2 + d3) / 4 / 255
    if (max > observedMaxDelta) observedMaxDelta = max
    if (max > maxChannelDelta) {
      changedPixels += 1
      highlight[o] = 255
      highlight[o + 1] = 0
      highlight[o + 2] = 0
      highlight[o + 3] = 255
    } else {
      highlight[o] = Math.round(one[o] * 0.25)
      highlight[o + 1] = Math.round(one[o + 1] * 0.25)
      highlight[o + 2] = Math.round(one[o + 2] * 0.25)
      highlight[o + 3] = one[o + 3]
    }
  }
  return {
    totalPixels,
    changedPixels,
    changedFraction: totalPixels === 0 ? 0 : changedPixels / totalPixels,
    meanAbsDifference: meanAbs / totalPixels,
    maxChannelDelta: observedMaxDelta,
    deltas,
    highlight,
  }
}

function pixelInsideMask(mask, x, y) {
  const rect = mask.rect
  return (
    x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
  )
}

/**
 * Assigns changed pixels (delta above the same maxChannelDelta threshold the
 * metrics used) to the first containing declared mask (declaration order) or
 * to the outside region. Returns outside-mask aggregate deltas, the per-mask
 * changed counts, and the first touched mask.
 */
export function maskCoverage(metrics, masks, width, height, maxChannelDelta) {
  const perMask = new Map(masks.map((mask) => [mask.id, 0]))
  let outsideChanged = 0
  let outsideMeanAbs = 0
  let outsideMaxDelta = 0
  let firstTouched = null
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (metrics.deltas[index] <= maxChannelDelta) continue
      let covered = null
      for (const mask of masks) {
        if (pixelInsideMask(mask, x, y)) {
          covered = mask
          break
        }
      }
      if (covered !== null) {
        perMask.set(covered.id, perMask.get(covered.id) + 1)
        if (firstTouched === null) firstTouched = covered
      } else {
        outsideChanged += 1
        outsideMeanAbs += metrics.deltas[index] / 255
        if (metrics.deltas[index] > outsideMaxDelta) outsideMaxDelta = metrics.deltas[index]
      }
    }
  }
  const outsidePixels = width * height
  return {
    outsideChanged,
    outsideChangedFraction: outsidePixels === 0 ? 0 : outsideChanged / outsidePixels,
    outsideMeanAbsDifference: outsidePixels === 0 ? 0 : outsideMeanAbs / outsidePixels,
    outsideMaxDelta,
    firstTouched,
    perMaskChanged: [...perMask.entries()].map(([id, count]) => ({ id, count })),
  }
}

/* ------------------------------------------------------------------ */
/* Capture sets and classification                                     */
/* ------------------------------------------------------------------ */

/**
 * Loads and validates one capture set. Throws ComparisonUnavailableError when
 * the side lacks deterministic capture metadata — the refusal that makes an
 * unsupported comparison UNAVAILABLE.
 */
export function loadCaptureSet(directory, label) {
  const metadataPath = path.join(directory, 'checkpoints.json')
  if (!fs.existsSync(metadataPath)) {
    throw new ComparisonUnavailableError(
      `${label} has no deterministic capture metadata (checkpoints.json missing); comparison refused`,
    )
  }
  let metadata
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
  } catch (error) {
    throw new ComparisonUnavailableError(
      `${label} checkpoints.json is not valid JSON (${error instanceof Error ? error.message : String(error)}); comparison refused`,
    )
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new ComparisonUnavailableError(`${label} checkpoints.json is not an object; comparison refused`)
  }
  if (metadata.schemaVersion !== CHECKPOINT_SCHEMA_VERSION) {
    throw new ComparisonUnavailableError(
      `${label} capture metadata schemaVersion ${String(metadata.schemaVersion)} is unsupported; comparison refused`,
    )
  }
  if (metadata.surface !== CHECKPOINT_SURFACE_ID) {
    throw new ComparisonUnavailableError(
      `${label} capture metadata surface ${JSON.stringify(metadata.surface)} is not ${CHECKPOINT_SURFACE_ID}; comparison refused`,
    )
  }
  if (metadata.modeInput !== CHECKPOINT_MODE_INPUT) {
    throw new ComparisonUnavailableError(
      `${label} capture metadata modeInput ${JSON.stringify(metadata.modeInput)} does not request deterministic mode; comparison refused`,
    )
  }
  if (typeof metadata.project !== 'string' || metadata.project.length === 0) {
    throw new ComparisonUnavailableError(`${label} capture metadata has no project; comparison refused`)
  }
  const viewport = metadata.viewport
  if (
    !viewport ||
    typeof viewport !== 'object' ||
    !Number.isInteger(viewport.width) ||
    !Number.isInteger(viewport.height) ||
    viewport.width < 1 ||
    viewport.height < 1
  ) {
    throw new ComparisonUnavailableError(`${label} capture metadata has no valid viewport; comparison refused`)
  }
  if (!Array.isArray(metadata.entries) || metadata.entries.length === 0) {
    throw new ComparisonUnavailableError(`${label} capture metadata has no entries; comparison refused`)
  }
  for (const entry of metadata.entries) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.id !== 'string' ||
      entry.id.length === 0 ||
      typeof entry.file !== 'string' ||
      entry.file.length === 0
    ) {
      throw new ComparisonUnavailableError(`${label} capture metadata has a malformed entry; comparison refused`)
    }
  }
  return {
    directory,
    project: metadata.project,
    modeInput: metadata.modeInput,
    readyMarker: metadata.readyMarker,
    viewport,
    entries: metadata.entries,
  }
}

function isDeterministicEvidence(entry) {
  return entry.status === 'CAPTURED' && entry.modeResolved === 'deterministic'
}

function entryBase(id) {
  return {
    id,
    class: null,
    score: null,
    mask: null,
    withinTolerance: null,
    reason: null,
    diffFile: null,
  }
}

function classifyEntry(baselineDir, candidateDir, baselineEntry, candidateEntry, masks, tolerance) {
  const result = entryBase(baselineEntry.id)
  const baselineDeterministic = isDeterministicEvidence(baselineEntry)
  const candidateDeterministic = isDeterministicEvidence(candidateEntry)
  if (!baselineDeterministic || !candidateDeterministic) {
    // The capture metadata itself does not establish deterministic evidence.
    // This is nondeterministic content, classified and flagged — the
    // metadata is present and names the condition, so the comparison runs.
    const side = !baselineDeterministic ? 'baseline' : 'candidate'
    const entry = !baselineDeterministic ? baselineEntry : candidateEntry
    const detail =
      entry.status !== 'CAPTURED'
        ? `status ${entry.status}${entry.reason ? ` (${entry.reason})` : ''}`
        : `modeResolved ${JSON.stringify(entry.modeResolved)}`
    result.class = 'nondeterministic-content'
    result.reason = `${side} capture metadata records no deterministic resolution (${detail})`
    return result
  }

  const baselinePngPath = path.join(baselineDir, 'checkpoints', baselineEntry.file)
  const candidatePngPath = path.join(candidateDir, 'checkpoints', candidateEntry.file)
  if (!fs.existsSync(baselinePngPath) || !fs.existsSync(candidatePngPath)) {
    const missing = !fs.existsSync(baselinePngPath) ? baselinePngPath : candidatePngPath
    result.class = 'structural-regression'
    result.reason = `capture PNG missing: ${missing}`
    return result
  }

  let baselinePixels
  let candidatePixels
  try {
    baselinePixels = readPngPixels(fs.readFileSync(baselinePngPath))
    candidatePixels = readPngPixels(fs.readFileSync(candidatePngPath))
  } catch (error) {
    result.class = 'structural-regression'
    result.reason = `capture PNG cannot be decoded: ${error instanceof Error ? error.message : String(error)}`
    return result
  }
  if (
    baselinePixels.width !== candidatePixels.width ||
    baselinePixels.height !== candidatePixels.height
  ) {
    result.class = 'structural-regression'
    result.reason = `capture dimensions differ (${baselinePixels.width}x${baselinePixels.height} vs ${candidatePixels.width}x${candidatePixels.height})`
    return result
  }

  const metrics = diffMetrics(
    baselinePixels.rgba,
    candidatePixels.rgba,
    baselinePixels.width,
    baselinePixels.height,
    tolerance.maxChannelDelta,
  )
  result.score = {
    bytes: baselinePixels.rgba.length,
    totalPixels: metrics.totalPixels,
    changedPixels: metrics.changedPixels,
    changedFraction: metrics.changedFraction,
    meanAbsDifference: metrics.meanAbsDifference,
    maxChannelDelta: metrics.maxChannelDelta,
  }
  if (metrics.changedPixels === 0) {
    result.class = 'identical'
    return result
  }

  const coverage = maskCoverage(metrics, masks, baselinePixels.width, baselinePixels.height, tolerance.maxChannelDelta)
  if (coverage.outsideChanged === 0) {
    // Every changed pixel sits inside a declared mask: the difference is the
    // mask's declared class, never a verdict on the region's content.
    result.class = coverage.firstTouched.class
    result.mask = {
      id: coverage.firstTouched.id,
      class: coverage.firstTouched.class,
      rect: coverage.firstTouched.rect,
      source: coverage.firstTouched.source,
    }
    result.reason = `all changed pixels are inside declared mask ${coverage.firstTouched.id}`
    result.diffFile = `${baselineEntry.id}.png`
    return result
  }

  // Deterministic mismatch outside every declared mask: perceptual evidence,
  // never routed into a dynamic bucket.
  result.class = 'perceptual-difference'
  result.withinTolerance =
    coverage.outsideChangedFraction <= tolerance.maxChangedFraction &&
    coverage.outsideMeanAbsDifference <= tolerance.maxMeanAbsDifference
  result.score = {
    ...result.score,
    outsideChangedPixels: coverage.outsideChanged,
    outsideChangedFraction: coverage.outsideChangedFraction,
    outsideMeanAbsDifference: coverage.outsideMeanAbsDifference,
  }
  result.reason = result.withinTolerance
    ? null
    : `deterministic mismatch outside every declared mask (changed fraction ${coverage.outsideChangedFraction.toFixed(6)} outside tolerance ${tolerance.maxChangedFraction})`
  result.diffFile = `${baselineEntry.id}.png`
  return result
}

/**
 * Classifies every checkpoint of the union of both capture sets. Structural
 * differences at the metadata level (project, viewport) are returned
 * separately from the per-entry classification.
 */
export function classifyCaptureDifference(baseline, candidate, declaration) {
  const baselineById = new Map(baseline.entries.map((entry) => [entry.id, entry]))
  const candidateById = new Map(candidate.entries.map((entry) => [entry.id, entry]))

  const structuralDifferences = []
  if (baseline.project !== candidate.project) {
    structuralDifferences.push({
      field: 'project',
      baseline: baseline.project,
      candidate: candidate.project,
    })
  }
  const baselineViewport = `${baseline.viewport.width}x${baseline.viewport.height}`
  const candidateViewport = `${candidate.viewport.width}x${candidate.viewport.height}`
  if (baselineViewport !== candidateViewport) {
    structuralDifferences.push({
      field: 'viewport',
      baseline: baselineViewport,
      candidate: candidateViewport,
    })
  }

  const masks = declaration?.masks ?? []
  const tolerance = declaration?.tolerance ?? DEFAULT_TOLERANCE
  const entries = []
  for (const [id, baselineEntry] of baselineById) {
    const candidateEntry = candidateById.get(id)
    if (candidateEntry === undefined) {
      const result = entryBase(id)
      result.class = 'structural-regression'
      result.reason = 'checkpoint is missing from the candidate capture set'
      entries.push(result)
      continue
    }
    entries.push(
      classifyEntry(baseline.directory, candidate.directory, baselineEntry, candidateEntry, masks, tolerance),
    )
  }
  for (const [id] of candidateById) {
    if (!baselineById.has(id)) {
      const result = entryBase(id)
      result.class = 'structural-regression'
      result.reason = 'checkpoint is new in the candidate capture set'
      entries.push(result)
    }
  }
  return { entries, structuralDifferences, masks, tolerance }
}

/* ------------------------------------------------------------------ */
/* Report and orchestration                                            */
/* ------------------------------------------------------------------ */

function writeJson(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}

function prepareOutputDirectory(requested) {
  if (!requested) {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-baseline-comparison-'))
  }
  if (fs.existsSync(requested)) {
    if (!fs.statSync(requested).isDirectory()) {
      throw new Error(`output path is not a directory: ${requested}`)
    }
    if (fs.readdirSync(requested).length > 0) {
      throw new Error(`output directory is not empty: ${requested}`)
    }
  } else {
    fs.mkdirSync(requested, { recursive: true })
  }
  return requested
}

function summarizeSet(set) {
  return {
    directory: set.directory,
    project: set.project,
    modeInput: set.modeInput,
    readyMarker: set.readyMarker,
    viewport: `${set.viewport.width}x${set.viewport.height}`,
    entryCount: set.entries.length,
  }
}

/**
 * Runs the comparison and writes comparison.json plus diff PNGs into out.
 * Returns { report, exitCode }. Refusals (missing or unsupported capture
 * metadata) return exitCode 2 with status UNAVAILABLE.
 */
export function compareCaptureSets({ baselineDirectory, candidateDirectory, declarationPath, out }) {
  const outputDirectory = prepareOutputDirectory(out)
  const masksApplied = []
  let tolerancesApplied = DEFAULT_TOLERANCE
  let declaration = null
  try {
    const baseline = loadCaptureSet(baselineDirectory, 'baseline')
    const candidate = loadCaptureSet(candidateDirectory, 'candidate')
    if (declarationPath !== undefined && declarationPath !== null) {
      declaration = validateComparisonDeclaration(
        JSON.parse(fs.readFileSync(declarationPath, 'utf8')),
      )
    }
    const classified = classifyCaptureDifference(baseline, candidate, declaration)
    masksApplied.push(...classified.masks)
    tolerancesApplied = classified.tolerance

    const diffDirectory = path.join(outputDirectory, 'diff')
    const diffArtifacts = []
    for (const entry of classified.entries) {
      if (entry.diffFile === null) continue
      const baselineEntry = baseline.entries.find((item) => item.id === entry.id)
      if (baselineEntry === undefined) continue
      const baselinePngPath = path.join(baseline.directory, 'checkpoints', baselineEntry.file)
      if (!fs.existsSync(baselinePngPath)) continue
      const baselinePixels = readPngPixels(fs.readFileSync(baselinePngPath))
      const candidateEntry = candidate.entries.find((item) => item.id === entry.id)
      const candidatePngPath =
        candidateEntry === undefined ? null : path.join(candidate.directory, 'checkpoints', candidateEntry.file)
      const metrics = diffMetrics(
        baselinePixels.rgba,
        candidatePngPath !== null && fs.existsSync(candidatePngPath)
          ? readPngPixels(fs.readFileSync(candidatePngPath)).rgba
          : baselinePixels.rgba,
        baselinePixels.width,
        baselinePixels.height,
        tolerancesApplied.maxChannelDelta,
      )
      fs.mkdirSync(diffDirectory, { recursive: true })
      const target = path.join(diffDirectory, entry.diffFile)
      fs.writeFileSync(target, encodePng(baselinePixels.width, baselinePixels.height, metrics.highlight))
      diffArtifacts.push(`diff/${entry.diffFile}`)
    }

    const classCounts = { identical: 0, 'structural-regression': 0, 'perceptual-difference': 0, 'expected-dynamic-variation': 0, 'nondeterministic-content': 0 }
    for (const entry of classified.entries) classCounts[entry.class] += 1

    const unexpected = [
      ...classified.structuralDifferences.map((difference) => ({
        class: 'structural-regression',
        field: difference.field,
        baseline: difference.baseline,
        candidate: difference.candidate,
      })),
      ...classified.entries.filter(
        (entry) =>
          entry.class === 'structural-regression' ||
          (entry.class === 'perceptual-difference' && entry.withinTolerance === false) ||
          (entry.class === 'nondeterministic-content' && entry.mask === null),
      ),
    ]
    const status =
      classified.structuralDifferences.length > 0 || unexpected.length > 0 ? 'FAIL' : 'PASS'

    const report = {
      schemaVersion: REPORT_SCHEMA_VERSION,
      surface: REPORT_SURFACE_ID,
      status,
      statement: EVIDENCE_STATEMENT,
      project: candidate.project,
      declaration: declarationPath ?? null,
      baseline: summarizeSet(baseline),
      candidate: summarizeSet(candidate),
      masksApplied: masksApplied.map((mask) => ({
        id: mask.id,
        class: mask.class,
        rect: mask.rect,
        source: mask.source,
      })),
      tolerancesApplied: {
        id: tolerancesApplied.id,
        maxChannelDelta: tolerancesApplied.maxChannelDelta,
        maxChangedFraction: tolerancesApplied.maxChangedFraction,
        maxMeanAbsDifference: tolerancesApplied.maxMeanAbsDifference,
        source: tolerancesApplied.source,
      },
      structuralDifferences: classified.structuralDifferences,
      entries: classified.entries,
      classCounts,
      unexpected,
      diffArtifacts,
    }
    writeJson(path.join(outputDirectory, 'comparison.json'), report)
    return { report, exitCode: status === 'PASS' ? 0 : 1 }
  } catch (error) {
    const unavailable = error instanceof ComparisonUnavailableError
    const report = {
      schemaVersion: REPORT_SCHEMA_VERSION,
      surface: REPORT_SURFACE_ID,
      status: unavailable ? 'UNAVAILABLE' : 'FAIL',
      statement: EVIDENCE_STATEMENT,
      declaration: declarationPath ?? null,
      reason: error instanceof Error ? error.message : String(error),
    }
    writeJson(path.join(outputDirectory, 'comparison.json'), report)
    return { report, exitCode: unavailable ? 2 : 1 }
  }
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function parseArguments(argv) {
  const options = {
    baseline: null,
    candidate: null,
    declaration: null,
    out: null,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--baseline') {
      options.baseline = path.resolve(argv[index + 1] ?? '')
      index += 1
    } else if (argument === '--candidate') {
      options.candidate = path.resolve(argv[index + 1] ?? '')
      index += 1
    } else if (argument === '--declaration') {
      options.declaration = path.resolve(argv[index + 1] ?? '')
      index += 1
    } else if (argument === '--out') {
      options.out = path.resolve(argv[index + 1] ?? '')
      index += 1
    } else if (argument === '--help') {
      options.help = true
    } else {
      throw new Error(`unknown argument ${JSON.stringify(argument)}`)
    }
  }
  return options
}

function main() {
  let options
  try {
    options = parseArguments(process.argv.slice(2))
    if (options.help) {
      console.log(`Usage:
  node compare-baselines.mjs --baseline <capture-set-dir> --candidate <capture-set-dir>
    [--declaration <baseline-comparison.json>] --out <empty-or-new-directory>

Compares two deterministic capture sets offline and classifies every
difference into structural regression, perceptual difference, expected
dynamic variation, or nondeterministic content. Writes diff PNGs and
comparison.json, whose statement labels every score as evidence, never an
aesthetic verdict, taste, or approval. Exit codes:
0 = PASS (no unexpected difference), 1 = FAIL (structural or perceptual
difference outside declared masks/tolerances, or a capture that did not
resolve deterministic mode), 2 = UNAVAILABLE (comparison refused: a side
lacks deterministic capture metadata).`)
      return
    }
    if (!options.baseline || !options.candidate) {
      throw new Error('--baseline and --candidate are required')
    }
    if (!options.out) throw new Error('--out is required')
    const { report, exitCode } = compareCaptureSets({
      baselineDirectory: options.baseline,
      candidateDirectory: options.candidate,
      declarationPath: options.declaration,
      out: options.out,
    })
    const message = `BASELINE_COMPARISON: ${report.status} ${report.reason ?? ''}`
    if (report.status === 'PASS') console.log(message.trim())
    else console.error(message.trim())
    console.log(`BASELINE_COMPARISON: ${EVIDENCE_STATEMENT}`)
    process.exitCode = exitCode
  } catch (error) {
    console.error(
      `BASELINE_COMPARISON: FAIL ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  }
}

if (
  process.argv[1] &&
  fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))
) {
  main()
}
