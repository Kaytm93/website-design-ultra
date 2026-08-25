#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REFERENCE_INTAKE_SCHEMA_VERSION = 'wdu-reference-intake/v1'
export const ART_DIRECTION_TRACE_FIELDS = Object.freeze([
  'visual-thesis',
  'hero-subject',
  'camera.framing',
  'camera.fov',
  'camera.position',
  'camera.target',
  'camera.near-far',
  'composition.subject-anchor',
  'composition.dom-safe-area',
  'lighting',
  'material-order',
  'color-output',
  'tone-mapping',
  'mobile-reframe',
  'spatial-type',
  'poster-frame',
])

export class ReferenceIntakeValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ReferenceIntakeValidationError'
  }
}

function invalid(message) {
  throw new ReferenceIntakeValidationError(message)
}

function readJson(file, label) {
  let source
  try {
    source = fs.readFileSync(file, 'utf8')
  } catch (error) {
    invalid(`${label}: cannot read ${file}: ${error.message}`)
  }
  try {
    return JSON.parse(source)
  } catch (error) {
    invalid(`${label}: invalid JSON in ${file}: ${error.message}`)
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`${label}: expected an object`)
  }
  return value
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    invalid(`${label}: expected a non-empty string`)
  }
  return value
}

function resolveArtifact(recordDirectory, relativeFile, label) {
  requireString(relativeFile, `${label}.file`)
  if (path.isAbsolute(relativeFile)) invalid(`${label}.file: absolute paths are not allowed`)
  const resolved = path.resolve(recordDirectory, relativeFile)
  const relative = path.relative(recordDirectory, resolved)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    invalid(`${label}.file: path escapes the intake directory`)
  }
  let artifactRealPath
  try {
    artifactRealPath = fs.realpathSync(resolved)
  } catch (error) {
    invalid(`${label}.file: artifact does not exist (${relativeFile}): ${error.message}`)
  }
  const rootRealPath = fs.realpathSync(recordDirectory)
  const realRelative = path.relative(rootRealPath, artifactRealPath)
  if (
    realRelative === '..' ||
    realRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(realRelative)
  ) {
    invalid(`${label}.file: symlink resolves outside the intake directory`)
  }
  if (!fs.statSync(artifactRealPath).isFile()) invalid(`${label}.file: artifact is not a file`)
  return artifactRealPath
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function requireDigest(file, expected, label) {
  if (!/^[a-f0-9]{64}$/.test(expected ?? '')) {
    invalid(`${label}.sha256: expected 64 lowercase hexadecimal characters`)
  }
  const observed = sha256(file)
  if (observed !== expected) {
    invalid(`${label}.sha256: expected ${expected}, observed ${observed}`)
  }
}

function inspectPng(file, label) {
  const bytes = fs.readFileSync(file)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) {
    invalid(`${label}: declared PNG does not have a PNG signature and IHDR`)
  }
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') {
    invalid(`${label}: PNG is missing its leading IHDR chunk`)
  }
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (width < 1 || height < 1) invalid(`${label}: PNG dimensions must be positive`)
  return `${width}x${height}`
}

function inspectSvg(file, label) {
  const source = fs.readFileSync(file, 'utf8')
  if (!/<svg\b/i.test(source)) invalid(`${label}: declared SVG has no <svg> root`)
  const viewBox = source.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1]
  if (!viewBox) invalid(`${label}: SVG must declare a viewBox`)
  const normalized = viewBox.trim().split(/[\s,]+/).join(' ')
  const values = normalized.split(' ').map(Number)
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    invalid(`${label}: SVG viewBox must contain four finite numbers`)
  }
  if (values[2] <= 0 || values[3] <= 0) invalid(`${label}: SVG viewBox size must be positive`)
  return normalized
}

function validateFrame(frame, index, recordDirectory) {
  requireObject(frame, `frames[${index}]`)
  const expectedId = `frame-${String(index + 1).padStart(2, '0')}`
  if (frame.id !== expectedId) invalid(`frames[${index}].id: expected ${expectedId}`)
  if (!['png', 'svg'].includes(frame.format)) {
    invalid(`${frame.id}.format: expected png or svg`)
  }
  const artifact = resolveArtifact(recordDirectory, frame.file, frame.id)
  const extension = path.extname(frame.file).slice(1).toLowerCase()
  if (extension !== frame.format) {
    invalid(`${frame.id}.format: ${frame.format} does not match .${extension || '(none)'}`)
  }
  requireDigest(artifact, frame.sha256, frame.id)
  const observedGeometry = frame.format === 'png'
    ? inspectPng(artifact, frame.id)
    : inspectSvg(artifact, frame.id)
  if (frame.dimensionsOrViewBox !== observedGeometry) {
    invalid(
      `${frame.id}.dimensionsOrViewBox: expected ${observedGeometry}, received ${frame.dimensionsOrViewBox}`,
    )
  }
  if (!['wide', 'portrait', 'square', 'component'].includes(frame.viewport)) {
    invalid(`${frame.id}.viewport: expected wide, portrait, square, or component`)
  }
  for (const key of ['role', 'provenance']) requireString(frame[key], `${frame.id}.${key}`)
  return { id: frame.id, artifact }
}

