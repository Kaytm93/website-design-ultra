#!/usr/bin/env node

/**
 * IP-06B interaction fixture suite.
 *
 * Runs the plugin verifier (website-design-ultra/scripts/verify-browser.mjs
 * --checkpoints) against the interaction fixture pair:
 *
 * - sound absent: the reference starter's own manifest — every declared
 *   checkpoint must capture, keyboard/touch peaks must reach the same
 *   declared outcome state as the pointer click peak, and NO audio entry may
 *   run (audio tests never run for a silent deliverable);
 * - sound present: the static sound fixture under
 *   fixtures/sound-present/ — locked/enabled/muted/returning must capture,
 *   and unlock, mute persistence, and the voice limit must be observable in
 *   the recorded evidence.
 *
 * Exit codes: 0 = PASS, 1 = FAIL, 2 = UNAVAILABLE (browser CLI,
 * deterministic mode, or build capability missing).
 */

import { spawn } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  requireCleanSourceState,
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
const STARTER_MANIFEST = path.join(STARTER_DIRECTORY, 'lib', 'interaction-checkpoints.json')
const SOUND_FIXTURE_DIRECTORY = path.join(SCRIPT_DIRECTORY, 'fixtures', 'sound-present')
const SOUND_MANIFEST = path.join(SOUND_FIXTURE_DIRECTORY, 'manifest.json')
const STARTER_PORT = 3210
const FIXTURE_PORT = 3211

class SuiteUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SuiteUnavailableError'
  }
}

