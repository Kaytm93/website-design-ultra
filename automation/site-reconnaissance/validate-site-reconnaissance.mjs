#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SITE_RECONNAISSANCE_SCHEMA_VERSION = 'wdu-site-reconnaissance/v1'
export const EVIDENCE_KINDS = Object.freeze(['bundle', 'network', 'renderer-info', 'inspector', 'shader'])
export const REQUIRED_FIELD_COUNTS = Object.freeze({
  bundle: 2,
  network: 2,
  renderer: 2,
  inspector: 2,
  shader: 2,
})

const IMAGE_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg'])
const STATUS_VALUES = new Set(['PASS', 'FAIL', 'UNAVAILABLE', 'NOT_APPLICABLE'])
const FIELD_GROUPS = new Map([
  ['bundle.', 'bundle'],
  ['network.', 'network'],
  ['renderer.', 'renderer'],
  ['inspector.', 'inspector'],
  ['shader.', 'shader'],
])

export class SiteReconnaissanceValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SiteReconnaissanceValidationError'
  }
}

function invalid(message) {
  throw new SiteReconnaissanceValidationError(message)
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${label}: expected an object`)
  return value
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${label}: expected a non-empty string`)
  return value
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') invalid(`${label}: expected a boolean`)
  return value
}

function readJson(file) {
  let source
  try {
    source = fs.readFileSync(file, 'utf8')
  } catch (error) {
    invalid(`ledger: cannot read ${file}: ${error.message}`)
  }
  try {
    return JSON.parse(source)
  } catch (error) {
    invalid(`ledger: invalid JSON in ${file}: ${error.message}`)
  }
}

function resolveEvidenceFile(ledgerDirectory, relativeFile, label) {
  requireString(relativeFile, `${label}.file`)
  if (path.isAbsolute(relativeFile)) invalid(`${label}.file: absolute paths are not allowed`)
  const resolved = path.resolve(ledgerDirectory, relativeFile)
  const relative = path.relative(ledgerDirectory, resolved)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    invalid(`${label}.file: path escapes the ledger directory`)
  }
  let realPath
  try {
    realPath = fs.realpathSync(resolved)
  } catch (error) {
    invalid(`${label}.file: artifact does not exist (${relativeFile}): ${error.message}`)
  }
  const rootRealPath = fs.realpathSync(ledgerDirectory)
  const realRelative = path.relative(rootRealPath, realPath)
  if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
    invalid(`${label}.file: symlink resolves outside the ledger directory`)
  }
  if (!fs.statSync(realPath).isFile()) invalid(`${label}.file: artifact is not a file`)
  return realPath
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function requireDigest(file, expected, label) {
  if (!/^[a-f0-9]{64}$/.test(expected ?? '')) {
    invalid(`${label}.sha256: expected 64 lowercase hexadecimal characters`)
  }
  const observed = sha256(file)
  if (observed !== expected) invalid(`${label}.sha256: expected ${expected}, observed ${observed}`)
}

function validatePublicUrl(value) {
  let parsed
  try {
    parsed = new URL(requireString(value, 'activation.sourceUrl'))
  } catch (error) {
    invalid(`activation.sourceUrl: expected a public http(s) URL (${error.message})`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) invalid('activation.sourceUrl: expected http or https')
  if (parsed.username || parsed.password) invalid('activation.sourceUrl: credentials are forbidden')
  const host = parsed.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.endsWith('.local') ||
    host.endsWith('.invalid')
  ) {
    invalid('activation.sourceUrl: local or non-public host is not allowed')
  }
  return parsed.href
}

function validateRuntime(runtime) {
  requireObject(runtime, 'runtime')
  for (const key of ['browser', 'gpu', 'inspector', 'shaderCapture']) {
    const value = requireString(runtime[key], `runtime.${key}`)
    if (!STATUS_VALUES.has(value)) invalid(`runtime.${key}: unknown status ${value}`)
    if (value !== 'PASS') invalid(`runtime.${key}: ${value} cannot be reported as PASS evidence`)
  }
}

