// immersive-telemetry.ts — Project-declared budget and device profile, shared
// with the verifier. Three gate classes: warm-gpu-frame-time, first-meaningful-frame,
// transfer-before-first-meaningful-frame. Desktop <100 draws / <500k triangles;
// mobile <50 draws / <150k triangles. Numbers come from TODO.md T0.2 and the
// shared immersive-3d §3 reference; this file only validates the shape.

export interface FrameTimeBudget {
  value: number
  unit: 'ms' | 'fps'
}

export interface BudgetedMeasurement {
  value: number
  unit: 'ms' | 'bytes' | 'count' | 'ratio'
}

export interface BudgetGate {
  class: 'warm-gpu-frame-time' | 'first-meaningful-frame' | 'transfer-before-first-meaningful-frame'
  observed: BudgetedMeasurement | null
  threshold: BudgetedMeasurement
  status: 'PASS' | 'FAIL' | 'UNAVAILABLE'
  reason?: string
}

export interface BudgetDeclaration {
  schemaVersion: 1
  surface: 'wdu.immersive-telemetry'
  device: { name: string; renderer: 'webgl2' | 'webgpu'; network: 'offline' | 'online' }
  frameTarget: { frameTime: FrameTimeBudget; sampleWindow: number; warmupFrames: number }
  transfer: { ceilingBytes: number }
  gates: BudgetGate[]
}

export const BUDGET_DECLARATION: BudgetDeclaration = {
  schemaVersion: 1,
  surface: 'wdu.immersive-telemetry',
  device: { name: 'procedural-crystal-fixture', renderer: 'webgl2', network: 'offline' },
  frameTarget: { frameTime: { value: 33.3, unit: 'ms' }, sampleWindow: 120, warmupFrames: 60 },
  transfer: { ceilingBytes: 250_000 },
  gates: [
    {
      class: 'warm-gpu-frame-time',
      observed: null,
      threshold: { value: 33.3, unit: 'ms' },
      status: 'UNAVAILABLE',
    },
    {
      class: 'first-meaningful-frame',
      observed: null,
      threshold: { value: 2000, unit: 'ms' },
      status: 'UNAVAILABLE',
    },
    {
      class: 'transfer-before-first-meaningful-frame',
      observed: null,
      threshold: { value: 250_000, unit: 'bytes' },
      status: 'UNAVAILABLE',
    },
  ],
}

export function validateBudgetDeclaration(declaration: BudgetDeclaration): BudgetDeclaration {
  if (declaration.schemaVersion !== 1) {
    throw new Error(`budget schemaVersion must be 1, got ${declaration.schemaVersion}`)
  }
  if (!['webgl2', 'webgpu'].includes(declaration.device.renderer)) {
    throw new Error(`device.renderer must be webgl2 or webgpu, got ${declaration.device.renderer}`)
  }
  if (!['offline', 'online'].includes(declaration.device.network)) {
    throw new Error(`device.network must be offline or online, got ${declaration.device.network}`)
  }
  if (declaration.frameTarget.frameTime.unit !== 'ms' && declaration.frameTarget.frameTime.unit !== 'fps') {
    throw new Error(`frameTarget.frameTime.unit must be ms or fps, got ${declaration.frameTarget.frameTime.unit}`)
  }
  const classes = new Set(declaration.gates.map((g) => g.class))
  for (const expected of ['warm-gpu-frame-time', 'first-meaningful-frame', 'transfer-before-first-meaningful-frame'] as const) {
    if (!classes.has(expected)) {
      throw new Error(`budget must declare gate ${expected}`)
    }
  }
  return declaration
}

export interface TelemetryDocument {
  schemaVersion: number
  surface: string
  runtime: {
    quality: { tier: string; dpr: BudgetedMeasurement }
    frame: {
      warmGpu: { samples: number[]; median: BudgetedMeasurement; p95: BudgetedMeasurement }
      firstMeaningfulFrame: { observed: BudgetedMeasurement | null }
      longFrameCount: { value: number; unit: 'count' }
      transfer: { observed: BudgetedMeasurement }
    }
    contextLoss: { count: { value: number; unit: 'count' }; events: { reason: string; recovered: boolean }[] }
    errors: { kind: string; message: string; resource?: string }[]
    renderer: {
      api: 'webgl2' | 'webgpu' | 'none'
      counters: {
        drawCalls: BudgetedMeasurement
        visibleTriangles: BudgetedMeasurement
        textures: BudgetedMeasurement
        geometries: BudgetedMeasurement
        programs: BudgetedMeasurement
      }
    }
  }
}

export function validateTelemetryDocument(document: TelemetryDocument): TelemetryDocument {
  if (document.schemaVersion !== 1) {
    throw new Error(`telemetry document schemaVersion must be 1`)
  }
  if (document.surface !== 'wdu.immersive-telemetry') {
    throw new Error(`telemetry document surface must be wdu.immersive-telemetry`)
  }
  return document
}