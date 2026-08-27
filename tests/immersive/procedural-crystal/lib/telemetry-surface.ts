// telemetry-surface.ts — Minimal in-process telemetry surface for the
// procedural-crystal fixture. Captures the same three gate numbers as
// product-hero but with a smaller API surface — enough to publish the document
// the verifier reads.

import {
  BUDGET_DECLARATION,
  type BudgetedMeasurement,
  type TelemetryDocument,
  validateTelemetryDocument,
} from './immersive-telemetry.ts'

export function medianOf(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = values.slice().sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

export function percentile95(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = values.slice().sort((a, b) => a - b)
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil(sorted.length * 0.95)))
  return sorted[rank - 1]
}

export interface QualityLike {
  forcePoster(reason: string): void
  recordFrameTime(ms: number): void
  read(): { tier: string; dpr: number }
  attachVisibility(isVisible: () => boolean): () => void
}

export interface CreateTelemetrySurfaceOptions {
  nowMs: () => number
  mode: 'deterministic' | 'live'
  stepMs: number
  readyMarker: string
  quality: QualityLike
  readRenderer?: null | { read(): { counters: { api: 'webgl2' | 'webgpu' | 'none'; drawCalls: number; visibleTriangles: number; textures: number; geometries: number; programs: number }; info: { render: { calls: number } } } }
}

export interface CollectedTelemetry {
  document: TelemetryDocument
  rendererInfo: { counters: { drawCalls: number; visibleTriangles: number; textures: number; geometries: number; programs: number }; api: string } | null
}

export interface ImmersiveTelemetrySurface {
  recordFrameTimeMs(ms: number): void
  recordReady(ms: number): void
  recordError(kind: string, message: string, resource?: string): void
  recordContextLoss(reason: string): void
  read(): TelemetryDocument
  collect(options: { warmupFrames: number; sampleWindow: number }): Promise<CollectedTelemetry>
  rendererInfo(): { counters: { drawCalls: number; visibleTriangles: number; textures: number; geometries: number; programs: number }; info: { render: { calls: number } } } | null
}

function emptyCounters() {
  return {
    api: 'none' as const,
    counters: {
      drawCalls: { value: 0, unit: 'count' as const },
      visibleTriangles: { value: 0, unit: 'count' as const },
      textures: { value: 0, unit: 'count' as const },
      geometries: { value: 0, unit: 'count' as const },
      programs: { value: 0, unit: 'count' as const },
    },
  }
}

export function createImmersiveTelemetrySurface(options: CreateTelemetrySurfaceOptions): ImmersiveTelemetrySurface {
  const samples: number[] = []
  let firstFrameMs: number | null = null
  const contextLossEvents: { reason: string; recovered: boolean }[] = []
  const errors: { kind: string; message: string; resource?: string }[] = []
  // The controller owns visibility tracking; we call its read() lazily.
  // No interval is scheduled here — the controller's own attachVisibility
  // is the single owner of any polling.

  function snapshot(): TelemetryDocument {
    const median = medianOf(samples) ?? 0
    const p95 = percentile95(samples) ?? 0
    const renderer = options.readRenderer?.read() ?? null
    const quality = options.quality.read()
    return {
      schemaVersion: 1,
      surface: 'wdu.immersive-telemetry',
      runtime: {
        quality: { tier: quality.tier, dpr: { value: quality.dpr, unit: 'ratio' } },
        frame: {
          warmGpu: {
            samples: samples.slice(),
            median: { value: median, unit: 'ms' },
            p95: { value: p95, unit: 'ms' },
          },
          firstMeaningfulFrame: {
            observed: firstFrameMs === null ? null : { value: firstFrameMs, unit: 'ms' },
          },
          longFrameCount: { value: samples.filter((s) => s > 50).length, unit: 'count' },
          transfer: { observed: { value: 0, unit: 'bytes' } },
        },
        contextLoss: { count: { value: contextLossEvents.length, unit: 'count' }, events: contextLossEvents.slice() },
        errors: errors.slice(),
        renderer: renderer
          ? {
              api: renderer.counters.api,
              counters: {
                drawCalls: { value: renderer.counters.drawCalls, unit: 'count' },
                visibleTriangles: { value: renderer.counters.visibleTriangles, unit: 'count' },
                textures: { value: renderer.counters.textures, unit: 'count' },
                geometries: { value: renderer.counters.geometries, unit: 'count' },
                programs: { value: renderer.counters.programs, unit: 'count' },
              },
            }
          : {
              api: 'none',
              counters: emptyCounters().counters,
            },
      },
    }
  }

  return {
    recordFrameTimeMs(ms) {
      options.quality.recordFrameTime(ms)
      samples.push(ms)
      if (samples.length > 1024) samples.splice(0, samples.length - 1024)
    },
    recordReady(ms) {
      if (firstFrameMs === null) firstFrameMs = ms
    },
    recordError(kind, message, resource) {
      errors.push(resource ? { kind, message, resource } : { kind, message })
    },
    recordContextLoss(reason) {
      contextLossEvents.push({ reason, recovered: false })
      options.quality.forcePoster(reason)
    },
    read() {
      return snapshot()
    },
    async collect({ warmupFrames, sampleWindow }) {
      // Deterministic: pad to the declared window in-place so the captured
      // document is stable for two runs. Live: return whatever we have.
      if (options.mode === 'deterministic') {
        while (samples.length < warmupFrames) samples.push(options.stepMs)
        while (samples.length < warmupFrames + sampleWindow) samples.push(options.stepMs)
      }
      const renderer = options.readRenderer?.read() ?? null
      return {
        document: snapshot(),
        rendererInfo: renderer
          ? { counters: renderer.counters, api: renderer.counters.api }
          : null,
      }
    },
    rendererInfo() {
      const renderer = options.readRenderer?.read() ?? null
      return renderer ? { counters: renderer.counters, info: renderer.info } : null
    },
  }
}

// re-export the declaration so the runner can read it without importing two files.
export { BUDGET_DECLARATION }