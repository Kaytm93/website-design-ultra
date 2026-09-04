import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('the optimized model exists, is small, and is the manifest-declared asset', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'lib', 'asset-manifest.json'), 'utf8'))
  const model = manifest.assets.find((asset) => asset.id === 'crystal-model')
  assert.ok(model, 'the manifest declares the model asset')

  const glbPath = join(root, 'public', model.url.replace(/^\//, ''))
  assert.ok(existsSync(glbPath), `model file must exist at ${model.url}`)
  const bytes = statSync(glbPath).size
  assert.ok(bytes > 0 && bytes < 1_000_000, `model must be under 1 MB, got ${bytes} bytes`)
})

test('the committed pipeline summary proves the documented pipeline ran', () => {
  const summaryPath = join(root, 'reports', 'model', 'summary.json')
  assert.ok(existsSync(summaryPath), 'reports/model/summary.json must be committed')
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))

  assert.equal(summary.acceptance, 'ip-10c-optimized-procedural-crystal')
  assert.equal(summary.validate.pre, 'PASS')
  assert.equal(summary.validate.post, 'PASS')
  assert.ok(summary.optimized.extensionsUsed.includes('KHR_draco_mesh_compression'), 'optimized GLB must declare Draco')
  assert.ok(summary.optimized.bytes > 0)
  assert.ok(summary.optimized.sha256.match(/^[0-9a-f]{64}$/), 'optimized SHA256 must be hex')
  assert.equal(summary.optimize_invocations, 1, 'exactly one optimize invocation')
  assert.ok(summary.optimize_command.includes('--compress draco'))
  assert.ok(summary.optimize_command.includes('--texture-compress false'))
  // raw vs optimized transfer proof
  assert.ok(summary.raw.bytes > summary.optimized.bytes, 'Draco should shrink this asset')
})

test('the raw and optimized pre/post reports both exist and report PASS', () => {
  const preInspect = readFileSync(join(root, 'reports', 'model', 'pre-inspect.txt'), 'utf8')
  const postInspect = readFileSync(join(root, 'reports', 'model', 'post-inspect.txt'), 'utf8')
  assert.ok(preInspect.includes('Procedural__Crystal'), 'pre-inspect must name the input mesh')
  assert.ok(postInspect.includes('KHR_draco_mesh_compression'), 'post-inspect must declare Draco on optimized output')
  const preValidate = readFileSync(join(root, 'reports', 'model', 'pre-validate.log'), 'utf8')
  const postValidate = readFileSync(join(root, 'reports', 'model', 'post-validate.log'), 'utf8')
  assert.ok(preValidate.includes('No errors found'), 'pre-validate must report no errors')
  assert.ok(postValidate.includes('No errors found'), 'post-validate must report no errors')
})

test('committed pipeline reports are portable evidence (no host paths, no objc warnings, no stage timings, no trailing whitespace)', () => {
  // The sanitizer in scripts/build-model.mjs guarantees every committed
  // pipeline report file under reports/model/ is reproducible across
  // reruns on any host. These assertions double as a regression net: if a
  // future change drops the sanitizer, leaks a contributor path, or lets
  // nondeterministic timing tokens through, the contract fails here.
  const files = [
    'pre-inspect.txt',
    'pre-validate.log',
    'optimize.log',
    'post-inspect.txt',
    'post-validate.log',
  ]
  // Host path patterns the sanitizer must scrub:
  //   - /Users/<anything>      (macOS contributor home)
  //   - /home/<anything>       (Linux contributor home)
  //   - /private/<anything>    (macOS /private prefix on sensitive files)
  //   - Windows drive-letter absolute paths (C:\..., D:\..., ...)
  //   - the old `website-design-ultra-pr*` worktree marker that briefly
  //     leaked from a sibling checkout
  const hostPathPatterns = [
    /\/Users\//,
    /\/home\//,
    /\/private\//,
    /[A-Za-z]:\\/,
    /website-design-ultra-pr/,
  ]
  // Per-stage timing tokens like ` 5ms` or ` 1.25ms` at line ends.
  const timingToken = /\s+\d+(?:\.\d+)?ms[ \t]*$/
  const objcWarning = /^objc\[\d+\]: /
  const trailingWhitespace = /[ \t]+$/

  for (const file of files) {
    const path = join(root, 'reports', 'model', file)
    const text = readFileSync(path, 'utf8')
    const lines = text.split('\n')

    for (const pattern of hostPathPatterns) {
      const offender = lines.findIndex((line) => pattern.test(line))
      assert.equal(
        offender,
        -1,
        `${file}: line ${offender + 1} leaks a host path; the sanitizer must scrub PROJECT_ROOT and strip macOS objc warnings`,
      )
    }

    const objcLine = lines.findIndex((line) => objcWarning.test(line))
    assert.equal(
      objcLine,
      -1,
      `${file}: line ${objcLine + 1} carries an objc[PID] warning; the sanitizer must drop these`,
    )

    const timingLine = lines.findIndex((line) => timingToken.test(line))
    assert.equal(
      timingLine,
      -1,
      `${file}: line ${timingLine + 1} carries a raw stage timing token; the sanitizer must replace it with <timing omitted>`,
    )

    const trailingLine = lines.findIndex((line) => trailingWhitespace.test(line))
    assert.equal(
      trailingLine,
      -1,
      `${file}: line ${trailingLine + 1} has trailing whitespace; the sanitizer must strip it`,
    )

    assert.ok(
      text.endsWith('\n') && !text.endsWith('\n\n'),
      `${file}: must end with exactly one newline`,
    )
  }

  // The optimize.log specifically must contain the stable marker so the
  // sanitizer is actually exercised (not a no-op regex with no matchers).
  const optimizeLog = readFileSync(join(root, 'reports', 'model', 'optimize.log'), 'utf8')
  assert.ok(
    optimizeLog.includes('<timing omitted>'),
    'optimize.log must contain the stable <timing omitted> marker so the sanitizer is exercised',
  )
})

test('the summary budget is parsed from the optimized artifact, not the generator report', () => {
  const summary = JSON.parse(readFileSync(join(root, 'reports', 'model', 'summary.json'), 'utf8'))
  // Decoded stats must come from the optimized post-inspect (not the 30-mesh
  // raw generator count). The optimizer merges to 2 meshes / 2 materials /
  // 532 triangles — these are the OPTIMIZED readings.
  assert.equal(summary.optimized.meshes, 2, 'optimized must report 2 meshes')
  assert.equal(summary.optimized.materials, 2, 'optimized must report 2 materials')
  assert.equal(summary.optimized.triangles, 532, 'optimized must report 532 triangles')
  assert.notEqual(summary.raw.bytes, summary.optimized.bytes, 'raw and optimized byte sizes must differ')
})