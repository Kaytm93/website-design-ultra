#!/usr/bin/env node

/**
 * IP-07B — the immersive implementation evaluation runner.
 *
 * Asserts the ten evaluation gates against a buildable implementation
 * fixture: build, runtime, keyboard, mobile, reduced motion, fallback,
 * interaction checkpoints, and the three telemetry budget gates (warm GPU
 * frame time, first meaningful frame, transfer before that frame).
 *
 * The runner is deliberately separate from the forward routing suite
 * (`website-design-ultra/scripts/run-forward-tests.mjs`): that suite proves
 * routing; this one proves that a generated implementation installs,
 * builds, serves, renders, survives a pointer, and reports its declared
 * budget against real browser evidence.
 *
 * Evidence contract (TODO.md T1.4 / QUEUE.md IP-07B acceptance):
 * - Every gate result links the artifacts it was decided from (relative
 *   paths under the fixture's output directory). A gate never reports PASS
 *   without its evidence files existing.
 * - A missing capture can never be replaced by a build pass: the build gate
 *   and the capture gates are evaluated independently, and a fixture whose
 *   build fails produces NOT_APPLICABLE capture gates, never PASS.
 * - Failed resources, console errors, and shader errors fail the runtime
 *   case: the runtime gate requires a clean `console-errors.txt` and an
 *   empty `failureEvidence` block (resource-load, shader-compile, runtime,
 *   context loss) in the performance summary.
 * - Browser or GPU unavailability is UNAVAILABLE, never PASS (ADR-010), and
 *   leaves the fixture's status UNAVAILABLE.
 *
 * Deliberate failing fixtures live under `fixtures/` — one per gate — plus
 * the green product-hero fixture (`tests/immersive/product-hero/`), which
 * declares its surfaces in `fixture.json` and its checkpoints in
 * `lib/interaction-checkpoints.json`.
 *
 * Usage:
 *   node tests/immersive/evaluation/run-implementation-evaluation.mjs \
 *     --fixture product-hero --out /tmp/wdu-evaluation
 *   node tests/immersive/evaluation/run-implementation-evaluation.mjs \
 *     --fixture all --out /tmp/wdu-evaluation
 *
 * Exit codes: 0 = every fixture matched its declared expectation, 1 = an
 * expectation mismatch (a fixture failed unexpectedly, or a deliberate
 * failing fixture did not fail the gate it exists to prove), 2 = an
 * applicable gate was UNAVAILABLE.
 */

import { spawn } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
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
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '..', '..', '..')
const FIXTURES_DIRECTORY = path.join(SCRIPT_DIRECTORY, 'fixtures')
const COMMON_FIXTURE_DIRECTORY = path.join(FIXTURES_DIRECTORY, 'common')
const PRODUCT_HERO_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  'tests',
  'immersive',
  'product-hero',
)
const PROCEDURAL_CRYSTAL_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  'tests',
  'immersive',
  'procedural-crystal',
)
const IMMERSIVE_FIXTURE_ROOT_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  'tests',
  'immersive',
)
const VERIFIER = path.join(
  REPOSITORY_ROOT,
  'website-design-ultra',
  'scripts',
  'verify-browser.mjs',
)

// One capture of a single page state costs about a minute. The checkpoint
// capture instead walks every entry of the fixture's manifest, so its cost
// scales with the manifest and is by far the longest phase: measured at 498s
// for product-hero's twenty checkpoints and, per checkpoint, roughly three
// times that for procedural-crystal. Both fixtures were being SIGTERMed at the
// blanket 900s ceiling — product-hero after writing all twenty PNGs but before
// writing checkpoints.json, procedural-crystal after eleven of twenty — and
// the two interaction gates then reported UNAVAILABLE, which is never PASS.
// The checkpoint budget is therefore stated separately from the single-state
// one, with headroom over the slowest observed fixture.
const SINGLE_STATE_CAPTURE_TIMEOUT_MS = 900_000
const CHECKPOINT_CAPTURE_TIMEOUT_MS = 1_800_000

export const GATE_IDS = [
  'build',
  'runtime',
  'keyboard',
  'mobile',
  'reduced-motion',
  'fallback',
  'interaction-checkpoints',
  'telemetry-warm-gpu-frame-time',
  'telemetry-first-meaningful-frame',
  'telemetry-transfer-before-first-meaningful-frame',
]

const CAPTURE_GATE_IDS = GATE_IDS.filter((id) => id !== 'build')
const TELEMETRY_GATE_CLASSES = {
  'telemetry-warm-gpu-frame-time': 'warm-gpu-frame-time',
  'telemetry-first-meaningful-frame': 'first-meaningful-frame',
  'telemetry-transfer-before-first-meaningful-frame':
    'transfer-before-first-meaningful-frame',
}

class SuiteUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SuiteUnavailableError'
  }
}

function report(status, message) {
  const output = `IMPLEMENTATION_EVALUATION: ${status} ${message}`
  if (status === 'PASS') console.log(output)
  else console.error(output)
}

// ---------------------------------------------------------------------------
// Declaration parsing and validation
// ---------------------------------------------------------------------------

/**
 * Parse and validate a fixture declaration. Exported for the offline test
 * suite.
 */
