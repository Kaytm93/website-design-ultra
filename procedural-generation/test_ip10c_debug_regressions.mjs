#!/usr/bin/env node
/**
 * IP-10C debug regressions — narrow, durable tests that capture the four
 * confirmed seams where the procedural-crystal live gate failed at commit
 * d065abf593384cc3335c016d6ac2835bc3ed2a63.
 *
 * Each test asserts the contract product-hero's working implementation
 * already keeps. The procedural-crystal fixture must match it. Failing any
 * one of these red-flags the corresponding regression that the live gate
 * observes at runtime.
 *
 * No browser launch, no live gate — these run in plain Node and exit
 * non-zero when the fixture's source deviates from the contract.
 *
 *  A. SSR attrs: app/layout.tsx stamps data-wdu-mode, data-wdu-station,
 *     data-wdu-motion on the document root from resolveRuntimeMode().
 *  B. Telemetry document schema: the in-process surface emits a document
 *     that the verifier's validateTelemetryDocument accepts. The
 *     procedural-crystal lib/immersive-telemetry.ts was gutted from the
 *     product-hero reference; this test fails until the schema is restored.
 *  C. Telemetry surface fields: surface.collect() returns a document with
 *     deviceProfile, budget, evidenceSource, capabilities, transferObservation
 *     and runtime.renderer/api — every field the verifier reads.
 *  D. Renderer reader: ClientCanvas (or SceneRuntime) wires a readRenderer
 *     into the telemetry surface so renderer.api / rendererInfo / counters
 *     are populated, not "none" / null.
 *  E. Scene clock tick: SceneRuntime advances the clock via useFrame priority
 *     -1 — without it, the stable-frame marker never reaches ready and
 *     data-wdu-ready="true" never sets (root cause of all 20 checkpoint
 *     timeouts in the live run).
 *  F. local Draco load: ProductModel uses DRACOLoader with
 *     setDecoderPath('/draco/') and the committed public/draco/ files are
 *     present.
 *
 * Exit code 0 means every IP-10C debug seam holds against the contract.
 */
'use strict'

import { strict as assert } from 'node:assert'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The repository root is derived from this file, never from one contributor's
// checkout: procedural-generation/ sits one level below the root.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PH = (rel) => resolve(REPO, 'tests/immersive/product-hero', rel)
const PC = (rel) => resolve(REPO, 'tests/immersive/procedural-crystal', rel)

const failures = []
function check_(name, fn) {
  try {
    fn()
    process.stdout.write(`  ok   ${name}\n`)
  } catch (error) {
    failures.push({ name, error })
    process.stdout.write(`  FAIL ${name}: ${error.message}\n`)
  }
}

// ----- A. SSR attrs in app/layout.tsx ---------------------------------------

const procLayout = readFileSync(PC('app/layout.tsx'), 'utf8')
const heroLayout = readFileSync(PH('app/layout.tsx'), 'utf8')

