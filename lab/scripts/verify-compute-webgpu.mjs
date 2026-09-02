#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import { chromium } from 'playwright'

const LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const ARTIFACT = process.env.WDU_COMPUTE_ARTIFACT ?? '/tmp/wdu-compute-particles-webgpu.png'

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
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) })
      if (response.ok) return
    } catch {
      // Vite is still starting.
    }
    await sleep(200)
  }
  throw new Error(`lab server did not become ready: ${url}`)
}

function stopServer(server) {
  if (!server || server.exitCode !== null || server.killed) return
  server.kill('SIGTERM')
}

async function main() {
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const server = spawn(
    NPM,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: LAB_ROOT, stdio: 'ignore' },
  )
  try {
    await waitForServer(`${baseUrl}/`)

    let browser
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--enable-unsafe-webgpu'],
      })
    } catch (error) {
      console.log(`UNAVAILABLE: Chromium headless could not launch: ${error.message}`)
      process.exitCode = 2
      return
    }

    const page = await browser.newPage({ viewport: { width: 1024, height: 640 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`)
    })
    await page.goto(`${baseUrl}/?e=compute-particles`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-testid="compute-particles-webgpu"]', { timeout: 30000 })
    await page.waitForFunction(
      () => document.querySelector('[data-testid="compute-particles-webgpu"]')?.getAttribute('data-status'),
      { timeout: 30000 },
    )
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
    console.log(JSON.stringify({ ...result, artifact: ARTIFACT, errors }, null, 2))
    await browser.close()

    if (result.status === 'UNAVAILABLE') {
      process.exitCode = 2
    } else if (result.status !== 'PASS' || result.device !== 'true' || result.dispatch !== 'true' || result.render !== 'true' || errors.length > 0) {
      process.exitCode = 1
    }
  } finally {
    stopServer(server)
  }
}

main().catch((error) => {
  console.log(`FAIL: ${error.stack || error.message}`)
  process.exitCode = 1
})
