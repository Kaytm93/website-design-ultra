#!/usr/bin/env node

/**
 * IP-06A two-run checkpoint comparator.
 *
 * Builds the starter if needed, starts it in deterministic mode, captures
 * every declared checkpoint twice through the plugin verifier
 * (website-design-ultra/scripts/verify-browser.mjs --checkpoints), and
 * compares the stable states: per checkpoint id the two runs must produce
 * byte-identical PNGs and identical timestamp-free metadata.
 *
 * Exit codes: 0 = PASS (all declared checkpoints byte-identical across runs),
 * 1 = FAIL (mismatch or capture failure), 2 = UNAVAILABLE (browser CLI,
 * deterministic mode, or build capability missing).
 */

import { spawn } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  canonicalJson,
  requireCleanSourceState,
  sha256Hex,
} from '../deterministic-capture/compare-captures.mjs'
import { validateCheckpointManifest } from '../../../references/interaction-checkpoints.ts'

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '../../..')
const STARTER_DIRECTORY = path.join(REPOSITORY_ROOT, 'starters', 'next-r3f-cinematic')
const VERIFIER = path.join(
  REPOSITORY_ROOT,
  'website-design-ultra',
  'scripts',
  'verify-browser.mjs',
)
const DEFAULT_MANIFEST = path.join(
  STARTER_DIRECTORY,
  'lib',
  'interaction-checkpoints.json',
)
const DEFAULT_PORT = 3210

class ComparatorUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ComparatorUnavailableError'
  }
}

function parseArguments(argv) {
  const options = {
    out: null,
    manifest: DEFAULT_MANIFEST,
    port: DEFAULT_PORT,
    skipBuild: false,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--out') {
      options.out = path.resolve(argv[index + 1] ?? '')
      index += 1
    } else if (argument === '--manifest') {
      options.manifest = path.resolve(argv[index + 1] ?? '')
      index += 1
    } else if (argument === '--port') {
      options.port = Number.parseInt(argv[index + 1] ?? '', 10)
      index += 1
    } else if (argument === '--skip-build') {
      options.skipBuild = true
    } else if (argument === '--help') {
      options.help = true
    } else {
      throw new Error(`unknown argument ${JSON.stringify(argument)}`)
    }
  }
  if (!options.help && !options.out) throw new Error('--out is required')
  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) {
    throw new Error('--port must be an integer between 1024 and 65535')
  }
  return options
}

function report(status, message) {
  const output = `CHECKPOINT_COMPARISON: ${status} ${message}`
  if (status === 'PASS') console.log(output)
  else console.error(output)
}

function writeJson(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: options.timeout ?? 300_000,
    ...options,
  })
  return result
}

function combinedOutput(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
}

function prepareOutputDirectory(requested) {
  if (!requested) {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-checkpoint-comparison-'))
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

function ensureBuilt(options) {
  const hasModules = fs.existsSync(path.join(STARTER_DIRECTORY, 'node_modules'))
  const hasBuild = fs.existsSync(path.join(STARTER_DIRECTORY, '.next'))
  if (hasModules && hasBuild) return
  if (options.skipBuild) {
    throw new Error('starter is not built (node_modules/.next missing) and --skip-build was passed')
  }
  if (!hasModules) {
    const install = run('npm', ['ci'], { cwd: STARTER_DIRECTORY, timeout: 600_000 })
    if (install.error || install.status !== 0) {
      throw new ComparatorUnavailableError(
        `starter install unavailable: ${install.error?.message ?? combinedOutput(install) ?? install.status}`,
      )
    }
  }
  const build = run('npm', ['run', 'build'], { cwd: STARTER_DIRECTORY, timeout: 600_000 })
  if (build.error || build.status !== 0) {
    throw new Error(`starter build failed: ${build.error?.message ?? combinedOutput(build) ?? build.status}`)
  }
}

function verifyBrowserCli() {
  const probe = run(process.execPath, [VERIFIER, '--probe'], { timeout: 120_000 })
  if (probe.error || probe.status !== 0) {
    throw new ComparatorUnavailableError(
      `browser CLI unavailable: ${probe.error?.message ?? combinedOutput(probe) ?? probe.status}`,
    )
  }
}

async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) })
      if (response.status === 200) return
      lastError = new Error(`server responded with status ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`server did not become ready: ${lastError?.message ?? 'timeout'}`)
}

function startServer(options) {
  const nextCli = path.join(
    STARTER_DIRECTORY,
    'node_modules',
    'next',
    'dist',
    'bin',
    'next',
  )
  const child = spawn(process.execPath, [nextCli, 'start', '-p', String(options.port)], {
    cwd: STARTER_DIRECTORY,
    env: {
      ...process.env,
      WDU_DETERMINISTIC: '1',
      NODE_NO_WARNINGS: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const logs = []
  child.stdout.on('data', (chunk) => logs.push(String(chunk)))
  child.stderr.on('data', (chunk) => logs.push(String(chunk)))
  return { child, logs: () => logs.join('') }
}

function captureRun(options, runDirectory) {
  const result = run(
    process.execPath,
    [
      VERIFIER,
      '--url',
      `http://127.0.0.1:${options.port}`,
      '--out',
      runDirectory,
      '--checkpoints',
      options.manifest,
    ],
    { timeout: 600_000 },
  )
  const detail = combinedOutput(result)
  if (result.status === 2) {
    throw new ComparatorUnavailableError(`verifier run UNAVAILABLE: ${detail || 'exit 2'}`)
  }
  if (result.error || result.status !== 0) {
    throw new Error(`verifier run failed: ${result.error?.message ?? detail ?? result.status}`)
  }
  const metadataPath = path.join(runDirectory, 'checkpoints.json')
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`verifier run wrote no checkpoints.json: ${runDirectory}`)
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
  if (metadata.entries.some((entry) => entry.status !== 'CAPTURED')) {
    const failed = metadata.entries.filter((entry) => entry.status !== 'CAPTURED')
    throw new Error(
      `verifier run did not capture every checkpoint: ${failed
        .map((entry) => `${entry.id}=${entry.status} (${entry.reason ?? ''})`)
        .join('; ')}`,
    )
  }
  return metadata
}

