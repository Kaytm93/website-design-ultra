#!/usr/bin/env node

/**
 * Dependency-free comparison of one live hero frame against its authored poster
 * target. The browser verifier owns capture orchestration; this module owns the
 * portable report and diff artifact so an installed plugin can run it without a
 * repository checkout.
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import {
  diffMetrics,
  encodePng,
  readPngPixels,
} from '../templates/runtime/compare-baselines.mjs'

export const TARGET_COMPARISON_SCHEMA_VERSION = 1
export const TARGET_COMPARISON_SURFACE_ID = 'wdu.target-comparison'
export const TARGET_EVIDENCE_STATEMENT =
  'A target score is evidence of visual change. It is never an aesthetic verdict, taste, or approval.'

export const DEFAULT_TARGET_TOLERANCE = Object.freeze({
  id: 'strict-default',
  maxChannelDelta: 0,
  maxChangedFraction: 0,
  maxMeanAbsDifference: 0,
  source: 'built-in strict target default (zero tolerance)',
})

export class TargetComparisonUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'TargetComparisonUnavailableError'
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function fileLabel(file) {
  return path.basename(file)
}

function readTargetImage(file, label) {
  if (!file || !fs.existsSync(file)) {
    throw new TargetComparisonUnavailableError(`${label} image is missing: ${file}`)
  }
  let bytes
  try {
    bytes = fs.readFileSync(file)
  } catch (error) {
    throw new TargetComparisonUnavailableError(
      `${label} image cannot be read: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  try {
    const pixels = readPngPixels(bytes)
    return {
      file: fileLabel(file),
      bytes: bytes.length,
      sha256: sha256Hex(bytes),
      width: pixels.width,
      height: pixels.height,
      rgba: pixels.rgba,
    }
  } catch (error) {
    throw new TargetComparisonUnavailableError(
      `${label} image is not a comparable 8-bit PNG: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function normalizeTolerance(input) {
  const tolerance = input ?? DEFAULT_TARGET_TOLERANCE
  if (!isRecord(tolerance)) throw new Error('target tolerance must be an object')
  const integer = (key, maximum) => {
    if (!Number.isInteger(tolerance[key]) || tolerance[key] < 0 || tolerance[key] > maximum) {
      throw new Error(`target tolerance ${key} must be an integer in [0, ${maximum}]`)
    }
    return tolerance[key]
  }
  const ratio = (key) => {
    if (
      typeof tolerance[key] !== 'number' ||
      !Number.isFinite(tolerance[key]) ||
      tolerance[key] < 0 ||
      tolerance[key] > 1
    ) {
      throw new Error(`target tolerance ${key} must be a number in [0, 1]`)
    }
    return tolerance[key]
  }
  if (typeof tolerance.id !== 'string' || tolerance.id.length === 0) {
    throw new Error('target tolerance id must be a non-empty string')
  }
  if (typeof tolerance.source !== 'string' || tolerance.source.trim().length === 0) {
    throw new Error('target tolerance source must be a non-empty string')
  }
  return {
    id: tolerance.id,
    maxChannelDelta: integer('maxChannelDelta', 255),
    maxChangedFraction: ratio('maxChangedFraction'),
    maxMeanAbsDifference: ratio('maxMeanAbsDifference'),
    source: tolerance.source,
  }
}

function baseReport({ targetPath, liveFramePath, iteration, diffArtifact }) {
  return {
    schemaVersion: TARGET_COMPARISON_SCHEMA_VERSION,
    surface: TARGET_COMPARISON_SURFACE_ID,
    mode: 'poster-target',
    status: 'UNAVAILABLE',
    verificationStatus: 'UNAVAILABLE',
    statement: TARGET_EVIDENCE_STATEMENT,
    iteration: iteration ?? null,
    target: { file: fileLabel(targetPath) },
    liveFrame: { file: fileLabel(liveFramePath) },
    comparison: null,
    tolerance: null,
    diffArtifact,
    reason: null,
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * Compare a captured live frame to a poster target and write target-comparison.json
 * plus target-diff.png. A mismatch is FAIL evidence that the look loop needs
 * another iteration; it is not an aesthetic verdict. Invalid or unavailable
 * comparison inputs return UNAVAILABLE (exit code 2).
 */
export function compareTargetFrame({
  targetPath,
  liveFramePath,
  out,
  iteration = null,
  tolerance = null,
  diffFile = 'target-diff.png',
} = {}) {
  if (!targetPath || !liveFramePath) {
    throw new Error('targetPath and liveFramePath are required')
  }
  if (!out) throw new Error('out is required')
  fs.mkdirSync(out, { recursive: true })
  const reportPath = path.join(out, 'target-comparison.json')
  const diffArtifact = diffFile
  const report = baseReport({ targetPath, liveFramePath, iteration, diffArtifact })

  try {
    const target = readTargetImage(targetPath, 'poster target')
    const live = readTargetImage(liveFramePath, 'live frame')
    const appliedTolerance = normalizeTolerance(tolerance)
    report.target = {
      file: target.file,
      bytes: target.bytes,
      sha256: target.sha256,
      width: target.width,
      height: target.height,
    }
    report.liveFrame = {
      file: live.file,
      bytes: live.bytes,
      sha256: live.sha256,
      width: live.width,
      height: live.height,
    }
    report.tolerance = appliedTolerance

    if (target.width !== live.width || target.height !== live.height) {
      throw new Error(
        `target and live frame dimensions differ (${target.width}x${target.height} vs ${live.width}x${live.height})`,
      )
    }

    const metrics = diffMetrics(
      target.rgba,
      live.rgba,
      target.width,
      target.height,
      appliedTolerance.maxChannelDelta,
    )
    const withinTolerance =
      metrics.changedFraction <= appliedTolerance.maxChangedFraction &&
      metrics.meanAbsDifference <= appliedTolerance.maxMeanAbsDifference
    report.comparison = {
      totalPixels: metrics.totalPixels,
      changedPixels: metrics.changedPixels,
      changedFraction: metrics.changedFraction,
      meanAbsDifference: metrics.meanAbsDifference,
      maxChannelDelta: metrics.maxChannelDelta,
      withinTolerance,
    }
    report.status = withinTolerance ? 'PASS' : 'FAIL'
    report.verificationStatus = report.status
    report.reason = withinTolerance
      ? null
      : `live frame differs from poster target outside tolerance (changed fraction ${metrics.changedFraction.toFixed(6)}, mean absolute difference ${metrics.meanAbsDifference.toFixed(6)})`
    fs.writeFileSync(
      path.join(out, diffArtifact),
      encodePng(target.width, target.height, metrics.highlight),
    )
  } catch (error) {
    report.status = error instanceof TargetComparisonUnavailableError ? 'UNAVAILABLE' : 'FAIL'
    report.verificationStatus = report.status
    report.reason = error instanceof Error ? error.message : String(error)
  }

  writeJson(reportPath, report)
  return { report, reportPath, exitCode: report.status === 'PASS' ? 0 : report.status === 'UNAVAILABLE' ? 2 : 1 }
}