function validateActivation(activation) {
  requireObject(activation, 'activation')
  validatePublicUrl(activation.sourceUrl)
  requireBoolean(activation.explicitRuntimeRequest, 'activation.explicitRuntimeRequest')
  if (!activation.explicitRuntimeRequest) invalid('activation.explicitRuntimeRequest: runtime request is required')
  requireBoolean(activation.publicAccess, 'activation.publicAccess')
  if (!activation.publicAccess) invalid('activation.publicAccess: must be true for this skill')
  requireBoolean(activation.screenshotOnly, 'activation.screenshotOnly')
  if (activation.screenshotOnly) invalid('activation.screenshotOnly: screenshot alone cannot activate this skill')
  if (!Array.isArray(activation.evidenceFamilies)) invalid('activation.evidenceFamilies: expected an array')
  for (const kind of EVIDENCE_KINDS) {
    if (!activation.evidenceFamilies.includes(kind)) {
      invalid(`activation.evidenceFamilies: missing ${kind}`)
    }
  }
}

function validateEvidence(entries, ledgerDirectory) {
  if (!Array.isArray(entries) || !entries.length) invalid('evidence: expected a non-empty array')
  const byId = new Map()
  const primaryKinds = new Set()
  for (const [index, entry] of entries.entries()) {
    const label = `evidence[${index}]`
    requireObject(entry, label)
    const id = requireString(entry.id, `${label}.id`)
    if (byId.has(id)) invalid(`${label}.id: repeated evidence id ${id}`)
    byId.set(id, entry)
    const kind = requireString(entry.kind, `${label}.kind`)
    if (![...EVIDENCE_KINDS, 'screenshot'].includes(kind)) invalid(`${label}.kind: unknown evidence family ${kind}`)
    const format = requireString(entry.format, `${label}.format`).toLowerCase()
    const artifact = resolveEvidenceFile(ledgerDirectory, entry.file, label)
    requireDigest(artifact, entry.sha256, label)
    requireString(entry.locator, `${label}.locator`)
    if (fs.statSync(artifact).size === 0) invalid(`${label}.file: evidence artifact is empty`)
    if (kind === 'screenshot') {
      if (entry.primary !== false) invalid(`${label}: screenshots must be supplemental, never primary evidence`)
      if (!IMAGE_FORMATS.has(format)) invalid(`${label}: screenshot evidence must use an image format`)
      continue
    }
    if (IMAGE_FORMATS.has(format)) {
      invalid(`${label}: ${kind} requires semantic text/JSON evidence; screenshot alone is not enough`)
    }
    if (entry.primary !== false) primaryKinds.add(kind)
  }
  for (const kind of EVIDENCE_KINDS) {
    if (!primaryKinds.has(kind)) invalid(`evidence: missing primary ${kind} artifact`)
  }
  return byId
}

function fieldGroup(id, label) {
  for (const [prefix, group] of FIELD_GROUPS) {
    if (id.startsWith(prefix)) return group
  }
  invalid(`${label}.id: unsupported ledger field ${id}`)
}

function validateFieldEvidence(references, evidenceById, label) {
  if (!Array.isArray(references) || !references.length) invalid(`${label}.evidence: expected at least one reference`)
  let primaryReference = false
  for (const [index, reference] of references.entries()) {
    const referenceLabel = `${label}.evidence[${index}]`
    requireObject(reference, referenceLabel)
    const artifactId = requireString(reference.artifact, `${referenceLabel}.artifact`)
    const artifact = evidenceById.get(artifactId)
    if (!artifact) invalid(`${referenceLabel}.artifact: unknown evidence id ${artifactId}`)
    requireString(reference.locator, `${referenceLabel}.locator`)
    requireString(reference.excerpt, `${referenceLabel}.excerpt`)
    if (artifact.kind !== 'screenshot' && artifact.primary !== false) primaryReference = true
  }
  if (!primaryReference) invalid(`${label}: screenshot-only evidence cannot support a ledger field`)
}

