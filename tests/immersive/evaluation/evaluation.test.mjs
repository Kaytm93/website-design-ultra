/**
 * IP-07B — offline unit tests for the implementation evaluation runner.
 *
 * These tests exercise the runner's pure gate-evaluation surface against
 * synthetic artifact trees, proving the acceptance contract without a
 * browser:
 *
 * - every assertion decides from evidence files, and a missing capture can
 *   never be replaced by a build pass;
 * - failed resources, console errors, and shader errors fail the runtime
 *   case;
 * - the three telemetry gates map through the performance summary;
 * - expectations (PASS, and deliberate FAIL per gate) are matched exactly,
 *   with UNAVAILABLE never treated as PASS or FAIL.
 *
 * They also guard the CI shard matrix against drift: the suite runs one
 * fixture per job, so a fixture added to the repository without a matrix
 * entry would never run and its absence would look like a green suite.
 *
 * Run from the repository root:
 *   node --test tests/immersive/evaluation/evaluation.test.mjs
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  GATE_IDS,
  aggregateGateStatus,
  evaluateGates,
  matchExpectation,
  parseFixtureDeclaration,
  peerGreenFixtureNames,
  validateFixtureDeclaration,
} from './run-implementation-evaluation.mjs'

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIRECTORY = path.join(SCRIPT_DIRECTORY, 'fixtures')
const PRODUCT_HERO = path.join(SCRIPT_DIRECTORY, '..', 'product-hero')

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-evaluation-test-'))
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function productHeroDeclaration() {
  return parseFixtureDeclaration(path.join(PRODUCT_HERO, 'fixture.json'))
}

function staticDeclaration(id, overrides = {}) {
  return parseFixtureDeclaration(
    path.join(FIXTURES_DIRECTORY, id, 'fixture.json'),
  )
}

function standardSummary(overrides = {}) {
  return {
    schemaVersion: 1,
    status: overrides.status ?? 'PASS',
    capabilities: {
      browser: { status: 'AVAILABLE' },
      gpu: { status: 'AVAILABLE' },
      telemetry: { status: 'AVAILABLE' },
    },
    failureEvidence: overrides.failureEvidence ?? {
      resourceFailures: [],
      shaderCompileErrors: [],
      runtimeErrors: [],
      longFrames: { count: { value: 0, unit: 'count' }, detected: false },
      contextLoss: { count: { value: 0, unit: 'count' }, events: [] },
    },
    observed: {
      warmGpuFrameTime: {
        median: { value: 16.7, unit: 'ms' },
        p95: { value: 16.7, unit: 'ms' },
      },
      firstMeaningfulFrame: {
        observed:
          overrides.firstFrameMs === null
            ? null
            : { value: overrides.firstFrameMs ?? 1200, unit: 'ms' },
      },
      transferBeforeFirstMeaningfulFrame: {
        observed: { value: 2400, unit: 'bytes' },
      },
    },
    comparison: {
      status: overrides.comparisonStatus ?? 'PASS',
      gates: {
        'warm-gpu-frame-time': {
          class: 'warm-gpu-frame-time',
          status: overrides.warmGpuGate ?? 'PASS',
        },
        'first-meaningful-frame': {
          class: 'first-meaningful-frame',
          status: overrides.firstFrameGate ?? 'PASS',
        },
        'transfer-before-first-meaningful-frame': {
          class: 'transfer-before-first-meaningful-frame',
          status: overrides.transferGate ?? 'PASS',
        },
      },
    },
  }
}

function standardRun(directory, overrides = {}) {
  write(
    path.join(directory, 'capture.json'),
    `${JSON.stringify({ status: 'captured', backend: 'npm-cli' })}\n`,
  )
  write(
    path.join(directory, 'performance-summary.json'),
    `${JSON.stringify(standardSummary(overrides), null, 2)}\n`,
  )
  for (const name of [
    'desktop-full.png',
    'desktop-snapshot.txt',
    'console-errors.txt',
    'desktop-hero.png',
    'mobile-full.png',
    'mobile-hero.png',
    'reduced-motion-a.png',
    'reduced-motion-b.png',
    'fallback-full.png',
  ]) {
    write(path.join(directory, name), overrides.artifactBytes?.[name] ?? 'x')
  }
  return {
    exitCode: overrides.exitCode ?? 0,
    directory,
    summary: standardSummary(overrides),
    consoleErrors:
      overrides.consoleErrors ?? 'Total messages: 0 (Errors: 0, Warnings: 0)',
    captureJson: { status: 'captured', backend: 'npm-cli' },
    serverHtml: overrides.serverHtml ?? {
      mode: 'deterministic',
      station: 'hero-wide',
    },
  }
}

function greenContext(overrides = {}) {
  const root = temporaryDirectory()
  const declaration = overrides.declaration ?? productHeroDeclaration()
  const standardDirectory = path.join(root, 'capture-standard')
  const standard = standardRun(standardDirectory, overrides.standard ?? {})
  const reducedDirectory = path.join(root, 'capture-reduced-motion')
  fs.mkdirSync(reducedDirectory, { recursive: true })
  write(path.join(reducedDirectory, 'reduced-motion-a.png'), 'x')
  write(path.join(reducedDirectory, 'reduced-motion-b.png'), 'x')
  const portraitDirectory = path.join(root, 'capture-portrait')
  fs.mkdirSync(portraitDirectory, { recursive: true })
  write(path.join(portraitDirectory, 'capture.json'), '{}\n')
  const checkpointsDirectory = path.join(root, 'checkpoints')
  fs.mkdirSync(checkpointsDirectory, { recursive: true })
  const context = {
    declaration,
    build: { status: 'PASS', evidence: ['gates/build.log', '.next/BUILD_ID'], reason: null },
    standard,
    reduced: {
      exitCode: 0,
      directory: reducedDirectory,
      serverHtmlMotion: 'reduced',
    },
    portrait: {
      exitCode: 0,
      directory: portraitDirectory,
      serverHtmlStation: 'hero-portrait',
    },
    checkpoints: overrides.checkpoints ?? {
      exitCode: 0,
      directory: checkpointsDirectory,
      metadata: {
        project: 'wdu-product-hero',
        entries: greenCheckpointEntries(),
      },
    },
    posterFetches: [
      { path: '/poster-desktop.svg', status: 200 },
      { path: '/poster-portrait.svg', status: 200 },
    ],
  }
  write(
    path.join(checkpointsDirectory, 'checkpoints.json'),
    `${JSON.stringify(context.checkpoints.metadata)}\n`,
  )
  return { root, context }
}

function greenCheckpointEntries() {
  const entries = []
  const group = (interaction, phases, target) => {
    for (const phase of phases) {
      entries.push({
        id: `${interaction}-${phase}`,
        interaction,
        phase,
        target,
        waitFor: `html[data-wdu-pointer="${phase === 'peak' ? 'pressed' : 'idle'}"]`,
        status: 'CAPTURED',
        file: `${interaction}-${phase}.png`,
      })
    }
  }
  group('hover', ['before', 'during', 'after'], '.scene-frame')
  group('click', ['before', 'peak', 'recovered'], '.scene-frame')
  group('focus', ['before', 'during', 'after'], '[data-wdu-activation-target]')
  group('keyboard', ['before', 'peak', 'recovered'], '[data-wdu-activation-target]')
  group('touch', ['before', 'peak', 'recovered'], '[data-wdu-activation-target]')
  for (const entry of entries.filter((entry) => entry.interaction === 'touch')) {
    entry.touch = { method: 'cdp-touch' }
  }
  for (const progress of [0, 0.5, 1]) {
    entries.push({ id: `page-scroll-${progress * 100}`, interaction: 'scroll', progress, status: 'CAPTURED', file: `page-scroll-${progress * 100}.png` })
  }
  entries.push({ id: 'scene-ready', interaction: 'ready', status: 'CAPTURED', file: 'scene-ready.png' })
  entries.push({ id: 'scene-failure', interaction: 'failure', waitFor: 'html[data-wdu-context="lost"]', status: 'CAPTURED', file: 'scene-failure.png' })
  return entries
}

// ---------------------------------------------------------------------------
// Declaration parsing and validation
// ---------------------------------------------------------------------------

test('every committed fixture declaration parses and matches its directory', () => {
  const directories = [
    PRODUCT_HERO,
    ...fs
      .readdirSync(FIXTURES_DIRECTORY, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'common')
      .map((entry) => path.join(FIXTURES_DIRECTORY, entry.name)),
  ]
  for (const directory of directories) {
    const declaration = parseFixtureDeclaration(path.join(directory, 'fixture.json'))
    assert.equal(declaration.id, path.basename(directory))
    assert.ok(GATE_IDS.includes(declaration.expect.status === 'FAIL' ? declaration.expect.gates[0] : 'build'))
    for (const gate of declaration.expect.gates ?? []) {
      assert.ok(GATE_IDS.includes(gate), `${directory}: unknown gate ${gate}`)
      if (declaration.kind === 'static') {
        assert.notEqual(gate, 'build', `${directory}: a static fixture cannot fail the build gate`)
      }
    }
  }
})

test('the product-hero declaration expects PASS with the full declared surface', () => {
  const declaration = productHeroDeclaration()
  assert.equal(declaration.kind, 'next-app')
  assert.deepEqual(declaration.expect, { status: 'PASS' })
  assert.equal(declaration.declared.checkpointsManifest, 'lib/interaction-checkpoints.json')
  assert.equal(declaration.declared.portraitStation, 'hero-portrait')
  assert.equal(declaration.declared.reducedMotionStaticPair, true)
  assert.equal(declaration.declared.fallbackHeroAbsent, true)
})

test('declaration validation rejects malformed expectations and surfaces', () => {
  const base = productHeroDeclaration()
  assert.throws(
    () => validateFixtureDeclaration({ ...base, expect: { status: 'FAIL' } }),
    /must name applicable gates/,
  )
  assert.throws(
    () => validateFixtureDeclaration({ ...base, expect: { status: 'PASS', gates: ['runtime'] } }),
    /must not name failing gates/,
  )
  assert.throws(
    () => validateFixtureDeclaration({ ...base, expect: { status: 'MAYBE' } }),
    /must be PASS or FAIL/,
  )
  assert.throws(
    () => validateFixtureDeclaration({ ...base, kind: 'vite' }),
    /must be next-app or static/,
  )
  assert.throws(
    () =>
      validateFixtureDeclaration({
        ...base,
        declared: { ...base.declared, fallbackPosters: ['poster.svg'] },
      }),
    /absolute URL paths/,
  )
  const staticBase = staticDeclaration('runtime-console-error')
  assert.throws(
    () => validateFixtureDeclaration({ ...staticBase, expect: { status: 'FAIL', gates: ['build'] } }),
    /applicable gates/,
  )
})

// ---------------------------------------------------------------------------
// The acceptance contract: evidence, never build-pass substitution
// ---------------------------------------------------------------------------

test('a green product-hero-shaped context passes every gate', () => {
  const { context } = greenContext()
  const { gates, status } = evaluateGates(context)
  assert.equal(status, 'PASS')
  for (const id of GATE_IDS) {
    assert.equal(gates[id].status, 'PASS', `gate ${id} should PASS`)
    assert.ok(gates[id].evidence.length > 0, `gate ${id} must link evidence`)
  }
})

test('a missing capture fails runtime even when the build passed', () => {
  // The acceptance line: "a missing capture cannot be replaced by a build
  // pass". Build evidence is green; the desktop capture files are absent.
  const { context } = greenContext()
  fs.rmSync(path.join(context.standard.directory, 'desktop-full.png'))
  fs.rmSync(path.join(context.standard.directory, 'desktop-snapshot.txt'))
  const { gates, status } = evaluateGates(context)
  assert.equal(status, 'FAIL')
  assert.equal(gates.build.status, 'PASS', 'the build gate itself is green')
  assert.equal(gates.runtime.status, 'FAIL')
  assert.match(gates.runtime.reason, /missing evidence desktop-full\.png/)
})

test('a failed build makes every capture gate NOT_APPLICABLE, never PASS', () => {
  const { context } = greenContext()
  context.build = {
    status: 'FAIL',
    evidence: ['gates/build.log', '.next/BUILD_ID'],
    reason: 'fixture build failed: deliberate',
  }
  context.standard = null
  context.reduced = null
  context.portrait = null
  context.checkpoints = null
  context.posterFetches = null
  const { gates, status } = evaluateGates(context)
  assert.equal(status, 'FAIL')
  assert.equal(gates.build.status, 'FAIL')
  for (const id of CAPTURE_GATE_IDS) {
    assert.equal(gates[id].status, 'NOT_APPLICABLE', `gate ${id} must be NOT_APPLICABLE`)
  }
})

const CAPTURE_GATE_IDS = GATE_IDS.filter((id) => id !== 'build')

test('console errors fail the runtime case', () => {
  const { context } = greenContext()
  context.standard.consoleErrors =
    'Total messages: 1 (Errors: 1, Warnings: 0)\nReturning 1 messages for level "error"\n- ERROR: deliberate runtime error'
  write(
    path.join(context.standard.directory, 'console-errors.txt'),
    context.standard.consoleErrors,
  )
  const { gates } = evaluateGates(context)
  assert.equal(gates.runtime.status, 'FAIL')
  assert.match(gates.runtime.reason, /console reported 1 error/)
})

test('failed resources fail the runtime case', () => {
  const { context } = greenContext()
  context.standard.summary.failureEvidence.resourceFailures = [
    { kind: 'resource-load', message: 'failed to load resource', resource: '/missing.js' },
  ]
  write(
    path.join(context.standard.directory, 'performance-summary.json'),
    `${JSON.stringify(context.standard.summary, null, 2)}\n`,
  )
  const { gates } = evaluateGates(context)
  assert.equal(gates.runtime.status, 'FAIL')
  assert.match(gates.runtime.reason, /resourceFailures reported 1/)
})

test('shader compile errors fail the runtime case', () => {
  const { context } = greenContext()
  context.standard.summary.failureEvidence.shaderCompileErrors = [
    { kind: 'shader-compile', message: 'no matching overloaded function found' },
  ]
  write(
    path.join(context.standard.directory, 'performance-summary.json'),
    `${JSON.stringify(context.standard.summary, null, 2)}\n`,
  )
  const { gates } = evaluateGates(context)
  assert.equal(gates.runtime.status, 'FAIL')
  assert.match(gates.runtime.reason, /shaderCompileErrors reported 1/)
})

test('runtime errors and context loss fail the runtime case', () => {
  for (const [key, value] of [
    ['runtimeErrors', [{ kind: 'runtime', message: 'uncaught' }]],
    ['contextLoss', { count: { value: 1, unit: 'count' }, events: [{ reason: 'context lost', recovered: false }] }],
  ]) {
    const { context } = greenContext()
    context.standard.summary.failureEvidence[key] = value
    write(
      path.join(context.standard.directory, 'performance-summary.json'),
      `${JSON.stringify(context.standard.summary, null, 2)}\n`,
    )
    const { gates } = evaluateGates(context)
    assert.equal(gates.runtime.status, 'FAIL', `${key} must fail the runtime gate`)
  }
})

test('an unobserved first meaningful frame fails runtime (missing capture evidence)', () => {
  const { context } = greenContext()
  context.standard.summary.observed.firstMeaningfulFrame.observed = null
  write(
    path.join(context.standard.directory, 'performance-summary.json'),
    `${JSON.stringify(context.standard.summary, null, 2)}\n`,
  )
  const { gates } = evaluateGates(context)
  assert.equal(gates.runtime.status, 'FAIL')
  assert.match(gates.runtime.reason, /first meaningful frame was never observed/)
})

test('an unparseable console file fails runtime rather than passing silently', () => {
  const { context } = greenContext()
  context.standard.consoleErrors = 'unexpected format without a count'
  write(
    path.join(context.standard.directory, 'console-errors.txt'),
    context.standard.consoleErrors,
  )
  const { gates } = evaluateGates(context)
  assert.equal(gates.runtime.status, 'FAIL')
  assert.match(gates.runtime.reason, /no parseable error count/)
})

test('an UNAVAILABLE summary makes runtime UNAVAILABLE, never PASS', () => {
  const { context } = greenContext()
  context.standard.summary.status = 'UNAVAILABLE'
  context.standard.summary.unavailable = { telemetry: 'surface missing' }
  write(
    path.join(context.standard.directory, 'performance-summary.json'),
    `${JSON.stringify(context.standard.summary, null, 2)}\n`,
  )
  const { gates, status } = evaluateGates(context)
  assert.equal(gates.runtime.status, 'UNAVAILABLE')
  assert.equal(status, 'UNAVAILABLE')
})

// ---------------------------------------------------------------------------
// Per-gate assertions
// ---------------------------------------------------------------------------

test('mobile gate: a missing mobile hero capture fails when declared', () => {
  const { context } = greenContext()
  fs.rmSync(path.join(context.standard.directory, 'mobile-hero.png'))
  const { gates } = evaluateGates(context)
  assert.equal(gates.mobile.status, 'FAIL')
  assert.match(gates.mobile.reason, /missing evidence mobile-hero\.png/)
})

test('mobile gate: a portrait station the server never resolves fails', () => {
  const { context } = greenContext()
  context.portrait.serverHtmlStation = 'hero-wide'
  const { gates } = evaluateGates(context)
  assert.equal(gates.mobile.status, 'FAIL')
  assert.match(gates.mobile.reason, /hero-portrait/)
})

test('reduced-motion gate: differing a/b captures fail when a static pair is declared', () => {
  const { context } = greenContext()
  write(path.join(context.reduced.directory, 'reduced-motion-a.png'), 'frame-a')
  write(path.join(context.reduced.directory, 'reduced-motion-b.png'), 'frame-b')
  const { gates } = evaluateGates(context)
  assert.equal(gates['reduced-motion'].status, 'FAIL')
  assert.match(gates['reduced-motion'].reason, /kept animating/)
})

test('reduced-motion gate: a server that does not resolve the reduced state fails', () => {
  const { context } = greenContext()
  context.reduced.serverHtmlMotion = 'full'
  const { gates } = evaluateGates(context)
  assert.equal(gates['reduced-motion'].status, 'FAIL')
  assert.match(gates['reduced-motion'].reason, /data-wdu-motion/)
})

test('fallback gate: a poster asset that 404s fails', () => {
  const { context } = greenContext()
  context.posterFetches[0].status = 404
  const { gates } = evaluateGates(context)
  assert.equal(gates.fallback.status, 'FAIL')
  assert.match(gates.fallback.reason, /served status 404/)
})

test('fallback gate: an unexpected fallback hero canvas fails when declared absent', () => {
  const { context } = greenContext()
  write(path.join(context.standard.directory, 'fallback-hero.png'), 'x')
  const { gates } = evaluateGates(context)
  assert.equal(gates.fallback.status, 'FAIL')
  assert.match(gates.fallback.reason, /declares a canvas-free fallback/)
})

test('interrupted checkpoint capture preserves the exact unavailable reason', () => {
  const { context } = greenContext()
  context.checkpoints.exitCode = 2
  context.checkpoints.unavailableReason = 'spawnSync node ETIMEDOUT'
  for (const metadata of [context.checkpoints.metadata, null]) {
    context.checkpoints.metadata = metadata
    const { gates } = evaluateGates(context)
    for (const id of ['interaction-checkpoints', 'keyboard']) {
      assert.equal(gates[id].status, 'UNAVAILABLE')
      assert.equal(gates[id].reason, 'spawnSync node ETIMEDOUT')
    }
  }
})

test('keyboard gate: a keyboard checkpoint that was not captured fails', () => {
  const { context } = greenContext()
  const keyboardPeak = context.checkpoints.metadata.entries.find(
    (entry) => entry.interaction === 'keyboard' && entry.phase === 'peak',
  )
  keyboardPeak.status = 'FAIL'
  keyboardPeak.reason = 'focus target not reachable by Tab'
  write(
    path.join(context.checkpoints.directory, 'checkpoints.json'),
    `${JSON.stringify(context.checkpoints.metadata)}\n`,
  )
  const { gates } = evaluateGates(context)
  assert.equal(gates.keyboard.status, 'FAIL')
  assert.match(gates.keyboard.reason, /focus target not reachable/)
})

test('keyboard gate: a keyboard peak with a different outcome state than the click peak fails', () => {
  const { context } = greenContext()
  const keyboardPeak = context.checkpoints.metadata.entries.find(
    (entry) => entry.interaction === 'keyboard' && entry.phase === 'peak',
  )
  keyboardPeak.waitFor = 'html[data-wdu-pointer="hover"]'
  write(
    path.join(context.checkpoints.directory, 'checkpoints.json'),
    `${JSON.stringify(context.checkpoints.metadata)}\n`,
  )
  const { gates } = evaluateGates(context)
  assert.equal(gates.keyboard.status, 'FAIL')
  assert.match(gates.keyboard.reason, /keyboard peak waits for/)
})

test('interaction gate: a failed hover checkpoint fails, and a touch entry without an input method fails', () => {
  const { context } = greenContext()
  const hoverDuring = context.checkpoints.metadata.entries.find(
    (entry) => entry.interaction === 'hover' && entry.phase === 'during',
  )
  hoverDuring.status = 'FAIL'
  hoverDuring.reason = 'declared state never reached'
  write(
    path.join(context.checkpoints.directory, 'checkpoints.json'),
    `${JSON.stringify(context.checkpoints.metadata)}\n`,
  )
  const { gates } = evaluateGates(context)
  assert.equal(gates['interaction-checkpoints'].status, 'FAIL')
  assert.match(gates['interaction-checkpoints'].reason, /declared state never reached/)
  assert.equal(gates.keyboard.status, 'PASS', 'the keyboard gate stays independent')

  const { context: secondContext } = greenContext()
  const touchPeak = secondContext.checkpoints.metadata.entries.find(
    (entry) => entry.interaction === 'touch' && entry.phase === 'peak',
  )
  delete touchPeak.touch
  write(
    path.join(secondContext.checkpoints.directory, 'checkpoints.json'),
    `${JSON.stringify(secondContext.checkpoints.metadata)}\n`,
  )
  const second = evaluateGates(secondContext)
  assert.equal(second.gates['interaction-checkpoints'].status, 'FAIL')
  assert.match(second.gates['interaction-checkpoints'].reason, /no touch input method/)
})

test('telemetry gates map the summary comparison status through', () => {
  const { context } = greenContext()
  context.standard.summary.comparison.gates['warm-gpu-frame-time'].status = 'FAIL'
  context.standard.summary.comparison.gates['transfer-before-first-meaningful-frame'].status =
    'UNAVAILABLE'
  write(
    path.join(context.standard.directory, 'performance-summary.json'),
    `${JSON.stringify(context.standard.summary, null, 2)}\n`,
  )
  const { gates, status } = evaluateGates(context)
  assert.equal(gates['telemetry-warm-gpu-frame-time'].status, 'FAIL')
  assert.equal(gates['telemetry-first-meaningful-frame'].status, 'PASS')
  assert.equal(gates['telemetry-transfer-before-first-meaningful-frame'].status, 'UNAVAILABLE')
  assert.equal(status, 'FAIL')
})

test('a fixture without a checkpoint manifest reports keyboard and interaction NOT_APPLICABLE', () => {
  const { context } = greenContext({
    declaration: staticDeclaration('runtime-console-error'),
    standard: {},
  })
  context.checkpoints = null
  context.build = null
  context.reduced = null
  context.portrait = null
  context.posterFetches = null
  const { gates, status } = evaluateGates(context)
  assert.equal(gates.build.status, 'NOT_APPLICABLE')
  assert.equal(gates.keyboard.status, 'NOT_APPLICABLE')
  assert.equal(gates['interaction-checkpoints'].status, 'NOT_APPLICABLE')
  assert.equal(status, 'PASS')
})

// ---------------------------------------------------------------------------
// Expectation matching
// ---------------------------------------------------------------------------

test('expectation matching: PASS fixture with a failing gate is not met', () => {
  const { context } = greenContext()
  fs.rmSync(path.join(context.standard.directory, 'mobile-hero.png'))
  const { gates, status } = evaluateGates(context)
  const expectation = matchExpectation(context.declaration, gates, status)
  assert.equal(expectation.met, false)
  assert.equal(expectation.unavailable, false)
})

test('expectation matching: a deliberate failing fixture must fail exactly its declared gate', () => {
  const { context } = greenContext({
    declaration: staticDeclaration('runtime-console-error'),
    standard: {},
  })
  context.build = null
  context.reduced = null
  context.portrait = null
  context.checkpoints = null
  context.posterFetches = null
  context.standard.consoleErrors =
    'Total messages: 1 (Errors: 1, Warnings: 0)\nReturning 1 messages for level "error"'
  write(
    path.join(context.standard.directory, 'console-errors.txt'),
    context.standard.consoleErrors,
  )
  const { gates, status } = evaluateGates(context)
  assert.equal(status, 'FAIL')
  const expectation = matchExpectation(context.declaration, gates, status)
  assert.equal(expectation.met, true, expectation.reason)
  assert.equal(gates.runtime.status, 'FAIL')
})

test('expectation matching: a deliberate failing fixture that passes is not met', () => {
  // Same declaration, but the console stays clean: the runtime gate passes,
  // so the fixture failed to demonstrate its gate.
  const { context } = greenContext({
    declaration: staticDeclaration('runtime-console-error'),
    standard: {},
  })
  context.build = null
  context.reduced = null
  context.portrait = null
  context.checkpoints = null
  context.posterFetches = null
  const { gates, status } = evaluateGates(context)
  assert.equal(status, 'PASS')
  const expectation = matchExpectation(context.declaration, gates, status)
  assert.equal(expectation.met, false)
  assert.match(expectation.reason, /expected gate runtime to FAIL/)
})

test('expectation matching: an expected-failing gate that comes out UNAVAILABLE is not met and is unavailable', () => {
  const { context } = greenContext({
    declaration: staticDeclaration('runtime-console-error'),
    standard: { status: 'UNAVAILABLE' },
  })
  context.build = null
  context.reduced = null
  context.portrait = null
  context.checkpoints = null
  context.posterFetches = null
  const { gates, status } = evaluateGates(context)
  const expectation = matchExpectation(context.declaration, gates, status)
  assert.equal(expectation.met, false)
  assert.equal(expectation.unavailable, true)
})

test('aggregation: UNAVAILABLE dominates PASS, FAIL dominates both', () => {
  assert.equal(aggregateGateStatus({ a: { status: 'PASS' }, b: { status: 'PASS' } }), 'PASS')
  assert.equal(
    aggregateGateStatus({ a: { status: 'PASS' }, b: { status: 'UNAVAILABLE' } }),
    'UNAVAILABLE',
  )
  assert.equal(
    aggregateGateStatus({ a: { status: 'UNAVAILABLE' }, b: { status: 'FAIL' } }),
    'FAIL',
  )
  assert.equal(
    aggregateGateStatus({ a: { status: 'PASS' }, b: { status: 'NOT_APPLICABLE' } }),
    'PASS',
  )
})

// --- CI shard matrix ---------------------------------------------------------
//
// The immersive evaluation runs one fixture per CI job. That list lives in the
// workflow, and a workflow cannot enumerate a directory, so the two can drift.
// A fixture missing from the matrix does not fail: it simply never runs, and a
// suite that never ran looks exactly like a suite that passed. This test is the
// only thing standing between that and a false green.

function workflowMatrixFixtures() {
  const workflow = fs.readFileSync(
    path.join(SCRIPT_DIRECTORY, '..', '..', '..', '.github', 'workflows', 'validate.yml'),
    'utf8',
  )
  const block = workflow.match(/\n {8}fixture:\n((?: {10}- \S+\n)+)/)
  assert.ok(block, 'validate.yml must declare a matrix.fixture list for the sharded evaluation')
  return block[1]
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => line.trim().replace(/^-\s*/, ''))
}

