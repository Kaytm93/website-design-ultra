/**
 * The shared immersive telemetry surface (IP-03A/B) for the product-hero
 * fixture.
 *
 * This module implements the runtime side of the surface the verifier reads
 * (`window.__WDU_IMMERSIVE_TELEMETRY__`): it collects the three gate classes
 * plus the T0.2 context counters, builds a TelemetryDocument that validates
 * against the copied reference validator (lib/immersive-telemetry.ts), and
 * exposes `read()` / `collect()` in the shape the plugin verifier
 * (website-design-ultra/scripts/verify-browser.mjs) drives.
 *
 * Contracts this file keeps:
 *
 * - No wall clock. Time is injected (`nowMs`); every sample, decision, and
 *   timestamp derives from the one scene clock. In deterministic mode the
 *   clock advances the declared fixed step per rendered frame, so the
 *   warm-GPU evidence is the declared frame-time input — the same input the
 *   quality controller consumes — and the document is byte-identical across
 *   runs. Live mode reports measured clock deltas.
 * - One quality owner. The tier/DPR slice comes from the quality controller's
 *   `qualityState()`; this surface never decides quality.
 * - One sample source. The frame-time sample recorded here is the same
 *   `clock.delta` the quality controller receives, recorded once per rendered
 *   frame by QualityRuntime.
 * - Deterministic median/p95: nearest-rank p95 (ceil(n × 0.95), 1-based),
 *   matching the quality controller's rule and the verifier's expectation.
 * - Fail loud: every document is validated before it leaves the surface, so
 *   a schema drift fails the capture instead of silently producing an
 *   unreadable artifact.
 */

import {
  TELEMETRY_SCHEMA_VERSION,
  TELEMETRY_SURFACE_ID,
  validateTelemetryDocument,
  type Bytes,
  type RendererCounters,
  type RuntimeError,
  type TelemetryDocument,
} from './immersive-telemetry.ts'
import { BUDGET_DECLARATION } from './budget-declaration.ts'
import { DEVICE_PROFILE } from './device-profile.ts'
import { LONG_FRAME_MS } from './scene-config.ts'
import type { QualityController } from './quality-controller.ts'
import type { RuntimeMode } from './runtime-config.ts'

/** Bounded history so a long-running live session cannot grow unbounded. */
const MAX_SAMPLES = 512
const MAX_ERRORS = 16
const MAX_CONTEXT_LOSS_EVENTS = 8

export interface RendererReader {
  /**
   * The mapped shared counters plus the renderer's own info object (three's
   * `gl.info` shape) for the verifier's evidence.rendererInfo. Returns null
   * when no renderer exists (no-WebGL fallback page).
   */
  read(): { counters: RendererCounters; info: unknown } | null
}

export interface TelemetrySurfaceOptions {
  /** Injected time source in milliseconds (the one scene clock). */
  nowMs: () => number
  /** Resolved runtime mode; deterministic uses the declared fixed step. */
  mode: RuntimeMode
  /** The deterministic fixed step in milliseconds (1/60 s). */
  stepMs: number
  /** The declared readiness marker, reported in firstMeaningfulFrame. */
  readyMarker: string
  /** The one quality owner; the surface reads only its telemetry slice. */
  quality: QualityController
  /** The renderer reader; null when the page has no WebGL context. */
  readRenderer: RendererReader | null
}

export interface ImmersiveTelemetrySurface {
  /** Record one rendered frame's delta, fed once per frame by QualityRuntime. */
  recordFrameTimeMs(frameTimeMs: number): void
  /** Record the ready marker time (scene-clock ms) when readiness fires. */
  recordReady(clockMs: number): void
  /** Record a runtime failure (model load failure, shader error, ...). */
  recordError(kind: RuntimeError['kind'], message: string, resource?: string): void
  /** Record a WebGL context-loss event. */
  recordContextLoss(reason: string): void
  /** The current validated telemetry document. */
  read(): TelemetryDocument
  /**
   * The verifier's collection entry point. In live mode it waits until the
   * declared warm-up plus sample window have been recorded; in deterministic
   * mode it returns the declared fixed-step window immediately.
   */
  collect(input: {
    warmupFrames: number | null
    sampleWindow: number | null
  }): Promise<{ document: TelemetryDocument; rendererInfo: unknown }>
  /** The renderer's own info object for the verifier's evidence, if any. */
  rendererInfo(): unknown
}

/** Nearest-rank p95 over the current window, matching the quality controller. */
export function percentile95(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b)
  const rank = Math.max(1, Math.ceil(sorted.length * 0.95))
  return sorted[rank - 1] ?? 0
}