function credentialIssue(value, trail = []) {
  if (typeof value === 'string') {
    return /\bfigd_[A-Za-z0-9_-]{20,}\b/.test(value)
      ? `credential-shaped value at ${trail.join('.') || '(root)'}`
      : null
  }
  if (!value || typeof value !== 'object') return null
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[-_]/g, '').toLowerCase()
    if (
      [
        'accesstoken',
        'personalaccesstoken',
        'figmaaccesstoken',
        'figmatoken',
        'authorization',
        'apikey',
        'password',
        'secret',
      ].includes(normalized)
    ) {
      return `credential key ${[...trail, key].join('.')}`
    }
    const issue = credentialIssue(child, [...trail, key])
    if (issue) return issue
  }
  return null
}

function validateWrittenTokenBlock(block, recordDirectory) {
  requireObject(block, 'writtenTokenBlock')
  const artifact = resolveArtifact(recordDirectory, block.file, 'writtenTokenBlock')
  requireDigest(artifact, block.sha256, 'writtenTokenBlock')
  const tokens = requireObject(readJson(artifact, 'writtenTokenBlock'), 'writtenTokenBlock content')
  const credential = credentialIssue(tokens)
  if (credential) invalid(`writtenTokenBlock: authentication credential is forbidden (${credential})`)
  for (const key of ['directionName', 'grid', 'color', 'typography', 'spacing', 'motion']) {
    requireString(tokens[key], `writtenTokenBlock.${key}`)
  }
  for (const key of ['mustPreserve', 'mustAvoid']) {
    if (!Array.isArray(tokens[key])) invalid(`writtenTokenBlock.${key}: expected an array`)
  }
}

function validateTraceRows(rows, frameIds) {
  if (!Array.isArray(rows)) invalid('artDirection: expected an array')
  const observedFields = rows.map((row, index) => {
    requireObject(row, `artDirection[${index}]`)
    return row.field
  })
  if (JSON.stringify(observedFields) !== JSON.stringify(ART_DIRECTION_TRACE_FIELDS)) {
    invalid(`artDirection: fields must be exactly ${ART_DIRECTION_TRACE_FIELDS.join(', ')}`)
  }
  for (const row of rows) {
    requireString(row.value, `${row.field}.value`)
    requireString(row.sourceFrame, `${row.field}.sourceFrame`)
    requireString(row.observation, `${row.field}.observation`)
    if (row.sourceFrame !== 'unknown' && !frameIds.has(row.sourceFrame)) {
      invalid(
        `${row.field}.sourceFrame: expected a manifest frame id or unknown, received ${row.sourceFrame}`,
      )
    }
    if (row.sourceFrame === 'unknown' && row.value !== 'unknown') {
      invalid(`${row.field}.value: must remain unknown when sourceFrame is unknown`)
    }
    if (row.sourceFrame !== 'unknown' && row.value === 'unknown') {
      invalid(`${row.field}.value: a cited frame requires an observed value`)
    }
  }
  return rows
    .filter((row) => row.sourceFrame === 'unknown')
    .map((row) => row.field)
}

function validateContradictions(entries, traceRows, frameIds) {
  if (!Array.isArray(entries)) invalid('contradictions: expected an array')
  const traces = new Map(traceRows.map((row) => [row.field, row]))
  for (const [index, entry] of entries.entries()) {
    const label = `contradictions[${index}]`
    requireObject(entry, label)
    if (!ART_DIRECTION_TRACE_FIELDS.includes(entry.field)) {
      invalid(`${label}.field: unknown art-direction field ${entry.field}`)
    }
    if (!Array.isArray(entry.frames) || entry.frames.length < 2) {
      invalid(`${label}.frames: expected at least two manifest frame ids`)
    }
    if (new Set(entry.frames).size !== entry.frames.length) {
      invalid(`${label}.frames: repeated frame id`)
    }
    for (const frame of entry.frames) {
      if (!frameIds.has(frame)) invalid(`${label}.frames: unknown id ${frame}`)
    }
    requireString(entry.axis, `${label}.axis`)
    if (entry.resolution !== 'unknown') invalid(`${label}.resolution: must remain unknown`)
    const trace = traces.get(entry.field)
    if (trace.value !== 'unknown' || trace.sourceFrame !== 'unknown') {
      invalid(`${label}: ${entry.field} must remain unknown until the contradiction is resolved`)
    }
  }
}