function runnerFixtureNames() {
  const failing = fs
    .readdirSync(FIXTURES_DIRECTORY, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== 'common' &&
        fs.existsSync(path.join(FIXTURES_DIRECTORY, entry.name, 'fixture.json')),
    )
    .map((entry) => entry.name)
    .sort()
  return [...peerGreenFixtureNames(), ...failing]
}

test('the CI shard matrix covers exactly the fixtures the runner knows', () => {
  const declared = workflowMatrixFixtures()
  const actual = runnerFixtureNames()

  const missing = actual.filter((name) => !declared.includes(name))
  assert.deepEqual(
    missing,
    [],
    `fixtures exist but no CI shard runs them: ${missing.join(', ')}`,
  )

  const stale = declared.filter((name) => !actual.includes(name))
  assert.deepEqual(
    stale,
    [],
    `CI shards name fixtures the runner does not have: ${stale.join(', ')}`,
  )

  assert.equal(
    new Set(declared).size,
    declared.length,
    'a fixture is listed twice in the shard matrix',
  )
})

test('every shard uploads its evidence under its own artifact name', () => {
  const workflow = fs.readFileSync(
    path.join(SCRIPT_DIRECTORY, '..', '..', '..', '.github', 'workflows', 'validate.yml'),
    'utf8',
  )
  // Artifact names must be unique per job, and the aggregate gate points
  // readers at immersive-evaluation-<fixture> when a shard is not green.
  assert.match(workflow, /name: immersive-evaluation-\$\{\{ matrix\.fixture \}\}/)
  assert.match(workflow, /--fixture "\$\{\{ matrix\.fixture \}\}"/)
  // fail-fast would let one red shard hide the verdict of the others.
  assert.match(workflow, /fail-fast: false/)
  // One required check stands for the whole sharded suite.
  assert.match(workflow, /immersive-evaluation-gate:/)
})
