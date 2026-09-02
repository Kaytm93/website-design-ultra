/*
 * Copyable immersive budget and telemetry surface reference.
 *
 * This file has zero runtime dependencies and stays outside the installed
 * website-design-ultra plugin payload. A project copies it into the renderer,
 * quality controller, and verifier so all three read one versioned shape.
 * It validates declarations and snapshots; it does not collect samples or
 * compare them. Collection and comparison belong to the verifier workstream.
 */

export const TELEMETRY_SCHEMA_VERSION = 1 as const
export const TELEMETRY_SURFACE_ID = 'wdu.immersive-telemetry' as const

export const TELEMETRY_GATE_CLASSES = [
  'warm-gpu-frame-time',
  'first-meaningful-frame',
  'transfer-before-first-meaningful-frame',
] as const

export type TelemetryGateClass = (typeof TELEMETRY_GATE_CLASSES)[number]
export type TelemetryUnit =
  | 'bytes'
  | 'count'
  | 'css-px'
  | 'fps'
  | 'frames'
  | 'ms'
  | 'ratio'

export type Quantity<Unit extends TelemetryUnit = TelemetryUnit> = Readonly<{
  value: number
  unit: Unit
}>

export type Bytes = Quantity<'bytes'>
export type Count = Quantity<'count'>
export type CssPixels = Quantity<'css-px'>
export type Frames = Quantity<'frames'>
export type Milliseconds = Quantity<'ms'>
export type Ratio = Quantity<'ratio'>
export type FramesPerSecond = Quantity<'fps'>

export type DeviceClass = 'desktop' | 'mobile'
export type RendererApi = 'webgl' | 'webgl2' | 'webgpu'
export type NetworkMode = 'offline' | 'online' | 'throttled'

export interface DeviceProfile {
  readonly id: string
  readonly class: DeviceClass
  readonly browser: string
  readonly browserVersion: string
  readonly renderer: RendererApi
  readonly viewport: {
    readonly width: CssPixels
    readonly height: CssPixels
  }
  readonly deviceScaleFactor: Ratio
  readonly network: NetworkMode
}

export interface FrameTarget {
  readonly rate: FramesPerSecond
  readonly frameTime: Milliseconds
  readonly justification: string
}

interface GateBase {
  readonly comparison: 'less-than-or-equal'
  readonly justification: string
}

export interface WarmGpuFrameTimeGate extends GateBase {
  readonly class: 'warm-gpu-frame-time'
  readonly targets: {
    readonly median: Milliseconds
    readonly p95: Milliseconds
  }
  readonly warmup: Frames
  readonly sampleWindow: Frames
}

export interface FirstMeaningfulFrameGate extends GateBase {
  readonly class: 'first-meaningful-frame'
  readonly marker: string
  readonly target: Milliseconds
}

export interface TransferBeforeFirstMeaningfulFrameGate extends GateBase {
  readonly class: 'transfer-before-first-meaningful-frame'
  readonly boundary: 'first-meaningful-frame'
  readonly target: Bytes
}

export type BudgetGate =
  | WarmGpuFrameTimeGate
  | FirstMeaningfulFrameGate
  | TransferBeforeFirstMeaningfulFrameGate

export interface BudgetDeclaration {
  readonly frameTarget: FrameTarget
  readonly gates: readonly BudgetGate[]
}

export interface WarmGpuFrameEvidence {
  readonly samples: readonly Milliseconds[]
  readonly median: Milliseconds | null
  readonly p95: Milliseconds | null
}

export interface FirstMeaningfulFrameEvidence {
  readonly marker: string
  readonly observed: Milliseconds | null
}

export interface TransferEvidence {
  readonly boundary: 'first-meaningful-frame'
  readonly observed: Bytes | null
}

export interface FrameTelemetry {
  readonly warmGpu: WarmGpuFrameEvidence
  readonly firstMeaningfulFrame: FirstMeaningfulFrameEvidence
  readonly transfer: TransferEvidence
  readonly longFrameCount: Count
}

