#!/usr/bin/env node

/**
 * scripts/capture-poster.mjs — render the poster fallbacks from the scene they
 * stand in for.
 *
 * A poster is the frame the visitor sees while the canvas is loading, while
 * quality has degraded to the poster tier, and after a lost context. Drawing
 * one by hand produces a picture of what someone remembers the scene looking
 * like, which is how this starter ended up shipping a single symmetric shard in
 * a blue glow while the scene rendered a branched crystal, off centre, with a
 * hard cast shadow. The two were never going to agree, because nothing tied
 * them together. This script ties them together: the poster is a capture of the
 * scene, taken through the same deterministic entry point the verifiers use.
 *
 * Each variant is captured from its own named camera station, because the
 * station is the composition — `hero-wide` frames the subject for a landscape
 * crop and `hero-portrait` pulls back and aims higher for a tall one. The
 * station is resolved from WDU_STATION at the application boundary, so a
 * variant means a server of its own rather than a query parameter.
 *
 * What this script does NOT promise is a byte-identical file on every machine.
 * The pixels come out of a GPU: a macOS Metal backend and a CI software
 * rasterizer disagree about antialiasing edges, and a Chromium upgrade may
 * disagree with both. So the capture is a committed artifact with recorded
 * provenance, not a build output — the same footing as any other rendered
 * asset in this repository. `lib/asset-manifest.json` carries the SHA-256 of
 * each poster and the browser it was taken with; `npm test` checks the hash,
 * which is what catches a poster quietly edited by hand.
 *
 *   node scripts/capture-poster.mjs              # build, then capture both
 *   node scripts/capture-poster.mjs --skip-build # reuse an existing .next
 *
 * Exit codes follow the repository's status vocabulary (ADR-010): 0 captured,
 * 2 the browser evidence was unavailable so nothing was captured and nothing is
 * claimed, 1 the capture ran and failed.
 */

import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const STARTER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = join(STARTER_ROOT, 'lib', 'asset-manifest.json')

/** The version `verify-browser.mjs` and `verify-lab.mjs` already pin. */
const CLI_VERSION = '0.1.17'

/**
 * One entry per poster variant. `width` and `height` are the poster's own
 * pixel dimensions, which the capture forces onto the scene frame so the
 * committed file does not inherit whatever the viewport happened to be.
 *
 * They are the shape `.scene-frame` actually takes, measured rather than
 * assumed, because `.scene-poster` fills it with `object-fit: cover` and a
 * mismatched source is simply cropped away. The frame is 1104x560 on a desktop
 * and 720x399 on a tablet, so 16:9 covers both with a few per cent trimmed off
 * the top and bottom. On a phone it is 342x320 — very nearly square. "Portrait"
 * names the device the variant serves, not the shape of the image: the old
 * 900x1600 poster lost about two thirds of its height to the cover crop, and
 * at that aspect the camera's horizontal field of view is narrow enough to
 * slice a branch off the subject. A square capture matches the box across the
 * phone widths that reach it, from 272x320 to 382x320.
 */
const POSTERS = [
  {
    id: 'poster-desktop',
    station: 'hero-wide',
    file: 'poster-desktop.png',
    width: 1200,
    height: 675,
    viewport: { width: 1440, height: 900 },
  },
  {
    id: 'poster-portrait',
    station: 'hero-portrait',
    file: 'poster-portrait.png',
    width: 1000,
    height: 1000,
    viewport: { width: 1200, height: 1200 },
  },
]

class CaptureUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CaptureUnavailableError'
  }
}

function report(status, message) {
  const line = `CAPTURE_POSTER: ${status} ${message}`
  if (status === 'CAPTURED') console.log(line)
  else console.error(line)
}

/**
 * Resolve the Playwright CLI the same three ways the rest of the repository
 * does: an explicit WDU_PLAYWRIGHT_CLI, then one on PATH, then npx with the
 * pinned package. Returning undefined is UNAVAILABLE, never a failure.
 */
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