function compareRuns(options, first, second, sourceCommit) {
  const firstEntries = new Map(first.entries.map((entry) => [entry.id, entry]))
  const secondEntries = new Map(second.entries.map((entry) => [entry.id, entry]))

  const ids = [...firstEntries.keys()]
  for (const id of ids) {
    if (!secondEntries.has(id)) {
      throw new Error(`run-2 is missing checkpoint ${id}`)
    }
  }
  if (ids.length !== secondEntries.size) {
    throw new Error('run-1 and run-2 declared different checkpoint counts')
  }
  if (canonicalJson(first.entries) !== canonicalJson(second.entries)) {
    throw new Error('checkpoint metadata differs between clean runs')
  }

  const entries = []
  let mismatches = 0
  for (const id of ids) {
    const firstEntry = firstEntries.get(id)
    const secondEntry = secondEntries.get(id)
    const firstPng = fs.readFileSync(path.join(options.out, 'run-1', 'checkpoints', firstEntry.file))
    const secondPng = fs.readFileSync(path.join(options.out, 'run-2', 'checkpoints', secondEntry.file))
    const firstSha256 = sha256Hex(firstPng)
    const secondSha256 = sha256Hex(secondPng)
    const byteIdentical = firstSha256 === secondSha256
    if (!byteIdentical) mismatches += 1
    entries.push({
      id,
      interaction: firstEntry.interaction,
      file: firstEntry.file,
      byteIdentical,
      runOneSha256: firstSha256,
      runTwoSha256: secondSha256,
      bytes: firstPng.length,
    })
  }

  const status = mismatches === 0 ? 'PASS' : 'FAIL'
  const summary = {
    schemaVersion: 1,
    status,
    acceptance: 'byte-identical-checkpoint-states',
    project: first.project,
    sourceCommit,
    modeInput: first.modeInput,
    readyMarker: first.readyMarker,
    viewport: first.viewport,
    cleanRuns: 2,
    comparedCheckpoints: entries.length,
    byteIdenticalCheckpoints: entries.length - mismatches,
    entries,
  }
  if (status === 'FAIL') {
    summary.reason = `${mismatches} checkpoint(s) differ between clean runs`
  }
  writeJson(path.join(options.out, 'comparison.json'), summary)
  report(
    status,
    `commit=${sourceCommit} checkpoints=${entries.length} byte-identical=${entries.length - mismatches} artifacts=${options.out}`,
  )
}

async function main() {
  let options
  let server = null
  try {
    options = parseArguments(process.argv.slice(2))
    if (options.help) {
      console.log(`Usage:
  node tests/immersive/interaction-capture/compare-checkpoints.mjs
    --out <empty-or-new-directory>
    [--manifest <interaction-checkpoints.json>]
    [--port 3210]
    [--skip-build]

Captures every declared checkpoint twice (WDU_DETERMINISTIC=1) through
website-design-ultra/scripts/verify-browser.mjs and compares the stable
states byte for byte. Exit codes: 0 = PASS, 1 = FAIL, 2 = UNAVAILABLE.`)
      return
    }

    const sourceCommit = requireCleanSourceState(
      REPOSITORY_ROOT,
      'before checkpoint comparison',
    )
    const manifest = validateCheckpointManifest(
      JSON.parse(fs.readFileSync(options.manifest, 'utf8')),
    )
    options.out = prepareOutputDirectory(options.out)
    ensureBuilt(options)
    verifyBrowserCli()

    server = startServer(options)
    const url = `http://127.0.0.1:${options.port}`
    await waitForServer(url)

    const firstDirectory = path.join(options.out, 'run-1')
    const secondDirectory = path.join(options.out, 'run-2')
    const first = captureRun(options, firstDirectory)
    const commitBeforeRunTwo = requireCleanSourceState(
      REPOSITORY_ROOT,
      'before run 2',
    )
    const second = captureRun(options, secondDirectory)
    const commitAfterRunTwo = requireCleanSourceState(
      REPOSITORY_ROOT,
      'after run 2',
    )
    if (
      new Set([sourceCommit, commitBeforeRunTwo, commitAfterRunTwo]).size !== 1
    ) {
      throw new Error('source commit changed between clean checkpoints')
    }
    compareRuns(options, first, second, sourceCommit)
  } catch (error) {
    const unavailable = error instanceof ComparatorUnavailableError
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
    report(
      unavailable ? 'UNAVAILABLE' : 'FAIL',
      error instanceof Error ? error.message : String(error),
    )
    process.exitCode = unavailable ? 2 : 1
  } finally {
    if (server) {
      server.child.kill('SIGTERM')
      setTimeout(() => server.child.kill('SIGKILL'), 3000).unref()
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
