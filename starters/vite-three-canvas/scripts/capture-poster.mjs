#!/usr/bin/env node

/**
 * scripts/capture-poster.mjs — render the poster fallbacks from the scene they
 * stand in for.
 *
 * A poster is what the visitor sees while the canvas is still coming up, after
 * the quality controller has dropped to the poster tier, and after a lost
 * context. Drawing one by hand produces a picture of what someone remembers the
 * scene looking like; the two drift apart because nothing ties them together.
 * This script ties them together.
 *
 * Each variant is captured from its own named station, because the station is
 * the composition: `hero-wide` frames the cluster for a landscape crop and
 * `hero-portrait` pulls back and aims higher for a tall one. Unlike the Next
 * starter, the station here is a query parameter — this page has no server to
 * resolve it at a request boundary, which is the actual difference between the
 * two stacks rather than a difference in rigor.
 *
 * The output is not promised to be byte-identical across machines: the pixels
 * come out of a GPU, and a macOS Metal backend and a CI software rasterizer
 * disagree about antialiasing. The capture is a committed artifact with
 * recorded provenance, and `src/asset-manifest.json` carries each poster's
 * SHA-256 and the browser that drew it, so a poster edited by hand fails the
 * test suite.
 *
 *   node scripts/capture-poster.mjs              # build, then capture both
 *   node scripts/capture-poster.mjs --skip-build # reuse an existing dist/
 *
 * Exit codes follow ADR-010: 0 captured, 2 the browser evidence was
 * unavailable so nothing was captured and nothing is claimed, 1 it ran and
 * failed.
 */

import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const STARTER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = join(STARTER_ROOT, 'src', 'asset-manifest.json')

/** The version verify-browser.mjs and verify-lab.mjs already pin. */
const CLI_VERSION = '0.1.17'

const POSTERS = [
  {
    id: 'poster-desktop',
    station: 'hero-wide',
    file: 'poster-desktop.png',
    viewport: { width: 1280, height: 720 },
  },
  {
    id: 'poster-portrait',
    station: 'hero-portrait',
    file: 'poster-portrait.png',
    viewport: { width: 720, height: 1280 },
  },
]

class CaptureUnavailableError extends Error {}

function findPlaywrightCli() {
  const explicit = process.env.WDU_PLAYWRIGHT_CLI
  if (explicit) {
    const probe = spawnSync(explicit, ['--version'], { encoding: 'utf8' })
    return probe.status === 0 ? { command: explicit, prefix: [] } : undefined
  }
  const onPath = spawnSync('sh', ['-lc', 'command -v playwright-cli'], { encoding: 'utf8' })
  if (onPath.status === 0 && onPath.stdout.trim()) {
    return { command: onPath.stdout.trim(), prefix: [] }
  }
  const npx = spawnSync('sh', ['-lc', 'command -v npx'], { encoding: 'utf8' })
  if (npx.status === 0 && npx.stdout.trim()) {
    return {
      command: npx.stdout.trim(),
      prefix: ['--yes', '--package', `@playwright/cli@${CLI_VERSION}`, 'playwright-cli'],
    }
  }
  return undefined
}

function hasBrowserCliError(output) {
  return /(?:^|\n)### Error\b/.test(String(output ?? ''))
}

function invokeCli(cli, session, action, args = [], timeout = 120_000) {
  const result = spawnSync(cli.command, [...cli.prefix, `-s=${session}`, action, ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout,
  })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  if (result.error || result.status !== 0 || hasBrowserCliError(output)) {
    const detail = result.error?.message ?? output ?? String(result.status)
    if (/Executable doesn't exist|playwright install|Failed to launch/i.test(detail)) {
      throw new CaptureUnavailableError(`bundled Chromium unavailable: ${detail}`)
    }
    throw new Error(`${session}/${action}: ${detail}`)
  }
  return output
}