function build() {
  const result = spawnSync(
    process.execPath,
    [join(STARTER_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'],
    { cwd: STARTER_ROOT, encoding: 'utf8', stdio: 'inherit', timeout: 600_000 },
  )
  if (result.status !== 0) {
    throw new Error(`next build failed with exit ${result.status ?? 'spawn-error'}`)
  }
}

function startServer(port, station) {
  const child = spawn(
    process.execPath,
    [join(STARTER_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port)],
    {
      cwd: STARTER_ROOT,
      env: {
        ...process.env,
        // The capture contract: fixed clock, seeded streams, named station.
        WDU_DETERMINISTIC: '1',
        WDU_STATION: station,
        NODE_NO_WARNINGS: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
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

/**
 * Drive one capture. The frame is pinned to the poster's dimensions from an
 * init script rather than after load, because deterministic mode freezes the
 * render loop once the stable frame is up: a size applied after that point
 * would stretch a smaller drawing buffer instead of re-rendering into a
 * correctly sized one.
 */
function capturePoster(cli, poster, baseUrl, outputPath) {
  const session = `wdu-poster-${poster.id}-${process.pid}`
  const frameStyle =
    `.scene-frame{width:${poster.width}px !important;height:${poster.height}px !important;` +
    `max-width:none !important;border:0 !important;border-radius:0 !important}`
  try {
    invokeCli(cli, session, 'open', [baseUrl])
    const raw = invokeCli(cli, session, 'run-code', [
      `async (page) => {
  await page.setViewportSize(${JSON.stringify(poster.viewport)})
  await page.addInitScript((css) => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = css
      document.head.appendChild(style)
    })
  }, ${JSON.stringify(frameStyle)})
  await page.goto(${JSON.stringify(baseUrl)}, { waitUntil: 'load' })
  await page.waitForSelector('html[data-wdu-ready="true"]', { state: 'attached', timeout: 120000 })
  const canvas = page.locator('.scene-canvas canvas')
  await canvas.screenshot({ path: ${JSON.stringify(outputPath)} })
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

/**
 * The size of the file that was actually written. The frame is pinned in CSS
 * pixels, but the element box the browser composites can land a pixel off after
 * the drawing buffer is divided by the device pixel ratio, so the record states
 * the capture's real dimensions rather than the ones it asked for. IHDR is the
 * first chunk of every PNG; width and height are bytes 16-23.
 */
function readPngSize(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (const [index, byte] of signature.entries()) {
    if (bytes[index] !== byte) throw new Error('capture is not a PNG')
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

/** Chromium's UA string carries the build; the poster records which one drew it. */
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

  if (!skipBuild) build()
  if (!existsSync(join(STARTER_ROOT, '.next'))) {
    throw new Error('no .next build to serve; drop --skip-build')
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const captured = []
  let port = 4390

  for (const poster of POSTERS) {
    const outputPath = join(STARTER_ROOT, 'public', poster.file)
    const baseUrl = `http://127.0.0.1:${port}/`
    const server = startServer(port, poster.station)
    let observed
    try {
      await waitForServer(baseUrl, server)
      observed = capturePoster(cli, poster, baseUrl, outputPath)
    } finally {
      await stopServer(server)
    }
    port += 1

    const bytes = readFileSync(outputPath)
    const size = readPngSize(bytes)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const entry = manifest.assets.find((asset) => asset.id === poster.id)
    if (!entry) throw new Error(`${poster.id} is not declared in lib/asset-manifest.json`)
    entry.url = `/${poster.file}`
    entry.sha256 = sha256
    entry.capture = {
      station: poster.station,
      width: size.width,
      height: size.height,
      browser: browserLabel(observed.browser),
      motion: observed.motion,
      command: 'npm run capture:poster',
    }
    captured.push(
      `${poster.file} ${size.width}x${size.height} ${bytes.length}B ${sha256.slice(0, 12)}`,
    )
  }

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  report('CAPTURED', captured.join(' | '))
}

main().catch((error) => {
  if (error instanceof CaptureUnavailableError) {
    report('UNAVAILABLE', `reason=${error.message}`)
    process.exitCode = 2
    return
  }
  report('FAIL', error.stack || error.message)
  process.exitCode = 1
})
