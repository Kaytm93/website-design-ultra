#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const TELEMETRY_SURFACE_GLOBAL = '__WDU_IMMERSIVE_TELEMETRY__'
export const TELEMETRY_SURFACE_GLOBAL_ALIASES = [
  TELEMETRY_SURFACE_GLOBAL,
  '__WDU_TELEMETRY__',
]
export const PERFORMANCE_SUMMARY_SCHEMA_VERSION = 1

const TELEMETRY_GATE_CLASSES = [
  'warm-gpu-frame-time',
  'first-meaningful-frame',
  'transfer-before-first-meaningful-frame',
]
const TELEMETRY_SURFACE_ID = 'wdu.immersive-telemetry'

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cloneJson(value) {
  if (value === undefined) return null
  return JSON.parse(JSON.stringify(value))
}

function metric(value, unit) {
  return { value: value === null ? null : value, unit }
}

function metricFrom(value, unit) {
  if (value === null || value === undefined) return metric(null, unit)
  if (typeof value === 'number' && Number.isFinite(value)) return metric(value, unit)
  if (
    isRecord(value) &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    value.unit === unit
  ) {
    return metric(value.value, unit)
  }
  return metric(null, unit)
}

function numericSamples(values) {
  if (!Array.isArray(values)) throw new Error('frame samples must be an array')
  return values.map((sample, index) => {
    if (isRecord(sample) && sample.unit !== 'ms') {
      throw new Error(`frame sample ${index} must use the ms unit`)
    }
    const value = typeof sample === 'number' ? sample : sample?.value
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`frame sample ${index} must be a positive finite number`)
    }
    return value
  })
}

