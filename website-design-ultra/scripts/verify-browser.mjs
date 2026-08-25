#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const TELEMETRY_SURFACE_GLOBAL = '__WDU_IMMERSIVE_TELEMETRY__'
export const TELEMETRY_SURFACE_GLOBAL_ALIASES = [
  TELEMETRY_SURFACE_GLOBAL,
  '__WDU_TELEMETRY__',
]
export const PERFORMANCE_SUMMARY_SCHEMA_VERSION = 1

export const CHECKPOINT_SCHEMA_VERSION = 1
export const CHECKPOINT_SURFACE_ID = 'wdu.interaction-checkpoints'
export const CHECKPOINT_KINDS = [
  'hover',
  'click',
  'scroll',
  'loading',
  'ready',
  'failure',
  'focus',
  'keyboard',
  'touch',
  'audio',
]
export const HOVER_PHASES = ['before', 'during', 'after']
export const CLICK_PHASES = ['before', 'peak', 'recovered']
export const FOCUS_PHASES = ['before', 'during', 'after']
export const KEYBOARD_PHASES = ['before', 'peak', 'recovered']
export const TOUCH_PHASES = ['before', 'peak', 'recovered']
export const AUDIO_STATES = ['locked', 'enabled', 'muted', 'returning']
export const CHECKPOINT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/
export const CHECKPOINT_MODE_INPUT = 'WDU_DETERMINISTIC=1'
export const CHECKPOINT_VIEWPORT = { width: 1440, height: 1000 }

const TELEMETRY_GATE_CLASSES = [
  'warm-gpu-frame-time',
  'first-meaningful-frame',
  'transfer-before-first-meaningful-frame',
]
const TELEMETRY_SURFACE_ID = 'wdu.immersive-telemetry'

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function cloneJson(value) {
  if (value === undefined) return null
  return JSON.parse(JSON.stringify(value))
}

function normalizeCapability(input, fallbackReason) {
  const available = isRecord(input) && input.status === 'AVAILABLE'
  const result = {
    status: available ? 'AVAILABLE' : 'UNAVAILABLE',
    reason: available
      ? null
      : isRecord(input) && typeof input.reason === 'string' && input.reason.length > 0
        ? input.reason
        : fallbackReason,
  }
  if (isRecord(input)) {
    for (const [key, value] of Object.entries(input)) {
      if (key === 'status' || key === 'reason') continue
      result[key] = cloneJson(value)
    }
  }
  return result
}