export function parseFixtureDeclaration(file) {
  let declaration
  try {
    declaration = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(
      `invalid fixture declaration ${file}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  validateFixtureDeclaration(declaration)
  return declaration
}

export function validateFixtureDeclaration(declaration) {
  if (declaration.schemaVersion !== 1) {
    throw new Error('fixture declaration schemaVersion must be 1')
  }
  if (typeof declaration.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(declaration.id)) {
    throw new Error(`fixture declaration id must be a slug, got ${JSON.stringify(declaration.id)}`)
  }
  if (!['next-app', 'static'].includes(declaration.kind)) {
    throw new Error(`fixture declaration kind must be next-app or static, got ${declaration.kind}`)
  }
  if (
    !Number.isInteger(declaration.port) ||
    declaration.port < 1024 ||
    declaration.port > 65535
  ) {
    throw new Error(`fixture declaration port must be an integer 1024..65535, got ${declaration.port}`)
  }
  const applicable = declaration.kind === 'next-app' ? GATE_IDS : CAPTURE_GATE_IDS
  const expect = declaration.expect
  if (!expect || typeof expect !== 'object') {
    throw new Error('fixture declaration must declare expect')
  }
  if (expect.status === 'PASS') {
    if (expect.gates !== undefined) {
      throw new Error('a PASS expectation must not name failing gates')
    }
  } else if (expect.status === 'FAIL') {
    if (
      !Array.isArray(expect.gates) ||
      expect.gates.length === 0 ||
      expect.gates.some((gate) => !applicable.includes(gate))
    ) {
      throw new Error(
        `a FAIL expectation must name applicable gates, got ${JSON.stringify(expect.gates)}`,
      )
    }
  } else {
    throw new Error(`expect.status must be PASS or FAIL, got ${JSON.stringify(expect.status)}`)
  }
  const declared = declaration.declared ?? {}
  if (declared.buildEvidence !== undefined && typeof declared.buildEvidence !== 'string') {
    throw new Error('declared.buildEvidence must be a string path')
  }
  if (declared.readyMarker !== undefined && typeof declared.readyMarker !== 'string') {
    throw new Error('declared.readyMarker must be a string selector')
  }
  if (declared.stationId !== undefined && typeof declared.stationId !== 'string') {
    throw new Error('declared.stationId must be a string')
  }
  if (declared.heroCapture !== undefined && typeof declared.heroCapture !== 'boolean') {
    throw new Error('declared.heroCapture must be a boolean')
  }
  if (
    declared.checkpointsManifest !== undefined &&
    typeof declared.checkpointsManifest !== 'string'
  ) {
    throw new Error('declared.checkpointsManifest must be a string path')
  }
  if (
    declared.portraitStation !== undefined &&
    typeof declared.portraitStation !== 'string'
  ) {
    throw new Error('declared.portraitStation must be a string')
  }
  if (
    declared.reducedMotionStaticPair !== undefined &&
    typeof declared.reducedMotionStaticPair !== 'boolean'
  ) {
    throw new Error('declared.reducedMotionStaticPair must be a boolean')
  }
  if (declared.fallbackPosters !== undefined) {
    if (
      !Array.isArray(declared.fallbackPosters) ||
      declared.fallbackPosters.some((entry) => typeof entry !== 'string' || !entry.startsWith('/'))
    ) {
      throw new Error('declared.fallbackPosters must be an array of absolute URL paths')
    }
  }
  if (
    declared.fallbackHeroAbsent !== undefined &&
    typeof declared.fallbackHeroAbsent !== 'boolean'
  ) {
    throw new Error('declared.fallbackHeroAbsent must be a boolean')
  }
}

// ---------------------------------------------------------------------------
// Gate evaluation (pure; exported for the offline test suite)
// ---------------------------------------------------------------------------

export function gateResult(status, evidence, reason = null) {
  return { status, evidence: [...evidence], reason }
}

function gateResultFrom(declaration, status, evidence, reason = null) {
  return gateResult(status, evidence, reason)
}

function relativeEvidence(directory, names) {
  return names.map((name) => path.join(directory, name))
}

function parseConsoleErrorCount(consoleErrors) {
  if (consoleErrors === null || consoleErrors === undefined) return null
  const match = consoleErrors.match(/Errors:\s*(\d+)/)
  if (match) return Number.parseInt(match[1], 10)
  if (/\[ERROR\]/.test(consoleErrors)) return -1 // unparseable but error-shaped
  return null
}

function byteIdentical(first, second) {
  return fs.readFileSync(first).equals(fs.readFileSync(second))
}

/**
 * Evaluate every gate from assembled evidence. Pure: all file access happens
 * against the artifact directories the caller prepared. Exported for the
 * offline test suite.
 */
export function evaluateGates(context) {
  const declaration = context.declaration
  const declared = declaration.declared ?? {}
  const gates = {}

  // ---- build --------------------------------------------------------------
  if (declaration.kind === 'static') {
    gates.build = gateResult('NOT_APPLICABLE', [], 'static fixtures declare no build')
  } else if (context.build === null) {
    gates.build = gateResult('UNAVAILABLE', [], 'build was not attempted')
  } else {
    gates.build = gateResultFrom(
      declaration,
      context.build.status,
      [...context.build.evidence],
      context.build.reason,
    )
  }

  // When the build failed, no runtime evidence can exist: a missing capture
  // is never replaced by a build pass, and equally a failed build produces
  // no captures. Every capture gate is NOT_APPLICABLE in that case.
  const buildFailed = gates.build.status === 'FAIL'
  const noRuntimeEvidence = buildFailed

  // ---- runtime ------------------------------------------------------------
  const standard = context.standard
  if (noRuntimeEvidence) {
    gates.runtime = gateResult(
      'NOT_APPLICABLE',
      [],
      'fixture did not build; no runtime evidence exists',
    )
  } else if (standard === null) {
    gates.runtime = gateResult(
      'UNAVAILABLE',
      [],
      'standard capture did not run',
    )
  } else {
    const evidence = []
    const failures = []
    let unavailable = null
    const directory = standard.directory
    for (const name of [
      'capture.json',
      'performance-summary.json',
      'desktop-full.png',
      'desktop-snapshot.txt',
      'console-errors.txt',
    ]) {
      const file = path.join(directory, name)
      evidence.push(file)
      if (!fs.existsSync(file)) failures.push(`missing evidence ${name}`)
    }
    const summary = standard.summary
    if (!summary) {
      failures.push('performance-summary.json is unreadable')
    } else {
      if (summary.status === 'UNAVAILABLE') {
        unavailable = 'telemetry verification is UNAVAILABLE'
      }
      const firstFrame = summary.observed?.firstMeaningfulFrame?.observed?.value
      if (typeof firstFrame !== 'number' || !Number.isFinite(firstFrame)) {
        failures.push('first meaningful frame was never observed')
      }
      const failureEvidence = summary.failureEvidence ?? {}
      for (const kind of ['resourceFailures', 'shaderCompileErrors', 'runtimeErrors']) {
        const entries = failureEvidence[kind]
        if (Array.isArray(entries) && entries.length > 0) {
          failures.push(
            `${kind} reported ${entries.length}: ${entries
              .map((entry) => entry.message ?? entry.resource ?? 'unknown')
              .join('; ')}`,
          )
        }
      }
      const contextLoss = failureEvidence.contextLoss
      if (
        contextLoss &&
        ((contextLoss.count?.value ?? 0) > 0 || (contextLoss.events?.length ?? 0) > 0)
      ) {
        failures.push('context loss was recorded during the capture')
      }
    }
    const errorCount = parseConsoleErrorCount(standard.consoleErrors)
    evidence.push(path.join(directory, 'console-errors.txt'))
    if (errorCount === null) {
      failures.push('console-errors.txt reports no parseable error count')
    } else if (errorCount !== 0) {
      failures.push(
        `browser console reported ${errorCount} error(s):\n${(standard.consoleErrors ?? '').trim().slice(0, 1200)}`,
      )
    }
    if (declared.heroCapture) {
      const file = path.join(directory, 'desktop-hero.png')
      evidence.push(file)
      if (!fs.existsSync(file)) failures.push('missing evidence desktop-hero.png')
    }
    if (declared.stationId !== undefined) {
      const resolved = standard.serverHtml?.station
      evidence.push('served-html:data-wdu-station')
      if (resolved !== declared.stationId) {
        failures.push(
          `served HTML resolved data-wdu-station=${JSON.stringify(resolved)}, expected ${JSON.stringify(declared.stationId)}`,
        )
      }
    }
    if (declared.readyMarker !== undefined) {
      // The ready marker is client-side state; the fixture records readiness
      // on the shared telemetry surface, and the first-meaningful-frame
      // observation only exists when the marker fired (readiness gates on
      // the model load). The FMF check above is therefore the ready-marker
      // evidence; it must be observed for the runtime gate to pass.
      evidence.push('performance-summary:firstMeaningfulFrame.observed')
    }
    gates.runtime =
      unavailable !== null
        ? gateResult('UNAVAILABLE', evidence, unavailable)
        : gateResult(failures.length === 0 ? 'PASS' : 'FAIL', evidence, failures.join('; ') || null)
  }

  // ---- mobile -------------------------------------------------------------
  if (noRuntimeEvidence) {
    gates.mobile = gateResult(
      'NOT_APPLICABLE',
      [],
      'fixture did not build; no mobile capture exists',
    )
  } else if (standard === null) {
    gates.mobile = gateResult('UNAVAILABLE', [], 'standard capture did not run')
  } else {
    const evidence = []
    const failures = []
    let unavailable = null
    const directory = standard.directory
    for (const name of ['mobile-full.png', ...(declared.heroCapture ? ['mobile-hero.png'] : [])]) {
      const file = path.join(directory, name)
      evidence.push(file)
      if (!fs.existsSync(file)) failures.push(`missing evidence ${name}`)
    }
    if (declared.portraitStation !== undefined) {
      const portrait = context.portrait
      if (portrait === null || !portrait.directory) {
        if (portrait?.exitCode === 2) {
          unavailable = 'portrait capture was UNAVAILABLE'
        } else {
          failures.push('portrait capture did not run')
        }
      } else {
        evidence.push(path.join(portrait.directory, 'capture.json'))
        if (!fs.existsSync(path.join(portrait.directory, 'capture.json'))) {
          failures.push('missing evidence capture.json in the portrait run')
        }
        const resolved = portrait.serverHtmlStation
        evidence.push('served-html:data-wdu-station (portrait)')
        if (resolved !== declared.portraitStation) {
          failures.push(
            `portrait HTML resolved data-wdu-station=${JSON.stringify(resolved)}, expected ${JSON.stringify(declared.portraitStation)}`,
          )
        }
      }
    }
    gates.mobile =
      unavailable !== null
        ? gateResult('UNAVAILABLE', evidence, unavailable)
        : gateResult(
            failures.length === 0 ? 'PASS' : 'FAIL',
            evidence,
            failures.join('; ') || null,
          )
  }

  // ---- reduced motion -----------------------------------------------------
  if (noRuntimeEvidence) {
    gates['reduced-motion'] = gateResult(
      'NOT_APPLICABLE',
      [],
      'fixture did not build; no reduced-motion capture exists',
    )
  } else {
    const reducedDirectory =
      declaration.kind === 'next-app' ? context.reduced?.directory : standard?.directory
    if (reducedDirectory === undefined || reducedDirectory === null) {
      gates['reduced-motion'] = gateResult(
        'UNAVAILABLE',
        [],
        'reduced-motion capture did not run',
      )
    } else {
      const evidence = []
      const failures = []
      for (const name of ['reduced-motion-a.png', 'reduced-motion-b.png']) {
        const file = path.join(reducedDirectory, name)
        evidence.push(file)
        if (!fs.existsSync(file)) failures.push(`missing evidence ${name}`)
      }
      if (declared.reducedMotionStaticPair) {
        const a = path.join(reducedDirectory, 'reduced-motion-a.png')
        const b = path.join(reducedDirectory, 'reduced-motion-b.png')
        if (fs.existsSync(a) && fs.existsSync(b)) {
          evidence.push('reduced-motion-a.png == reduced-motion-b.png (bytes)')
          if (!byteIdentical(a, b)) {
            failures.push(
              'reduced-motion captures differ: the page kept animating under prefers-reduced-motion',
            )
          }
        }
      }
      if (declaration.kind === 'next-app') {
        const resolved = context.reduced?.serverHtmlMotion ?? null
        evidence.push('served-html:data-wdu-motion')
        if (resolved !== 'reduced') {
          failures.push(
            `reduced-motion HTML resolved data-wdu-motion=${JSON.stringify(resolved)}, expected "reduced"`,
          )
        }
      }
      gates['reduced-motion'] = gateResult(
        failures.length === 0 ? 'PASS' : 'FAIL',
        evidence,
        failures.join('; ') || null,
      )
    }
  }

  // ---- fallback -----------------------------------------------------------
  if (noRuntimeEvidence) {
    gates.fallback = gateResult(
      'NOT_APPLICABLE',
      [],
      'fixture did not build; no fallback capture exists',
    )
  } else if (standard === null) {
    gates.fallback = gateResult('UNAVAILABLE', [], 'standard capture did not run')
  } else {
    const evidence = []
    const failures = []
    const directory = standard.directory
    for (const name of ['fallback-full.png']) {
      const file = path.join(directory, name)
      evidence.push(file)
      if (!fs.existsSync(file)) failures.push(`missing evidence ${name}`)
    }
    if (declared.fallbackHeroAbsent) {
      const file = path.join(directory, 'fallback-hero.png')
      evidence.push('fallback-hero.png (declared absent)')
      if (fs.existsSync(file)) {
        failures.push('fallback-hero.png exists but the fixture declares a canvas-free fallback')
      }
    }
    for (const poster of declared.fallbackPosters ?? []) {
      const fetch = context.posterFetches?.find((entry) => entry.path === poster)
      evidence.push(`poster-fetch:${poster}`)
      if (!fetch) {
        failures.push(`poster asset ${poster} was not fetched`)
      } else if (fetch.status !== 200) {
        failures.push(`poster asset ${poster} served status ${fetch.status}`)
      }
    }
    gates.fallback = gateResult(
      failures.length === 0 ? 'PASS' : 'FAIL',
      evidence,
      failures.join('; ') || null,
    )
  }

  // ---- interaction checkpoints and keyboard -------------------------------
  const manifestDeclared = declared.checkpointsManifest !== undefined
  for (const [gateId, options] of [
    ['interaction-checkpoints', { excludeKeyboard: true }],
    ['keyboard', { excludeKeyboard: false }],
  ]) {
    if (!manifestDeclared) {
      gates[gateId] = gateResult('NOT_APPLICABLE', [], 'fixture declares no checkpoint manifest')
      continue
    }
    if (noRuntimeEvidence) {
      gates[gateId] = gateResult(
        'NOT_APPLICABLE',
        [],
        'fixture did not build; no interaction evidence exists',
      )
      continue
    }
    const checkpoints = context.checkpoints
    if (checkpoints === null || checkpoints.metadata === null) {
      // Whatever the capture did manage to write is the evidence for why this
      // gate is UNAVAILABLE, so it is named here instead of being dropped.
      const evidence = checkpoints?.logPath ? [checkpoints.logPath] : []
      gates[gateId] = gateResult(
        'UNAVAILABLE',
        evidence,
        checkpoints === null
          ? 'checkpoint capture did not run'
          : (checkpoints.unavailableReason ??
              (checkpoints.metadataError
                ? `checkpoint capture wrote no readable checkpoints.json after ` +
                  `${checkpoints.capturedCount ?? 0} captured checkpoint(s): ${checkpoints.metadataError}`
                : 'checkpoint capture wrote no checkpoints.json')),
      )
      continue
    }
    const entries = checkpoints.metadata.entries ?? []
    const evidence = [path.join(checkpoints.directory, 'checkpoints.json')]
    const failures = []
    if (gateId === 'keyboard') {
      const keyboardEntries = entries.filter((entry) => entry.interaction === 'keyboard')
      if (keyboardEntries.length === 0) {
        failures.push('the manifest declares no keyboard group to assert')
      }
      for (const entry of keyboardEntries) {
        evidence.push(`checkpoints/${entry.id}.png`)
        if (entry.status !== 'CAPTURED') {
          failures.push(`keyboard checkpoint ${entry.id} was ${entry.status}: ${entry.reason ?? ''}`)
        }
      }
      const clickPeak = entries.find(
        (entry) => entry.interaction === 'click' && entry.phase === 'peak',
      )
      const keyboardPeak = entries.find(
        (entry) => entry.interaction === 'keyboard' && entry.phase === 'peak',
      )
      const touchPeak = entries.find(
        (entry) => entry.interaction === 'touch' && entry.phase === 'peak',
      )
      if (!clickPeak || !keyboardPeak) {
        failures.push('keyboard gate requires both a click peak and a keyboard peak checkpoint')
      } else {
        evidence.push('keyboard-peak.waitFor === click-peak.waitFor')
        if (keyboardPeak.waitFor !== clickPeak.waitFor) {
          failures.push(
            `keyboard peak waits for ${JSON.stringify(keyboardPeak.waitFor)}, the pointer click peak waits for ${JSON.stringify(clickPeak.waitFor)}`,
          )
        }
        if (touchPeak && touchPeak.waitFor !== clickPeak.waitFor) {
          failures.push(
            `touch peak waits for ${JSON.stringify(touchPeak.waitFor)}, the pointer click peak waits for ${JSON.stringify(clickPeak.waitFor)}`,
          )
        }
      }
    } else {
      for (const entry of entries) {
        if (entry.interaction === 'keyboard') continue
        evidence.push(`checkpoints/${entry.id}.png`)
        if (entry.status !== 'CAPTURED') {
          failures.push(`checkpoint ${entry.id} was ${entry.status}: ${entry.reason ?? ''}`)
        }
        if (entry.interaction === 'touch' && entry.phase === 'peak' && !entry.touch) {
          failures.push(`touch checkpoint ${entry.id} recorded no touch input method`)
        }
      }
    }
    gates[gateId] = gateResult(
      failures.length === 0 ? 'PASS' : 'FAIL',
      evidence,
      failures.join('; ') || null,
    )
  }

  // ---- telemetry gates ----------------------------------------------------
  for (const [gateId, gateClass] of Object.entries(TELEMETRY_GATE_CLASSES)) {
    if (noRuntimeEvidence) {
      gates[gateId] = gateResult(
        'NOT_APPLICABLE',
        [],
        'fixture did not build; no telemetry summary exists',
      )
      continue
    }
    if (standard === null || standard.summary === null) {
      gates[gateId] = gateResult(
        'UNAVAILABLE',
        [],
        'performance-summary.json is unavailable',
      )
      continue
    }
    const gate = standard.summary.comparison?.gates?.[gateClass]
    const evidence = [
      path.join(standard.directory, 'performance-summary.json'),
      `performance-summary:comparison.gates.${gateClass}.status`,
    ]
    if (!gate || !['PASS', 'FAIL', 'UNAVAILABLE'].includes(gate.status)) {
      gates[gateId] = gateResult('UNAVAILABLE', evidence, `gate ${gateClass} is not reported`)
      continue
    }
    gates[gateId] = gateResult(
      gate.status,
      evidence,
      gate.status === 'FAIL'
        ? `observed value exceeds the declared ${gateClass} budget`
        : gate.status === 'UNAVAILABLE'
          ? gate.unavailableReason ?? 'gate measurement is unavailable'
          : null,
    )
  }

  return { gates, status: aggregateGateStatus(gates) }
}

export function aggregateGateStatus(gates) {
  const applicable = Object.values(gates).filter((gate) => gate.status !== 'NOT_APPLICABLE')
  if (applicable.length === 0) return 'NOT_APPLICABLE'
  if (applicable.some((gate) => gate.status === 'FAIL')) return 'FAIL'
  if (applicable.some((gate) => gate.status === 'UNAVAILABLE')) return 'UNAVAILABLE'
  return 'PASS'
}

/**
 * Match the fixture's declared expectation against the evaluated gates.
 * Exported for the offline test suite.
 */
export function matchExpectation(declaration, gates, status) {
  const expect = declaration.expect
  if (expect.status === 'PASS') {
    if (status === 'PASS') return { met: true, unavailable: false }
    if (status === 'UNAVAILABLE') {
      return { met: false, unavailable: true, reason: 'the fixture is UNAVAILABLE' }
    }
    return { met: false, unavailable: false, reason: `expected PASS, evaluated ${status}` }
  }
  const expectedGates = expect.gates
  const applicable = Object.entries(gates).filter(
    ([id, gate]) => gate.status !== 'NOT_APPLICABLE',
  )
  const problems = []
  let unavailable = false
  for (const [id, gate] of applicable) {
    if (expectedGates.includes(id)) {
      if (gate.status !== 'FAIL') {
        problems.push(
          `expected gate ${id} to FAIL, evaluated ${gate.status}${gate.reason ? ` (${gate.reason})` : ''}`,
        )
        if (gate.status === 'UNAVAILABLE') unavailable = true
      }
    } else if (gate.status !== 'PASS') {
      problems.push(`gate ${id} failed unexpectedly: ${gate.status}${gate.reason ? ` (${gate.reason})` : ''}`)
      if (gate.status === 'UNAVAILABLE') unavailable = true
    }
  }
  if (status !== 'FAIL') {
    problems.push(`expected overall FAIL, evaluated ${status}`)
    if (status === 'UNAVAILABLE') unavailable = true
  }
  if (problems.length === 0) return { met: true, unavailable: false }
  return { met: false, unavailable, reason: problems.join('; ') }
}

// ---------------------------------------------------------------------------
// Process and server plumbing
// ---------------------------------------------------------------------------

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

async function waitForPortClosed(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  const url = `http://127.0.0.1:${port}`
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(2_000) })
    } catch {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`port ${port} was not released before the next server start`)
}

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

