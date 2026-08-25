import {
  TELEMETRY_GATE_CLASSES,
  TELEMETRY_SCHEMA_VERSION,
  TELEMETRY_SURFACE_ID,
  type BudgetDeclaration,
  type Bytes,
  type Count,
  type DeviceProfile,
  type FirstMeaningfulFrameGate,
  type Milliseconds,
  type Ratio,
  type TelemetryDocument,
  type TelemetryGateClass,
  type WarmGpuFrameTimeGate,
} from '../../../references/immersive-telemetry.ts'

const milliseconds: Milliseconds = { value: 33, unit: 'ms' }
const bytes: Bytes = { value: 524288, unit: 'bytes' }
const count: Count = { value: 0, unit: 'count' }
const ratio: Ratio = { value: 1.25, unit: 'ratio' }

const warmGate: WarmGpuFrameTimeGate = {
  class: 'warm-gpu-frame-time',
  comparison: 'less-than-or-equal',
  targets: { median: milliseconds, p95: milliseconds },
  warmup: { value: 120, unit: 'frames' },
  sampleWindow: { value: 300, unit: 'frames' },
  justification: 'Explicit warm window for the declared profile.',
}

const firstFrameGate: FirstMeaningfulFrameGate = {
  class: 'first-meaningful-frame',
  comparison: 'less-than-or-equal',
  marker: 'html[data-wdu-ready="true"]',
  target: { value: 1500, unit: 'ms' },
  justification: 'Explicit stable-frame target.',
}

const transferGate = {
  class: 'transfer-before-first-meaningful-frame',
  comparison: 'less-than-or-equal',
  boundary: 'first-meaningful-frame',
  target: bytes,
  justification: 'Explicit transfer boundary.',
} as const

const deviceProfile: DeviceProfile = {
  id: 'type-test-profile',
  class: 'desktop',
  browser: 'chromium',
  browserVersion: 'fixture',
  renderer: 'webgl2',
  viewport: {
    width: { value: 1440, unit: 'css-px' },
    height: { value: 1000, unit: 'css-px' },
  },
  deviceScaleFactor: ratio,
  network: 'offline',
}

const budget: BudgetDeclaration = {
  frameTarget: {
    rate: { value: 30, unit: 'fps' },
    frameTime: milliseconds,
    justification: 'Explicit target and explicit time ceiling.',
  },
  gates: [warmGate, firstFrameGate, transferGate],
}

const document: TelemetryDocument = {
  schemaVersion: TELEMETRY_SCHEMA_VERSION,
  surface: TELEMETRY_SURFACE_ID,
  deviceProfile,
  budget,
  runtime: {
    frame: {
      warmGpu: { samples: [milliseconds], median: milliseconds, p95: milliseconds },
      firstMeaningfulFrame: {
        marker: 'html[data-wdu-ready="true"]',
        observed: { value: 1200, unit: 'ms' },
      },
      transfer: {
        boundary: 'first-meaningful-frame',
        observed: bytes,
      },
      longFrameCount: count,
    },
    renderer: {
      api: 'three.renderer.info',
      counters: {
        drawCalls: count,
        visibleTriangles: count,
        textures: count,
        geometries: count,
        programs: count,
      },
    },
    quality: { tier: 'medium', dpr: ratio },
    errors: [],
    contextLoss: { count, events: [] },
  },
}

const allGateClasses: readonly TelemetryGateClass[] = TELEMETRY_GATE_CLASSES
void document
void allGateClasses

// @ts-expect-error a measurement without a unit is not a telemetry quantity
const missingUnit: Milliseconds = { value: 33 }
void missingUnit

const contextGateBudget: BudgetDeclaration = {
  frameTarget: budget.frameTarget,
  gates: [
    warmGate,
    firstFrameGate,
    // @ts-expect-error a context counter is not one of the three budget gates
    { class: 'context-loss', target: count },
  ],
}
void contextGateBudget