function closeCliSession(cli, session) {
  try {
    spawnSync(cli.command, [...cli.prefix, `-s=${session}`, 'close'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
  } catch {
    // Cleanup must not hide the assertion that brought us here.
  }
}

function runNpm(args) {
  const result = spawnSync('npm', args, {
    cwd: STARTER_ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    timeout: 600_000,
  })
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed with exit ${result.status ?? 'spawn-error'}`)
  }
}

function startServer(port) {
  const child = spawn('npm', ['run', 'preview', '--', '--port', String(port), '--strictPort'], {
    cwd: STARTER_ROOT,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const logs = []
  child.stdout.on('data', (chunk) => logs.push(String(chunk)))
  child.stderr.on('data', (chunk) => logs.push(String(chunk)))
  return { child, logs: () => logs.join('') }
}

async function waitForServer(baseUrl, server, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (server.child.exitCode !== null) {
      throw new Error(`server exited early with ${server.child.exitCode}: ${server.logs()}`)
    }
    try {
      const response = await fetch(baseUrl, { redirect: 'manual' })
      if (response.status < 500) return
    } catch {
      // Not listening yet.
    }
    await sleep(500)
  }
  throw new Error(`server did not answer on ${baseUrl}: ${server.logs()}`)
}

async function stopServer(server) {
  if (server.child.exitCode !== null) return
  server.child.kill('SIGTERM')
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (server.child.exitCode !== null) return
    await sleep(250)
  }
  server.child.kill('SIGKILL')
}

function capturePoster(cli, poster, baseUrl, outputPath) {
  const session = `wdu-vanilla-poster-${poster.id}-${process.pid}`
  const url = `${baseUrl}?wdu=deterministic&station=${poster.station}`
  try {
    invokeCli(cli, session, 'open', [baseUrl])
    const raw = invokeCli(cli, session, 'run-code', [
      `async (page) => {
  await page.setViewportSize(${JSON.stringify(poster.viewport)})
  // The poster is painted *behind* the copy at runtime, so a capture that
  // includes the copy renders the headline twice. Hide the DOM layer for the
  // capture only: it is what the poster stands behind, not part of it.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '.copy,.controls{visibility:hidden !important}'
      document.head.appendChild(style)
    })
  })
  await page.goto(${JSON.stringify(url)}, { waitUntil: 'load' })
  await page.waitForSelector('html[data-wdu-ready="true"]', { state: 'attached', timeout: 120000 })
  await page.locator('[data-scene-canvas]').screenshot({ path: ${JSON.stringify(outputPath)} })
  return await page.evaluate(() => ({
    station: document.documentElement.getAttribute('data-wdu-station'),
    motion: document.documentElement.getAttribute('data-wdu-motion'),
    browser: navigator.userAgent,
  }))
}`,
      '--raw',
    ])
    const observed = JSON.parse(raw.split('\n').filter(Boolean).at(0) ?? '{}')
    if (observed.station !== poster.station) {
      throw new Error(
        `captured the wrong station: asked for ${poster.station}, page reported ${observed.station}`,
      )
    }
    if (!existsSync(outputPath)) throw new Error(`no file written at ${outputPath}`)
    return observed
  } finally {
    closeCliSession(cli, session)
  }
}

/** IHDR is the first chunk of every PNG; width and height are bytes 16-23. */
function readPngSize(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (const [index, byte] of signature.entries()) {
    if (bytes[index] !== byte) throw new Error('capture is not a PNG')
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

function browserLabel(userAgent) {
  const match = /(HeadlessChrome|Chrome)\/([\d.]+)/.exec(String(userAgent ?? ''))
  return match ? `Chromium ${match[2]} headless` : String(userAgent ?? 'unknown browser')
}

async function main() {
  const skipBuild = process.argv.includes('--skip-build')
  const cli = findPlaywrightCli()
  if (!cli) {
    throw new CaptureUnavailableError(
      'no Playwright CLI: set WDU_PLAYWRIGHT_CLI, put playwright-cli on PATH, or make npx available',
    )
  }

  if (!skipBuild) runNpm(['run', 'build'])
  if (!existsSync(join(STARTER_ROOT, 'dist'))) {
    throw new Error('no dist/ build to serve; drop --skip-build')
  }

  const port = 4319
  const baseUrl = `http://localhost:${port}/`
  const server = startServer(port)
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))

  try {
    await waitForServer(baseUrl, server)
    for (const poster of POSTERS) {
      const outputPath = join(STARTER_ROOT, 'public', poster.file)
      const observed = capturePoster(cli, poster, baseUrl, outputPath)
      const bytes = readFileSync(outputPath)
      const size = readPngSize(bytes)
      const entry = manifest.assets.find((asset) => asset.id === poster.id)
      if (!entry) throw new Error(`manifest has no entry for ${poster.id}`)
      entry.sha256 = createHash('sha256').update(bytes).digest('hex')
      entry.width = size.width
      entry.height = size.height
      entry.station = poster.station
      entry.capturedWith = browserLabel(observed.browser)
      console.log(
        `captured ${poster.id}: ${size.width}x${size.height} station=${observed.station} motion=${observed.motion}`,
      )
    }
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  } finally {
    await stopServer(server)
  }
}

main().catch((error) => {
  if (error instanceof CaptureUnavailableError) {
    console.error(`UNAVAILABLE capability=browser — ${error.message}`)
    console.error('Nothing was captured and no poster claim is made.')
    process.exit(2)
  }
  console.error(error.stack ?? String(error))
  process.exit(1)
})