check_('A1: procedural-crystal layout imports resolveRuntimeMode from lib/runtime-config', () => {
  assert.match(
    procLayout,
    /from ['"]\.\.\/lib\/runtime-config/,
    'app/layout.tsx must import resolveRuntimeMode (or its renamed export)',
  )
})

check_('A2: procedural-crystal layout calls resolveRuntimeMode() to read mode/station/motion', () => {
  assert.match(
    procLayout,
    /resolveRuntimeMode\s*\(/,
    'app/layout.tsx must call resolveRuntimeMode to derive SSR attributes',
  )
})

check_('A3: procedural-crystal layout stamps data-wdu-mode / station / motion onto <html>', () => {
  for (const attr of ['data-wdu-mode', 'data-wdu-station', 'data-wdu-motion']) {
    assert.match(
      procLayout,
      new RegExp(attr.replace('-', String.raw`\-`)),
      `app/layout.tsx must stamp ${attr} on the root <html>`,
    )
  }
})

// ----- B. Telemetry document schema (immersive-telemetry.ts) ---------------

const procTelem = readFileSync(PC('lib/immersive-telemetry.ts'), 'utf8')
const heroTelem = readFileSync(PH('lib/immersive-telemetry.ts'), 'utf8')

check_('B1: procedural-crystal immersive-telemetry.ts is not a gutted rewrite', () => {
  // The reference validator and the full schema must be present. The
  // procedural-crystal fixture at d065abf had 118 lines vs the 784-line
  // product-hero reference; that's the smoking gun for the
  // "invalid telemetry document" reason the live gate reported.
  const procLines = procTelem.split('\n').length
  const heroLines = heroTelem.split('\n').length
  assert.ok(
    procLines > 400,
    `procedural-crystal immersive-telemetry.ts has ${procLines} lines, must approach the product-hero reference (${heroLines} lines) so the schema is intact`,
  )
})

check_('B2: validateTelemetryDocument enforces top-level deviceProfile and budget', () => {
  assert.match(
    procTelem,
    /telemetry document.*\bdeviceProfile\b/is,
    'validateTelemetryDocument must assert deviceProfile',
  )
  assert.match(
    procTelem,
    /telemetry document.*\bbudget\b/is,
    'validateTelemetryDocument must assert budget',
  )
})

check_('B3: validateTelemetryDocument asserts the runtime frame substructure', () => {
  assert.match(procTelem, /warmGpu/i, 'must validate runtime.frame.warmGpu')
  assert.match(procTelem, /firstMeaningfulFrame/i, 'must validate firstMeaningfulFrame')
  assert.match(procTelem, /longFrameCount/i, 'must validate longFrameCount')
})

// ----- C. Telemetry surface fields -----------------------------------------

const procSurface = readFileSync(PC('lib/telemetry-surface.ts'), 'utf8')
const heroSurface = readFileSync(PH('lib/telemetry-surface.ts'), 'utf8')

check_('C1: surface.snapshot() includes top-level deviceProfile', () => {
  // The verifier (website-design-ultra/scripts/verify-browser.mjs) requires
  // document.deviceProfile with id/class/browser/renderer/viewport.
  assert.match(
    procSurface,
    /deviceProfile:/,
    'snapshot() must emit a top-level deviceProfile field — the verifier rejects documents without it',
  )
})

check_('C2: budget declaration (consumed by surface.snapshot) declares all three gate classes', () => {
  // The gate class strings are declared in budget-declaration.ts (consumed
  // by telemetry-surface.ts through BUDGET_DECLARATION.gates). The verifier
  // reads each gate's class to drive the comparison evaluation, so the
  // surface must emit them. Look across both files since the split is the
  // product-hero reference layout.
  const combined = procSurface + '\n' + readFileSync(PC('lib/budget-declaration.ts'), 'utf8')
  for (const gateClass of [
    'warm-gpu-frame-time',
    'first-meaningful-frame',
    'transfer-before-first-meaningful-frame',
  ]) {
    assert.match(
      combined,
      new RegExp(gateClass),
      `the three-gate declaration must include ${gateClass}`,
    )
  }
})

check_('C3: surface exposes rendererInfo() through the collect() handle', () => {
  // The verifier (verify-browser.mjs) reads evidence.rendererInfo and
  // collection.{warmupFrames,sampleWindow,status} off the document, so the
  // surface must publish them via its collect() return shape and its
  // rendererInfo() method. product-hero's surface wires them through
  // buildDocument() / collect() — the procedural-crystal surface must too.
  // (evidenceSource and transferObservation are added by verify-browser.mjs
  // when it writes performance-summary.json; those fields are not part of
  // the runtime surface contract.)
  const combined =
    procSurface +
    '\n' +
    readFileSync(PC('lib/immersive-telemetry.ts'), 'utf8')
  assert.match(
    combined,
    /\brendererInfo\b/,
    'surface must expose a rendererInfo() method the verifier calls',
  )
  assert.match(
    combined,
    /\bcollect\s*\(/,
    'surface must expose a collect() method that returns {document, rendererInfo}',
  )
})

check_('C4: surface is not a 165-line rewrite (must approach product-hero size)', () => {
  const procLines = procSurface.split('\n').length
  const heroLines = heroSurface.split('\n').length
  assert.ok(
    procLines > heroLines * 0.6,
    `procedural-crystal telemetry-surface.ts has ${procLines} lines, must be >60% of the ${heroLines}-line product-hero reference`,
  )
})

// ----- D. Renderer reader wiring in SceneRuntime ----------------------------

const procSceneCanvas = readFileSync(PC('components/SceneCanvas.tsx'), 'utf8')

check_('D1: SceneCanvas wires SceneRuntime (which provides the renderer reader)', () => {
  // The renderer reader is wired inside SceneRuntime.tsx via useThree →
  // gl.info → RendererCounters, and the surface receives it via readRenderer
  // (not null). Verify SceneCanvas wraps its children in SceneRuntime, the
  // pattern that owns the readRenderer hookup.
  assert.match(
    procSceneCanvas,
    /<SceneRuntime\b/,
    'SceneCanvas must wrap its scene content in <SceneRuntime> — that wrapper owns the renderer reader',
  )
  // And the legacy stub (readRenderer: null in ClientCanvas) is gone.
  assert.ok(
    !existsSync(PC('components/ClientCanvas.tsx')),
    'the legacy ClientCanvas (which passed readRenderer: null) must be removed; the unified SceneCanvas+SceneRuntime path is the single owner',
  )
})

// ----- E. Scene clock advances via useFrame at priority -1 ------------------

const procSceneRuntime = readFileSync(PC('components/SceneRuntime.tsx'), 'utf8')

check_('E1: SceneRuntime advances the scene clock via useFrame priority -1', () => {
  // Without the priority -1 subscriber the stable-frame marker never reaches
  // ready and data-wdu-ready="true" never sets, which is the root cause of
  // all 20 checkpoint timeouts in the live run.
  assert.match(
    procSceneRuntime,
    /useFrame\s*\(/,
    'SceneRuntime must use useFrame to advance the scene clock and re-evaluate the stable-frame marker',
  )
  assert.match(
    procSceneRuntime,
    /-1\s*\)/,
    'the frame tick must be at priority -1 (clock tick runs before any priority-0 consumer)',
  )
})

check_('E2: SceneRuntime publishes __WDU_IMMERSIVE_TELEMETRY__ with read/collect/rendererInfo', () => {
  assert.match(
    procSceneRuntime,
    /__WDU_IMMERSIVE_TELEMETRY__/,
    'SceneRuntime must publish the telemetry handle that the verifier drives',
  )
  assert.match(procSceneRuntime, /\bcollect\s*\(/, 'the handle must expose collect()')
  assert.match(procSceneRuntime, /\brendererInfo\s*\(/, 'the handle must expose rendererInfo()')
})

// ----- F. Local Draco load --------------------------------------------------

check_('F1: ProductModel uses DRACOLoader with setDecoderPath(\'/draco/\')', () => {
  const procModel = readFileSync(PC('components/ProductModel.tsx'), 'utf8')
  assert.match(procModel, /DRACOLoader/, 'ProductModel must import DRACOLoader')
  assert.match(
    procModel,
    /setDecoderPath\s*\(\s*['"]\/draco\/['"]\s*\)/,
    'ProductModel must wire the decoder to /draco/ (committed local files)',
  )
})

check_('F2: committed /draco/ decoder files exist under public/', () => {
  for (const name of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
    const path = PC(`public/draco/${name}`)
    assert.ok(existsSync(path), `missing committed decoder file ${path}`)
  }
})

// ----- Summary -------------------------------------------------------------

if (failures.length > 0) {
  process.stdout.write(
    `\nIP-10C DEBUG RED: ${failures.length} contract violation(s) at procedural-crystal/\n`,
  )
  for (const { name, error } of failures) {
    process.stdout.write(`  - ${name}\n      ${error.message}\n`)
  }
  process.exit(1)
}
process.stdout.write('\nIP10C_DEBUG_REGRESSIONS_GREEN\n')