function report(status, message) {
  const output = `INTERACTION_FIXTURES: ${status} ${message}`
  if (status === 'PASS') console.log(output)
  else console.error(output)
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

function ensureStarterBuilt() {
  const hasModules = fs.existsSync(path.join(STARTER_DIRECTORY, 'node_modules'))
  const hasBuild = fs.existsSync(path.join(STARTER_DIRECTORY, '.next'))
  if (hasModules && hasBuild) return
  if (!hasModules) {
    const install = run('npm', ['ci'], { cwd: STARTER_DIRECTORY, timeout: 600_000 })
    if (install.error || install.status !== 0) {
      throw new SuiteUnavailableError(
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

function startStarterServer() {
  const nextCli = path.join(
    STARTER_DIRECTORY,
    'node_modules',
    'next',
    'dist',
    'bin',
    'next',
  )
  const child = spawn(process.execPath, [nextCli, 'start', '-p', String(STARTER_PORT)], {
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

function startStaticServer() {
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
  }
  const child = spawn(
    process.execPath,
    [
      '-e',
      `
        const http = require('node:http')
        const fs = require('node:fs')
        const path = require('node:path')
        const root = ${JSON.stringify(SOUND_FIXTURE_DIRECTORY)}
        const types = ${JSON.stringify(contentTypes)}
        http.createServer((req, res) => {
          const name = req.url === '/' ? 'index.html' : req.url.replace(/^\\//, '')
          const file = path.join(root, name)
          if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            res.writeHead(404)
            res.end('not found')
            return
          }
          res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' })
          res.end(fs.readFileSync(file))
        }).listen(${FIXTURE_PORT})
      `,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const logs = []
  child.stdout.on('data', (chunk) => logs.push(String(chunk)))
  child.stderr.on('data', (chunk) => logs.push(String(chunk)))
  return { child, logs: () => logs.join('') }
}

function captureRun(options, runDirectory, manifest) {
  const result = run(
    process.execPath,
    [
      VERIFIER,
      '--url',
      `http://127.0.0.1:${options.port}`,
      '--out',
      runDirectory,
      '--checkpoints',
      manifest,
    ],
    { timeout: 600_000 },
  )
  const detail = combinedOutput(result)
  if (result.status === 2) {
    throw new SuiteUnavailableError(`verifier run UNAVAILABLE: ${detail || 'exit 2'}`)
  }
  if (result.error || result.status !== 0) {
    throw new Error(`verifier run failed: ${result.error?.message ?? detail ?? result.status}`)
  }
  const metadataPath = path.join(runDirectory, 'checkpoints.json')
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`verifier run wrote no checkpoints.json: ${runDirectory}`)
  }
  return JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
}

function assertAllCaptured(metadata, fixtureName) {
  const failed = metadata.entries.filter((entry) => entry.status !== 'CAPTURED')
  if (failed.length > 0) {
    throw new Error(
      `${fixtureName}: ${failed
        .map((entry) => `${entry.id}=${entry.status} (${entry.reason ?? ''})`)
        .join('; ')}`,
    )
  }
}

function assertKeyboardTouchPointerOutcome(metadata) {
  const byId = new Map(metadata.entries.map((entry) => [entry.id, entry]))
  const clickPeak = [...metadata.entries].find(
    (entry) => entry.interaction === 'click' && entry.phase === 'peak',
  )
  const keyboardPeak = [...metadata.entries].find(
    (entry) => entry.interaction === 'keyboard' && entry.phase === 'peak',
  )
  const touchPeak = [...metadata.entries].find(
    (entry) => entry.interaction === 'touch' && entry.phase === 'peak',
  )
  if (!clickPeak || !keyboardPeak || !touchPeak) {
    throw new Error('the silent fixture must declare click, keyboard, and touch peak checkpoints')
  }
  if (keyboardPeak.waitFor !== clickPeak.waitFor || touchPeak.waitFor !== clickPeak.waitFor) {
    throw new Error(
      'keyboard and touch peaks must reach the same declared outcome state as the pointer click peak',
    )
  }
  for (const entry of [clickPeak, keyboardPeak, touchPeak]) {
    if (entry.status !== 'CAPTURED') {
      throw new Error(`outcome peak ${entry.id} was not captured (${entry.status})`)
    }
  }
  return {
    outcomeState: clickPeak.waitFor,
    clickPeak: byId.get(clickPeak.id)?.file,
    keyboardPeak: byId.get(keyboardPeak.id)?.file,
    touchPeak: byId.get(touchPeak.id)?.file,
  }
}

function assertSilentFixture(metadata) {
  const audio = metadata.entries.filter((entry) => entry.interaction === 'audio')
  if (audio.length > 0) {
    throw new Error('audio tests must not run for a silent deliverable')
  }
}

function assertSoundFixture(metadata) {
  const audio = metadata.entries.filter((entry) => entry.interaction === 'audio')
  const states = audio.map((entry) => entry.state)
  for (const state of ['locked', 'enabled', 'muted', 'returning']) {
    if (!states.includes(state)) {
      throw new Error(`the sound fixture must capture the audio state ${state}`)
    }
  }

  const enabled = audio.find((entry) => entry.state === 'enabled')
  if (enabled.audio?.audio !== 'enabled') {
    throw new Error(`unlock not observable: enabled evidence is ${JSON.stringify(enabled.audio)}`)
  }
  const limit = enabled.voiceLimit
  if (!limit || limit.observedMaxVoices > limit.declared) {
    throw new Error(`voice limit not observable: ${JSON.stringify(limit)}`)
  }
  if (!(limit.clamped >= 1 && limit.attempts > limit.declared)) {
    throw new Error(`voice limit did not engage: ${JSON.stringify(limit)}`)
  }

  const muted = audio.find((entry) => entry.state === 'muted')
  if (muted.persistence?.value !== 'muted') {
    throw new Error(`mute persistence not observable: ${JSON.stringify(muted.persistence)}`)
  }

  const returning = audio.find((entry) => entry.state === 'returning')
  if (returning.audio?.restored !== 'true' || returning.persistence?.wrote !== 'muted') {
    throw new Error(
      `returning session not observable: audio=${JSON.stringify(returning.audio)} persistence=${JSON.stringify(returning.persistence)}`,
    )
  }
}

async function main() {
  const out = process.argv.findIndex((arg) => arg === '--out')
  const requestedOut = out >= 0 ? path.resolve(process.argv[out + 1] ?? '') : null
  let outputDirectory = requestedOut
  if (!outputDirectory) {
    outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-interaction-fixtures-'))
  } else if (fs.existsSync(outputDirectory) && fs.readdirSync(outputDirectory).length > 0) {
    throw new Error(`output directory is not empty: ${outputDirectory}`)
  } else {
    fs.mkdirSync(outputDirectory, { recursive: true })
  }

  let starterServer = null
  let staticServer = null
  try {
    const sourceCommit = requireCleanSourceState(
      REPOSITORY_ROOT,
      'before the interaction fixture suite',
    )
    validateCheckpointManifest(JSON.parse(fs.readFileSync(STARTER_MANIFEST, 'utf8')))
    validateCheckpointManifest(JSON.parse(fs.readFileSync(SOUND_MANIFEST, 'utf8')))
    ensureStarterBuilt()
    verifyBrowserCli()

    starterServer = startStarterServer()
    await waitForServer(`http://127.0.0.1:${STARTER_PORT}`)
    staticServer = startStaticServer()
    await waitForServer(`http://127.0.0.1:${FIXTURE_PORT}`)

    const silentDirectory = path.join(outputDirectory, 'sound-absent')
    fs.mkdirSync(silentDirectory, { recursive: true })
    const silent = captureRun(
      { port: STARTER_PORT },
      silentDirectory,
      STARTER_MANIFEST,
    )
    assertAllCaptured(silent, 'sound-absent (starter)')
    assertSilentFixture(silent)
    const outcome = assertKeyboardTouchPointerOutcome(silent)

    const soundDirectory = path.join(outputDirectory, 'sound-present')
    fs.mkdirSync(soundDirectory, { recursive: true })
    const sound = captureRun(
      { port: FIXTURE_PORT },
      soundDirectory,
      SOUND_MANIFEST,
    )
    assertAllCaptured(sound, 'sound-present (fixture)')
    assertSoundFixture(sound)

    const commitAfter = requireCleanSourceState(
      REPOSITORY_ROOT,
      'after the interaction fixture suite',
    )
    if (commitAfter !== sourceCommit) {
      throw new Error('source commit changed during the interaction fixture suite')
    }

    const summary = {
      schemaVersion: 1,
      acceptance: 'ip-06b-interaction-fixture-suite',
      status: 'PASS',
      sourceCommit,
      fixtures: {
        'sound-absent': {
          project: silent.project,
          captured: silent.entries.filter((entry) => entry.status === 'CAPTURED').length,
          audioEntries: silent.entries.filter((entry) => entry.interaction === 'audio').length,
          keyboardTouchPointerOutcome: outcome,
        },
        'sound-present': {
          project: sound.project,
          captured: sound.entries.filter((entry) => entry.status === 'CAPTURED').length,
          audioStates: sound.entries
            .filter((entry) => entry.interaction === 'audio')
            .map((entry) => entry.state),
          audioEvidence: sound.entries
            .filter((entry) => entry.interaction === 'audio')
            .map((entry) => ({
              id: entry.id,
              state: entry.state,
              audio: entry.audio ?? null,
              persistence: entry.persistence ?? null,
              voiceLimit: entry.voiceLimit ?? null,
            })),
        },
      },
    }
    fs.writeFileSync(path.join(outputDirectory, 'interaction-fixtures.json'), `${JSON.stringify(summary, null, 2)}\n`)
    report(
      'PASS',
      `commit=${sourceCommit} sound-absent=${summary.fixtures['sound-absent'].captured} sound-present=${summary.fixtures['sound-present'].captured} artifacts=${outputDirectory}`,
    )
  } catch (error) {
    const unavailable = error instanceof SuiteUnavailableError
    if (outputDirectory && fs.existsSync(outputDirectory)) {
      fs.writeFileSync(
        path.join(outputDirectory, 'interaction-fixtures.json'),
        `${JSON.stringify(
          {
            schemaVersion: 1,
            acceptance: 'ip-06b-interaction-fixture-suite',
            status: unavailable ? 'UNAVAILABLE' : 'FAIL',
            reason: error instanceof Error ? error.message : String(error),
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
    for (const server of [starterServer, staticServer]) {
      if (server) {
        server.child.kill('SIGTERM')
        setTimeout(() => server.child.kill('SIGKILL'), 3000).unref()
      }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