export function calculateMedian(values) {
  const sorted = numericSamples(values).sort((left, right) => left - right)
  if (sorted.length === 0) throw new Error('median requires at least one sample')
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

export function calculateP95(values) {
  const sorted = numericSamples(values).sort((left, right) => left - right)
  if (sorted.length === 0) throw new Error('p95 requires at least one sample')
  const nearestRank = Math.max(1, Math.ceil(sorted.length * 0.95))
  return sorted[nearestRank - 1]
}

export function collectFixedFrameWindow(samples, declaredWindow) {
  if (!Number.isSafeInteger(declaredWindow) || declaredWindow <= 0) {
    throw new Error('declared frame window must be a positive safe integer')
  }
  const values = numericSamples(samples)
  if (values.length !== declaredWindow) {
    throw new Error(
      `frame sample window requires exactly ${declaredWindow} frame samples; received ${values.length}`,
    )
  }
  return values
}

export function sumTransferBeforeMeaningfulFrame(entries, meaningfulFrameAtMs) {
  if (!Array.isArray(entries)) throw new Error('resource entries must be an array')
  if (
    typeof meaningfulFrameAtMs !== 'number' ||
    !Number.isFinite(meaningfulFrameAtMs) ||
    meaningfulFrameAtMs < 0
  ) {
    return null
  }
  return entries.reduce((total, entry) => {
    if (!isRecord(entry)) return total
    const responseEnd = entry.responseEnd
    if (
      typeof responseEnd !== 'number' ||
      !Number.isFinite(responseEnd) ||
      responseEnd <= 0 ||
      responseEnd > meaningfulFrameAtMs
    ) {
      return total
    }
    const transferSize =
      typeof entry.transferSize === 'number' &&
      Number.isFinite(entry.transferSize) &&
      entry.transferSize >= 0
        ? entry.transferSize
        : typeof entry.encodedBodySize === 'number' &&
            Number.isFinite(entry.encodedBodySize) &&
            entry.encodedBodySize >= 0
          ? entry.encodedBodySize
          : 0
    return total + Math.round(transferSize)
  }, 0)
}

function gateFor(document, gateClass) {
  return document?.budget?.gates?.find((gate) => gate.class === gateClass) ?? null
}

function unavailableReason(unavailable, key, reason) {
  if (unavailable[key] === null) unavailable[key] = reason
  return reason
}

function compareQuantity(observed, target, reason) {
  if (!observed || observed.value === null) {
    return {
      status: 'UNAVAILABLE',
      unavailableReason: reason,
    }
  }
  if (!target || typeof target.value !== 'number') {
    return {
      status: 'UNAVAILABLE',
      unavailableReason: 'declared comparison target is unavailable',
    }
  }
  return {
    status: observed.value <= target.value ? 'PASS' : 'FAIL',
    unavailableReason: null,
  }
}

function aggregateStatus(gates) {
  const statuses = Object.values(gates).map((gate) => gate.status)
  if (statuses.includes('FAIL')) return 'FAIL'
  if (statuses.includes('UNAVAILABLE')) return 'UNAVAILABLE'
  return 'PASS'
}

function validQuantity(
  value,
  unit,
  { integer = false, positive = false, minimum = null } = {},
) {
  return (
    isRecord(value) &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    value.unit === unit &&
    (!integer || Number.isSafeInteger(value.value)) &&
    (!positive || value.value > 0) &&
    (minimum === null || value.value >= minimum)
  )
}

function validTelemetryDocument(document) {
  if (
    !isRecord(document) ||
    document.schemaVersion !== 1 ||
    document.surface !== TELEMETRY_SURFACE_ID
  ) {
    return false
  }
  const profile = document.deviceProfile
  if (
    !isRecord(profile) ||
    typeof profile.id !== 'string' ||
    profile.id.length === 0 ||
    !['desktop', 'mobile'].includes(profile.class) ||
    typeof profile.browser !== 'string' ||
    profile.browser.length === 0 ||
    typeof profile.browserVersion !== 'string' ||
    profile.browserVersion.length === 0 ||
    !['webgl', 'webgl2', 'webgpu'].includes(profile.renderer) ||
    !['offline', 'online', 'throttled'].includes(profile.network) ||
    !isRecord(profile.viewport) ||
    !validQuantity(profile.viewport.width, 'css-px', { integer: true, positive: true }) ||
    !validQuantity(profile.viewport.height, 'css-px', { integer: true, positive: true }) ||
    !validQuantity(profile.deviceScaleFactor, 'ratio', { positive: true })
  ) {
    return false
  }
  const budget = document.budget
  if (!isRecord(budget) || !isRecord(budget.frameTarget)) return false
  if (
    !validQuantity(budget.frameTarget.rate, 'fps', { positive: true }) ||
    !validQuantity(budget.frameTarget.frameTime, 'ms', { positive: true }) ||
    typeof budget.frameTarget.justification !== 'string' ||
    budget.frameTarget.justification.length === 0 ||
    !Array.isArray(budget.gates) ||
    budget.gates.length !== TELEMETRY_GATE_CLASSES.length
  ) {
    return false
  }
  const classes = new Set(budget.gates.map((gate) => gate?.class))
  if (
    classes.size !== TELEMETRY_GATE_CLASSES.length ||
    TELEMETRY_GATE_CLASSES.some((gateClass) => !classes.has(gateClass))
  ) {
    return false
  }
  for (const gate of budget.gates) {
    if (
      !isRecord(gate) ||
      gate.comparison !== 'less-than-or-equal' ||
      typeof gate.justification !== 'string' ||
      gate.justification.length === 0
    ) {
      return false
    }
    if (gate.class === 'warm-gpu-frame-time') {
      if (
        !isRecord(gate.targets) ||
        !validQuantity(gate.targets.median, 'ms', { positive: true }) ||
        !validQuantity(gate.targets.p95, 'ms', { positive: true }) ||
        !validQuantity(gate.warmup, 'frames', {
          integer: true,
          minimum: 0,
        }) ||
        !validQuantity(gate.sampleWindow, 'frames', {
          integer: true,
          positive: true,
        })
      ) {
        return false
      }
    } else if (gate.class === 'first-meaningful-frame') {
      if (
        typeof gate.marker !== 'string' ||
        gate.marker.length === 0 ||
        !validQuantity(gate.target, 'ms', { positive: true })
      ) {
        return false
      }
    } else if (
      gate.class === 'transfer-before-first-meaningful-frame' &&
      (gate.boundary !== 'first-meaningful-frame' ||
        !validQuantity(gate.target, 'bytes', { integer: true, minimum: 0 }))
    ) {
      return false
    }
  }
  return true
}

export function buildPerformanceSummary({
  document = null,
  rendererInfo = null,
  evidenceSource = `window.${TELEMETRY_SURFACE_GLOBAL}`,
  transferObservation = null,
  collection = null,
  unavailableSurfaceReason = null,
} = {}) {
  const unavailable = {
    surface: null,
    budget: null,
    warmGpuFrameTime: null,
    firstMeaningfulFrame: null,
    transferBeforeFirstMeaningfulFrame: null,
    rendererInfo: null,
    renderer: null,
    quality: null,
    longFrameCount: null,
    errors: null,
    contextLoss: null,
  }
  const surfaceAvailable = validTelemetryDocument(document)
  const surfaceReason =
    unavailableSurfaceReason ??
    (surfaceAvailable
      ? null
      : isRecord(document) && document.schemaVersion === 1
        ? 'invalid telemetry document'
        : 'telemetry surface is not available')
  if (!surfaceAvailable) unavailable.surface = surfaceReason

  const deviceProfile = surfaceAvailable ? cloneJson(document.deviceProfile) : null
  const budget = surfaceAvailable ? cloneJson(document.budget) : null
  if (!budget) unavailableReason(unavailable, 'budget', 'declared budget is not available')

  const runtime = surfaceAvailable && isRecord(document.runtime) ? document.runtime : null
  if (!runtime) {
    const runtimeReason = surfaceReason ?? 'runtime telemetry is not available'
    unavailableReason(unavailable, 'warmGpuFrameTime', runtimeReason)
    unavailableReason(unavailable, 'firstMeaningfulFrame', runtimeReason)
    unavailableReason(unavailable, 'transferBeforeFirstMeaningfulFrame', runtimeReason)
    unavailableReason(unavailable, 'rendererInfo', runtimeReason)
    unavailableReason(unavailable, 'renderer', runtimeReason)
    unavailableReason(unavailable, 'quality', runtimeReason)
    unavailableReason(unavailable, 'longFrameCount', runtimeReason)
    unavailableReason(unavailable, 'errors', runtimeReason)
    unavailableReason(unavailable, 'contextLoss', runtimeReason)
  }

  const warmGate = gateFor(document, 'warm-gpu-frame-time')
  const firstGate = gateFor(document, 'first-meaningful-frame')
  const transferGate = gateFor(
    document,
    'transfer-before-first-meaningful-frame',
  )
  const declaredWindow = warmGate?.sampleWindow?.value
  const declaredWarmup = warmGate?.warmup ?? null
  const rawSamples = runtime?.frame?.warmGpu?.samples
  let samples = []
  let median = metric(null, 'ms')
  let p95 = metric(null, 'ms')
  let sampleReason =
    collection?.method === 'surface-collection-failed'
      ? 'telemetry collection did not complete'
      : surfaceReason
  if (!sampleReason && Number.isSafeInteger(declaredWindow) && declaredWindow > 0) {
    try {
      samples = collectFixedFrameWindow(rawSamples, declaredWindow)
      median = metric(calculateMedian(samples), 'ms')
      p95 = metric(calculateP95(samples), 'ms')
      sampleReason = null
    } catch (error) {
      sampleReason = error instanceof Error ? error.message : 'frame samples are unavailable'
    }
  } else if (!surfaceReason) {
    sampleReason = 'declared warm GPU sample window is unavailable'
  }
  if (sampleReason) unavailableReason(unavailable, 'warmGpuFrameTime', sampleReason)

  const firstObserved = metricFrom(
    runtime?.frame?.firstMeaningfulFrame?.observed,
    'ms',
  )
  const firstMarker =
    runtime?.frame?.firstMeaningfulFrame?.marker ?? firstGate?.marker ?? null
  const firstReason =
    firstObserved.value === null
      ? surfaceReason ?? 'first meaningful frame measurement is not available'
      : null
  if (firstReason) unavailableReason(unavailable, 'firstMeaningfulFrame', firstReason)

  const documentTransfer = metricFrom(runtime?.frame?.transfer?.observed, 'bytes')
  const transferObserved = transferObservation?.observed
    ? metricFrom(transferObservation.observed, 'bytes')
    : documentTransfer
  const transferReason =
    transferObservation?.unavailableReason ??
    (transferObserved.value === null
      ? surfaceReason ?? 'transfer before the meaningful frame is not available'
      : null)
  if (transferReason) {
    unavailableReason(
      unavailable,
      'transferBeforeFirstMeaningfulFrame',
      transferObservation?.unavailableReason ?? transferReason,
    )
  }

  const renderer = runtime?.renderer ? cloneJson(runtime.renderer) : null
  const quality = runtime?.quality ? cloneJson(runtime.quality) : null
  const longFrameCount = metricFrom(runtime?.frame?.longFrameCount, 'count')
  const errors = Array.isArray(runtime?.errors) ? cloneJson(runtime.errors) : null
  const contextLoss = runtime?.contextLoss ? cloneJson(runtime.contextLoss) : null
  if (!renderer) unavailableReason(unavailable, 'renderer', 'renderer telemetry is not available')
  if (!quality) unavailableReason(unavailable, 'quality', 'quality telemetry is not available')
  if (longFrameCount.value === null) {
    unavailableReason(unavailable, 'longFrameCount', 'long-frame count is not available')
  }
  if (errors === null) unavailableReason(unavailable, 'errors', 'runtime error telemetry is not available')
  if (!contextLoss) unavailableReason(unavailable, 'contextLoss', 'context-loss telemetry is not available')
  if (rendererInfo === null || rendererInfo === undefined) {
    unavailableReason(unavailable, 'rendererInfo', 'renderer.info is not available')
  }

  const observed = {
    warmGpuFrameTime: {
      warmup: cloneJson(declaredWarmup),
      sampleWindow: cloneJson(warmGate?.sampleWindow ?? null),
      collected: metric(samples.length, 'frames'),
      samples: samples.map((value) => metric(value, 'ms')),
      median,
      p95,
    },
    firstMeaningfulFrame: {
      marker: firstMarker,
      observed: firstObserved,
    },
    transferBeforeFirstMeaningfulFrame: {
      boundary: 'first-meaningful-frame',
      observed: transferObserved,
    },
  }

  const comparisonGates = {
    'warm-gpu-frame-time': {
      class: 'warm-gpu-frame-time',
      comparison: warmGate?.comparison ?? 'less-than-or-equal',
      budget: cloneJson(warmGate),
      observed: { median, p95 },
      ...(() => {
        if (median.value === null || p95.value === null) {
          return {
            status: 'UNAVAILABLE',
            unavailableReason: unavailable.warmGpuFrameTime,
          }
        }
        const medianResult = compareQuantity(
          median,
          warmGate?.targets?.median,
          unavailable.warmGpuFrameTime,
        )
        const p95Result = compareQuantity(
          p95,
          warmGate?.targets?.p95,
          unavailable.warmGpuFrameTime,
        )
        return {
          status:
            medianResult.status === 'FAIL' || p95Result.status === 'FAIL'
              ? 'FAIL'
              : medianResult.status === 'UNAVAILABLE' ||
                  p95Result.status === 'UNAVAILABLE'
                ? 'UNAVAILABLE'
                : 'PASS',
          unavailableReason:
            medianResult.unavailableReason ?? p95Result.unavailableReason,
        }
      })(),
    },
    'first-meaningful-frame': {
      class: 'first-meaningful-frame',
      comparison: firstGate?.comparison ?? 'less-than-or-equal',
      budget: cloneJson(firstGate),
      observed: firstObserved,
      ...compareQuantity(firstObserved, firstGate?.target, firstReason),
    },
    'transfer-before-first-meaningful-frame': {
      class: 'transfer-before-first-meaningful-frame',
      comparison: transferGate?.comparison ?? 'less-than-or-equal',
      budget: cloneJson(transferGate),
      observed: transferObserved,
      ...compareQuantity(
        transferObserved,
        transferGate?.target,
        transferReason,
      ),
    },
  }

  const status = aggregateStatus(comparisonGates)
  return {
    schemaVersion: PERFORMANCE_SUMMARY_SCHEMA_VERSION,
    status,
    evidenceSource,
    deviceProfile,
    budget,
    observed,
    comparison: {
      status,
      gates: comparisonGates,
    },
    evidence: {
      source: evidenceSource,
      collection: {
        method: collection?.method ?? null,
        warmupFrames: collection?.warmupFrames ?? null,
        sampleWindow: collection?.sampleWindow ?? null,
      },
      rendererInfo: rendererInfo === undefined ? null : cloneJson(rendererInfo),
      renderer,
      quality,
      longFrameCount,
      errors,
      contextLoss,
      transfer: {
        boundary: 'first-meaningful-frame',
        markerAt: transferObservation?.markerAt
          ? metricFrom(transferObservation.markerAt, 'ms')
          : firstObserved,
        resourcesConsidered: transferObservation?.resourcesConsidered ?? null,
        resourcesIgnoredAfterMarker:
          transferObservation?.resourcesIgnoredAfterMarker ?? null,
      },
    },
    unavailable,
  }
}

export function parseRawJson(stdout) {
  const text = String(stdout ?? '').trim()
  if (!text) throw new Error('browser returned no JSON telemetry')
  const parsed = JSON.parse(text)
  return typeof parsed === 'string' ? JSON.parse(parsed) : parsed
}

export function createTelemetryCollectionScript() {
  return `async (page) => await page.evaluate(async (globalNames) => {
    const clone = (value) => {
      if (value === undefined) return null
      try {
        return JSON.parse(JSON.stringify(value))
      } catch {
        return null
      }
    }
    const readDocument = async (surface) => {
      if (surface && typeof surface.read === 'function') {
        const result = await surface.read()
        return result && result.document ? result.document : result
      }
      if (surface && surface.document && typeof surface.document === 'object') {
        return surface.document
      }
      return surface
    }
    const surfaceName = globalNames.find((name) => globalThis[name] != null) ?? null
    if (!surfaceName) {
      return {
        document: null,
        rendererInfo: null,
        evidenceSource: null,
        collection: { method: 'no-surface', warmupFrames: null, sampleWindow: null },
        transferObservation: null,
      }
    }
    const surface = globalThis[surfaceName]
    const initialDocument = await readDocument(surface)
    const warmGate = initialDocument?.budget?.gates?.find(
      (gate) => gate.class === 'warm-gpu-frame-time',
    )
    const warmupFrames = warmGate?.warmup?.value ?? null
    const sampleWindow = warmGate?.sampleWindow?.value ?? null
    let method = 'surface-snapshot'
    let collectionFailed = false
    let collectedDocument = null
    let collectedRendererInfo = null
    try {
      if (surface && typeof surface.collect === 'function') {
        const collected = await surface.collect({
          warmupFrames,
          sampleWindow,
        })
        if (collected && typeof collected === 'object') {
          collectedDocument = collected.document ?? collected
          collectedRendererInfo = collected.rendererInfo ?? null
        }
        method = 'surface.collect'
      } else {
        if (surface && typeof surface.warmUp === 'function') {
          await surface.warmUp({ frames: warmupFrames })
          method = 'surface.warmUp-and-sample'
        }
        if (surface && typeof surface.sample === 'function') {
          await surface.sample({ frames: sampleWindow })
          method = 'surface.sample'
        }
      }
    } catch {
      collectionFailed = true
      method = 'surface-collection-failed'
    }
    const document = collectedDocument ?? await readDocument(surface)
    const meaningfulFrameAtMs = document?.runtime?.frame?.firstMeaningfulFrame?.observed?.value
    const resources = performance.getEntriesByType('resource').map((entry) => ({
      name: entry.name,
      responseEnd: entry.responseEnd,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
    }))
    let transferObservation = null
    if (typeof meaningfulFrameAtMs === 'number' && Number.isFinite(meaningfulFrameAtMs) && resources.length > 0) {
      let observed = 0
      let resourcesConsidered = 0
      let resourcesIgnoredAfterMarker = 0
      for (const entry of resources) {
        if (typeof entry.responseEnd !== 'number' || !Number.isFinite(entry.responseEnd) || entry.responseEnd <= 0) continue
        if (entry.responseEnd > meaningfulFrameAtMs) {
          resourcesIgnoredAfterMarker += 1
          continue
        }
        resourcesConsidered += 1
        const size = typeof entry.transferSize === 'number' && Number.isFinite(entry.transferSize) && entry.transferSize >= 0
          ? entry.transferSize
          : typeof entry.encodedBodySize === 'number' && Number.isFinite(entry.encodedBodySize) && entry.encodedBodySize >= 0
            ? entry.encodedBodySize
            : 0
        observed += Math.round(size)
      }
      transferObservation = {
        observed: { value: observed, unit: 'bytes' },
        markerAt: { value: meaningfulFrameAtMs, unit: 'ms' },
        resourcesConsidered,
        resourcesIgnoredAfterMarker,
        unavailableReason: collectionFailed ? 'surface collection did not complete' : null,
      }
    }
    const rendererInfo = collectedRendererInfo ?? surface?.rendererInfo ?? surface?.renderer?.info ?? globalThis.__WDU_RENDERER__?.info ?? null
    return {
      document: clone(document),
      rendererInfo: clone(rendererInfo),
      evidenceSource: 'window.' + surfaceName,
      collection: {
        method,
        warmupFrames,
        sampleWindow,
      },
      transferObservation,
    }
  }, ${JSON.stringify(TELEMETRY_SURFACE_GLOBAL_ALIASES)})`
}

function fail(message, exitCode = 1) {
  console.error(`VERIFY_RUNTIME: ${exitCode === 2 ? 'UNAVAILABLE' : 'FAIL'} ${message}`)
  process.exit(exitCode)
}

function parseArguments(argv) {
  const options = {
    url: null,
    out: null,
    probe: false,
    includeFallback: true,
    timeoutMs: 120000,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--url') {
      options.url = argv[index + 1]
      index += 1
    } else if (argument === '--out') {
      options.out = path.resolve(argv[index + 1])
      index += 1
    } else if (argument === '--probe') {
      options.probe = true
    } else if (argument === '--skip-fallback') {
      options.includeFallback = false
    } else if (argument === '--timeout-ms') {
      options.timeoutMs = Number.parseInt(argv[index + 1], 10)
      index += 1
    } else if (argument === '--help') {
      console.log(`Usage:
  node scripts/verify-browser.mjs --probe
  node scripts/verify-browser.mjs --url http://127.0.0.1:3000
                                  [--out /absolute/output/directory]
                                  [--skip-fallback]
                                  [--timeout-ms 120000]

Exit codes: 0 = capture complete, 1 = capture failed, 2 = compatible
browser automation unavailable. Set WDU_PLAYWRIGHT_CLI to an explicit executable
to override discovery.`)
      process.exit(0)
    } else {
      fail(`unknown argument "${argument}"`)
    }
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 10000) {
    fail('--timeout-ms must be an integer of at least 10000')
  }
  if (!options.probe && !options.url) fail('--url is required unless --probe is used')
  if (options.url && !/^https?:\/\//.test(options.url)) {
    fail('--url must start with http:// or https://')
  }
  return options
}

