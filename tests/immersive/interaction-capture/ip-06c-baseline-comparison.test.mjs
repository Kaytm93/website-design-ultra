import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  BASELINE_COMPARISON_SCHEMA_VERSION,
  BASELINE_COMPARISON_SURFACE_ID,
  DIFF_CLASSES,
  EVIDENCE_STATEMENT,
  MASK_CLASSES,
  validateComparisonDeclaration,
} from '../../../references/baseline-comparison.ts'
import {
  ComparisonUnavailableError,
  DEFAULT_TOLERANCE,
  compareCaptureSets,
  diffMetrics,
  encodePng,
  loadCaptureSet,
  readPngPixels,
} from './compare-baselines.mjs'

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, '../../..')
const SCHEMA_PATH = path.resolve(
  REPOSITORY_ROOT,
  'website-design-ultra/skills/core-rules/references/baseline-comparison.schema.json',
)
const FIXTURES = path.join(TEST_DIRECTORY, 'fixtures', 'baseline-comparison')
const COMPARATOR_PATH = path.join(TEST_DIRECTORY, 'compare-baselines.mjs')

function runCase(name, extra = {}) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-ip06c-test-'))
  const options = {
    baselineDirectory: path.join(FIXTURES, name, 'baseline'),
    candidateDirectory: path.join(FIXTURES, name, 'candidate'),
    out,
    ...extra,
  }
  const declarationPath = path.join(FIXTURES, name, 'comparison.json')
  if (fs.existsSync(declarationPath) && extra.declarationPath === undefined) {
    options.declarationPath = declarationPath
  }
  const result = compareCaptureSets(options)
  return {
    ...result,
    reportPath: path.join(out, 'comparison.json'),
    out,
  }
}

function runCli(args) {
  return spawnSync(
    process.execPath,
    [COMPARATOR_PATH, ...args],
    { encoding: 'utf8', timeout: 60_000 },
  )
}

/* ------------------------------------------------------------------ */
/* PNG codec                                                           */
/* ------------------------------------------------------------------ */

test('the PNG codec round-trips RGBA pixels', () => {
  const width = 7
  const height = 5
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = (i * 37) % 256
    rgba[i * 4 + 1] = (i * 91) % 256
    rgba[i * 4 + 2] = (i * 53) % 256
    rgba[i * 4 + 3] = 128 + ((i * 17) % 128)
  }
  const png = encodePng(width, height, rgba)
  const decoded = readPngPixels(png)
  assert.equal(decoded.width, width)
  assert.equal(decoded.height, height)
  assert.deepEqual(decoded.rgba, rgba)
})

test('the PNG codec refuses unsupported formats', () => {
  const png = encodePng(2, 2, Buffer.alloc(16, 0x80))
  assert.throws(() => readPngPixels(Buffer.from('not a png')), /not a PNG file/)

  // A 16-bit depth IHDR is refused.
  const broken = Buffer.from(png)
  broken[24] = 16 // bit depth byte inside IHDR data
  assert.throws(() => readPngPixels(broken), /bit depth 16/)
})

test('diffMetrics reports per-pixel evidence and builds the highlight buffer', () => {
  const width = 2
  const height = 2
  const one = Buffer.alloc(width * height * 4, 0x20)
  const other = Buffer.from(one)
  other[0] = 0xff // top-left pixel red channel changes
  const metrics = diffMetrics(one, other, width, height, 0)
  assert.equal(metrics.totalPixels, 4)
  assert.equal(metrics.changedPixels, 1)
  assert.equal(metrics.changedFraction, 0.25)
  assert.equal(metrics.maxChannelDelta, 0xdf)
  assert.ok(metrics.meanAbsDifference > 0)
  // The changed pixel is highlighted red; unchanged pixels are dimmed.
  assert.deepEqual([...metrics.highlight.subarray(0, 4)], [255, 0, 0, 255])
  assert.equal(metrics.highlight[4], Math.round(0x20 * 0.25))
})

/* ------------------------------------------------------------------ */
/* Comparison declaration                                              */
/* ------------------------------------------------------------------ */

test('the installed schema is versioned and matches the reference constants', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'))
  assert.equal(schema.$id, 'wdu://baseline-comparison/v1')
  assert.equal(schema.properties.schemaVersion.const, BASELINE_COMPARISON_SCHEMA_VERSION)
  assert.equal(schema.properties.surface.const, BASELINE_COMPARISON_SURFACE_ID)
  assert.deepEqual(schema.$defs.mask.properties.class.enum, [...MASK_CLASSES])
  assert.deepEqual(schema.$defs.tolerance.properties.maxChannelDelta.maximum, 255)
  assert.deepEqual(schema.$defs.tolerance.required, [
    'id',
    'maxChannelDelta',
    'maxChangedFraction',
    'maxMeanAbsDifference',
    'source',
  ])
  assert.deepEqual(schema.$defs.mask.required, ['id', 'class', 'rect', 'source'])
})