export interface RendererCounters {
  readonly api: string
  readonly counters: {
    readonly drawCalls: Count
    readonly visibleTriangles: Count
    readonly textures: Count
    readonly geometries: Count
    readonly programs: Count
  }
}

export type QualityTier = 'poster' | 'low' | 'medium' | 'high'

export interface QualityState {
  readonly tier: QualityTier
  readonly dpr: Ratio
}

export type RuntimeErrorKind = 'resource-load' | 'shader-compile' | 'runtime'

export interface RuntimeError {
  readonly kind: RuntimeErrorKind
  readonly message: string
  readonly resource?: string
}

export interface ContextLossEvent {
  readonly reason: string
  readonly recovered: boolean
}

export interface ContextLossEvidence {
  readonly count: Count
  readonly events: readonly ContextLossEvent[]
}

export interface RuntimeTelemetry {
  readonly frame: FrameTelemetry
  readonly renderer: RendererCounters
  readonly quality: QualityState
  readonly errors: readonly RuntimeError[]
  readonly contextLoss: ContextLossEvidence
}

export interface TelemetryDocument {
  readonly schemaVersion: typeof TELEMETRY_SCHEMA_VERSION
  readonly surface: typeof TELEMETRY_SURFACE_ID
  readonly deviceProfile: DeviceProfile
  readonly budget: BudgetDeclaration
  readonly runtime: RuntimeTelemetry
}

type JsonRecord = Record<string, unknown>

type QuantityOptions = Readonly<{
  integer?: boolean
  minimum?: number
  exclusiveMinimum?: number
}>

function hasOwn(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function asRecord(input: unknown, label: string): JsonRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${label} must be an object`)
  }
  return input as JsonRecord
}

function assertKnownKeys(
  record: JsonRecord,
  allowed: readonly string[],
  label: string,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new Error(`${label} has unknown property ${key}`)
    }
  }
}

function required(record: JsonRecord, key: string, label: string): unknown {
  if (!hasOwn(record, key)) {
    throw new Error(`${label}.${key} is required`)
  }
  return record[key]
}

function text(input: unknown, label: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return input
}

function enumValue<const Values extends readonly string[]>(
  input: unknown,
  values: Values,
  label: string,
): Values[number] {
  if (typeof input !== 'string' || !values.includes(input)) {
    throw new Error(`${label} must be one of ${values.join(', ')}`)
  }
  return input as Values[number]
}

function quantity<Unit extends TelemetryUnit>(
  input: unknown,
  expectedUnit: Unit,
  label: string,
  options: QuantityOptions = {},
): Quantity<Unit> {
  const record = asRecord(input, label)
  assertKnownKeys(record, ['value', 'unit'], label)
  const value = required(record, 'value', label)
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label}.value must be a finite number`)
  }
  if (options.integer && !Number.isSafeInteger(value)) {
    throw new Error(`${label}.value must be a safe integer`)
  }
  if (options.minimum !== undefined && value < options.minimum) {
    throw new Error(`${label}.value must be at least ${options.minimum}`)
  }
  if (
    options.exclusiveMinimum !== undefined &&
    value <= options.exclusiveMinimum
  ) {
    throw new Error(`${label}.value must be greater than ${options.exclusiveMinimum}`)
  }
  const unit = required(record, 'unit', label)
  if (unit !== expectedUnit) {
    throw new Error(`${label}.unit must be ${expectedUnit}`)
  }
  return { value, unit: expectedUnit } as Quantity<Unit>
}

function nullableQuantity<Unit extends TelemetryUnit>(
  input: unknown,
  expectedUnit: Unit,
  label: string,
  options: QuantityOptions = {},
): Quantity<Unit> | null {
  if (input === null) return null
  return quantity(input, expectedUnit, label, options)
}