function commandOnPath(command) {
  const lookup = spawnSync('sh', ['-lc', `command -v "${command}"`], {
    encoding: 'utf8',
  })
  return lookup.status === 0 ? lookup.stdout.trim() : null
}

function candidates() {
  const result = []
  const explicit = process.env.WDU_PLAYWRIGHT_CLI
  if (explicit) result.push({ name: 'explicit', command: explicit, prefix: [] })

  const codexHome = process.env.CODEX_HOME
  if (codexHome) {
    result.push({
      name: 'codex-wrapper',
      command: path.join(codexHome, 'skills', 'playwright', 'scripts', 'playwright_cli.sh'),
      prefix: [],
    })
  }

  const pathCli = commandOnPath('playwright-cli')
  if (pathCli) result.push({ name: 'path-cli', command: pathCli, prefix: [] })

  const npx = commandOnPath('npx')
  if (npx) {
    result.push({
      name: 'npm-cli',
      command: npx,
      prefix: ['--yes', '--package', '@playwright/cli@0.1.17', 'playwright-cli'],
    })
  }
  return result
}

function run(candidate, args, timeoutMs) {
  return spawnSync(candidate.command, [...candidate.prefix, ...args], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: timeoutMs,
  })
}

function resolveBackend(timeoutMs) {
  const attempts = []
  for (const candidate of candidates()) {
    if (
      candidate.name !== 'npm-cli' &&
      (!fs.existsSync(candidate.command) || !(fs.statSync(candidate.command).mode & 0o111))
    ) {
      attempts.push(`${candidate.name}: executable missing`)
      continue
    }
    const probe = run(candidate, ['--help'], timeoutMs)
    const help = `${probe.stdout ?? ''}\n${probe.stderr ?? ''}`
    if (
      !probe.error &&
      probe.status === 0 &&
      help.includes('run-code') &&
      help.includes('-s=<session>') &&
      help.includes('screenshot')
    ) {
      return { candidate, attempts }
    }
    attempts.push(
      `${candidate.name}: incompatible or failed (${probe.error?.message ?? probe.status ?? 'unknown'})`,
    )
  }
  return { candidate: null, attempts }
}

