#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildFixtureHtml } from '../deterministic-capture/capture.mjs'
import { validateExpectedMetadata } from '../deterministic-capture/compare-captures.mjs'

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '../../..')
const VERIFY_BROWSER = path.join(
  REPOSITORY_ROOT,
  'website-design-ultra/scripts/verify-browser.mjs',
)
const EXPECTED_METADATA = path.join(
  REPOSITORY_ROOT,
  'tests/immersive/deterministic-capture/expected-metadata.json',
)
const FIXTURE_TEMPLATE = path.join(
  REPOSITORY_ROOT,
  'tests/immersive/deterministic-capture/fixture.html',
)
const RUNTIME_SOURCE = path.join(
  REPOSITORY_ROOT,
  'references/determinism-runtime.ts',
)

function outputDirectory(argv) {
  if (argv.length === 0) {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-ip-03b-capture-'))
  }
  if (argv.length !== 2 || argv[0] !== '--out') {
    throw new Error('usage: capture-ip-02c.mjs [--out <empty-directory>]')
  }
  const directory = path.resolve(argv[1])
  if (fs.existsSync(directory)) {
    if (!fs.statSync(directory).isDirectory()) {
      throw new Error(`output path is not a directory: ${directory}`)
    }
    if (fs.readdirSync(directory).length > 0) {
      throw new Error(`output directory is not empty: ${directory}`)
    }
  } else {
    fs.mkdirSync(directory, { recursive: true })
  }
  return directory
}

function startFixtureServer(html) {
  const server = http.createServer((request, response) => {
    if (request.url !== '/fixture.html' && request.url !== '/') {
      response.writeHead(404)
      response.end()
      return
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(html)
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('fixture server did not expose a TCP port'))
        return
      }
      resolve({ server, url: `http://127.0.0.1:${address.port}/fixture.html` })
    })
  })
}

function runVerify(url, out) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [VERIFY_BROWSER, '--url', url, '--out', out, '--skip-fallback'],
      {
        cwd: REPOSITORY_ROOT,
        env: {
          ...process.env,
          WDU_DETERMINISTIC: '1',
          NODE_NO_WARNINGS: '1',
        },
      },
    )
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('verify-browser timed out after 300000 ms'))
    }, 300_000)
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.once('error', reject)
    child.once('close', (status, signal) => {
      clearTimeout(timer)
      resolve({ status, signal, stdout, stderr, error: null })
    })
  })
}

function assertSummary(out) {
  const summaryPath = path.join(out, 'performance-summary.json')
  assert.equal(fs.existsSync(summaryPath), true, 'performance-summary.json is required')
  const source = fs.readFileSync(summaryPath, 'utf8')
  assert.doesNotMatch(source, /generatedAt|timeOrigin|timestamp/i)
  const summary = JSON.parse(source)
  assert.equal(summary.status, 'PASS')
  assert.equal(summary.comparison.status, 'PASS')
  assert.equal(summary.capabilities.browser.status, 'AVAILABLE')
  assert.equal(summary.capabilities.gpu.status, 'AVAILABLE')
  assert.equal(summary.capabilities.telemetry.status, 'AVAILABLE')
  assert.equal(summary.failureEvidence.resourceFailures.length, 0)
  assert.equal(summary.failureEvidence.shaderCompileErrors.length, 0)
  assert.equal(summary.failureEvidence.contextLoss.count.value, 0)
  assert.equal(summary.failureEvidence.longFrames.count.value, 1)
  assert.equal(summary.observed.warmGpuFrameTime.sampleWindow.value, 5)
  assert.equal(summary.observed.warmGpuFrameTime.collected.value, 5)
  assert.equal(summary.observed.warmGpuFrameTime.median.value, 18)
  assert.equal(summary.observed.warmGpuFrameTime.p95.value, 21)
  assert.equal(summary.observed.transferBeforeFirstMeaningfulFrame.observed.value, 300)
  assert.equal(summary.evidence.transfer.resourcesConsidered, 1)
  assert.equal(summary.evidence.rendererInfo.render.calls, 42)
  return summary
}

async function main() {
  const out = outputDirectory(process.argv.slice(2))
  const expected = validateExpectedMetadata(
    JSON.parse(fs.readFileSync(EXPECTED_METADATA, 'utf8')),
  )
  const html = buildFixtureHtml({
    expected,
    runtimeSource: fs.readFileSync(RUNTIME_SOURCE, 'utf8'),
    template: fs.readFileSync(FIXTURE_TEMPLATE, 'utf8'),
  })
  const fixture = await startFixtureServer(html)
  try {
    const result = await runVerify(fixture.url, out)
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    if (
      result.status === 2 ||
      /VERIFY_RUNTIME: UNAVAILABLE/.test(output)
    ) {
      console.error(`IP03B_CAPTURE: UNAVAILABLE ${out}`)
      process.exitCode = 2
      return
    }
    if (result.error || result.status !== 0) {
      throw new Error(`verify-browser failed: ${result.error?.message ?? output}`)
    }
    assertSummary(out)
    console.log(`IP03B_CAPTURE: PASS summary=${path.join(out, 'performance-summary.json')}`)
  } finally {
    await new Promise((resolve) => fixture.server.close(resolve))
  }
}

main().catch((error) => {
  console.error(`IP03B_CAPTURE: FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