function validateDeviceProfile(input: unknown): DeviceProfile {
  const record = asRecord(input, 'deviceProfile')
  assertKnownKeys(
    record,
    [
      'id',
      'class',
      'browser',
      'browserVersion',
      'renderer',
      'viewport',
      'deviceScaleFactor',
      'network',
    ],
    'deviceProfile',
  )
  const viewport = asRecord(
    required(record, 'viewport', 'deviceProfile'),
    'deviceProfile.viewport',
  )
  assertKnownKeys(viewport, ['width', 'height'], 'deviceProfile.viewport')
  return {
    id: text(required(record, 'id', 'deviceProfile'), 'deviceProfile.id'),
    class: enumValue(
      required(record, 'class', 'deviceProfile'),
      ['desktop', 'mobile'],
      'deviceProfile.class',
    ),
    browser: text(
      required(record, 'browser', 'deviceProfile'),
      'deviceProfile.browser',
    ),
    browserVersion: text(
      required(record, 'browserVersion', 'deviceProfile'),
      'deviceProfile.browserVersion',
    ),
    renderer: enumValue(
      required(record, 'renderer', 'deviceProfile'),
      ['webgl', 'webgl2', 'webgpu'],
      'deviceProfile.renderer',
    ),
    viewport: {
      width: quantity(
        required(viewport, 'width', 'deviceProfile.viewport'),
        'css-px',
        'deviceProfile.viewport.width',
        { integer: true, exclusiveMinimum: 0 },
      ),
      height: quantity(
        required(viewport, 'height', 'deviceProfile.viewport'),
        'css-px',
        'deviceProfile.viewport.height',
        { integer: true, exclusiveMinimum: 0 },
      ),
    },
    deviceScaleFactor: quantity(
      required(record, 'deviceScaleFactor', 'deviceProfile'),
      'ratio',
      'deviceProfile.deviceScaleFactor',
      { exclusiveMinimum: 0 },
    ),
    network: enumValue(
      required(record, 'network', 'deviceProfile'),
      ['offline', 'online', 'throttled'],
      'deviceProfile.network',
    ),
  }
}

function validateFrameTarget(input: unknown): FrameTarget {
  const record = asRecord(input, 'budget.frameTarget')
  assertKnownKeys(
    record,
    ['rate', 'frameTime', 'justification'],
    'budget.frameTarget',
  )
  if (!hasOwn(record, 'frameTime')) {
    throw new Error(
      'budget.frameTarget.frameTime must be declared explicitly; fps must not imply an implicit frame-time threshold',
    )
  }
  return {
    rate: quantity(
      required(record, 'rate', 'budget.frameTarget'),
      'fps',
      'budget.frameTarget.rate',
      { exclusiveMinimum: 0 },
    ),
    frameTime: quantity(
      record.frameTime,
      'ms',
      'budget.frameTarget.frameTime',
      { exclusiveMinimum: 0 },
    ),
    justification: text(
      required(record, 'justification', 'budget.frameTarget'),
      'budget.frameTarget.justification',
    ),
  }
}