function timestamp() {
  return new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z')
}

function quoted(value) {
  return JSON.stringify(value)
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  const resolved = resolveBackend(options.timeoutMs)
  if (!resolved.candidate) {
    fail(`no compatible CLI; ${resolved.attempts.join('; ')}`, 2)
  }

  const backend = resolved.candidate
  if (options.probe) {
    console.log(`VERIFY_RUNTIME: READY backend=${backend.name}`)
    return
  }

  const outputDirectory =
    options.out ??
    path.resolve(process.cwd(), 'output', 'playwright', 'verify', timestamp())
  fs.mkdirSync(outputDirectory, { recursive: true })
  const sessions = new Set()
  const commands = []

  function invoke(session, action, ...args) {
    sessions.add(session)
    const result = run(backend, [`-s=${session}`, action, ...args], options.timeoutMs)
    commands.push({
      session,
      action,
      status: result.status,
      stdout: result.stdout?.trim(),
      stderr: result.stderr?.trim(),
    })
    if (result.error || result.status !== 0) {
      throw new Error(
        `${session}/${action}: ${result.error?.message ?? result.stderr ?? result.stdout ?? result.status}`,
      )
    }
    return result
  }

  function invokeRaw(session, action, ...args) {
    return invoke(session, action, ...args, '--raw')
  }

  const settle = `async (page) => {
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready
      await Promise.all([...document.images].filter((image) => !image.complete).map(
        (image) => new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true })
          image.addEventListener('error', resolve, { once: true })
        }),
      ))
    })
    await page.waitForTimeout(150)
  }`

  function captureHero(session, filename) {
    const target = path.join(outputDirectory, filename)
    invoke(
      session,
      'run-code',
      `async (page) => {
        const target = page.locator('[data-verify-3d], [data-verify-hero], canvas').first()
        if (await target.count()) await target.screenshot({ path: ${quoted(target)} })
      }`,
    )
  }

  try {
    invoke('wdu-desktop', 'open', options.url)
    invoke('wdu-desktop', 'resize', '1440', '1000')
    invoke('wdu-desktop', 'run-code', settle)

    let performanceSummary
    try {
      const telemetryResult = invokeRaw(
        'wdu-desktop',
        'run-code',
        createTelemetryCollectionScript(),
      )
      const telemetryObservation = parseRawJson(telemetryResult.stdout)
      performanceSummary = buildPerformanceSummary({
        document: telemetryObservation?.document ?? null,
        rendererInfo: telemetryObservation?.rendererInfo ?? null,
        evidenceSource:
          telemetryObservation?.evidenceSource ??
          `window.${TELEMETRY_SURFACE_GLOBAL}`,
        transferObservation: telemetryObservation?.transferObservation ?? null,
        collection: telemetryObservation?.collection ?? null,
      })
    } catch {
      performanceSummary = buildPerformanceSummary({
        unavailableSurfaceReason: 'telemetry collection command failed',
      })
    }
    fs.writeFileSync(
      path.join(outputDirectory, 'performance-summary.json'),
      `${JSON.stringify(performanceSummary, null, 2)}\n`,
    )

    const snapshot = invoke('wdu-desktop', 'snapshot')
    fs.writeFileSync(path.join(outputDirectory, 'desktop-snapshot.txt'), snapshot.stdout)
    invoke(
      'wdu-desktop',
      'screenshot',
      '--filename',
      path.join(outputDirectory, 'desktop-full.png'),
      '--full-page',
    )
    captureHero('wdu-desktop', 'desktop-hero.png')

    invoke('wdu-mobile', 'open', options.url)
    invoke('wdu-mobile', 'resize', '390', '844')
    invoke('wdu-mobile', 'run-code', settle)
    invoke(
      'wdu-mobile',
      'screenshot',
      '--filename',
      path.join(outputDirectory, 'mobile-full.png'),
      '--full-page',
    )
    captureHero('wdu-mobile', 'mobile-hero.png')

    invoke('wdu-reduce', 'open', options.url)
    invoke(
      'wdu-reduce',
      'run-code',
      `async (page) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.reload({ waitUntil: 'domcontentloaded' })
        ${settle.replace(/^async \(page\) => \{|\}$/g, '')}
      }`,
    )
    invoke(
      'wdu-reduce',
      'screenshot',
      '--filename',
      path.join(outputDirectory, 'reduced-motion-a.png'),
      '--full-page',
    )
    invoke('wdu-reduce', 'run-code', 'async (page) => { await page.waitForTimeout(750) }')
    invoke(
      'wdu-reduce',
      'screenshot',
      '--filename',
      path.join(outputDirectory, 'reduced-motion-b.png'),
      '--full-page',
    )

    if (options.includeFallback) {
      invoke('wdu-fallback', 'open', options.url)
      invoke(
        'wdu-fallback',
        'run-code',
        `async (page) => {
          await page.addInitScript(() => {
            try {
              Object.defineProperty(navigator, 'gpu', {
                configurable: true,
                get: () => undefined,
              })
            } catch {}
            const original = HTMLCanvasElement.prototype.getContext
            HTMLCanvasElement.prototype.getContext = function(type, ...args) {
              return ['webgpu', 'webgl', 'webgl2', 'experimental-webgl'].includes(type)
                ? null
                : original.call(this, type, ...args)
            }
          })
          await page.reload({ waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(150)
        }`,
      )
      invoke(
        'wdu-fallback',
        'screenshot',
        '--filename',
        path.join(outputDirectory, 'fallback-full.png'),
        '--full-page',
      )
      captureHero('wdu-fallback', 'fallback-hero.png')
    }

    const consoleErrors = invoke('wdu-desktop', 'console', 'error')
    fs.writeFileSync(path.join(outputDirectory, 'console-errors.txt'), consoleErrors.stdout)
    const requests = invoke('wdu-desktop', 'requests')
    fs.writeFileSync(path.join(outputDirectory, 'requests.txt'), requests.stdout)
    fs.writeFileSync(
      path.join(outputDirectory, 'capture.json'),
      `${JSON.stringify(
        {
          status: 'captured-not-yet-inspected',
          generatedAt: new Date().toISOString(),
          url: options.url,
          backend: backend.name,
          fallbackIncluded: options.includeFallback,
          outputDirectory,
          commands,
        },
        null,
        2,
      )}\n`,
    )
  } catch (error) {
    fs.writeFileSync(
      path.join(outputDirectory, 'capture-error.json'),
      `${JSON.stringify({ status: 'failed', error: error.message, commands }, null, 2)}\n`,
    )
    fail(`${error.message}; partial artifacts: ${outputDirectory}`)
  } finally {
    for (const session of sessions) {
      run(backend, [`-s=${session}`, 'close'], Math.min(options.timeoutMs, 30000))
    }
  }

  console.log(
    `VERIFY_RUNTIME: CAPTURED backend=${backend.name} artifacts=${outputDirectory}`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