function validateLedgerRows(rows, evidenceById) {
  if (!Array.isArray(rows) || !rows.length) invalid('ledger: expected a non-empty array')
  const ids = new Set()
  const supportedByGroup = Object.fromEntries(Object.keys(REQUIRED_FIELD_COUNTS).map((group) => [group, 0]))
  let supportedFieldCount = 0
  for (const [index, row] of rows.entries()) {
    const label = `ledger[${index}]`
    requireObject(row, label)
    const id = requireString(row.id, `${label}.id`)
    if (ids.has(id)) invalid(`${label}.id: repeated ledger field ${id}`)
    ids.add(id)
    const group = fieldGroup(id, label)
    if (
      (typeof row.value !== 'string' || !row.value.trim()) &&
      (typeof row.value !== 'number' || !Number.isFinite(row.value)) &&
      typeof row.value !== 'boolean'
    ) {
      invalid(`${label}.value: expected a non-empty scalar or unknown`)
    }
    validateFieldEvidence(row.evidence, evidenceById, label)
    requireString(row.observation, `${label}.observation`)
    if (row.value !== 'unknown') {
      supportedFieldCount += 1
      supportedByGroup[group] += 1
    }
  }
  if (supportedFieldCount < 10) {
    invalid(`ledger: expected at least 10 supported fields, found ${supportedFieldCount}`)
  }
  for (const [group, minimum] of Object.entries(REQUIRED_FIELD_COUNTS)) {
    if (supportedByGroup[group] < minimum) {
      invalid(`ledger: expected at least ${minimum} supported ${group} fields, found ${supportedByGroup[group]}`)
    }
  }
  return { supportedFieldCount, supportedByGroup, fieldCount: rows.length }
}

function validateStringArray(value, label) {
  if (!Array.isArray(value)) invalid(`${label}: expected an array`)
  for (const [index, entry] of value.entries()) requireString(entry, `${label}[${index}]`)
}

export function validateSiteReconnaissance(recordPath) {
  const absoluteRecord = path.resolve(requireString(recordPath, 'recordPath'))
  const record = requireObject(readJson(absoluteRecord), 'site reconnaissance ledger')
  const ledgerDirectory = path.dirname(absoluteRecord)

  if (record.schemaVersion !== SITE_RECONNAISSANCE_SCHEMA_VERSION) {
    invalid(`schemaVersion: expected ${SITE_RECONNAISSANCE_SCHEMA_VERSION}`)
  }
  if (record.status !== 'PASS') invalid(`status: expected PASS for a validated ledger, received ${record.status ?? 'missing'}`)
  validateActivation(record.activation)
  validateRuntime(record.runtime)
  const evidenceById = validateEvidence(record.evidence, ledgerDirectory)
  const summary = validateLedgerRows(record.ledger, evidenceById)
  validateStringArray(record.openQuestions ?? [], 'openQuestions')
  if (!Array.isArray(record.contradictions)) invalid('contradictions: expected an array')

  return {
    status: 'PASS',
    schemaVersion: record.schemaVersion,
    sourceUrl: record.activation.sourceUrl,
    evidenceFamilies: EVIDENCE_KINDS,
    evidenceCount: record.evidence.length,
    ...summary,
  }
}

function runCli(argv) {
  if (argv.length !== 1 || argv[0] === '--help') {
    console.log('Usage: node automation/site-reconnaissance/validate-site-reconnaissance.mjs <ledger.json>')
    return argv[0] === '--help' ? 0 : 2
  }
  try {
    console.log(JSON.stringify(validateSiteReconnaissance(argv[0]), null, 2))
    return 0
  } catch (error) {
    console.error(`Site reconnaissance validation failed: ${error.message}`)
    return 1
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) process.exitCode = runCli(process.argv.slice(2))