function validateGate(input: unknown): BudgetGate {
  const record = asRecord(input, 'budget.gates[]')
  const gateClass = enumValue(
    required(record, 'class', 'budget.gates[]'),
    TELEMETRY_GATE_CLASSES,
    'budget.gates[].class',
  )
  const comparison = required(record, 'comparison', `budget.gates.${gateClass}`)
  if (comparison !== 'less-than-or-equal') {
    throw new Error(`budget.gates.${gateClass}.comparison must be less-than-or-equal`)
  }
  const justification = text(
    required(record, 'justification', `budget.gates.${gateClass}`),
    `budget.gates.${gateClass}.justification`,
  )

  if (gateClass === 'warm-gpu-frame-time') {
    assertKnownKeys(
      record,
      ['class', 'comparison', 'targets', 'warmup', 'sampleWindow', 'justification'],
      `budget.gates.${gateClass}`,
    )
    const targets = asRecord(
      required(record, 'targets', `budget.gates.${gateClass}`),
      `budget.gates.${gateClass}.targets`,
    )
    assertKnownKeys(
      targets,
      ['median', 'p95'],
      `budget.gates.${gateClass}.targets`,
    )
    return {
      class: gateClass,
      comparison: 'less-than-or-equal',
      targets: {
        median: quantity(
          required(targets, 'median', `budget.gates.${gateClass}.targets`),
          'ms',
          `budget.gates.${gateClass}.targets.median`,
          { exclusiveMinimum: 0 },
        ),
        p95: quantity(
          required(targets, 'p95', `budget.gates.${gateClass}.targets`),
          'ms',
          `budget.gates.${gateClass}.targets.p95`,
          { exclusiveMinimum: 0 },
        ),
      },
      warmup: quantity(
        required(record, 'warmup', `budget.gates.${gateClass}`),
        'frames',
        `budget.gates.${gateClass}.warmup`,
        { integer: true, minimum: 0 },
      ),
      sampleWindow: quantity(
        required(record, 'sampleWindow', `budget.gates.${gateClass}`),
        'frames',
        `budget.gates.${gateClass}.sampleWindow`,
        { integer: true, exclusiveMinimum: 0 },
      ),
      justification,
    }
  }

  if (gateClass === 'first-meaningful-frame') {
    assertKnownKeys(
      record,
      ['class', 'comparison', 'marker', 'target', 'justification'],
      `budget.gates.${gateClass}`,
    )
    return {
      class: gateClass,
      comparison: 'less-than-or-equal',
      marker: text(
        required(record, 'marker', `budget.gates.${gateClass}`),
        `budget.gates.${gateClass}.marker`,
      ),
      target: quantity(
        required(record, 'target', `budget.gates.${gateClass}`),
        'ms',
        `budget.gates.${gateClass}.target`,
        { exclusiveMinimum: 0 },
      ),
      justification,
    }
  }

  assertKnownKeys(
    record,
    ['class', 'comparison', 'boundary', 'target', 'justification'],
    `budget.gates.${gateClass}`,
  )
  const boundary = required(record, 'boundary', `budget.gates.${gateClass}`)
  if (boundary !== 'first-meaningful-frame') {
    throw new Error(
      `budget.gates.${gateClass}.boundary must be first-meaningful-frame`,
    )
  }
  return {
    class: gateClass,
    comparison: 'less-than-or-equal',
    boundary: 'first-meaningful-frame',
    target: quantity(
      required(record, 'target', `budget.gates.${gateClass}`),
      'bytes',
      `budget.gates.${gateClass}.target`,
      { integer: true, minimum: 0 },
    ),
    justification,
  }
}

export function validateBudgetDeclaration(input: unknown): BudgetDeclaration {
  const record = asRecord(input, 'budget')
  assertKnownKeys(record, ['frameTarget', 'gates'], 'budget')
  const gatesInput = required(record, 'gates', 'budget')
  if (!Array.isArray(gatesInput) || gatesInput.length !== 3) {
    throw new Error('budget.gates must contain exactly three gate classes')
  }
  const gates = gatesInput.map(validateGate)
  const classes = gates.map((gate) => gate.class)
  if (
    new Set(classes).size !== TELEMETRY_GATE_CLASSES.length ||
    TELEMETRY_GATE_CLASSES.some((gateClass) => !classes.includes(gateClass))
  ) {
    throw new Error(
      `budget.gates must contain exactly three gate classes: ${TELEMETRY_GATE_CLASSES.join(', ')}`,
    )
  }
  return {
    frameTarget: validateFrameTarget(
      required(record, 'frameTarget', 'budget'),
    ),
    gates,
  }
}