function validatePosterTarget(target, recordDirectory, frameIds) {
  requireObject(target, 'posterTarget')
  if (!['png', 'svg'].includes(target.format)) invalid('posterTarget.format: expected png or svg')
  const artifact = resolveArtifact(recordDirectory, target.asset, 'posterTarget')
  const extension = path.extname(target.asset).slice(1).toLowerCase()
  if (extension !== target.format) invalid('posterTarget.format: does not match asset extension')
  requireDigest(artifact, target.sha256, 'posterTarget')
  if (target.format === 'png') inspectPng(artifact, 'posterTarget')
  else inspectSvg(artifact, 'posterTarget')
  if (!Array.isArray(target.sourceFrames) || !target.sourceFrames.length) {
    invalid('posterTarget.sourceFrames: expected at least one frame id')
  }
  for (const sourceFrame of target.sourceFrames) {
    if (!frameIds.has(sourceFrame)) invalid(`posterTarget.sourceFrames: unknown id ${sourceFrame}`)
  }
  for (const key of [
    'wideCrop',
    'portraitCrop',
    'subjectAnchor',
    'domSafeArea',
    'silhouette',
    'lightingDirection',
    'materialRanking',
    'tonalRange',
    'comparisonSize',
  ]) {
    requireString(target[key], `posterTarget.${key}`)
    if (target[key] === 'unknown') invalid(`posterTarget.${key}: cannot be unknown for a ready handoff`)
  }
}

export function validateReferenceIntake(recordPath) {
  const absoluteRecord = path.resolve(requireString(recordPath, 'recordPath'))
  const record = requireObject(readJson(absoluteRecord, 'reference intake'), 'reference intake')
  const recordDirectory = path.dirname(absoluteRecord)

  if (record.schemaVersion !== REFERENCE_INTAKE_SCHEMA_VERSION) {
    invalid(`schemaVersion: expected ${REFERENCE_INTAKE_SCHEMA_VERSION}`)
  }
  if (!Array.isArray(record.frames) || record.frames.length < 6 || record.frames.length > 10) {
    invalid('frames: expected six to ten entries')
  }
  const validatedFrames = record.frames.map((frame, index) =>
    validateFrame(frame, index, recordDirectory),
  )
  const artifactOwners = new Map()
  for (const frame of validatedFrames) {
    const previous = artifactOwners.get(frame.artifact)
    if (previous) invalid(`${frame.id}: same artifact is already assigned to ${previous}`)
    artifactOwners.set(frame.artifact, frame.id)
  }
  const frameIds = new Set(validatedFrames.map((frame) => frame.id))
  const formats = [...new Set(record.frames.map((frame) => frame.format))].sort()
  if (!formats.includes('png') || !formats.includes('svg')) {
    invalid('frames: the set must contain both PNG and SVG exports')
  }

  validateWrittenTokenBlock(record.writtenTokenBlock, recordDirectory)
  const unknownFields = validateTraceRows(record.artDirection, frameIds)
  validateContradictions(record.contradictions, record.artDirection, frameIds)
  if (!Array.isArray(record.openQuestions)) invalid('openQuestions: expected an array')
  for (const [index, question] of record.openQuestions.entries()) {
    requireString(question, `openQuestions[${index}]`)
  }
  validatePosterTarget(record.posterTarget, recordDirectory, frameIds)
  if (record.sceneCodeStatus !== 'ready-for-3d-art-direction') {
    invalid('sceneCodeStatus: expected ready-for-3d-art-direction after poster validation')
  }

  return {
    status: 'PASS',
    schemaVersion: record.schemaVersion,
    frameCount: record.frames.length,
    formats,
    unknownFields,
    sceneCodeStatus: record.sceneCodeStatus,
  }
}

function runCli(argv) {
  if (argv.length !== 1 || argv[0] === '--help') {
    console.log('Usage: node automation/reference-intake/validate-reference-intake.mjs <reference-intake.json>')
    return argv[0] === '--help' ? 0 : 2
  }
  try {
    const report = validateReferenceIntake(argv[0])
    console.log(JSON.stringify(report, null, 2))
    return 0
  } catch (error) {
    console.error(`Reference intake validation failed: ${error.message}`)
    return 1
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) process.exitCode = runCli(process.argv.slice(2))
