#!/usr/bin/env node

/**
 * lab/scripts/verify-compute-webgpu.mjs — J-D4 device gate.
 *
 * Drives the root-only lab route `?e=compute-particles` in headless Chromium
 * with `--enable-unsafe-webgpu` and reports whether a real GPUDevice ran the
 * TSL compute kernel and rendered from it.
 *
 * Status contract (ADR-010, the same vocabulary as
 * website-design-ultra/scripts/verify-browser.mjs and
 * tests/immersive/evaluation/run-implementation-evaluation.mjs):
 *
 *   exit 0  PASS         a real GPUDevice dispatched the kernel and rendered
 *   exit 1  FAIL         the device ran and the evidence was wrong
 *   exit 2  UNAVAILABLE  the run could not be attempted on this host
 *
 * UNAVAILABLE is never a pass, and an absent capability is never a crash: a
 * missing playwright package, a missing browser binary, a dev server that
 * never comes up and a device that refuses to initialise are all capability
 * gaps, and each is reported as one machine-readable line with a reason
 * rather than as a Node stack trace. A stack trace carries no status at all,
 * so a caller cannot tell "this host has no GPU" from "the compute path is
 * broken" — which is exactly the distinction this gate exists to make.
 */

import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const ARTIFACT = process.env.WDU_COMPUTE_ARTIFACT ?? '/tmp/wdu-compute-particles-webgpu.png'
const LABEL = 'VERIFY_COMPUTE_WEBGPU'

/** A capability gap: reported as UNAVAILABLE with a reason, never as a crash. */
class Unavailable extends Error {
  constructor(reason) {
    super(reason)
    this.name = 'Unavailable'
    this.reason = reason
  }
}

function report(status, detail) {
  console.log(`${LABEL}: ${status} ${detail}`)
}

function reason(error) {
  const text = error instanceof Error ? error.message : String(error)
  // Playwright appends a boxed "install browsers" banner to launch errors. The
  // status line has to stay one greppable line, so the banner is cut off.
  const [head] = text.split(/[╔═║╚]/u)
  return head.replace(/\s+/g, ' ').trim().slice(0, 300)
}

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => (error ? reject(error) : resolvePort(port)))
    })
  })
}

async function waitForServer(url) {
  let last = 'no response'
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) })
      if (response.ok) return
      last = `HTTP ${response.status}`
    } catch (error) {
      // Vite is still starting, or it never will.
      last = reason(error)
    }
    await sleep(200)
  }
  throw new Unavailable(`lab dev server did not become ready at ${url} (${last}); run \`npm ci\` in lab/`)
}

function stopServer(server) {
  if (!server || server.exitCode !== null || server.killed) return
  server.kill('SIGTERM')
}

/**
 * playwright is a lab devDependency, so an install that never ran is a
 * capability gap rather than a programming error. Importing it lazily is what
 * lets that case reach the UNAVAILABLE path instead of aborting module
 * evaluation with ERR_MODULE_NOT_FOUND before main() exists.
 */
async function loadChromium() {
  try {
    const { chromium } = await import('playwright')
    return chromium
  } catch (error) {
    throw new Unavailable(
      `playwright is not installed in lab/ (${reason(error)}); run \`npm ci\` in lab/`,
    )
  }
}

async function launchChromium(chromium) {
  try {
    return await chromium.launch({
      headless: true,
      args: ['--enable-unsafe-webgpu'],
    })
  } catch (error) {
    throw new Unavailable(
      `Chromium headless could not launch (${reason(error)}); run \`npx playwright install --with-deps chromium\` in lab/`,
    )
  }
}

async function collectEvidence(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.goto(`${baseUrl}/?e=compute-particles`, { waitUntil: 'networkidle' })

  // The route creates this element synchronously on mount, before it touches
  // navigator.gpu. Its absence means the module never loaded — a real defect,
  // not a missing device — so it stays a FAIL.
  await page.waitForSelector('[data-testid="compute-particles-webgpu"]', { timeout: 30000 })

  // The status attribute, in contrast, is only set once the adapter and
  // device requests settle. A device that never finishes initialising leaves
  // it unset, and that is a capability gap.
  try {
    await page.waitForFunction(
      () => document.querySelector('[data-testid="compute-particles-webgpu"]')?.getAttribute('data-status'),
      { timeout: 30000 },
    )
  } catch (error) {
    throw new Unavailable(
      `the WebGPU device did not initialise within 30s (${reason(error)})`,
    )
  }

  const result = await page.evaluate(() => {
    const element = document.querySelector('[data-testid="compute-particles-webgpu"]')
    return {
      status: element?.getAttribute('data-status'),
      device: element?.getAttribute('data-webgpu-device'),
      dispatch: element?.getAttribute('data-compute-dispatch'),
      render: element?.getAttribute('data-compute-render'),
      reason: element?.getAttribute('data-reason'),
    }
  })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: ARTIFACT })
  return { result, errors }
}

async function main() {
  const chromium = await loadChromium()
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const server = spawn(
    NPM,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: LAB_ROOT, stdio: 'ignore' },
  )
  try {
    await waitForServer(`${baseUrl}/`)

    const browser = await launchChromium(chromium)
    let evidence
    try {
      evidence = await collectEvidence(browser, baseUrl)
    } finally {
      await browser.close().catch(() => {})
    }

    const { result, errors } = evidence
    console.log(JSON.stringify({ ...result, artifact: ARTIFACT, errors }, null, 2))

    if (result.status === 'UNAVAILABLE') {
      report('UNAVAILABLE', `reason=${result.reason ?? 'no WebGPU device on this host'}`)
      process.exitCode = 2
      return
    }
    if (
      result.status !== 'PASS' ||
      result.device !== 'true' ||
      result.dispatch !== 'true' ||
      result.render !== 'true' ||
      errors.length > 0
    ) {
      report(
        'FAIL',
        `status=${result.status} device=${result.device} dispatch=${result.dispatch} render=${result.render} errors=${errors.length}`,
      )
      process.exitCode = 1
      return
    }
    report('PASS', `device=true dispatch=true render=true artifact=${ARTIFACT}`)
  } finally {
    stopServer(server)
  }
}

main().catch((error) => {
  if (error instanceof Unavailable) {
    report('UNAVAILABLE', `reason=${error.reason}`)
    process.exitCode = 2
    return
  }
  report('FAIL', reason(error))
  console.error(error.stack ?? String(error))
  process.exitCode = 1
})
