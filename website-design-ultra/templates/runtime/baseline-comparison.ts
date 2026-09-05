/*
 * Copyable baseline-comparison declaration reference (IP-06C).
 *
 * This file has zero runtime dependencies and stays outside the installed
 * website-design-ultra plugin payload. A project copies it next to its
 * comparison declaration so the declaration, its tests, and the offline
 * comparator read one versioned shape. It validates declarations; it does not
 * decode PNGs or drive a browser. Comparison execution belongs to the
 * comparator workstream (tests/immersive/interaction-capture/compare-baselines.mjs).
 *
 * Contract: a baseline comparison is optional and offline. It compares two
 * capture sets that were produced under the deterministic contract and
 * classifies each difference into exactly one of four buckets: structural
 * regression, perceptual difference, expected dynamic variation, and
 * nondeterministic content. The declaration names pixel masks (regions whose
 * differences are expected or declared nondeterministic) and one tolerance
 * block (channel delta, changed fraction, mean absolute difference). Every
 * mask and every tolerance must name its source, and the comparison report
 * repeats that source. A difference score is evidence of change — never an
 * aesthetic verdict, taste, or approval.
 *
 * Masks are pixel rectangles in capture-viewport coordinates. A mask class of
 * expected-dynamic-variation declares a region that varies even under a
 * frozen clock (for example a live meter the project deliberately keeps out
 * of the frozen frame); nondeterministic-content declares a region the
 * project cannot make deterministic (for example embedded third-party
 * content). A deterministic mismatch outside every declared mask is a
 * perceptual difference and is never routed into a dynamic bucket.
 */

export const BASELINE_COMPARISON_SCHEMA_VERSION = 1 as const
export const BASELINE_COMPARISON_SURFACE_ID = 'wdu.baseline-comparison' as const

export const MASK_CLASSES = [
  'expected-dynamic-variation',
  'nondeterministic-content',
] as const

export const DIFF_CLASSES = [
  'identical',
  'structural-regression',
  'perceptual-difference',
  'expected-dynamic-variation',
  'nondeterministic-content',
] as const

/** The report and the CLI repeat this statement; a score is evidence, never taste. */
export const EVIDENCE_STATEMENT =
  'A difference score is evidence of change. It is never an aesthetic verdict, taste, or approval.'

export const MASK_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/

export type MaskClass = (typeof MASK_CLASSES)[number]
export type DiffClass = (typeof DIFF_CLASSES)[number]

