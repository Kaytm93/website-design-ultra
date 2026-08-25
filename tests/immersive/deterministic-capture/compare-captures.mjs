#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export class CaptureMismatchError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CaptureMismatchError'
  }
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    )
  }
  return value
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value))
}

export function validateExpectedMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('expected metadata must be a JSON object')
  }
  if (metadata.schemaVersion !== 1) {
    throw new Error('expected metadata schemaVersion must be 1')
  }
  if (metadata.acceptance !== 'byte-identical-png-bytes') {
    throw new Error('expected metadata acceptance must be byte-identical-png-bytes')
  }
  if (metadata.hashAlgorithm !== 'sha256') {
    throw new Error('expected metadata hashAlgorithm must be sha256')
  }
  if (metadata.captureFile !== 'capture.png') {
    throw new Error('expected metadata captureFile must be capture.png')
  }
  if (metadata.deterministicRuntime?.modeInput !== 'WDU_DETERMINISTIC=1') {
    throw new Error('expected deterministic modeInput must be WDU_DETERMINISTIC=1')
  }
  if (!metadata.deviceProfile || typeof metadata.deviceProfile !== 'object') {
    throw new Error('expected metadata requires a deviceProfile object')
  }

  const actual = sha256Hex(Buffer.from(canonicalJson(metadata.deviceProfile)))
  if (metadata.deviceProfileSha256 !== actual) {
    throw new Error(
      `device profile hash mismatch: expected ${metadata.deviceProfileSha256}; actual ${actual}`,
    )
  }

  return { ...metadata, deviceProfileSha256: actual }
}