test('a valid declaration validates and normalizes', () => {
  const declaration = validateComparisonDeclaration({
    schemaVersion: 1,
    surface: 'wdu.baseline-comparison',
    project: 'ip-06c-fixture',
    masks: [
      {
        id: 'live-region',
        class: 'expected-dynamic-variation',
        rect: { x: 0, y: 0, width: 4, height: 4 },
        source: 'manifest entry hero-audio-enabled declares the region varies',
      },
    ],
    tolerance: {
      id: 'pixel-noise',
      maxChannelDelta: 12,
      maxChangedFraction: 0.001,
      maxMeanAbsDifference: 0.004,
      source: 'project capture contract',
    },
  })
  assert.equal(declaration.schemaVersion, 1)
  assert.equal(declaration.masks.length, 1)
  assert.equal(declaration.tolerance.maxChannelDelta, 12)
})

test('a declaration without masks or tolerance is valid (comparator defaults apply)', () => {
  const declaration = validateComparisonDeclaration({
    schemaVersion: 1,
    surface: 'wdu.baseline-comparison',
    project: 'ip-06c-fixture',
    masks: [],
  })
  assert.deepEqual(declaration.masks, [])
  assert.equal(declaration.tolerance, undefined)
})

test('invalid declarations are rejected', () => {
  const base = {
    schemaVersion: 1,
    surface: 'wdu.baseline-comparison',
    project: 'ip-06c-fixture',
    masks: [],
  }
  assert.throws(
    () => validateComparisonDeclaration({ ...base, surface: 'wdu.interaction-checkpoints' }),
    /surface must be wdu\.baseline-comparison/,
  )
  assert.throws(
    () => validateComparisonDeclaration({ ...base, schemaVersion: 2 }),
    /schemaVersion must be 1/,
  )
  assert.throws(
    () =>
      validateComparisonDeclaration({
        ...base,
        masks: [
          {
            id: 'bad-mask',
            class: 'aesthetic-verdict',
            rect: { x: 0, y: 0, width: 4, height: 4 },
            source: 'x',
          },
        ],
      }),
    /must be one of expected-dynamic-variation, nondeterministic-content/,
  )
  assert.throws(
    () =>
      validateComparisonDeclaration({
        ...base,
        masks: [
          {
            id: 'bad-mask',
            class: 'expected-dynamic-variation',
            rect: { x: -1, y: 0, width: 4, height: 4 },
            source: 'x',
          },
        ],
      }),
    /must be a non-negative integer/,
  )
  assert.throws(
    () =>
      validateComparisonDeclaration({
        ...base,
        masks: [
          {
            id: 'no-source',
            class: 'expected-dynamic-variation',
            rect: { x: 0, y: 0, width: 4, height: 4 },
          },
        ],
      }),
    /masks\[\]\.source is required/,
  )
  assert.throws(
    () =>
      validateComparisonDeclaration({
        ...base,
        masks: [
          {
            id: 'Bad-Id',
            class: 'expected-dynamic-variation',
            rect: { x: 0, y: 0, width: 4, height: 4 },
            source: 'x',
          },
        ],
      }),
    /must match/,
  )
  assert.throws(
    () =>
      validateComparisonDeclaration({
        ...base,
        tolerance: {
          id: 'bad-tolerance',
          maxChannelDelta: 256,
          maxChangedFraction: 0.5,
          maxMeanAbsDifference: 0.5,
          source: 'x',
        },
      }),
    /maxChannelDelta must be at most 255/,
  )
  assert.throws(
    () =>
      validateComparisonDeclaration({
        ...base,
        tolerance: {
          id: 'bad-tolerance',
          maxChannelDelta: 0,
          maxChangedFraction: 1.5,
          maxMeanAbsDifference: 0.5,
          source: 'x',
        },
      }),
    /must be a number in \[0, 1\]/,
  )
})

/* ------------------------------------------------------------------ */
/* The four classification buckets (fixtures for each class)          */
/* ------------------------------------------------------------------ */