export interface MaskRect {
  /** Left edge in capture-viewport CSS pixels. */
  readonly x: number
  /** Top edge in capture-viewport CSS pixels. */
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface ComparisonMask {
  readonly id: string
  /** How differences inside this region are classified. */
  readonly class: MaskClass
  readonly rect: MaskRect
  /** Where this mask comes from (for example the manifest entry that justifies it). */
  readonly source: string
}

export interface ComparisonTolerance {
  readonly id: string
  /** Per-channel per-pixel absolute delta (0-255) above which a pixel counts as changed. */
  readonly maxChannelDelta: number
  /** Maximum fraction of outside-mask pixels that may be changed. */
  readonly maxChangedFraction: number
  /** Maximum normalized mean absolute channel difference outside masks. */
  readonly maxMeanAbsDifference: number
  /** Where this tolerance comes from. */
  readonly source: string
}

export interface BaselineComparisonDeclaration {
  readonly schemaVersion: typeof BASELINE_COMPARISON_SCHEMA_VERSION
  readonly surface: typeof BASELINE_COMPARISON_SURFACE_ID
  readonly project: string
  readonly masks: readonly ComparisonMask[]
  /** Optional; the comparator applies and names its built-in strict default when absent. */
  tolerance?: ComparisonTolerance
}

type JsonRecord = Record<string, unknown>

function hasOwn(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function asRecord(input: unknown, label: string): JsonRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${label} must be an object`)
  }
  return input as JsonRecord
}

function assertKnownKeys(record: JsonRecord, allowed: readonly string[], label: string): void {
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

function optionalText(record: JsonRecord, key: string, label: string): string | undefined {
  if (!hasOwn(record, key)) return undefined
  return text(record[key], `${label}.${key}`)
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

function maskId(input: unknown, label: string): string {
  const id = text(input, label)
  if (!MASK_ID_PATTERN.test(id)) {
    throw new Error(
      `${label} must match ${String(MASK_ID_PATTERN)} (deterministic artifact names are derived from ids)`,
    )
  }
  return id
}

function nonNegativeInteger(input: unknown, label: string): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
  return input
}

function positiveInteger(input: unknown, label: string): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < 1) {
    throw new Error(`${label} must be a positive integer`)
  }
  return input
}

function unitInterval(input: unknown, label: string): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input < 0 || input > 1) {
    throw new Error(`${label} must be a number in [0, 1]`)
  }
  return input
}

function validateMaskRect(record: JsonRecord, label: string): MaskRect {
  assertKnownKeys(record, ['x', 'y', 'width', 'height'], label)
  return {
    x: nonNegativeInteger(required(record, 'x', label), `${label}.x`),
    y: nonNegativeInteger(required(record, 'y', label), `${label}.y`),
    width: positiveInteger(required(record, 'width', label), `${label}.width`),
    height: positiveInteger(required(record, 'height', label), `${label}.height`),
  }
}

function validateMask(record: JsonRecord, label: string): ComparisonMask {
  assertKnownKeys(record, ['id', 'class', 'rect', 'source'], label)
  return {
    id: maskId(required(record, 'id', label), `${label}.id`),
    class: enumValue(required(record, 'class', label), MASK_CLASSES, `${label}.class`),
    rect: validateMaskRect(asRecord(required(record, 'rect', label), `${label}.rect`), `${label}.rect`),
    source: text(required(record, 'source', label), `${label}.source`),
  }
}

function validateTolerance(record: JsonRecord, label: string): ComparisonTolerance {
  assertKnownKeys(
    record,
    ['id', 'maxChannelDelta', 'maxChangedFraction', 'maxMeanAbsDifference', 'source'],
    label,
  )
  const maxChannelDelta = nonNegativeInteger(
    required(record, 'maxChannelDelta', label),
    `${label}.maxChannelDelta`,
  )
  if (maxChannelDelta > 255) {
    throw new Error(`${label}.maxChannelDelta must be at most 255`)
  }
  return {
    id: maskId(required(record, 'id', label), `${label}.id`),
    maxChannelDelta,
    maxChangedFraction: unitInterval(
      required(record, 'maxChangedFraction', label),
      `${label}.maxChangedFraction`,
    ),
    maxMeanAbsDifference: unitInterval(
      required(record, 'maxMeanAbsDifference', label),
      `${label}.maxMeanAbsDifference`,
    ),
    source: text(required(record, 'source', label), `${label}.source`),
  }
}

/**
 * Validates and normalizes a baseline-comparison declaration. Throws with a
 * descriptive message on the first contract violation. Masks are optional
 * (defaults to none) and tolerance is optional (the comparator then applies
 * its built-in strict default and names it in the report).
 */
export function validateComparisonDeclaration(input: unknown): BaselineComparisonDeclaration {
  const record = asRecord(input, 'baseline comparison declaration')
  assertKnownKeys(
    record,
    ['schemaVersion', 'surface', 'project', 'masks', 'tolerance'],
    'baseline comparison declaration',
  )

  const schemaVersion = required(record, 'schemaVersion', 'baseline comparison declaration')
  if (schemaVersion !== BASELINE_COMPARISON_SCHEMA_VERSION) {
    throw new Error(
      `baseline comparison declaration schemaVersion must be ${BASELINE_COMPARISON_SCHEMA_VERSION}`,
    )
  }
  const surface = required(record, 'surface', 'baseline comparison declaration')
  if (surface !== BASELINE_COMPARISON_SURFACE_ID) {
    throw new Error(
      `baseline comparison declaration surface must be ${BASELINE_COMPARISON_SURFACE_ID}`,
    )
  }

  const masksInput = required(record, 'masks', 'baseline comparison declaration')
  if (!Array.isArray(masksInput)) {
    throw new Error('baseline comparison declaration masks must be an array')
  }
  const masks: ComparisonMask[] = []
  const maskIds = new Set<string>()
  for (const item of masksInput) {
    const mask = validateMask(asRecord(item, 'masks[]'), 'masks[]')
    if (maskIds.has(mask.id)) {
      throw new Error(`mask id ${mask.id} is declared more than once`)
    }
    maskIds.add(mask.id)
    masks.push(mask)
  }

  const tolerance =
    hasOwn(record, 'tolerance') && record.tolerance !== undefined
      ? validateTolerance(asRecord(record.tolerance, 'tolerance'), 'tolerance')
      : undefined

  const declaration: BaselineComparisonDeclaration = {
    schemaVersion: BASELINE_COMPARISON_SCHEMA_VERSION,
    surface: BASELINE_COMPARISON_SURFACE_ID,
    project: text(
      required(record, 'project', 'baseline comparison declaration'),
      'baseline comparison declaration.project',
    ),
    masks,
  }
  if (tolerance !== undefined) declaration.tolerance = tolerance
  return declaration
}
