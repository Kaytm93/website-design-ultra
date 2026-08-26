#!/usr/bin/env node

/**
 * IP-07A fixture driver: exact-lockfile install, production build, runtime
 * smoke, and static capture through the plugin verifier.
 *
 * Runs the plugin verifier (website-design-ultra/scripts/verify-browser.mjs,
 * standard mode) against the built fixture in three deterministic server
 * configurations:
 *
 *   1. WDU_DETERMINISTIC=1                     — desktop/mobile/reduced/fallback
 *                                                matrix plus the telemetry gates
 *                                                (hero-wide station);
 *   2. WDU_DETERMINISTIC=1 WDU_REDUCED_MOTION=1 — the reduced-motion capture
 *                                                state: the hero holds its
 *                                                seeded static pose;
 *   3. WDU_DETERMINISTIC=1 WDU_STATION=hero-portrait — the portrait reframe.
 *
 * Each run must exit 0 (PASS), write the full artifact set, and report a
 * PASS performance summary with all three budget gates observed — the model
 * must actually load (first-meaningful-frame observed) for any run to pass.
 *
 * Exit codes: 0 = PASS, 1 = FAIL, 2 = UNAVAILABLE (browser CLI, build, or
 * deterministic-mode capability missing).
 */

import { spawn } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  requireCleanSourceState,
} from '../../deterministic-capture/compare-captures.mjs'

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, '..')
const REPOSITORY_ROOT = path.resolve(FIXTURE_DIRECTORY, '..', '..', '..')
const VERIFIER = path.join(
  REPOSITORY_ROOT,
  'website-design-ultra',
  'scripts',
  'verify-browser.mjs',
)
const FIXTURE_PORT = 3212
const NEXT_CLI = path.join(FIXTURE_DIRECTORY, 'node_modules', 'next', 'dist', 'bin', 'next')

class SuiteUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SuiteUnavailableError'
  }
}

function report(status, message) {
  const output = `PRODUCT_HERO_FIXTURE: ${status} ${message}`
  if (status === 'PASS') console.log(output)
  else console.error(output)
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: options.timeout ?? 600_000,
    ...options,
  })
}

function combinedOutput(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
}

function ensureBuilt() {
  const hasModules = fs.existsSync(path.join(FIXTURE_DIRECTORY, 'node_modules'))
  const hasBuild = fs.existsSync(path.join(FIXTURE_DIRECTORY, '.next'))
  if (hasModules && hasBuild) return
  if (!hasModules) {
    const install = run('npm', ['ci'], { cwd: FIXTURE_DIRECTORY, timeout: 600_000 })
    if (install.error || install.status !== 0) {
      throw new SuiteUnavailableError(
        `fixture install unavailable: ${install.error?.message ?? combinedOutput(install) ?? install.status}`,
      )
    }
  }
  const build = run('npm', ['run', 'build'], { cwd: FIXTURE_DIRECTORY, timeout: 600_000 })
  if (build.error || build.status !== 0) {
    throw new Error(`fixture build failed: ${build.error?.message ?? combinedOutput(build) ?? build.status}`)
  }
}

function verifyBrowserCli() {
  const probe = run(process.execPath, [VERIFIER, '--probe'], { timeout: 120_000 })
  if (probe.error || probe.status !== 0) {
    throw new SuiteUnavailableError(
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

/** Wait until the previous server released the port, so the next env cannot
 * be served by a dying predecessor process. */
async function waitForPortClosed(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  const url = `http://127.0.0.1:${port}`
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(2_000) })
      // Still answering: the old process holds the port.
    } catch {
      return // connection refused — the port is free
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`port ${port} was not released before the next server start`)
}

/** Stop a fixture server: SIGTERM, a short grace, then SIGKILL, then wait
 * for the port. Playwright sessions keep sockets alive, which can delay a
 * graceful Next shutdown well past a fixed sleep. */
async function stopServer(handle, port) {
  if (!handle) return
  handle.child.kill('SIGTERM')
  const deadline = Date.now() + 8000
  const url = `http://127.0.0.1:${port}`
  let released = false
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(1000) })
    } catch {
      released = true
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  if (!released) handle.child.kill('SIGKILL')
  await waitForPortClosed(port)
}