function startNextServer(fixtureDirectory, port, extraEnv) {
  const nextCli = path.join(
    fixtureDirectory,
    'node_modules',
    'next',
    'dist',
    'bin',
    'next',
  )
  const child = spawn(
    process.execPath,
    [nextCli, 'start', '-p', String(port)],
    {
      cwd: fixtureDirectory,
      env: {
        ...process.env,
        WDU_DETERMINISTIC: '1',
        NODE_NO_WARNINGS: '1',
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const logs = []
  child.stdout.on('data', (chunk) => logs.push(String(chunk)))
  child.stderr.on('data', (chunk) => logs.push(String(chunk)))
  return { child, logs: () => logs.join('') }
}

function startStaticServer(fixtureDirectory, port) {
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.glb': 'model/gltf-binary',
  }
  const child = spawn(
    process.execPath,
    [
      '-e',
      `
        const http = require('node:http')
        const fs = require('node:fs')
        const path = require('node:path')
        const root = ${JSON.stringify(fixtureDirectory)}
        const common = ${JSON.stringify(COMMON_FIXTURE_DIRECTORY)}
        const types = ${JSON.stringify(contentTypes)}
        http.createServer((req, res) => {
          const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
          let file
          if (pathname === '/common/' || pathname.startsWith('/common/')) {
            file = path.join(common, pathname.replace(/^\\/common\\//, ''))
          } else {
            const name = pathname === '/' ? 'index.html' : pathname.replace(/^\\//, '')
            file = path.join(root, name)
          }
          if (
            !file.startsWith(root) && !file.startsWith(common) ||
            !fs.existsSync(file) || !fs.statSync(file).isFile()
          ) {
            res.writeHead(404)
            res.end('not found')
            return
          }
          res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' })
          res.end(fs.readFileSync(file))
        }).listen(${port})
      `,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const logs = []
  child.stdout.on('data', (chunk) => logs.push(String(chunk)))
  child.stderr.on('data', (chunk) => logs.push(String(chunk)))
  return { child, logs: () => logs.join('') }
}

async function fetchServedHtml(port) {
  const response = await fetch(`http://127.0.0.1:${port}/`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status !== 200) {
    throw new Error(`server returned ${response.status} for the fixture page`)
  }
  return response.text()
}

function resolveServedAttribute(html, attribute) {
  const pattern = new RegExp(`${attribute}="([^"]*)"`)
  const match = html.match(pattern)
  return match ? match[1] : null
}

function runVerifier(
  url,
  outputDirectory,
  checkpointsManifest = null,
  timeoutMs = SINGLE_STATE_CAPTURE_TIMEOUT_MS,
) {
  const args = [
    VERIFIER,
    '--url',
    url,
    '--out',
    outputDirectory,
  ]
  if (checkpointsManifest !== null) {
    args.push('--checkpoints', checkpointsManifest)
  }
  const result = run(process.execPath, args, { timeout: timeoutMs })
  // spawnSync reports a killed child as an error with no status, which reads
  // the same as a spawn failure. The two need different remedies, so the
  // distinction is carried out of here rather than collapsed into one message.
  const timedOut = Boolean(result.error) && result.signal !== null
  return {
    exitCode: result.error ? null : result.status,
    error: result.error ? result.error.message : null,
    timedOut,
    timeoutMs,
    output: combinedOutput(result),
  }
}

// ---------------------------------------------------------------------------
// Fixture execution
// ---------------------------------------------------------------------------

function fixtureDirectoryFor(name) {
  if (name === 'product-hero') return PRODUCT_HERO_DIRECTORY
  if (name === 'procedural-crystal') return PROCEDURAL_CRYSTAL_DIRECTORY
  const candidate = path.join(FIXTURES_DIRECTORY, name)
  if (!fs.existsSync(path.join(candidate, 'fixture.json'))) {
    throw new Error(`unknown fixture ${JSON.stringify(name)}: no fixture.json under ${candidate}`)
  }
  return candidate
}

// Peer fixtures outside tests/immersive/evaluation/fixtures/ (the IP-07A
// product-hero fixture and the IP-10C procedural-crystal fixture). Both are
// registered green fixtures: their fixture.json declares expect.status PASS.
export function peerGreenFixtureNames() {
  const names = []
  for (const entry of [
    { id: 'product-hero', directory: PRODUCT_HERO_DIRECTORY },
    { id: 'procedural-crystal', directory: PROCEDURAL_CRYSTAL_DIRECTORY },
  ]) {
    const declarationPath = path.join(entry.directory, 'fixture.json')
    if (
      fs.existsSync(declarationPath) &&
      fs.existsSync(path.join(entry.directory, 'package.json'))
    ) {
      names.push(entry.id)
    }
  }
  return names
}

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

async function runBuildGate(declaration, fixtureDirectory, outputDirectory, phases) {
  const startedAt = Date.now()
  const logDirectory = path.join(outputDirectory, 'gates')
  fs.mkdirSync(logDirectory, { recursive: true })
  const logPath = path.join(logDirectory, 'build.log')
  const evidence = [path.relative(outputDirectory, logPath)]
  if (!fs.existsSync(path.join(fixtureDirectory, 'node_modules'))) {
    const install = run('npm', ['ci'], { cwd: fixtureDirectory, timeout: 900_000 })
    fs.appendFileSync(
      logPath,
      `[install] exit=${install.status ?? 'spawn-error'} ${install.error?.message ?? ''}\n${combinedOutput(install)}\n`,
    )
    if (install.error || install.status !== 0) {
      return {
        status: 'UNAVAILABLE',
        evidence,
        reason: `fixture install unavailable: ${install.error?.message ?? combinedOutput(install) ?? install.status}`,
        logPath,
        phaseMs: Date.now() - startedAt,
      }
    }
  }
  phases.installMs = Date.now() - startedAt
  const buildStartedAt = Date.now()
  const build = run('npm', ['run', 'build'], { cwd: fixtureDirectory, timeout: 900_000 })
  fs.appendFileSync(
    logPath,
    `[build] exit=${build.status ?? 'spawn-error'} ${build.error?.message ?? ''}\n${combinedOutput(build)}\n`,
  )
  phases.buildMs = Date.now() - buildStartedAt
  if (build.error || build.status !== 0) {
    return {
      status: 'FAIL',
      evidence: [...evidence, ...(declaration.declared?.buildEvidence ? [declaration.declared.buildEvidence] : [])],
      reason: `fixture build failed: ${build.error?.message ?? combinedOutput(build).slice(0, 2000) ?? build.status}`,
      logPath,
    }
  }
  if (declaration.declared?.buildEvidence) {
    const evidenceFile = path.join(fixtureDirectory, declaration.declared.buildEvidence)
    if (!fs.existsSync(evidenceFile)) {
      return {
        status: 'FAIL',
        evidence: [...evidence, declaration.declared.buildEvidence],
        reason: `build exited 0 but declared evidence ${declaration.declared.buildEvidence} is missing`,
        logPath,
      }
    }
    evidence.push(declaration.declared.buildEvidence)
  }
  return { status: 'PASS', evidence, reason: null, logPath }
}

async function runStandardCapture(declaration, fixtureDirectory, port, outputDirectory, phases) {
  const captureDirectory = path.join(outputDirectory, 'capture-standard')
  fs.mkdirSync(captureDirectory, { recursive: true })
  const startedAt = Date.now()
  const result = runVerifier(`http://127.0.0.1:${port}`, captureDirectory)
  phases.standardCaptureMs = Date.now() - startedAt

  const summaryPath = path.join(captureDirectory, 'performance-summary.json')
  let summary = null
  try {
    summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
  } catch {
    summary = null
  }
  const consolePath = path.join(captureDirectory, 'console-errors.txt')
  let consoleErrors = null
  try {
    consoleErrors = fs.readFileSync(consolePath, 'utf8')
  } catch {
    consoleErrors = null
  }
  const captureJsonPath = path.join(captureDirectory, 'capture.json')
  let captureJson = null
  try {
    captureJson = JSON.parse(fs.readFileSync(captureJsonPath, 'utf8'))
  } catch {
    captureJson = null
  }

  if (result.exitCode === 2 || (result.exitCode === null && result.error)) {
    return {
      exitCode: 2,
      directory: captureDirectory,
      summary,
      consoleErrors,
      captureJson,
      unavailableReason: result.error ?? 'verifier run UNAVAILABLE',
    }
  }
  return {
    exitCode: result.exitCode,
    directory: captureDirectory,
    summary,
    consoleErrors,
    captureJson,
  }
}

async function runCheckpointCapture(declaration, fixtureDirectory, port, outputDirectory, phases) {
  const checkpointDirectory = path.join(outputDirectory, 'checkpoints')
  fs.mkdirSync(checkpointDirectory, { recursive: true })
  const manifestPath = path.join(
    fixtureDirectory,
    declaration.declared.checkpointsManifest,
  )
  const startedAt = Date.now()
  const result = runVerifier(
    `http://127.0.0.1:${port}`,
    checkpointDirectory,
    manifestPath,
    CHECKPOINT_CAPTURE_TIMEOUT_MS,
  )
  phases.checkpointCaptureMs = Date.now() - startedAt

  // The build gate keeps a log; this one did not, so a capture that died left
  // no record of why anywhere — not in the artifact and not in the CI output.
  const logPath = path.join(checkpointDirectory, 'capture.log')
  fs.writeFileSync(
    logPath,
    `[checkpoint-capture] exit=${result.exitCode ?? 'killed'} timedOut=${result.timedOut} ` +
      `budgetMs=${result.timeoutMs} elapsedMs=${phases.checkpointCaptureMs}\n` +
      `${result.error ? `error=${result.error}\n` : ''}${result.output}\n`,
  )

  const metadataPath = path.join(checkpointDirectory, 'checkpoints.json')
  let metadata = null
  let metadataError = null
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
  } catch (error) {
    metadata = null
    metadataError = error instanceof Error ? error.message : String(error)
  }

  // The verifier writes checkpoints.json only after the last entry, so a
  // killed capture leaves PNGs and no manifest. Counting them says how far it
  // got, which is the difference between "too slow" and "broken at entry N".
  let capturedCount = null
  try {
    capturedCount = fs
      .readdirSync(path.join(checkpointDirectory, 'checkpoints'))
      .filter((entry) => entry.endsWith('.png')).length
  } catch {
    capturedCount = 0
  }

  if (result.timedOut || result.exitCode === 2 || (result.exitCode === null && result.error)) {
    return {
      exitCode: 2,
      directory: checkpointDirectory,
      metadata,
      capturedCount,
      logPath,
      unavailableReason: result.timedOut
        ? `checkpoint capture exceeded its ${Math.round(result.timeoutMs / 1000)}s budget after ` +
          `${capturedCount} captured checkpoint(s); see checkpoints/capture.log`
        : (result.error ?? 'checkpoint capture UNAVAILABLE'),
    }
  }
  return {
    exitCode: result.exitCode,
    directory: checkpointDirectory,
    metadata,
    capturedCount,
    logPath,
    metadataError,
  }
}

async function fetchPosterAssets(port, posters) {
  const fetches = []
  for (const poster of posters) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${poster}`, {
        signal: AbortSignal.timeout(10_000),
      })
      fetches.push({ path: poster, status: response.status })
    } catch {
      fetches.push({ path: poster, status: 0 })
    }
  }
  return fetches
}

async function evaluateFixture(name, outputRoot, sourceCommit) {
  const fixtureDirectory = fixtureDirectoryFor(name)
  const declaration = parseFixtureDeclaration(
    path.join(fixtureDirectory, 'fixture.json'),
  )
  if (declaration.id !== name) {
    throw new Error(
      `fixture directory ${name} declares id ${JSON.stringify(declaration.id)}; they must match`,
    )
  }
  if (declaration.declared?.checkpointsManifest) {
    const manifestPath = path.join(fixtureDirectory, declaration.declared.checkpointsManifest)
    validateCheckpointManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')))
  }

  const outputDirectory = path.join(outputRoot, declaration.id)
  fs.mkdirSync(outputDirectory, { recursive: true })
  const startedAt = Date.now()
  const phases = {
    installMs: 0,
    buildMs: 0,
    standardCaptureMs: 0,
    reducedCaptureMs: 0,
    portraitCaptureMs: 0,
    checkpointCaptureMs: 0,
    evaluationMs: 0,
  }

  const context = {
    declaration,
    build: null,
    standard: null,
    reduced: null,
    portrait: null,
    checkpoints: null,
    posterFetches: null,
  }

  let server = null
  try {
    const port = declaration.port

    if (declaration.kind === 'next-app') {
      const build = await runBuildGate(declaration, fixtureDirectory, outputDirectory, phases)
      context.build = build
      if (build.status !== 'PASS') {
        phases.evaluationMs = Date.now() - startedAt
        return await finishFixture(
          declaration,
          context,
          outputDirectory,
          outputRoot,
          sourceCommit,
          phases,
          startedAt,
        )
      }

      server = startNextServer(fixtureDirectory, port, {})
      await waitForServer(`http://127.0.0.1:${port}`)
      const html = await fetchServedHtml(port)
      context.standard = {
        serverHtml: {
          mode: resolveServedAttribute(html, 'data-wdu-mode'),
          station: resolveServedAttribute(html, 'data-wdu-station'),
        },
      }
      const standardRun = await runStandardCapture(
        declaration,
        fixtureDirectory,
        port,
        outputDirectory,
        phases,
      )
      context.standard = { ...context.standard, ...standardRun }

      await stopServer(server, port)
      server = startNextServer(fixtureDirectory, port, { WDU_REDUCED_MOTION: '1' })
      await waitForServer(`http://127.0.0.1:${port}`)
      const reducedHtml = await fetchServedHtml(port)
      const reducedDirectory = path.join(outputDirectory, 'capture-reduced-motion')
      fs.mkdirSync(reducedDirectory, { recursive: true })
      const reducedStartedAt = Date.now()
      const reducedRun = runVerifier(`http://127.0.0.1:${port}`, reducedDirectory)
      phases.reducedCaptureMs = Date.now() - reducedStartedAt
      context.reduced = {
        exitCode: reducedRun.exitCode,
        directory: reducedDirectory,
        serverHtmlMotion: resolveServedAttribute(reducedHtml, 'data-wdu-motion'),
      }

      if (declaration.declared?.portraitStation) {
        await stopServer(server, port)
        server = startNextServer(fixtureDirectory, port, {
          WDU_STATION: declaration.declared.portraitStation,
        })
        await waitForServer(`http://127.0.0.1:${port}`)
        const portraitHtml = await fetchServedHtml(port)
        const portraitDirectory = path.join(outputDirectory, 'capture-portrait')
        fs.mkdirSync(portraitDirectory, { recursive: true })
        const portraitStartedAt = Date.now()
        const portraitRun = runVerifier(`http://127.0.0.1:${port}`, portraitDirectory)
        phases.portraitCaptureMs = Date.now() - portraitStartedAt
        context.portrait = {
          exitCode: portraitRun.exitCode,
          directory: portraitDirectory,
          serverHtmlStation: resolveServedAttribute(portraitHtml, 'data-wdu-station'),
        }
      }

      if (declaration.declared?.checkpointsManifest) {
        context.checkpoints = await runCheckpointCapture(
          declaration,
          fixtureDirectory,
          port,
          outputDirectory,
          phases,
        )
      }

      if (declaration.declared?.fallbackPosters) {
        context.posterFetches = await fetchPosterAssets(
          port,
          declaration.declared.fallbackPosters,
        )
      }
    } else {
      server = startStaticServer(fixtureDirectory, port)
      await waitForServer(`http://127.0.0.1:${port}`)
      const standardRun = await runStandardCapture(
        declaration,
        fixtureDirectory,
        port,
        outputDirectory,
        phases,
      )
      context.standard = standardRun
      if (declaration.declared?.checkpointsManifest) {
        context.checkpoints = await runCheckpointCapture(
          declaration,
          fixtureDirectory,
          port,
          outputDirectory,
          phases,
        )
      }
      if (declaration.declared?.fallbackPosters) {
        context.posterFetches = await fetchPosterAssets(
          port,
          declaration.declared.fallbackPosters,
        )
      }
    }

    phases.evaluationMs = Date.now() - startedAt
    return await finishFixture(
      declaration,
      context,
      outputDirectory,
      outputRoot,
      sourceCommit,
      phases,
      startedAt,
    )
  } finally {
    if (server) {
      server.child.kill('SIGTERM')
      setTimeout(() => server.child.kill('SIGKILL'), 3000).unref()
    }
  }
}

async function finishFixture(
  declaration,
  context,
  outputDirectory,
  outputRoot,
  sourceCommit,
  phases,
  startedAt,
) {
  const evaluationStartedAt = Date.now()
  const { gates, status } = evaluateGates(context)
  phases.evaluationMs = Date.now() - evaluationStartedAt

  const expectation = matchExpectation(declaration, gates, status)
  const browserBackend = context.standard?.captureJson?.backend ?? null

  const result = {
    schemaVersion: 1,
    acceptance: 'ip-07b-implementation-evaluation',
    fixture: declaration.id,
    kind: declaration.kind,
    status,
    expected: declaration.expect,
    expectationMet: expectation.met,
    expectationReason: expectation.reason ?? null,
    unavailable: expectation.unavailable ?? false,
    sourceCommit,
    gates,
    cost: {
      durationMs: Date.now() - startedAt,
      phasesMs: phases,
      externalServices: 'none',
      browserBackend,
      note: 'local browser CLI only; no paid or external service is used, and the browser CLI may fetch its npm package on first use',
    },
    artifacts: outputDirectory,
  }
  const resultPath = path.join(outputDirectory, 'evaluation.json')
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`)

  const gateSummary = Object.entries(gates)
    .map(([id, gate]) => `${id}=${gate.status}`)
    .join(' ')
  report(
    status,
    `fixture=${declaration.id} expected=${JSON.stringify(declaration.expect)} met=${expectation.met} durationMs=${result.cost.durationMs} ${gateSummary} artifacts=${outputDirectory}`,
  )
  return result
}

async function main() {
  const args = process.argv.slice(2)
  let fixture = null
  let outputRoot = null
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--fixture') {
      fixture = args[index + 1]
      index += 1
    } else if (args[index] === '--out') {
      outputRoot = path.resolve(args[index + 1])
      index += 1
    } else if (args[index] === '--help' || args[index] === '-h') {
      console.log(`Usage:
  node tests/immersive/evaluation/run-implementation-evaluation.mjs \\
    --fixture <name|all> --out /absolute/output/directory

Fixtures:
  all                every green peer fixture (product-hero +
                     procedural-crystal) plus every deliberate failing
                     fixture under tests/immersive/evaluation/fixtures/
  product-hero       the R3F product-hero implementation fixture (IP-07A)
  procedural-crystal  the procedural crystal implementation fixture (IP-10C)
  <name>             any fixture directory under tests/immersive/evaluation/fixtures/

Each fixture declares its own expectation in fixture.json (PASS, or FAIL with
the gates it deliberately fails). The runner writes evaluation.json per
fixture with per-gate status and linked evidence, states duration and cost,
and exits 0 only when every fixture matched its declaration.

Exit codes: 0 = expectations met, 1 = expectation mismatch, 2 = UNAVAILABLE.`)
      return
    }
  }
  if (!fixture || !outputRoot) {
    console.error('Usage: run-implementation-evaluation.mjs --fixture <name|all> --out <dir>')
    process.exitCode = 2
    return
  }

  const names =
    fixture === 'all'
      ? [
          ...peerGreenFixtureNames(),
          ...fs
            .readdirSync(FIXTURES_DIRECTORY, { withFileTypes: true })
            .filter(
              (entry) =>
                entry.isDirectory() &&
                entry.name !== 'common' &&
                fs.existsSync(path.join(FIXTURES_DIRECTORY, entry.name, 'fixture.json')),
            )
            .map((entry) => entry.name)
            .sort(),
        ]
      : [fixture]

  if (fs.existsSync(outputRoot) && fs.readdirSync(outputRoot).length > 0) {
    console.error(`output directory is not empty: ${outputRoot}`)
    process.exitCode = 1
    return
  }
  fs.mkdirSync(outputRoot, { recursive: true })

  const startedAt = Date.now()
  const sourceCommit = requireCleanSourceState(
    REPOSITORY_ROOT,
    'before the implementation evaluation suite',
  )
  const results = []
  for (const name of names) {
    results.push(await evaluateFixture(name, outputRoot, sourceCommit))
  }
  const commitAfter = requireCleanSourceState(
    REPOSITORY_ROOT,
    'after the implementation evaluation suite',
  )
  if (commitAfter !== sourceCommit) {
    console.error('source commit changed during the implementation evaluation suite')
    process.exitCode = 1
    return
  }

  const failures = results.filter((result) => !result.expectationMet)
  const unavailable = results.filter((result) => result.expectationMet === false && result.unavailable)
  const status = failures.length === 0 ? 'PASS' : unavailable.length > 0 ? 'UNAVAILABLE' : 'FAIL'

  const summary = {
    schemaVersion: 1,
    acceptance: 'ip-07b-implementation-evaluation',
    status,
    sourceCommit,
    fixtures: results.map((result) => ({
      fixture: result.fixture,
      status: result.status,
      expected: result.expected,
      expectationMet: result.expectationMet,
      gates: Object.fromEntries(
        Object.entries(result.gates).map(([id, gate]) => [id, gate.status]),
      ),
      durationMs: result.cost.durationMs,
      artifacts: result.artifacts,
    })),
    durationMs: Date.now() - startedAt,
    externalServices: 'none',
    artifacts: outputRoot,
  }
  fs.writeFileSync(
    path.join(outputRoot, 'evaluation.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  )
  const metCount = results.filter((result) => result.expectationMet).length
  report(
    status,
    `fixtures=${results.length} expectationsMet=${metCount}/${results.length} durationMs=${summary.durationMs} externalServices=none artifacts=${outputRoot}`,
  )
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(
        `  ${failure.fixture}: expected ${JSON.stringify(failure.expected)}, evaluated ${failure.status}: ${failure.expectationReason}`,
      )
    }
  }
  process.exitCode = status === 'PASS' ? 0 : status === 'UNAVAILABLE' ? 2 : 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