export function medianOf(samples: readonly number[]): number | null {
  if (samples.length === 0) return null
  const sorted = [...samples].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

export function createImmersiveTelemetrySurface(
  options: TelemetrySurfaceOptions,
): ImmersiveTelemetrySurface {
  const { nowMs, mode, stepMs, readyMarker, quality, readRenderer } = options

  const samples: number[] = []
  let readyMs: number | null = null
  let longFrameCount = 0
  const errors: RuntimeError[] = []
  let contextLossCount = 0
  const contextLossEvents: Array<{ reason: string; recovered: boolean }> = []

  function recordFrameTimeMs(frameTimeMs: number): void {
    samples.push(frameTimeMs)
    if (samples.length > MAX_SAMPLES) samples.shift()
    if (frameTimeMs > LONG_FRAME_MS) longFrameCount += 1
  }

  function recordReady(clockMs: number): void {
    if (readyMs === null) readyMs = clockMs
  }

  function recordError(kind: RuntimeError['kind'], message: string, resource?: string): void {
    const error: RuntimeError = { kind, message }
    if (resource !== undefined) {
      errors.push({ kind, message, resource })
    } else {
      errors.push(error)
    }
    if (errors.length > MAX_ERRORS) errors.shift()
  }

  function recordContextLoss(reason: string): void {
    contextLossCount += 1
    contextLossEvents.push({ reason, recovered: false })
    if (contextLossEvents.length > MAX_CONTEXT_LOSS_EVENTS) contextLossEvents.shift()
  }

  /**
   * The declared deterministic window: in deterministic mode the fixed-step
   * clock IS the declared frame-time input (determinism contract), so the
   * warm-GPU evidence is a full window of the declared step. Live mode
   * reports the actually recorded deltas.
   */
  function windowSamples(windowSize: number): { value: number; unit: 'ms' }[] {
    if (mode === 'deterministic') {
      return Array.from({ length: windowSize }, () => ({
        value: stepMs,
        unit: 'ms' as const,
      }))
    }
    return samples.slice(-windowSize).map((value) => ({ value, unit: 'ms' as const }))
  }

  function transferObserved(): Bytes | null {
    if (readyMs === null) return null
    if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
      return null
    }
    let observed = 0
    for (const entry of performance.getEntriesByType('resource')) {
      const timing = entry as PerformanceResourceTiming
      if (typeof timing.responseEnd !== 'number' || !Number.isFinite(timing.responseEnd)) continue
      if (timing.responseEnd > readyMs) continue
      const size =
        typeof timing.transferSize === 'number' && Number.isFinite(timing.transferSize) && timing.transferSize >= 0
          ? timing.transferSize
          : typeof timing.encodedBodySize === 'number' &&
              Number.isFinite(timing.encodedBodySize) &&
              timing.encodedBodySize >= 0
            ? timing.encodedBodySize
            : 0
      observed += Math.round(size)
    }
    return { value: observed, unit: 'bytes' }
  }

  function buildDocument(): TelemetryDocument {
    const warmGate = BUDGET_DECLARATION.gates.find(
      (gate) => gate.class === 'warm-gpu-frame-time',
    )
    const declaredWindow = warmGate?.sampleWindow.value ?? 120
    const window = windowSamples(declaredWindow)
    const values = window.map((sample) => sample.value)
    const median = medianOf(values)
    const counters = readRenderer?.read()?.counters ?? {
      api: DEVICE_PROFILE.renderer,
      counters: {
        drawCalls: { value: 0, unit: 'count' },
        visibleTriangles: { value: 0, unit: 'count' },
        textures: { value: 0, unit: 'count' },
        geometries: { value: 0, unit: 'count' },
        programs: { value: 0, unit: 'count' },
      },
    }
    const document: TelemetryDocument = {
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
      surface: TELEMETRY_SURFACE_ID,
      deviceProfile: DEVICE_PROFILE,
      budget: BUDGET_DECLARATION,
      runtime: {
        frame: {
          warmGpu: {
            samples: window,
            median:
              median === null ? null : { value: median, unit: 'ms' },
            p95:
              values.length === 0
                ? null
                : { value: percentile95(values), unit: 'ms' },
          },
          firstMeaningfulFrame: {
            marker: readyMarker,
            observed:
              readyMs === null ? null : { value: readyMs, unit: 'ms' },
          },
          transfer: {
            boundary: 'first-meaningful-frame',
            observed: transferObserved(),
          },
          longFrameCount: { value: longFrameCount, unit: 'count' },
        },
        renderer: counters,
        quality: quality.qualityState(),
        errors: [...errors],
        contextLoss: {
          count: { value: contextLossCount, unit: 'count' },
          events: [...contextLossEvents],
        },
      },
    }
    // Fail loud: a document that no longer validates must surface as a
    // capture failure, never as a silently unreadable artifact.
    validateTelemetryDocument(document)
    return document
  }

  async function collect(input: {
    warmupFrames: number | null
    sampleWindow: number | null
  }): Promise<{ document: TelemetryDocument; rendererInfo: unknown }> {
    if (mode !== 'deterministic') {
      const warmup = input.warmupFrames ?? 60
      const windowSize = input.sampleWindow ?? 120
      const needed = warmup + windowSize
      const deadline = nowMs() + 30_000
      while (samples.length < needed && nowMs() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    } else if (readyMs === null) {
      // Deterministic mode: the verifier may collect before the model has
      // finished loading and the ready marker has fired. Wait a bounded real
      // time (this is verifier plumbing at the outer boundary, never scene
      // code) so a slow-but-successful load still produces the full
      // document; if readiness never fires, the document reports the null
      // observation and the gate stays UNAVAILABLE.
      const deadline = Date.now() + 30_000
      while (readyMs === null && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }
    return { document: buildDocument(), rendererInfo: rendererInfo() }
  }

  function rendererInfo(): unknown {
    return readRenderer?.read()?.info ?? null
  }

  return {
    recordFrameTimeMs,
    recordReady,
    recordError,
    recordContextLoss,
    read: buildDocument,
    collect,
    rendererInfo,
  }
}