test('perceptual fixture: a deterministic mismatch is a perceptual difference, never a dynamic bucket', () => {
  const { report, exitCode, out } = runCase('perceptual')
  assert.equal(report.status, 'FAIL')
  assert.equal(exitCode, 1)
  const entry = report.entries.find((item) => item.id === 'fixture-ready')
  assert.equal(entry.class, 'perceptual-difference')
  assert.equal(entry.withinTolerance, false)
  assert.equal(entry.mask, null)
  // The acceptance rule: deterministic mismatch is NOT routed into the
  // dynamic bucket — not expected dynamic variation, not nondeterministic
  // content — without a declared mask.
  assert.notEqual(entry.class, 'expected-dynamic-variation')
  assert.notEqual(entry.class, 'nondeterministic-content')
  assert.match(entry.reason, /deterministic mismatch outside every declared mask/)
  assert.ok(entry.score.changedPixels >= 1)
  assert.deepEqual(report.diffArtifacts, ['diff/fixture-ready.png'])
  assert.ok(fs.existsSync(path.join(out, 'diff', 'fixture-ready.png')))
})

test('perceptual within-tolerance fixture: the score is evidence, the tolerance decides the gate', () => {
  const { report, exitCode } = runCase('perceptual/within-tolerance')
  assert.equal(report.status, 'PASS')
  assert.equal(exitCode, 0)
  const entry = report.entries.find((item) => item.id === 'fixture-ready')
  assert.equal(entry.class, 'perceptual-difference')
  assert.equal(entry.withinTolerance, true)
  assert.equal(report.tolerancesApplied.id, 'fixture-noise')
  assert.match(report.tolerancesApplied.source, /comparison\.json/)
})

test('expected-dynamic-variation fixture: differences inside a declared mask are that mask class', () => {
  const { report, exitCode } = runCase('expected-dynamic-variation')
  assert.equal(report.status, 'PASS')
  assert.equal(exitCode, 0)
  const entry = report.entries.find((item) => item.id === 'fixture-ready')
  assert.equal(entry.class, 'expected-dynamic-variation')
  assert.equal(entry.mask.id, 'fixture-live-region')
  assert.equal(entry.mask.class, 'expected-dynamic-variation')
  assert.match(entry.mask.source, /region 0,0\.\.3,3 varies by design/)
  // The report names the applied mask and its source.
  assert.equal(report.masksApplied.length, 1)
  assert.equal(report.masksApplied[0].id, 'fixture-live-region')
  assert.match(report.masksApplied[0].source, /varies by design/)
})

test('nondeterministic-content/metadata fixture: the metadata itself records the nondeterminism', () => {
  const { report, exitCode } = runCase('nondeterministic-content/metadata')
  assert.equal(report.status, 'FAIL')
  assert.equal(exitCode, 1)
  const entry = report.entries.find((item) => item.id === 'fixture-ready')
  assert.equal(entry.class, 'nondeterministic-content')
  assert.equal(entry.mask, null)
  assert.match(entry.reason, /deterministic mode not resolved/)
  // An entry that did not resolve deterministic mode is flagged, not diffed.
  assert.equal(entry.score, null)
  assert.ok(report.unexpected.some((item) => item.id === 'fixture-ready'))
})

test('nondeterministic-content/mask fixture: a declared nondeterministic region is a named class', () => {
  const { report, exitCode } = runCase('nondeterministic-content/mask')
  assert.equal(report.status, 'PASS')
  assert.equal(exitCode, 0)
  const entry = report.entries.find((item) => item.id === 'fixture-ready')
  assert.equal(entry.class, 'nondeterministic-content')
  assert.equal(entry.mask.id, 'fixture-third-party-region')
  assert.match(entry.mask.source, /third-party content/)
})

test('structural fixtures: missing entries and viewport changes are structural regressions', () => {
  const missing = runCase('structural/missing-entry')
  assert.equal(missing.report.status, 'FAIL')
  assert.equal(missing.exitCode, 1)
  const missingEntry = missing.report.entries.find((item) => item.id === 'fixture-click')
  assert.equal(missingEntry.class, 'structural-regression')
  assert.match(missingEntry.reason, /missing from the candidate capture set/)
  const ready = missing.report.entries.find((item) => item.id === 'fixture-ready')
  assert.equal(ready.class, 'identical')

  const viewport = runCase('structural/viewport')
  assert.equal(viewport.report.status, 'FAIL')
  assert.equal(viewport.exitCode, 1)
  assert.deepEqual(viewport.report.structuralDifferences, [
    { field: 'viewport', baseline: '8x8', candidate: '9x8' },
  ])
  assert.ok(viewport.report.unexpected.some((item) => item.class === 'structural-regression'))
})

test('an identical pair is classified identical and passes', () => {
  const { report, exitCode } = runCase('perceptual', {
    candidateDirectory: path.join(FIXTURES, 'perceptual', 'baseline'),
    declarationPath: undefined,
  })
  assert.equal(report.status, 'PASS')
  assert.equal(exitCode, 0)
  const entry = report.entries.find((item) => item.id === 'fixture-ready')
  assert.equal(entry.class, 'identical')
  assert.deepEqual(report.diffArtifacts, [])
})