function validateFrameTelemetry(input: unknown): FrameTelemetry {
  const record = asRecord(input, 'runtime.frame')
  assertKnownKeys(
    record,
    ['warmGpu', 'firstMeaningfulFrame', 'transfer', 'longFrameCount'],
    'runtime.frame',
  )
  const warmGpu = asRecord(
    required(record, 'warmGpu', 'runtime.frame'),
    'runtime.frame.warmGpu',
  )
  assertKnownKeys(
    warmGpu,
    ['samples', 'median', 'p95'],
    'runtime.frame.warmGpu',
  )
  const samples = required(warmGpu, 'samples', 'runtime.frame.warmGpu')
  if (!Array.isArray(samples)) {
    throw new Error('runtime.frame.warmGpu.samples must be an array')
  }

  const firstMeaningfulFrame = asRecord(
    required(record, 'firstMeaningfulFrame', 'runtime.frame'),
    'runtime.frame.firstMeaningfulFrame',
  )
  assertKnownKeys(
    firstMeaningfulFrame,
    ['marker', 'observed'],
    'runtime.frame.firstMeaningfulFrame',
  )
  const transfer = asRecord(
    required(record, 'transfer', 'runtime.frame'),
    'runtime.frame.transfer',
  )
  assertKnownKeys(transfer, ['boundary', 'observed'], 'runtime.frame.transfer')
  if (transfer.boundary !== 'first-meaningful-frame') {
    throw new Error(
      'runtime.frame.transfer.boundary must be first-meaningful-frame',
    )
  }

  return {
    warmGpu: {
      samples: samples.map((sample, index) =>
        quantity(sample, 'ms', `runtime.frame.warmGpu.samples[${index}]`, {
          exclusiveMinimum: 0,
        }),
      ),
      median: nullableQuantity(
        required(warmGpu, 'median', 'runtime.frame.warmGpu'),
        'ms',
        'runtime.frame.warmGpu.median',
        { exclusiveMinimum: 0 },
      ),
      p95: nullableQuantity(
        required(warmGpu, 'p95', 'runtime.frame.warmGpu'),
        'ms',
        'runtime.frame.warmGpu.p95',
        { exclusiveMinimum: 0 },
      ),
    },
    firstMeaningfulFrame: {
      marker: text(
        required(
          firstMeaningfulFrame,
          'marker',
          'runtime.frame.firstMeaningfulFrame',
        ),
        'runtime.frame.firstMeaningfulFrame.marker',
      ),
      observed: nullableQuantity(
        required(
          firstMeaningfulFrame,
          'observed',
          'runtime.frame.firstMeaningfulFrame',
        ),
        'ms',
        'runtime.frame.firstMeaningfulFrame.observed',
        { exclusiveMinimum: 0 },
      ),
    },
    transfer: {
      boundary: 'first-meaningful-frame',
      observed: nullableQuantity(
        required(transfer, 'observed', 'runtime.frame.transfer'),
        'bytes',
        'runtime.frame.transfer.observed',
        { integer: true, minimum: 0 },
      ),
    },
    longFrameCount: quantity(
      required(record, 'longFrameCount', 'runtime.frame'),
      'count',
      'runtime.frame.longFrameCount',
      { integer: true, minimum: 0 },
    ),
  }
}

function validateRendererCounters(input: unknown): RendererCounters {
  const record = asRecord(input, 'runtime.renderer')
  assertKnownKeys(record, ['api', 'counters'], 'runtime.renderer')
  const counters = asRecord(
    required(record, 'counters', 'runtime.renderer'),
    'runtime.renderer.counters',
  )
  assertKnownKeys(
    counters,
    ['drawCalls', 'visibleTriangles', 'textures', 'geometries', 'programs'],
    'runtime.renderer.counters',
  )
  const counter = (name: string): Count =>
    quantity(
      required(counters, name, 'runtime.renderer.counters'),
      'count',
      `runtime.renderer.counters.${name}`,
      { integer: true, minimum: 0 },
    )
  return {
    api: text(required(record, 'api', 'runtime.renderer'), 'runtime.renderer.api'),
    counters: {
      drawCalls: counter('drawCalls'),
      visibleTriangles: counter('visibleTriangles'),
      textures: counter('textures'),
      geometries: counter('geometries'),
      programs: counter('programs'),
    },
  }
}

function validateQualityState(input: unknown): QualityState {
  const record = asRecord(input, 'runtime.quality')
  assertKnownKeys(record, ['tier', 'dpr'], 'runtime.quality')
  return {
    tier: enumValue(
      required(record, 'tier', 'runtime.quality'),
      ['poster', 'low', 'medium', 'high'],
      'runtime.quality.tier',
    ),
    dpr: quantity(
      required(record, 'dpr', 'runtime.quality'),
      'ratio',
      'runtime.quality.dpr',
      { exclusiveMinimum: 0 },
    ),
  }
}