function assertPng(bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24) {
    throw new Error(`${label} is not a PNG file`)
  }
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${label} is not a PNG file`)
  }
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`${label} has no PNG IHDR chunk`)
  }
}

export function readPngDimensions(bytes) {
  assertPng(bytes, 'capture')
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  }
}

export function comparePngBytes(runOne, runTwo) {
  assertPng(runOne, 'run-1 capture')
  assertPng(runTwo, 'run-2 capture')

  const runOneSha256 = sha256Hex(runOne)
  const runTwoSha256 = sha256Hex(runTwo)
  if (!runOne.equals(runTwo)) {
    throw new CaptureMismatchError(
      `PNG byte mismatch: run-1 sha256=${runOneSha256}; run-2 sha256=${runTwoSha256}`,
    )
  }

  return {
    byteIdentical: true,
    pngSha256: runOneSha256,
    bytes: runOne.length,
  }
}

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '../../..')
const CAPTURE_RUNNER = path.join(SCRIPT_DIRECTORY, 'capture.mjs')
const DEFAULT_EXPECTED = path.join(SCRIPT_DIRECTORY, 'expected-metadata.json')

class CaptureUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CaptureUnavailableError'
  }
}

function parseArguments(argv) {
  const options = {
    compareFiles: null,
    expected: DEFAULT_EXPECTED,
    out: null,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--out') {
      options.out = path.resolve(argv[index + 1] ?? '')
      index += 1
    } else if (argument === '--expected') {
      options.expected = path.resolve(argv[index + 1] ?? '')
      index += 1
    } else if (argument === '--compare-files') {
      const first = argv[index + 1]
      const second = argv[index + 2]
      if (!first || !second) throw new Error('--compare-files requires two PNG paths')
      options.compareFiles = [path.resolve(first), path.resolve(second)]
      index += 2
    } else if (argument === '--help') {
      options.help = true
    } else {
      throw new Error(`unknown argument ${JSON.stringify(argument)}`)
    }
  }
  return options
}

function prepareOutputDirectory(requested) {
  if (!requested) {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-deterministic-comparison-'))
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

export function requireCleanSourceState(
  cwd = REPOSITORY_ROOT,
  checkpoint = 'deterministic capture',
) {
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  })
  if (commit.error || commit.status !== 0) {
    throw new Error(
      `cannot resolve source commit at ${checkpoint}: ${commit.error?.message ?? commit.stderr}`,
    )
  }

  const status = spawnSync(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    {
      cwd,
      encoding: 'utf8',
    },
  )
  if (status.error || status.status !== 0) {
    throw new Error(
      `cannot inspect source state at ${checkpoint}: ${status.error?.message ?? status.stderr}`,
    )
  }
  const changes = status.stdout.trim()
  if (changes) {
    throw new Error(`${checkpoint} requires a clean source tree:\n${changes}`)
  }
  return commit.stdout.trim()
}

function writeJson(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}

function childOutput(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
}

function runCapture(runDirectory, expectedPath) {
  const result = spawnSync(
    process.execPath,
    [CAPTURE_RUNNER, '--out', runDirectory, '--expected', expectedPath],
    {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_NO_WARNINGS: '1',
        WDU_DETERMINISTIC: '1',
      },
      maxBuffer: 10 * 1024 * 1024,
      timeout: 180_000,
    },
  )
  const detail = childOutput(result)
  if (result.status === 2 && /DETERMINISTIC_CAPTURE: UNAVAILABLE/.test(detail)) {
    throw new CaptureUnavailableError(detail)
  }
  if (result.error || result.status !== 0) {
    throw new Error(
      `capture subprocess failed: ${result.error?.message ?? detail ?? result.status}`,
    )
  }

  const metadataPath = path.join(runDirectory, 'capture.json')
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`capture subprocess wrote no metadata: ${runDirectory}`)
  }
  return JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
}

function validateRun(metadata, expected, commit, png) {
  if (metadata.status !== 'CAPTURED') throw new Error('capture metadata is not CAPTURED')
  if (metadata.fixtureId !== expected.fixtureId) {
    throw new Error(`capture fixture id mismatch: ${metadata.fixtureId}`)
  }
  if (metadata.source?.commit !== commit) {
    throw new Error(
      `capture commit mismatch: expected ${commit}; received ${metadata.source?.commit}`,
    )
  }
  if (metadata.deviceProfileSha256 !== expected.deviceProfileSha256) {
    throw new Error(
      `capture device profile mismatch: expected ${expected.deviceProfileSha256}; received ${metadata.deviceProfileSha256}`,
    )
  }
  if (canonicalJson(metadata.deviceProfile) !== canonicalJson(expected.deviceProfile)) {
    throw new Error('capture device profile differs from committed metadata')
  }
  if (
    canonicalJson(metadata.deterministicRuntime) !==
    canonicalJson(expected.deterministicRuntime)
  ) {
    throw new Error('capture deterministic runtime differs from committed metadata')
  }
  const actualPngHash = sha256Hex(png)
  if (metadata.png?.sha256 !== actualPngHash) {
    throw new Error(
      `capture metadata PNG hash mismatch: expected ${metadata.png?.sha256}; actual ${actualPngHash}`,
    )
  }
}

function compareTwoRuns(options) {
  const expected = validateExpectedMetadata(
    JSON.parse(fs.readFileSync(options.expected, 'utf8')),
  )
  const commitBeforeRunOne = requireCleanSourceState(
    REPOSITORY_ROOT,
    'before run 1',
  )
  const firstDirectory = path.join(options.out, 'run-1')
  const secondDirectory = path.join(options.out, 'run-2')
  const firstMetadata = runCapture(firstDirectory, options.expected)
  const commitBeforeRunTwo = requireCleanSourceState(
    REPOSITORY_ROOT,
    'before run 2',
  )
  const secondMetadata = runCapture(secondDirectory, options.expected)
  const commitAfterRunTwo = requireCleanSourceState(
    REPOSITORY_ROOT,
    'after run 2',
  )
  if (
    new Set([
      commitBeforeRunOne,
      commitBeforeRunTwo,
      commitAfterRunTwo,
    ]).size !== 1
  ) {
    throw new Error(
      `source commit changed between clean checkpoints: before run 1 ${commitBeforeRunOne}; before run 2 ${commitBeforeRunTwo}; after run 2 ${commitAfterRunTwo}`,
    )
  }
  const sourceCommit = commitBeforeRunOne

  const firstPng = fs.readFileSync(path.join(firstDirectory, expected.captureFile))
  const secondPng = fs.readFileSync(path.join(secondDirectory, expected.captureFile))
  validateRun(firstMetadata, expected, sourceCommit, firstPng)
  validateRun(secondMetadata, expected, sourceCommit, secondPng)
  if (canonicalJson(firstMetadata.source) !== canonicalJson(secondMetadata.source)) {
    throw new Error('capture source digests differ between clean runs')
  }

  let comparison
  try {
    comparison = comparePngBytes(firstPng, secondPng)
  } catch (error) {
    writeJson(path.join(options.out, 'comparison.json'), {
      schemaVersion: 1,
      status: 'FAIL',
      fixtureId: expected.fixtureId,
      sourceCommit,
      deviceProfileSha256: expected.deviceProfileSha256,
      runOnePngSha256: sha256Hex(firstPng),
      runTwoPngSha256: sha256Hex(secondPng),
      reason: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  const summary = {
    schemaVersion: 1,
    status: 'PASS',
    acceptance: expected.acceptance,
    fixtureId: expected.fixtureId,
    sourceCommit,
    deviceProfileSha256: expected.deviceProfileSha256,
    cleanRuns: 2,
    comparedFile: expected.captureFile,
    pngSha256: comparison.pngSha256,
    pngBytes: comparison.bytes,
    byteIdentical: comparison.byteIdentical,
    source: firstMetadata.source,
  }
  writeJson(path.join(options.out, 'comparison.json'), summary)
  console.log(
    `DETERMINISTIC_CAPTURE: PASS commit=${sourceCommit} device-profile-sha256=${expected.deviceProfileSha256} png-sha256=${comparison.pngSha256} bytes=${comparison.bytes} artifacts=${options.out}`,
  )
}

function main() {
  let options
  try {
    options = parseArguments(process.argv.slice(2))
    if (options.help) {
      console.log(`Usage:
  node compare-captures.mjs [--out <empty-directory>]
                            [--expected <expected-metadata.json>]
  node compare-captures.mjs --compare-files <run-1.png> <run-2.png>

The default path launches two isolated Playwright captures. Exit codes:
0 = byte-identical PNGs, 1 = mismatch or capture failure, 2 = browser unavailable.`)
      return
    }
    if (options.compareFiles) {
      const result = comparePngBytes(
        fs.readFileSync(options.compareFiles[0]),
        fs.readFileSync(options.compareFiles[1]),
      )
      console.log(
        `DETERMINISTIC_CAPTURE: PASS png-sha256=${result.pngSha256} bytes=${result.bytes}`,
      )
      return
    }

    options.out = prepareOutputDirectory(options.out)
    compareTwoRuns(options)
  } catch (error) {
    const unavailable = error instanceof CaptureUnavailableError
    if (options?.out && fs.existsSync(options.out)) {
      const summaryPath = path.join(options.out, 'comparison.json')
      if (!fs.existsSync(summaryPath)) {
        writeJson(summaryPath, {
          schemaVersion: 1,
          status: unavailable ? 'UNAVAILABLE' : 'FAIL',
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }
    console.error(
      `DETERMINISTIC_CAPTURE: ${unavailable ? 'UNAVAILABLE' : 'FAIL'} ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = unavailable ? 2 : 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