/* ------------------------------------------------------------------ */
/* Report contract                                                     */
/* ------------------------------------------------------------------ */

test('the report labels every score as evidence, never taste or approval', () => {
  const { report } = runCase('perceptual')
  assert.equal(report.statement, EVIDENCE_STATEMENT)
  assert.match(report.statement, /evidence of change/)
  assert.match(report.statement, /never an aesthetic verdict, taste, or approval/)
  assert.ok(!('verdict' in report) && !('approval' in report))
})

test('the report always names masks and tolerances with their source', () => {
  // With a declaration: the declared mask and tolerance are named.
  const declared = runCase('expected-dynamic-variation')
  assert.ok(declared.report.masksApplied.every((mask) => mask.source.length > 0))
  assert.ok(declared.report.tolerancesApplied.source.length > 0)

  // Without a declaration: the built-in strict default is named with its source.
  const strict = runCase('perceptual')
  assert.deepEqual(strict.report.masksApplied, [])
  assert.equal(strict.report.tolerancesApplied.id, DEFAULT_TOLERANCE.id)
  assert.equal(strict.report.tolerancesApplied.maxChannelDelta, 0)
  assert.equal(strict.report.tolerancesApplied.maxChangedFraction, 0)
  assert.equal(strict.report.tolerancesApplied.maxMeanAbsDifference, 0)
  assert.match(strict.report.tolerancesApplied.source, /built-in strict default/)
})

/* ------------------------------------------------------------------ */
/* Negative gates                                                      */
/* ------------------------------------------------------------------ */

test('comparison refuses to run without deterministic capture metadata', () => {
  // Candidate side is PNGs only: no checkpoints.json at all.
  const noMetadata = runCase('negative/no-metadata')
  assert.equal(noMetadata.report.status, 'UNAVAILABLE')
  assert.equal(noMetadata.exitCode, 2)
  assert.match(noMetadata.report.reason, /no deterministic capture metadata/)

  // Candidate side has checkpoints.json but does not request deterministic mode.
  const liveMode = runCase('negative/live-mode')
  assert.equal(liveMode.report.status, 'UNAVAILABLE')
  assert.equal(liveMode.exitCode, 2)
  assert.match(liveMode.report.reason, /does not request deterministic mode/)
})

test('the refusal is a distinct error class for callers', () => {
  assert.throws(
    () => loadCaptureSet(path.join(FIXTURES, 'negative', 'no-metadata', 'candidate'), 'candidate'),
    ComparisonUnavailableError,
  )
  assert.throws(
    () => loadCaptureSet(path.join(FIXTURES, 'negative', 'live-mode', 'candidate'), 'candidate'),
    /does not request deterministic mode/,
  )
  assert.throws(
    () => loadCaptureSet(path.join(FIXTURES, 'negative', 'no-metadata', 'candidate'), 'candidate'),
    /comparison refused/,
  )
})

test('the CLI exits 2 and writes a UNAVAILABLE report for an unsupported comparison', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-ip06c-cli-'))
  const result = runCli([
    '--baseline',
    path.join(FIXTURES, 'perceptual', 'baseline'),
    '--candidate',
    path.join(FIXTURES, 'negative', 'no-metadata', 'candidate'),
    '--out',
    out,
  ])
  assert.equal(result.status, 2)
  const report = JSON.parse(fs.readFileSync(path.join(out, 'comparison.json'), 'utf8'))
  assert.equal(report.status, 'UNAVAILABLE')
  assert.match(result.stdout, /evidence of change/)
})

test('the CLI exits 0 on a declared variation and prints the evidence statement', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-ip06c-cli-'))
  const result = runCli([
    '--baseline',
    path.join(FIXTURES, 'expected-dynamic-variation', 'baseline'),
    '--candidate',
    path.join(FIXTURES, 'expected-dynamic-variation', 'candidate'),
    '--declaration',
    path.join(FIXTURES, 'expected-dynamic-variation', 'comparison.json'),
    '--out',
    out,
  ])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /BASELINE_COMPARISON: PASS/)
  assert.match(result.stdout, /evidence of change/)
})

test('the four diff classes are exactly the classification vocabulary', () => {
  assert.deepEqual([...DIFF_CLASSES], [
    'identical',
    'structural-regression',
    'perceptual-difference',
    'expected-dynamic-variation',
    'nondeterministic-content',
  ])
  assert.deepEqual([...MASK_CLASSES], ['expected-dynamic-variation', 'nondeterministic-content'])
})