function normalizeCapabilities(input, surfaceAvailable, surfaceReason) {
  const capabilities = isRecord(input) ? input : {}
  const browser = normalizeCapability(
    capabilities.browser,
    'browser CLI capability result is not available',
  )
  const gpu = normalizeCapability(
    capabilities.gpu,
    'GPU capability result is not available',
  )
  let telemetry = normalizeCapability(
    capabilities.telemetry,
    surfaceAvailable
      ? 'telemetry capability result is not available'
      : surfaceReason ?? 'telemetry surface is not available',
  )
  if (!surfaceAvailable) {
    telemetry = {
      ...telemetry,
      status: 'UNAVAILABLE',
      reason: surfaceReason ?? telemetry.reason,
    }
  }
  return { browser, gpu, telemetry }
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

function aggregateVerificationStatus(
  comparisonStatus,
  capabilities,
  hasRuntimeFailure,
  hasUnavailableEvidence,
) {
  if (
    Object.values(capabilities).some(
      (capability) => capability.status === 'UNAVAILABLE',
    ) ||
    hasUnavailableEvidence
  ) {
    return 'UNAVAILABLE'
  }
  if (hasRuntimeFailure) return 'FAIL'
  return comparisonStatus
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

function validNullableQuantity(value, unit, options = {}) {
  return value === null || validQuantity(value, unit, options)
}

function validRuntimeTelemetry(runtime) {
  if (!isRecord(runtime)) return false
  const frame = runtime.frame
  const warmGpu = frame?.warmGpu
  const firstMeaningfulFrame = frame?.firstMeaningfulFrame
  const transfer = frame?.transfer
  if (
    !isRecord(frame) ||
    !isRecord(warmGpu) ||
    !Array.isArray(warmGpu.samples) ||
    !warmGpu.samples.every((sample) => validQuantity(sample, 'ms', { positive: true })) ||
    !validNullableQuantity(warmGpu.median, 'ms', { positive: true }) ||
    !validNullableQuantity(warmGpu.p95, 'ms', { positive: true }) ||
    !isRecord(firstMeaningfulFrame) ||
    typeof firstMeaningfulFrame.marker !== 'string' ||
    firstMeaningfulFrame.marker.length === 0 ||
    !validNullableQuantity(firstMeaningfulFrame.observed, 'ms', { positive: true }) ||
    !isRecord(transfer) ||
    transfer.boundary !== 'first-meaningful-frame' ||
    !validNullableQuantity(transfer.observed, 'bytes', {
      integer: true,
      minimum: 0,
    }) ||
    !validQuantity(frame.longFrameCount, 'count', {
      integer: true,
      minimum: 0,
    })
  ) {
    return false
  }

  const renderer = runtime.renderer
  const counters = renderer?.counters
  const counterNames = ['drawCalls', 'visibleTriangles', 'textures', 'geometries', 'programs']
  if (
    !isRecord(renderer) ||
    typeof renderer.api !== 'string' ||
    renderer.api.length === 0 ||
    !isRecord(counters) ||
    !counterNames.every((name) =>
      validQuantity(counters[name], 'count', { integer: true, minimum: 0 }),
    )
  ) {
    return false
  }

  const quality = runtime.quality
  if (
    !isRecord(quality) ||
    !['poster', 'low', 'medium', 'high'].includes(quality.tier) ||
    !validQuantity(quality.dpr, 'ratio', { positive: true })
  ) {
    return false
  }

  if (
    !Array.isArray(runtime.errors) ||
    !runtime.errors.every((error) =>
      isRecord(error) &&
      ['resource-load', 'shader-compile', 'runtime'].includes(error.kind) &&
      typeof error.message === 'string' &&
      error.message.length > 0 &&
      (error.resource === undefined ||
        (typeof error.resource === 'string' && error.resource.length > 0)),
    )
  ) {
    return false
  }

  const contextLoss = runtime.contextLoss
  return (
    isRecord(contextLoss) &&
    validQuantity(contextLoss.count, 'count', { integer: true, minimum: 0 }) &&
    Array.isArray(contextLoss.events) &&
    contextLoss.events.every(
      (event) =>
        isRecord(event) &&
        typeof event.reason === 'string' &&
        event.reason.length > 0 &&
        typeof event.recovered === 'boolean',
    )
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
  return validRuntimeTelemetry(document.runtime)
}

export function buildPerformanceSummary({
  document = null,
  rendererInfo = null,
  evidenceSource = `window.${TELEMETRY_SURFACE_GLOBAL}`,
  transferObservation = null,
  collection = null,
  capabilities = null,
  unavailableSurfaceReason = null,
} = {}) {
  const unavailable = {
    browser: null,
    gpu: null,
    telemetry: null,
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

  const normalizedCapabilities = normalizeCapabilities(
    capabilities,
    surfaceAvailable,
    surfaceReason,
  )
  for (const capabilityName of ['browser', 'gpu', 'telemetry']) {
    const capability = normalizedCapabilities[capabilityName]
    if (capability.status === 'UNAVAILABLE') {
      unavailable[capabilityName] = capability.reason
    }
  }
  if (unavailable.surface === null && normalizedCapabilities.telemetry.status === 'UNAVAILABLE') {
    unavailable.surface = normalizedCapabilities.telemetry.reason
  }

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

  const resourceFailures = errors === null
    ? null
    : errors.filter((error) => error.kind === 'resource-load')
  const shaderCompileErrors = errors === null
    ? null
    : errors.filter((error) => error.kind === 'shader-compile')
  const runtimeErrors = errors === null
    ? null
    : errors.filter((error) => error.kind === 'runtime')
  const failureEvidence = {
    resourceFailures,
    shaderCompileErrors,
    runtimeErrors,
    longFrames: {
      count: longFrameCount,
      detected: longFrameCount.value === null ? null : longFrameCount.value > 0,
    },
    contextLoss,
  }
  const hasRuntimeFailure = Boolean(
    (resourceFailures?.length ?? 0) > 0 ||
      (shaderCompileErrors?.length ?? 0) > 0 ||
      (runtimeErrors?.length ?? 0) > 0 ||
      (contextLoss?.count?.value ?? 0) > 0 ||
      (contextLoss?.events?.length ?? 0) > 0,
  )
  const hasUnavailableEvidence = [
    'warmGpuFrameTime',
    'firstMeaningfulFrame',
    'transferBeforeFirstMeaningfulFrame',
    'renderer',
    'quality',
    'longFrameCount',
    'errors',
    'contextLoss',
  ].some((key) => unavailable[key] !== null)

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

  const comparisonStatus = aggregateStatus(comparisonGates)
  const status = aggregateVerificationStatus(
    comparisonStatus,
    normalizedCapabilities,
    hasRuntimeFailure,
    hasUnavailableEvidence,
  )
  return {
    schemaVersion: PERFORMANCE_SUMMARY_SCHEMA_VERSION,
    status,
    capabilities: normalizedCapabilities,
    failureEvidence,
    evidenceSource,
    deviceProfile,
    budget,
    observed,
    comparison: {
      status: comparisonStatus,
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
    const probeGpu = async (declaredRenderer = null) => {
      const probeContext = (type) => {
        try {
          const canvas = document.createElement('canvas')
          return Boolean(canvas.getContext(type))
        } catch {
          return false
        }
      }
      let webgpu = false
      try {
        webgpu = Boolean(
          navigator.gpu &&
            typeof navigator.gpu.requestAdapter === 'function' &&
            (await navigator.gpu.requestAdapter()),
        )
      } catch {}
      const evidence = {
        webgpu,
        webgl2: probeContext('webgl2'),
        webgl: probeContext('webgl'),
      }
      const declaredApi = Object.hasOwn(evidence, declaredRenderer)
        ? declaredRenderer
        : null
      const available = Object.values(evidence).some(Boolean)
      return {
        status: available ? 'AVAILABLE' : 'UNAVAILABLE',
        reason: available
          ? null
          : declaredApi
            ? 'declared ' + declaredApi + ' context is missing'
            : 'no WebGPU or WebGL context is available',
        renderer: declaredRenderer,
        evidence,
      }
    }
    const surfaceName = globalNames.find((name) => globalThis[name] != null) ?? null
    if (!surfaceName) {
      const gpu = await probeGpu()
      return {
        document: null,
        rendererInfo: null,
        evidenceSource: null,
        capabilities: {
          gpu,
          telemetry: {
            status: 'UNAVAILABLE',
            reason: 'telemetry surface is not available',
            evidence: { globalNames },
          },
        },
        collection: {
          method: 'no-surface',
          warmupFrames: null,
          sampleWindow: null,
          status: 'UNAVAILABLE',
          reason: 'telemetry surface is not available',
        },
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
    const telemetryDocument = collectedDocument ?? await readDocument(surface)
    const gpu = await probeGpu(telemetryDocument?.deviceProfile?.renderer ?? null)
    const telemetryCapability = {
      status: collectionFailed
        ? 'UNAVAILABLE'
        : telemetryDocument
          ? 'AVAILABLE'
          : 'UNAVAILABLE',
      reason: collectionFailed
        ? 'telemetry collection did not complete'
        : telemetryDocument
          ? null
          : 'telemetry surface did not return a document',
      evidence: {
        global: surfaceName,
        collectionMethod: method,
      },
    }
    const meaningfulFrameAtMs = telemetryDocument?.runtime?.frame?.firstMeaningfulFrame?.observed?.value
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
      document: clone(telemetryDocument),
      rendererInfo: clone(rendererInfo),
      evidenceSource: 'window.' + surfaceName,
      capabilities: {
        gpu,
        telemetry: telemetryCapability,
      },
      collection: {
        method,
        warmupFrames,
        sampleWindow,
        status: telemetryCapability.status,
        reason: telemetryCapability.reason,
      },
      transferObservation,
    }
  }, ${JSON.stringify(TELEMETRY_SURFACE_GLOBAL_ALIASES)})`
}

/**
 * Compact checkpoint-manifest validator (IP-06A). This is the verifier's own
 * copy of the contract implemented by the root reference
 * `references/interaction-checkpoints.ts`; the shared fixture suite binds the
 * two to the same accept/reject behaviour. Every checkpoint is declared by
 * the project — ids, targets, phases, progress, and state conditions — and
 * nothing here names a concrete checkpoint.
 */
export function validateCheckpointManifest(input) {
  const record = isRecord(input) ? input : null
  if (!record) throw new Error('checkpoint manifest must be an object')
  const allowed = [
    'schemaVersion',
    'surface',
    'project',
    'modeInput',
    'readyMarker',
    'checkpoints',
  ]
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new Error(`checkpoint manifest has unknown property ${key}`)
    }
  }
  if (record.schemaVersion !== CHECKPOINT_SCHEMA_VERSION) {
    throw new Error(`checkpoint manifest schemaVersion must be ${CHECKPOINT_SCHEMA_VERSION}`)
  }
  if (record.surface !== CHECKPOINT_SURFACE_ID) {
    throw new Error(`checkpoint manifest surface must be ${CHECKPOINT_SURFACE_ID}`)
  }
  if (typeof record.project !== 'string' || record.project.trim().length === 0) {
    throw new Error('checkpoint manifest.project must be a non-empty string')
  }
  if (record.modeInput !== CHECKPOINT_MODE_INPUT) {
    throw new Error(
      'checkpoint manifest modeInput must be WDU_DETERMINISTIC=1; interaction captures are only deterministic evidence in deterministic mode',
    )
  }
  if (typeof record.readyMarker !== 'string' || record.readyMarker.trim().length === 0) {
    throw new Error('checkpoint manifest.readyMarker must be a non-empty string')
  }
  if (!Array.isArray(record.checkpoints) || record.checkpoints.length === 0) {
    throw new Error('checkpoint manifest checkpoints must be a non-empty array')
  }

  const checkpoints = []
  const ids = new Set()
  const hoverGroups = new Map()
  const clickGroups = new Map()
  const targets = new Map()
  const interactionGroups = new Map([
    ['focus', new Map()],
    ['keyboard', new Map()],
    ['touch', new Map()],
  ])

  for (const item of record.checkpoints) {
    if (!isRecord(item)) throw new Error('checkpoints[] must be an object')
    const id = item.id
    if (typeof id !== 'string' || !CHECKPOINT_ID_PATTERN.test(id)) {
      throw new Error(
        `checkpoints[].id must match ${String(CHECKPOINT_ID_PATTERN)} (deterministic filenames are derived from ids)`,
      )
    }
    if (ids.has(id)) throw new Error(`checkpoint id ${id} is declared more than once`)
    ids.add(id)
    if (item.url !== undefined && (typeof item.url !== 'string' || item.url.length === 0)) {
      throw new Error(`checkpoints[].url must be a non-empty string`)
    }

    const interaction = item.interaction
    if (!CHECKPOINT_KINDS.includes(interaction)) {
      throw new Error(`checkpoints[].interaction must be one of ${CHECKPOINT_KINDS.join(', ')}`)
    }

    if (interaction === 'hover') {
      if (typeof item.group !== 'string' || item.group.length === 0) {
        throw new Error('checkpoints[].group is required for hover checkpoints')
      }
      if (!HOVER_PHASES.includes(item.phase)) {
        throw new Error(`checkpoints[].phase must be one of ${HOVER_PHASES.join(', ')}`)
      }
      if (typeof item.target !== 'string' || item.target.trim().length === 0) {
        throw new Error('checkpoints[].target is required for hover checkpoints')
      }
      const known = ['id', 'interaction', 'group', 'phase', 'target', 'waitFor', 'url', 'scrollIntoView']
      for (const key of Object.keys(item)) {
        if (!known.includes(key)) throw new Error(`checkpoints[] has unknown property ${key}`)
      }
      const group = hoverGroups.get(item.group) ?? []
      group.push(item)
      hoverGroups.set(item.group, group)
      const existingTarget = targets.get(item.group)
      if (existingTarget !== undefined && existingTarget !== item.target) {
        throw new Error(`hover group ${item.group} must target one selector across all phases`)
      }
      targets.set(item.group, item.target)
    } else if (interaction === 'click') {
      if (typeof item.group !== 'string' || item.group.length === 0) {
        throw new Error('checkpoints[].group is required for click checkpoints')
      }
      if (!CLICK_PHASES.includes(item.phase)) {
        throw new Error(`checkpoints[].phase must be one of ${CLICK_PHASES.join(', ')}`)
      }
      if (typeof item.target !== 'string' || item.target.trim().length === 0) {
        throw new Error('checkpoints[].target is required for click checkpoints')
      }
      const known = ['id', 'interaction', 'group', 'phase', 'target', 'waitFor', 'url', 'scrollIntoView']
      for (const key of Object.keys(item)) {
        if (!known.includes(key)) throw new Error(`checkpoints[] has unknown property ${key}`)
      }
      const group = clickGroups.get(item.group) ?? []
      group.push(item)
      clickGroups.set(item.group, group)
      const existingTarget = targets.get(item.group)
      if (existingTarget !== undefined && existingTarget !== item.target) {
        throw new Error(`click group ${item.group} must target one selector across all phases`)
      }
      targets.set(item.group, item.target)
    } else if (interaction === 'scroll') {
      const progress = item.progress
      if (
        typeof progress !== 'number' ||
        !Number.isFinite(progress) ||
        progress < 0 ||
        progress > 1
      ) {
        throw new Error('checkpoints[].progress must be a normalized number in [0, 1]')
      }
      const known = ['id', 'interaction', 'progress', 'url']
      for (const key of Object.keys(item)) {
        if (!known.includes(key)) throw new Error(`checkpoints[] has unknown property ${key}`)
      }
    } else if (interaction === 'loading' || interaction === 'failure') {
      if (typeof item.waitFor !== 'string' || item.waitFor.trim().length === 0) {
        throw new Error(`checkpoints[].waitFor is required for ${interaction} checkpoints`)
      }
      const known = ['id', 'interaction', 'waitFor', 'url', 'action', 'scrollIntoView']
      for (const key of Object.keys(item)) {
        if (!known.includes(key)) throw new Error(`checkpoints[] has unknown property ${key}`)
      }
      if (
        interaction === 'failure' &&
        item.action !== undefined &&
        item.action !== 'lose-webgl-context'
      ) {
        throw new Error("checkpoints[].action must be 'lose-webgl-context'")
      }
    } else if (interaction === 'ready') {
      const known = ['id', 'interaction', 'url', 'scrollIntoView']
      for (const key of Object.keys(item)) {
        if (!known.includes(key)) throw new Error(`checkpoints[] has unknown property ${key}`)
      }
    } else if (interaction === 'focus' || interaction === 'keyboard' || interaction === 'touch') {
      if (typeof item.group !== 'string' || item.group.length === 0) {
        throw new Error(`checkpoints[].group is required for ${interaction} checkpoints`)
      }
      const phases = interaction === 'focus' ? FOCUS_PHASES : KEYBOARD_PHASES
      if (!phases.includes(item.phase)) {
        throw new Error(`checkpoints[].phase must be one of ${phases.join(', ')}`)
      }
      if (typeof item.target !== 'string' || item.target.trim().length === 0) {
        throw new Error(`checkpoints[].target is required for ${interaction} checkpoints`)
      }
      const known = ['id', 'interaction', 'group', 'phase', 'target', 'waitFor', 'url', 'scrollIntoView']
      for (const key of Object.keys(item)) {
        if (!known.includes(key)) throw new Error(`checkpoints[] has unknown property ${key}`)
      }
      const group = interactionGroups.get(interaction).get(item.group) ?? []
      group.push(item)
      interactionGroups.get(interaction).set(item.group, group)
      const existingTarget = targets.get(`${interaction}:${item.group}`)
      if (existingTarget !== undefined && existingTarget !== item.target) {
        throw new Error(
          `${interaction} group ${item.group} must target one selector across all phases`,
        )
      }
      targets.set(`${interaction}:${item.group}`, item.target)
    } else if (interaction === 'audio') {
      if (!AUDIO_STATES.includes(item.state)) {
        throw new Error(`checkpoints[].state must be one of ${AUDIO_STATES.join(', ')}`)
      }
      if (typeof item.waitFor !== 'string' || item.waitFor.trim().length === 0) {
        throw new Error('checkpoints[].waitFor is required for audio checkpoints')
      }
      const known = [
        'id',
        'interaction',
        'state',
        'waitFor',
        'unlock',
        'target',
        'persist',
        'voiceLimit',
        'trigger',
        'repeats',
        'url',
        'scrollIntoView',
      ]
      for (const key of Object.keys(item)) {
        if (!known.includes(key)) throw new Error(`checkpoints[] has unknown property ${key}`)
      }
      if (item.state === 'enabled' && (typeof item.unlock !== 'string' || item.unlock.trim().length === 0)) {
        throw new Error('audio checkpoint state "enabled" requires the declared unlock gesture selector (unlock)')
      }
      if (
        (item.state === 'muted' || item.state === 'returning') &&
        (typeof item.target !== 'string' || item.target.trim().length === 0)
      ) {
        throw new Error(
          `audio checkpoint state "${item.state}" requires the declared mute control selector (target)`,
        )
      }
      if (
        (item.state === 'muted' || item.state === 'returning') &&
        (typeof item.persist !== 'string' || item.persist.trim().length === 0)
      ) {
        throw new Error(
          `audio checkpoint state "${item.state}" requires the declared persistence storage key (persist)`,
        )
      }
      if (item.voiceLimit !== undefined && (typeof item.trigger !== 'string' || item.trigger.trim().length === 0)) {
        throw new Error('audio checkpoint voiceLimit requires the declared rapid-activation source (trigger)')
      }
      if (item.voiceLimit !== undefined && item.state !== 'enabled') {
        throw new Error('audio checkpoint voiceLimit is observable only on the enabled state')
      }
      if (item.repeats !== undefined && item.voiceLimit === undefined) {
        throw new Error('audio checkpoint repeats is only valid with a declared voiceLimit')
      }
      if (item.trigger !== undefined && item.voiceLimit === undefined) {
        throw new Error('audio checkpoint trigger is only valid with a declared voiceLimit')
      }
      if (item.voiceLimit !== undefined && (!Number.isInteger(item.voiceLimit) || item.voiceLimit < 1)) {
        throw new Error('checkpoints[].voiceLimit must be a positive integer')
      }
      if (item.repeats !== undefined && (!Number.isInteger(item.repeats) || item.repeats < 1)) {
        throw new Error('checkpoints[].repeats must be a positive integer')
      }
    }
    checkpoints.push({ ...item })
  }

  for (const [group, entries] of hoverGroups) {
    const phases = new Set(entries.map((entry) => entry.phase))
    if (
      phases.size !== HOVER_PHASES.length ||
      HOVER_PHASES.some((phase) => !phases.has(phase))
    ) {
      throw new Error(
        `hover group ${group} must declare exactly the phases ${HOVER_PHASES.join(', ')}`,
      )
    }
  }
  for (const [group, entries] of clickGroups) {
    const phases = new Set(entries.map((entry) => entry.phase))
    if (
      phases.size !== CLICK_PHASES.length ||
      CLICK_PHASES.some((phase) => !phases.has(phase))
    ) {
      throw new Error(
        `click group ${group} must declare exactly the phases ${CLICK_PHASES.join(', ')}`,
      )
    }
  }
  for (const [kind, groups] of interactionGroups) {
    const phases = kind === 'focus' ? FOCUS_PHASES : KEYBOARD_PHASES
    for (const [group, entries] of groups) {
      const declared = new Set(entries.map((entry) => entry.phase))
      if (
        declared.size !== phases.length ||
        phases.some((phase) => !declared.has(phase))
      ) {
        throw new Error(
          `${kind} group ${group} must declare exactly the phases ${phases.join(', ')}`,
        )
      }
    }
  }

  return {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    surface: CHECKPOINT_SURFACE_ID,
    project: record.project,
    modeInput: record.modeInput,
    readyMarker: record.readyMarker,
    checkpoints,
  }
}

/** Deterministic capture filename for a checkpoint id (IP-06A deliverable). */
export function checkpointFileName(id) {
  if (typeof id !== 'string' || !CHECKPOINT_ID_PATTERN.test(id)) {
    throw new Error(`checkpoint id ${String(id)} cannot name a deterministic file`)
  }
  return `${id}.png`
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
    checkpoints: null,
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
    } else if (argument === '--checkpoints') {
      options.checkpoints = path.resolve(argv[index + 1])
      index += 1
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
  node scripts/verify-browser.mjs --url http://127.0.0.1:3000
                                  --checkpoints /absolute/path/interaction-checkpoints.json
                                  [--out /absolute/output/directory]

--checkpoints switches to checkpoint capture mode: every checkpoint declared
in the manifest is captured under deterministic mode into
<out>/checkpoints/<id>.png, with timestamp-free metadata in checkpoints.json
and a status summary in checkpoints-summary.json. No checkpoint is hardcoded
here; the manifest is the project's declaration. Generic drivers cover
hover/click/scroll/focus/keyboard/touch/loading/ready/failure, plus audio
locked/enabled/muted/returning only when the manifest declares sound. The
standard desktop/mobile/reduced/fallback matrix and telemetry summary are
skipped in this mode.

Exit codes: 0 = capture PASS, 1 = capture FAIL, 2 = browser, GPU, telemetry, or
deterministic-mode capability UNAVAILABLE. Set WDU_PLAYWRIGHT_CLI to an explicit executable
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
  if (options.checkpoints && !fs.existsSync(options.checkpoints)) {
    fail(`--checkpoints manifest does not exist: ${options.checkpoints}`)
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
  const explicit = process.env.WDU_PLAYWRIGHT_CLI
  if (explicit) {
    return [{ name: 'explicit', command: explicit, prefix: [] }]
  }

  const result = []
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

function outputDirectoryFor(options) {
  const outputDirectory =
    options.out ??
    path.resolve(process.cwd(), 'output', 'playwright', 'verify', timestamp())
  fs.mkdirSync(outputDirectory, { recursive: true })
  return outputDirectory
}

function writeBrowserUnavailableArtifacts(options, attempts) {
  const outputDirectory = outputDirectoryFor(options)
  const reason = 'no compatible browser CLI'
  const summary = buildPerformanceSummary({
    evidenceSource: 'browser-cli-probe',
    unavailableSurfaceReason: 'browser CLI is unavailable',
    capabilities: {
      browser: {
        status: 'UNAVAILABLE',
        reason,
        evidence: { attempts },
      },
      gpu: {
        status: 'UNAVAILABLE',
        reason: 'browser CLI is unavailable',
      },
      telemetry: {
        status: 'UNAVAILABLE',
        reason: 'browser CLI is unavailable',
      },
    },
  })
  fs.writeFileSync(
    path.join(outputDirectory, 'performance-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  )
  fs.writeFileSync(
    path.join(outputDirectory, 'capture.json'),
    `${JSON.stringify(
      {
        status: 'UNAVAILABLE',
        capability: 'browser-cli',
        url: options.url,
        outputDirectory,
        attempts,
      },
      null,
      2,
    )}\n`,
  )
  return outputDirectory
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  const resolved = resolveBackend(options.timeoutMs)
  if (!resolved.candidate) {
    if (options.probe) {
      fail(`browser CLI unavailable; ${resolved.attempts.join('; ')}`, 2)
    }
    const outputDirectory = writeBrowserUnavailableArtifacts(
      options,
      resolved.attempts,
    )
    fail(
      `browser CLI unavailable; partial artifacts: ${outputDirectory}`,
      2,
    )
  }

  const backend = resolved.candidate
  if (options.probe) {
    console.log(`VERIFY_RUNTIME: READY capability=browser-cli backend=${backend.name}`)
    return
  }

  const outputDirectory = outputDirectoryFor(options)
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

  // ---------------------------------------------------------------------
  // Checkpoint capture mode (IP-06A). Every checkpoint is declared by the
  // project's manifest; this verifier implements only generic drivers
  // (hover/click/scroll/loading/ready/failure) and derives deterministic
  // filenames from checkpoint ids. Nothing here names a concrete checkpoint.
  // ---------------------------------------------------------------------
  function runCheckpointCapture() {
    let manifest
    try {
      manifest = validateCheckpointManifest(
        JSON.parse(fs.readFileSync(options.checkpoints, 'utf8')),
      )
    } catch (error) {
      fail(
        `invalid checkpoint manifest ${options.checkpoints}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const checkpointDirectory = path.join(outputDirectory, 'checkpoints')
    fs.mkdirSync(checkpointDirectory, { recursive: true })

    const bootSnippet = (selector) => `async (page) => {
  await page.waitForSelector(${quoted(selector)}, { timeout: 30000 })
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
  return await page.evaluate(() => {
    const root = document.documentElement
    return {
      mode: root.getAttribute('data-wdu-mode'),
      pointer: root.getAttribute('data-wdu-pointer'),
      ready: root.getAttribute('data-wdu-ready'),
    }
  })
}`

    const waitSelectorSnippet = (selector) => `async (page) => {
  await page.waitForSelector(${quoted(selector)}, { timeout: 30000 })
}`

    const waitPointerChangeSnippet = (initial) => `async (page) => {
  await page.waitForFunction(
    (initial) => document.documentElement.getAttribute('data-wdu-pointer') !== initial,
    ${quoted(initial)},
    { timeout: 30000 },
  )
}`

    const moveToTargetSnippet = (target) => `async (page) => {
  const box = await page.locator(${quoted(target)}).boundingBox()
  if (!box) throw new Error('checkpoint target is not visible: ' + ${quoted(target)})
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
}`

    const parkPointerSnippet = `async (page) => {
  await page.mouse.move(4, 4)
}`

    const mouseDownSnippet = `async (page) => {
  await page.mouse.down()
}`

    const mouseUpSnippet = `async (page) => {
  await page.mouse.up()
}`

    const scrollSnippet = (progress) => `async (page) => {
  await page.evaluate((progress) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, Math.round(progress * max))
  }, ${progress})
  await page.waitForFunction(
    (progress) => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      return Math.abs(window.scrollY - Math.round(progress * max)) < 1
    },
    ${progress},
    { timeout: 10000 },
  )
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())))
}`

    const scrollIntoViewSnippet = (selector) => `async (page) => {
  await page.evaluate((selector) => {
    const element = document.querySelector(selector)
    if (!element) throw new Error('scroll-into-view target not found: ' + selector)
    element.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, ${quoted(selector)})
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())))
}`

    const loseContextSnippet = `async (page) => {
  await page.evaluate(() => {
    const canvas = document.querySelector('.scene-frame canvas')
    if (!canvas) throw new Error('lose-webgl-context: no scene canvas found')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!context) throw new Error('lose-webgl-context: no WebGL context found')
    const extension = context.getExtension('WEBGL_lose_context')
    if (!extension) throw new Error('lose-webgl-context: WEBGL_lose_context is unavailable')
    extension.loseContext()
  })
}`

    // IP-06B generic input drivers. Nothing here names a concrete checkpoint;
    // every selector comes from the project's manifest.

    // Bounded Tab navigation: reaches the declared focus target by real
    // keyboard traversal. Deterministic because the deterministic-mode DOM is
    // frozen; a target that Tab cannot reach is a keyboard-reachability
    // failure, not a fallback.
    const focusTargetSnippet = (target) => `async (page) => {
  for (let i = 0; i < 64; i += 1) {
    await page.keyboard.press('Tab')
    const reached = await page.evaluate((selector) => {
      const active = document.activeElement
      return active !== null && active !== document.body && active.matches(selector)
    }, ${quoted(target)})
    if (reached) return
  }
  throw new Error('focus target not reachable by Tab: ' + ${quoted(target)})
}`

    // Tab away from the focused target (bounded); used by focus-after so the
    // captured state is what a keyboard user sees after tabbing through.
    const blurTargetSnippet = (target) => `async (page) => {
  for (let i = 0; i < 64; i += 1) {
    await page.keyboard.press('Tab')
    const stillFocused = await page.evaluate((selector) => {
      const active = document.activeElement
      return active !== null && active.matches(selector)
    }, ${quoted(target)})
    if (!stillFocused) return
  }
  throw new Error('focus target did not blur after Tab: ' + ${quoted(target)})
}`

    // A held keyboard activation: keydown without keyup keeps the declared
    // peak state visible until the capture. The key is the platform default
    // for button activation (Enter); Space would scroll unless every project
    // prevented it, so the driver stays with Enter.
    const keyDownSnippet = `async (page) => {
  await page.keyboard.down('Enter')
}`

    const keyUpSnippet = `async (page) => {
  await page.keyboard.up('Enter')
}`

    // A held touch tap: trusted touch input through the browser's input
    // pipeline (CDP Input.dispatchTouchEvent), because a Playwright
    // touchscreen requires a hasTouch context this adapter does not control.
    // touchStart without touchEnd holds the declared peak state; a host
    // without the touch input pipeline is UNAVAILABLE, never a weaker
    // fallback. Coordinates come from the frozen layout, so the tap target is
    // deterministic.
    const touchStartSnippet = (target) => `async (page) => {
  let client
  try {
    client = await page.context().newCDPSession(page)
  } catch (error) {
    throw new Error('touch input pipeline unavailable (CDP session): ' + String(error?.message ?? error))
  }
  const box = await page.locator(${quoted(target)}).boundingBox()
  if (!box) throw new Error('touch target is not visible: ' + ${quoted(target)})
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        radiusX: 2,
        radiusY: 2,
        force: 1,
        id: 1,
      },
    ],
  })
  return { method: 'cdp-touch' }
}`

    const touchEndSnippet = `async (page) => {
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}`

    // Audio state evidence, read from the declared surface the project
    // records on the document root (the same pattern as data-wdu-pointer).
    const audioStateEvidenceSnippet = `async (page) => {
  return await page.evaluate(() => {
    const root = document.documentElement
    return {
      audio: root.getAttribute('data-wdu-audio'),
      context: root.getAttribute('data-wdu-audio-context'),
      restored: root.getAttribute('data-wdu-audio-restored'),
      voices: root.getAttribute('data-wdu-voices'),
      voiceAttempts: root.getAttribute('data-wdu-voice-attempts'),
      voiceClamped: root.getAttribute('data-wdu-voice-clamped'),
    }
  })
}`

    // The declared unlock gesture: a real pointer press on the project's
    // named gesture control.
    const audioUnlockSnippet = (unlock) => `async (page) => {
  const box = await page.locator(${quoted(unlock)}).boundingBox()
  if (!box) throw new Error('audio unlock target is not visible: ' + ${quoted(unlock)})
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}`

    // The declared mute control: a real pointer press on the opt-out control.
    const audioPressTargetSnippet = (target) => `async (page) => {
  const box = await page.locator(${quoted(target)}).boundingBox()
  if (!box) throw new Error('audio target is not visible: ' + ${quoted(target)})
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}`

    // The declared persistence key, read back as evidence of the write.
    const audioStorageEvidenceSnippet = (persist) => `async (page) => {
  return await page.evaluate((key) => {
    let value = null
    try {
      value = window.localStorage.getItem(key)
    } catch {
      value = null
    }
    return { key, value }
  }, ${quoted(persist)})
}`

    // Voice-limit observation: fire the declared number of rapid activations
    // on the declared trigger and read the fixture's counters after each one.
    // The fixture caps concurrent voices at the declared limit, so the
    // observed maximum and the clamped count are the evidence.
    const audioVoiceBurstSnippet = (trigger, repeats) => `async (page) => {
  let maxVoices = 0
  for (let i = 0; i < ${repeats}; i += 1) {
    await page.locator(${quoted(trigger)}).click({ noWaitAfter: true })
    const voices = Number(
      await page.evaluate(() => Number(document.documentElement.getAttribute('data-wdu-voices') ?? '0')),
    )
    if (voices > maxVoices) maxVoices = voices
  }
  const counts = await page.evaluate(() => ({
    voices: Number(document.documentElement.getAttribute('data-wdu-voices') ?? '0'),
    attempts: Number(document.documentElement.getAttribute('data-wdu-voice-attempts') ?? '0'),
    clamped: Number(document.documentElement.getAttribute('data-wdu-voice-clamped') ?? '0'),
  }))
  return { maxVoices, ...counts }
}`

    // The returning-session arc, in one session: press the declared mute
    // control, verify the persistence write, reload, and wait for the
    // restored state that only storage could have produced.
    const audioReturningSnippet = (target, persist) => `async (page) => {
  const box = await page.locator(${quoted(target)}).boundingBox()
  if (!box) throw new Error('audio target is not visible: ' + ${quoted(target)})
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const stored = await page.evaluate((key) => {
    let value = null
    try {
      value = window.localStorage.getItem(key)
    } catch {
      value = null
    }
    return value
  }, ${quoted(persist)})
  await page.reload({ waitUntil: 'domcontentloaded' })
  return { wrote: stored }
}`

    const entries = []

    function recordUnavailable(entry, record, reason) {
      record.status = 'UNAVAILABLE'
      record.reason = reason
      entries.push(record)
    }

    try {
      for (const entry of manifest.checkpoints) {
        const session = `wdu-checkpoint-${entry.id}`
        const file = checkpointFileName(entry.id)
        const target = path.join(checkpointDirectory, file)
        const record = {
          id: entry.id,
          interaction: entry.interaction,
          file,
        }
        if (entry.phase !== undefined) record.phase = entry.phase
        if (entry.state !== undefined) record.state = entry.state
        if (entry.progress !== undefined) record.progress = entry.progress
        if (entry.url !== undefined) record.url = entry.url
        if (entry.waitFor !== undefined) record.waitFor = entry.waitFor

        try {
          invoke(session, 'open', `${options.url}${entry.url ?? ''}`)
          invoke(
            session,
            'resize',
            String(CHECKPOINT_VIEWPORT.width),
            String(CHECKPOINT_VIEWPORT.height),
          )

          const initialSelector =
            entry.interaction === 'loading' ? entry.waitFor : manifest.readyMarker
          const boot = parseRawJson(
            invokeRaw(session, 'run-code', bootSnippet(initialSelector)).stdout,
          )
          record.modeResolved = boot.mode
          if (entry.interaction === 'loading') {
            record.readyAtCapture = boot.ready === 'true'
          }
          if (boot.mode !== 'deterministic') {
            recordUnavailable(
              entry,
              record,
              'deterministic mode not resolved (html[data-wdu-mode] is not "deterministic")',
            )
            continue
          }

          // Declared capture region: the entry names what must be visible
          // before the pointer moves or the capture happens. Scroll entries
          // define their own scroll position and never declare this.
          if (entry.scrollIntoView !== undefined) {
            invoke(session, 'run-code', scrollIntoViewSnippet(entry.scrollIntoView))
          }

          if (entry.interaction === 'hover' && entry.phase !== 'before') {
            invoke(session, 'run-code', moveToTargetSnippet(entry.target))
            invoke(session, 'run-code', waitPointerChangeSnippet(boot.pointer))
            if (entry.phase === 'after') {
              invoke(session, 'run-code', parkPointerSnippet)
            }
            if (entry.waitFor !== undefined) {
              invoke(session, 'run-code', waitSelectorSnippet(entry.waitFor))
            }
            // Re-ready: the capture-state change removed the marker; the
            // capture must wait for the frozen re-ready frame.
            invoke(session, 'run-code', waitSelectorSnippet(manifest.readyMarker))
          } else if (entry.interaction === 'click' && entry.phase !== 'before') {
            invoke(session, 'run-code', moveToTargetSnippet(entry.target))
            invoke(session, 'run-code', waitPointerChangeSnippet(boot.pointer))
            if (entry.phase === 'peak') {
              invoke(session, 'run-code', mouseDownSnippet)
            } else if (entry.phase === 'recovered') {
              invoke(session, 'run-code', mouseDownSnippet)
              invoke(session, 'run-code', mouseUpSnippet)
              invoke(session, 'run-code', parkPointerSnippet)
            }
            if (entry.waitFor !== undefined) {
              invoke(session, 'run-code', waitSelectorSnippet(entry.waitFor))
            }
            invoke(session, 'run-code', waitSelectorSnippet(manifest.readyMarker))
          } else if (entry.interaction === 'scroll') {
            invoke(session, 'run-code', scrollSnippet(entry.progress))
          } else if (entry.interaction === 'failure') {
            if (entry.action === 'lose-webgl-context') {
              invoke(session, 'run-code', loseContextSnippet)
            }
            invoke(session, 'run-code', waitSelectorSnippet(entry.waitFor))
          } else if (entry.interaction === 'focus' && entry.phase !== 'before') {
            // Focus-visible: reach the declared target by real Tab
            // traversal, then (for after) tab away. The project records
            // focus-visible on the document root (data-wdu-focus), and the
            // during condition is the target's own :focus-visible state.
            invoke(session, 'run-code', focusTargetSnippet(entry.target))
            if (entry.phase === 'after') {
              invoke(session, 'run-code', blurTargetSnippet(entry.target))
            }
            if (entry.waitFor !== undefined) {
              invoke(session, 'run-code', waitSelectorSnippet(entry.waitFor))
            }
            invoke(session, 'run-code', waitSelectorSnippet(manifest.readyMarker))
          } else if (entry.interaction === 'keyboard' && entry.phase !== 'before') {
            // Keyboard activation: Tab to the declared control, hold Enter
            // for the peak, release for the recovered state. The peak waits
            // for the same declared outcome state as the pointer click peak.
            invoke(session, 'run-code', focusTargetSnippet(entry.target))
            if (entry.phase === 'peak') {
              invoke(session, 'run-code', keyDownSnippet)
            } else if (entry.phase === 'recovered') {
              invoke(session, 'run-code', keyDownSnippet)
              invoke(session, 'run-code', keyUpSnippet)
            }
            if (entry.waitFor !== undefined) {
              invoke(session, 'run-code', waitSelectorSnippet(entry.waitFor))
            }
            invoke(session, 'run-code', waitSelectorSnippet(manifest.readyMarker))
          } else if (entry.interaction === 'touch' && entry.phase !== 'before') {
            // Touch alternative: a held touch tap through the browser's own
            // touch input pipeline. The peak holds touchStart so the declared
            // outcome state stays visible until the capture; recovered ends
            // the touch.
            let touchMethod
            try {
              touchMethod = parseRawJson(
                invokeRaw(session, 'run-code', touchStartSnippet(entry.target)).stdout,
              ).method
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              if (message.includes('touch input pipeline unavailable')) {
                recordUnavailable(
                  entry,
                  record,
                  'touch input pipeline unavailable (host browser cannot dispatch trusted touch input)',
                )
                continue
              }
              throw error
            }
            record.touch = touchMethod
            if (entry.phase === 'recovered') {
              invoke(session, 'run-code', touchEndSnippet)
            }
            if (entry.waitFor !== undefined) {
              invoke(session, 'run-code', waitSelectorSnippet(entry.waitFor))
            }
            invoke(session, 'run-code', waitSelectorSnippet(manifest.readyMarker))
          } else if (entry.interaction === 'audio') {
            // Conditional audio (IP-06B): audio checkpoints exist only when
            // the project declares sound. Every gesture, control, and storage
            // key is declared in the manifest; nothing here is invented.
            if (entry.state === 'enabled') {
              invoke(session, 'run-code', audioUnlockSnippet(entry.unlock))
              invoke(session, 'run-code', waitSelectorSnippet(entry.waitFor))
              if (entry.voiceLimit !== undefined) {
                const burst = parseRawJson(
                  invokeRaw(
                    session,
                    'run-code',
                    audioVoiceBurstSnippet(entry.trigger, entry.repeats ?? 6),
                  ).stdout,
                )
                record.voiceLimit = {
                  declared: entry.voiceLimit,
                  repeats: entry.repeats ?? 6,
                  observedMaxVoices: burst.maxVoices,
                  attempts: burst.attempts,
                  clamped: burst.clamped,
                }
              }
            } else if (entry.state === 'locked') {
              invoke(session, 'run-code', waitSelectorSnippet(entry.waitFor))
            } else if (entry.state === 'muted') {
              invoke(session, 'run-code', audioPressTargetSnippet(entry.target))
              invoke(session, 'run-code', waitSelectorSnippet(entry.waitFor))
              record.persistence = parseRawJson(
                invokeRaw(session, 'run-code', audioStorageEvidenceSnippet(entry.persist)).stdout,
              )
            } else if (entry.state === 'returning') {
              // One session proves the returning arc: press the declared
              // opt-out, verify the persistence write, reload, and wait for
              // the restored state only storage could have produced.
              const returning = parseRawJson(
                invokeRaw(session, 'run-code', audioReturningSnippet(entry.target, entry.persist))
                  .stdout,
              )
              record.persistence = {
                key: entry.persist,
                wrote: returning.wrote,
              }
              invoke(session, 'run-code', waitSelectorSnippet(manifest.readyMarker))
              invoke(session, 'run-code', waitSelectorSnippet(entry.waitFor))
            }
            const evidence = parseRawJson(
              invokeRaw(session, 'run-code', audioStateEvidenceSnippet).stdout,
            )
            record.audio = evidence
            invoke(session, 'run-code', waitSelectorSnippet(manifest.readyMarker))
          }

          invoke(session, 'screenshot', '--filename', target)
          const png = fs.readFileSync(target)
          record.sha256 = sha256Hex(png)
          record.bytes = png.length
          record.status = 'CAPTURED'
          entries.push(record)
        } catch (error) {
          record.status = 'FAIL'
          record.reason = error instanceof Error ? error.message : String(error)
          entries.push(record)
        }
      }
    } finally {
      for (const session of sessions) {
        if (session.startsWith('wdu-checkpoint-')) {
          run(backend, [`-s=${session}`, 'close'], Math.min(options.timeoutMs, 30000))
        }
      }
    }

    const counts = { captured: 0, failed: 0, unavailable: 0 }
    for (const entry of entries) {
      if (entry.status === 'CAPTURED') counts.captured += 1
      else if (entry.status === 'UNAVAILABLE') counts.unavailable += 1
      else counts.failed += 1
    }
    const status = counts.failed > 0 ? 'FAIL' : counts.unavailable > 0 ? 'UNAVAILABLE' : 'PASS'

    fs.writeFileSync(
      path.join(outputDirectory, 'checkpoints.json'),
      `${JSON.stringify(
        {
          schemaVersion: CHECKPOINT_SCHEMA_VERSION,
          surface: CHECKPOINT_SURFACE_ID,
          project: manifest.project,
          modeInput: manifest.modeInput,
          readyMarker: manifest.readyMarker,
          viewport: CHECKPOINT_VIEWPORT,
          entries,
        },
        null,
        2,
      )}\n`,
    )
    fs.writeFileSync(
      path.join(outputDirectory, 'checkpoints-summary.json'),
      `${JSON.stringify(
        {
          schemaVersion: CHECKPOINT_SCHEMA_VERSION,
          status,
          counts,
          entries: entries.map((entry) => ({
            id: entry.id,
            status: entry.status,
            reason: entry.reason ?? null,
          })),
        },
        null,
        2,
      )}\n`,
    )
    fs.writeFileSync(
      path.join(outputDirectory, 'capture.json'),
      `${JSON.stringify(
        {
          status,
          verificationStatus: status,
          mode: 'checkpoint',
          url: options.url,
          backend: backend.name,
          checkpointManifest: options.checkpoints,
          outputDirectory,
          commands,
        },
        null,
        2,
      )}\n`,
    )

    return { status, counts, entries }
  }

  if (options.checkpoints) {
    const checkpointResult = runCheckpointCapture()
    if (checkpointResult.status === 'FAIL') {
      fail(`checkpoint capture FAIL; artifacts: ${outputDirectory}`)
    }
    if (checkpointResult.status === 'UNAVAILABLE') {
      fail(`checkpoint capture UNAVAILABLE; artifacts: ${outputDirectory}`, 2)
    }
    console.log(
      `VERIFY_RUNTIME: PASS checkpoint-mode captured=${checkpointResult.counts.captured} artifacts=${outputDirectory}`,
    )
    return
  }

  let performanceSummary = null
  let captureFailure = null
  try {
    invoke('wdu-desktop', 'open', options.url)
    invoke('wdu-desktop', 'resize', '1440', '1000')
    invoke('wdu-desktop', 'run-code', settle)

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
        capabilities: {
          browser: {
            status: 'AVAILABLE',
            backend: backend.name,
            evidence: 'capability-checked browser CLI',
          },
          gpu: telemetryObservation?.capabilities?.gpu ?? {
            status: 'UNAVAILABLE',
            reason: 'GPU capability probe did not return',
          },
          telemetry: telemetryObservation?.capabilities?.telemetry ?? {
            status: 'UNAVAILABLE',
            reason: 'telemetry capability probe did not return',
          },
        },
      })
    } catch {
      performanceSummary = buildPerformanceSummary({
        evidenceSource: 'browser-telemetry-collection',
        unavailableSurfaceReason: 'telemetry collection command failed',
        capabilities: {
          browser: {
            status: 'AVAILABLE',
            backend: backend.name,
            evidence: 'capability-checked browser CLI',
          },
          gpu: {
            status: 'UNAVAILABLE',
            reason: 'GPU capability probe did not complete',
          },
          telemetry: {
            status: 'UNAVAILABLE',
            reason: 'telemetry collection command failed',
          },
        },
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
          status:
            performanceSummary.status === 'PASS'
              ? 'captured-not-yet-inspected'
              : performanceSummary.status,
          verificationStatus: performanceSummary.status,
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
      `${JSON.stringify({
        status: 'FAIL',
        error: error instanceof Error ? error.message : String(error),
        commands,
      }, null, 2)}\n`,
    )
    captureFailure = error
  } finally {
    for (const session of sessions) {
      run(backend, [`-s=${session}`, 'close'], Math.min(options.timeoutMs, 30000))
    }
  }

  if (captureFailure) {
    const message = captureFailure instanceof Error
      ? captureFailure.message
      : String(captureFailure)
    fail(`${message}; partial artifacts: ${outputDirectory}`)
  }
  if (!performanceSummary) {
    fail(`no performance summary was produced; partial artifacts: ${outputDirectory}`)
  }
  if (performanceSummary.status === 'UNAVAILABLE') {
    fail(
      `telemetry verification UNAVAILABLE; partial artifacts: ${outputDirectory}`,
      2,
    )
  }
  if (performanceSummary.status === 'FAIL') {
    fail(`telemetry verification FAIL; partial artifacts: ${outputDirectory}`)
  }

  console.log(
    `VERIFY_RUNTIME: PASS backend=${backend.name} artifacts=${outputDirectory}`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