function startServer(extraEnv) {
  const child = spawn(process.execPath, [NEXT_CLI, 'start', '-p', String(FIXTURE_PORT)], {
    cwd: FIXTURE_DIRECTORY,
    env: {
      ...process.env,
      WDU_DETERMINISTIC: '1',
      NODE_NO_WARNINGS: '1',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const logs = []
  child.stdout.on('data', (chunk) => logs.push(String(chunk)))
  child.stderr.on('data', (chunk) => logs.push(String(chunk)))
  return { child, logs: () => logs.join('') }
}

async function captureRun(runDirectory, server, label) {
  const result = run(
    process.execPath,
    [VERIFIER, '--url', `http://127.0.0.1:${FIXTURE_PORT}`, '--out', runDirectory],
    { timeout: 600_000 },
  )
  const detail = combinedOutput(result)
  if (result.status === 2) {
    throw new SuiteUnavailableError(`${label}: verifier run UNAVAILABLE: ${detail || 'exit 2'}`)
  }
  if (result.error || result.status !== 0) {
    throw new Error(`${label}: verifier run failed: ${result.error?.message ?? detail ?? result.status}`)
  }

  const summaryPath = path.join(runDirectory, 'performance-summary.json')
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`${label}: verifier wrote no performance-summary.json`)
  }
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
  if (summary.status !== 'PASS') {
    throw new Error(`${label}: performance summary status ${summary.status}, expected PASS`)
  }
  if (summary.comparison?.status !== 'PASS') {
    throw new Error(
      `${label}: telemetry gate comparison status ${summary.comparison?.status}, expected PASS`,
    )
  }
  for (const gate of Object.values(summary.comparison?.gates ?? {})) {
    if (gate.status !== 'PASS') {
      throw new Error(`${label}: gate ${gate.class} status ${gate.status}, expected PASS`)
    }
  }
  const observed = summary.observed?.firstMeaningfulFrame?.observed?.value
  if (typeof observed !== 'number' || !Number.isFinite(observed)) {
    throw new Error(`${label}: first-meaningful-frame was never observed — the model did not load`)
  }
  for (const artifact of [
    'desktop-full.png',
    'desktop-hero.png',
    'mobile-full.png',
    'mobile-hero.png',
    'reduced-motion-a.png',
    'reduced-motion-b.png',
    'fallback-full.png',
    'desktop-snapshot.txt',
    'console-errors.txt',
    'capture.json',
  ]) {
    if (!fs.existsSync(path.join(runDirectory, artifact))) {
      throw new Error(`${label}: verifier wrote no ${artifact}`)
    }
  }
  // fallback-hero.png is written only when the fallback session renders a
  // canvas-like hero element. The WebGL-gated fixture fallback is the
  // composed poster plus DOM copy — no canvas — so its absence is the
  // expected evidence, recorded as such.
  const fallbackHero = path.join(runDirectory, 'fallback-hero.png')
  const fallbackHeroPresent = fs.existsSync(fallbackHero)
  const consoleErrors = fs.readFileSync(path.join(runDirectory, 'console-errors.txt'), 'utf8')
  // The CLI summary always prints, even with zero messages; the gate is the
  // error count. Warnings (e.g. three's own Clock deprecation notice from
  // the pinned R3F matrix) are evidence, not failures.
  const errorCountMatch = consoleErrors.match(/Errors:\s*(\d+)/)
  const errorCount = errorCountMatch ? Number.parseInt(errorCountMatch[1], 10) : null
  if (errorCount !== null && errorCount > 0) {
    throw new Error(
      `${label}: browser console reported ${errorCount} error(s):\n${consoleErrors.trim().slice(0, 2000)}`,
    )
  }
  if (errorCount === null && /\[ERROR\]/.test(consoleErrors)) {
    throw new Error(`${label}: browser console reported errors:\n${consoleErrors.trim().slice(0, 2000)}`)
  }
  const warningCountMatch = consoleErrors.match(/Warnings:\s*(\d+)/)
  const warningCount = warningCountMatch ? Number.parseInt(warningCountMatch[1], 10) : null
  return { summary, fallbackHeroPresent, warningCount }
}

async function assertServedHtml(server, attribute, expected) {
  const response = await fetch(`http://127.0.0.1:${FIXTURE_PORT}/`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status !== 200) {
    throw new Error(`server returned ${response.status} for the fixture page`)
  }
  const html = await response.text()
  const pattern = new RegExp(`${attribute}="${expected}"`)
  if (!pattern.test(html)) {
    throw new Error(`server HTML must resolve ${attribute}="${expected}", got a different state`)
  }
}

async function main() {
  const outIndex = process.argv.findIndex((arg) => arg === '--out')
  const requestedOut = outIndex >= 0 ? path.resolve(process.argv[outIndex + 1] ?? '') : null
  let outputDirectory = requestedOut
  if (!outputDirectory) {
    outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-product-hero-'))
  } else if (fs.existsSync(outputDirectory) && fs.readdirSync(outputDirectory).length > 0) {
    throw new Error(`output directory is not empty: ${outputDirectory}`)
  } else {
    fs.mkdirSync(outputDirectory, { recursive: true })
  }

  const startedAt = Date.now()
  const runs = []
  let server = null
  try {
    const sourceCommit = requireCleanSourceState(
      REPOSITORY_ROOT,
      'before the product-hero fixture suite',
    )
    ensureBuilt()
    verifyBrowserCli()

    // Run 1: deterministic hero-wide — the full standard matrix plus gates.
    server = startServer({})
    await waitForServer(`http://127.0.0.1:${FIXTURE_PORT}`)
    await assertServedHtml(server, 'data-wdu-mode', 'deterministic')
    await assertServedHtml(server, 'data-wdu-station', 'hero-wide')
    const run1Directory = path.join(outputDirectory, 'capture-01-hero-wide')
    fs.mkdirSync(run1Directory, { recursive: true })
    const run1 = await captureRun(run1Directory, server, 'run 1 (hero-wide)')
    runs.push({
      id: 'capture-01-hero-wide',
      configuration: 'WDU_DETERMINISTIC=1',
      status: 'PASS',
      artifacts: run1Directory,
      fallbackHeroPresent: run1.fallbackHeroPresent,
      consoleWarnings: run1.warningCount,
    })
    await stopServer(server, FIXTURE_PORT)
    server = null

    // Run 2: the reduced-motion capture state.
    server = startServer({ WDU_REDUCED_MOTION: '1' })
    await waitForServer(`http://127.0.0.1:${FIXTURE_PORT}`)
    await assertServedHtml(server, 'data-wdu-motion', 'reduced')
    const run2Directory = path.join(outputDirectory, 'capture-02-reduced-motion')
    fs.mkdirSync(run2Directory, { recursive: true })
    const run2 = await captureRun(run2Directory, server, 'run 2 (reduced motion)')
    runs.push({
      id: 'capture-02-reduced-motion',
      configuration: 'WDU_DETERMINISTIC=1 WDU_REDUCED_MOTION=1',
      status: 'PASS',
      artifacts: run2Directory,
      fallbackHeroPresent: run2.fallbackHeroPresent,
      consoleWarnings: run2.warningCount,
    })
    await stopServer(server, FIXTURE_PORT)
    server = null

    // Run 3: the portrait reframe.
    server = startServer({ WDU_STATION: 'hero-portrait' })
    await waitForServer(`http://127.0.0.1:${FIXTURE_PORT}`)
    await assertServedHtml(server, 'data-wdu-station', 'hero-portrait')
    const run3Directory = path.join(outputDirectory, 'capture-03-portrait')
    fs.mkdirSync(run3Directory, { recursive: true })
    const run3 = await captureRun(run3Directory, server, 'run 3 (portrait reframe)')
    runs.push({
      id: 'capture-03-portrait',
      configuration: 'WDU_DETERMINISTIC=1 WDU_STATION=hero-portrait',
      status: 'PASS',
      artifacts: run3Directory,
      fallbackHeroPresent: run3.fallbackHeroPresent,
      consoleWarnings: run3.warningCount,
    })

    const commitAfter = requireCleanSourceState(
      REPOSITORY_ROOT,
      'after the product-hero fixture suite',
    )
    if (commitAfter !== sourceCommit) {
      throw new Error('source commit changed during the product-hero fixture suite')
    }

    const summary = {
      schemaVersion: 1,
      acceptance: 'ip-07a-product-hero-fixture',
      status: 'PASS',
      sourceCommit,
      telemetry: {
        warmGpuMedianMs: run1.summary.observed.warmGpuFrameTime?.median?.value ?? null,
        warmGpuP95Ms: run1.summary.observed.warmGpuFrameTime?.p95?.value ?? null,
        firstMeaningfulFrameMs: run1.summary.observed.firstMeaningfulFrame?.observed?.value ?? null,
        transferBytes: run1.summary.observed.transferBeforeFirstMeaningfulFrame?.observed?.value ?? null,
      },
      runs,
      durationMs: Date.now() - startedAt,
      artifacts: outputDirectory,
    }
    fs.writeFileSync(path.join(outputDirectory, 'product-hero-fixture.json'), `${JSON.stringify(summary, null, 2)}\n`)
    report(
      'PASS',
      `commit=${sourceCommit} runs=${runs.length} first-meaningful-frame=${summary.telemetry.firstMeaningfulFrameMs}ms transfer=${summary.telemetry.transferBytes}B durationMs=${summary.durationMs} artifacts=${outputDirectory}`,
    )
  } catch (error) {
    const unavailable = error instanceof SuiteUnavailableError
    if (outputDirectory && fs.existsSync(outputDirectory)) {
      fs.writeFileSync(
        path.join(outputDirectory, 'product-hero-fixture.json'),
        `${JSON.stringify(
          {
            schemaVersion: 1,
            acceptance: 'ip-07a-product-hero-fixture',
            status: unavailable ? 'UNAVAILABLE' : 'FAIL',
            reason: error instanceof Error ? error.message : String(error),
            runs,
            durationMs: Date.now() - startedAt,
          },
          null,
          2,
        )}\n`,
      )
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