function validateErrors(input: unknown): readonly RuntimeError[] {
  if (!Array.isArray(input)) throw new Error('runtime.errors must be an array')
  return input.map((item, index) => {
    const record = asRecord(item, `runtime.errors[${index}]`)
    assertKnownKeys(
      record,
      ['kind', 'message', 'resource'],
      `runtime.errors[${index}]`,
    )
    const error: RuntimeError = {
      kind: enumValue(
        required(record, 'kind', `runtime.errors[${index}]`),
        ['resource-load', 'shader-compile', 'runtime'],
        `runtime.errors[${index}].kind`,
      ),
      message: text(
        required(record, 'message', `runtime.errors[${index}]`),
        `runtime.errors[${index}].message`,
      ),
    }
    if (hasOwn(record, 'resource')) {
      return {
        ...error,
        resource: text(
          record.resource,
          `runtime.errors[${index}].resource`,
        ),
      }
    }
    return error
  })
}

function validateContextLoss(input: unknown): ContextLossEvidence {
  const record = asRecord(input, 'runtime.contextLoss')
  assertKnownKeys(record, ['count', 'events'], 'runtime.contextLoss')
  const eventsInput = required(record, 'events', 'runtime.contextLoss')
  if (!Array.isArray(eventsInput)) {
    throw new Error('runtime.contextLoss.events must be an array')
  }
  return {
    count: quantity(
      required(record, 'count', 'runtime.contextLoss'),
      'count',
      'runtime.contextLoss.count',
      { integer: true, minimum: 0 },
    ),
    events: eventsInput.map((item, index) => {
      const event = asRecord(item, `runtime.contextLoss.events[${index}]`)
      assertKnownKeys(
        event,
        ['reason', 'recovered'],
        `runtime.contextLoss.events[${index}]`,
      )
      const recovered = required(
        event,
        'recovered',
        `runtime.contextLoss.events[${index}]`,
      )
      if (typeof recovered !== 'boolean') {
        throw new Error(
          `runtime.contextLoss.events[${index}].recovered must be a boolean`,
        )
      }
      return {
        reason: text(
          required(event, 'reason', `runtime.contextLoss.events[${index}]`),
          `runtime.contextLoss.events[${index}].reason`,
        ),
        recovered,
      }
    }),
  }
}

function validateRuntimeTelemetry(input: unknown): RuntimeTelemetry {
  const record = asRecord(input, 'runtime')
  assertKnownKeys(
    record,
    ['frame', 'renderer', 'quality', 'errors', 'contextLoss'],
    'runtime',
  )
  return {
    frame: validateFrameTelemetry(required(record, 'frame', 'runtime')),
    renderer: validateRendererCounters(
      required(record, 'renderer', 'runtime'),
    ),
    quality: validateQualityState(required(record, 'quality', 'runtime')),
    errors: validateErrors(required(record, 'errors', 'runtime')),
    contextLoss: validateContextLoss(
      required(record, 'contextLoss', 'runtime'),
    ),
  }
}

export function validateTelemetryDocument(input: unknown): TelemetryDocument {
  const record = asRecord(input, 'telemetry document')
  assertKnownKeys(
    record,
    ['schemaVersion', 'surface', 'deviceProfile', 'budget', 'runtime'],
    'telemetry document',
  )
  if (record.schemaVersion !== TELEMETRY_SCHEMA_VERSION) {
    throw new Error(
      `telemetry document.schemaVersion must be ${TELEMETRY_SCHEMA_VERSION}`,
    )
  }
  if (record.surface !== TELEMETRY_SURFACE_ID) {
    throw new Error(`telemetry document.surface must be ${TELEMETRY_SURFACE_ID}`)
  }
  if (!hasOwn(record, 'deviceProfile')) {
    throw new Error('telemetry document requires deviceProfile')
  }
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    surface: TELEMETRY_SURFACE_ID,
    deviceProfile: validateDeviceProfile(record.deviceProfile),
    budget: validateBudgetDeclaration(required(record, 'budget', 'telemetry document')),
    runtime: validateRuntimeTelemetry(
      required(record, 'runtime', 'telemetry document'),
    ),
  }
}
