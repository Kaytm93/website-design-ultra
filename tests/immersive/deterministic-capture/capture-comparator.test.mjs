import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  CaptureMismatchError,
  comparePngBytes,
  readPngDimensions,
  requireCleanSourceState,
  validateExpectedMetadata,
} from './compare-captures.mjs'
import { buildFixtureHtml } from './capture.mjs'

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lU9Z7wAAAABJRU5ErkJggg==',
  'base64',
)
const blackPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==',
  'base64',
)
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url))
const captureFiles = [
  'references/determinism-runtime.ts',
  'tests/immersive/deterministic-capture/capture.mjs',
  'tests/immersive/deterministic-capture/compare-captures.mjs',
  'tests/immersive/deterministic-capture/expected-metadata.json',
  'tests/immersive/deterministic-capture/fixture.html',
]

function runGit(repository, args) {
  const result = spawnSync('git', args, { cwd: repository, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout.trim()
}

function createIsolatedCaptureRepository(temporaryRoot) {
  const repository = path.join(temporaryRoot, 'repository')
  for (const relativePath of captureFiles) {
    const source = path.join(repositoryRoot, relativePath)
    const target = path.join(repository, relativePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(source, target)
  }
  runGit(repository, ['init', '--quiet'])
  runGit(repository, ['config', 'user.email', 'capture-test@example.invalid'])
  runGit(repository, ['config', 'user.name', 'Capture Test'])
  runGit(repository, ['add', '.'])
  runGit(repository, ['commit', '--quiet', '-m', 'capture fixture'])
  return repository
}

function writeFakePlaywright(temporaryRoot, screenshotFailure = null) {
  const executable = path.join(temporaryRoot, 'fake-playwright.mjs')
  fs.writeFileSync(
    executable,
    `#!/usr/bin/env node
import fs from 'node:fs'
const screenshotFailure = ${JSON.stringify(screenshotFailure)}
if (process.argv[2] === '--version') {
  console.log('Version 1.62.1')
} else if (screenshotFailure) {
  console.error(screenshotFailure)
  process.exitCode = 1
} else {
  const png = Buffer.alloc(24)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png)
  png.write('IHDR', 12, 'ascii')
  png.writeUInt32BE(320, 16)
  png.writeUInt32BE(240, 20)
  fs.writeFileSync(process.argv.at(-1), png)
  if (process.env.WDU_FAKE_SCREENSHOT_MARKER) {
    fs.writeFileSync(process.env.WDU_FAKE_SCREENSHOT_MARKER, 'captured\\n')
  }
}
`,
    { mode: 0o755 },
  )
  return executable
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

test('the reusable source-state check rejects tracked and untracked changes', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wdu-deterministic-source-state-'),
  )
  try {
    const repository = createIsolatedCaptureRepository(temporaryRoot)
    const expectedCommit = runGit(repository, ['rev-parse', 'HEAD'])
    assert.equal(
      requireCleanSourceState(repository, 'clean checkpoint'),
      expectedCommit,
    )

    fs.appendFileSync(
      path.join(repository, 'references/determinism-runtime.ts'),
      '\n// tracked change\n',
    )
    assert.throws(
      () => requireCleanSourceState(repository, 'tracked checkpoint'),
      /tracked checkpoint requires a clean source tree[\s\S]*references\/determinism-runtime\.ts/,
    )

    runGit(repository, ['checkout', '--', '.'])
    fs.writeFileSync(path.join(repository, 'untracked-source.txt'), 'untracked\n')
    assert.throws(
      () => requireCleanSourceState(repository, 'untracked checkpoint'),
      /untracked checkpoint requires a clean source tree[\s\S]*untracked-source\.txt/,
    )
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true })
  }
})

test('a PNG byte mismatch reports both hashes and keeps the gate red', () => {
  assert.throws(
    () => comparePngBytes(transparentPng, blackPng),
    (error) => {
      assert.ok(error instanceof CaptureMismatchError)
      assert.match(error.message, new RegExp(`run-1 sha256=${sha256(transparentPng)}`))
      assert.match(error.message, new RegExp(`run-2 sha256=${sha256(blackPng)}`))
      return true
    },
  )
})

test('PNG dimensions are read from the captured bytes', () => {
  assert.deepEqual(readPngDimensions(transparentPng), { width: 1, height: 1 })
})

test('the comparator CLI exits red and prints both mismatched hashes', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wdu-deterministic-mismatch-'),
  )
  try {
    const first = path.join(temporaryRoot, 'first.png')
    const second = path.join(temporaryRoot, 'second.png')
    fs.writeFileSync(first, transparentPng)
    fs.writeFileSync(second, blackPng)
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./compare-captures.mjs', import.meta.url)),
        '--compare-files',
        first,
        second,
      ],
      { encoding: 'utf8' },
    )

    assert.equal(result.status, 1, result.stderr || result.stdout)
    const output = `${result.stdout}\n${result.stderr}`
    assert.match(output, /DETERMINISTIC_CAPTURE: FAIL/)
    assert.match(output, new RegExp(`run-1 sha256=${sha256(transparentPng)}`))
    assert.match(output, new RegExp(`run-2 sha256=${sha256(blackPng)}`))
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true })
  }
})

test('committed metadata binds the exact declared device profile', () => {
  const metadata = JSON.parse(
    fs.readFileSync(new URL('./expected-metadata.json', import.meta.url), 'utf8'),
  )
  const validated = validateExpectedMetadata(metadata)

  assert.equal(validated.deviceProfileSha256, metadata.deviceProfileSha256)
  assert.equal(metadata.acceptance, 'byte-identical-png-bytes')
  assert.equal(metadata.deterministicRuntime.modeInput, 'WDU_DETERMINISTIC=1')
  assert.equal(metadata.deviceProfile.playwrightVersion, '1.62.1')

  const tampered = structuredClone(metadata)
  tampered.deviceProfile.viewport.width += 1
  assert.throws(
    () => validateExpectedMetadata(tampered),
    /device profile hash mismatch: expected [a-f0-9]{64}; actual [a-f0-9]{64}/,
  )
})

test('a missing browser command reports UNAVAILABLE with exit code 2', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wdu-deterministic-unavailable-'),
  )
  try {
    const repository = createIsolatedCaptureRepository(temporaryRoot)
    const result = spawnSync(
      process.execPath,
      [
        fs.realpathSync(
          path.join(
            repository,
            'tests/immersive/deterministic-capture/capture.mjs',
          ),
        ),
        '--out',
        path.join(temporaryRoot, 'capture'),
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          WDU_DETERMINISTIC: '1',
          WDU_PLAYWRIGHT_CLI: path.join(temporaryRoot, 'missing-playwright'),
        },
      },
    )

    assert.equal(result.status, 2, result.stderr || result.stdout)
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /DETERMINISTIC_CAPTURE: UNAVAILABLE/,
    )
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true })
  }
})

test('bundled-browser unavailability removes the generated fixture directory', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wdu-deterministic-cleanup-'),
  )
  try {
    const repository = createIsolatedCaptureRepository(temporaryRoot)
    const isolatedTmp = path.join(temporaryRoot, 'tmp')
    fs.mkdirSync(isolatedTmp)
    const result = spawnSync(
      process.execPath,
      [
        fs.realpathSync(
          path.join(
            repository,
            'tests/immersive/deterministic-capture/capture.mjs',
          ),
        ),
        '--out',
        path.join(temporaryRoot, 'capture'),
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          TMPDIR: isolatedTmp,
          WDU_DETERMINISTIC: '1',
          WDU_PLAYWRIGHT_CLI: writeFakePlaywright(
            temporaryRoot,
            "Executable doesn't exist; run playwright install chromium",
          ),
        },
      },
    )

    const captureOutput = `${result.stdout}\n${result.stderr}`
    assert.equal(
      result.status,
      2,
      JSON.stringify({
        error: result.error?.message,
        status: result.status,
        output: captureOutput,
      }),
    )
    assert.match(
      captureOutput,
      /DETERMINISTIC_CAPTURE: UNAVAILABLE bundled Chromium unavailable/,
    )
    assert.deepEqual(
      fs
        .readdirSync(isolatedTmp)
        .filter((name) => name.startsWith('wdu-deterministic-capture-')),
      [],
    )
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true })
  }
})

test('standalone capture refuses an untracked source before writing metadata', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wdu-deterministic-dirty-capture-'),
  )
  try {
    const repository = createIsolatedCaptureRepository(temporaryRoot)
    fs.writeFileSync(path.join(repository, 'untracked-source.txt'), 'dirty\n')
    const captureDirectory = path.join(temporaryRoot, 'capture')
    const screenshotMarker = path.join(temporaryRoot, 'screenshot-ran')
    const result = spawnSync(
      process.execPath,
      [
        fs.realpathSync(
          path.join(
            repository,
            'tests/immersive/deterministic-capture/capture.mjs',
          ),
        ),
        '--out',
        captureDirectory,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          WDU_DETERMINISTIC: '1',
          WDU_FAKE_SCREENSHOT_MARKER: screenshotMarker,
          WDU_PLAYWRIGHT_CLI: writeFakePlaywright(temporaryRoot),
        },
      },
    )

    const output = `${result.stdout}\n${result.stderr}`
    assert.equal(result.status, 1, output)
    assert.match(
      output,
      /DETERMINISTIC_CAPTURE: FAIL before standalone capture requires a clean source tree:[\s\S]*untracked-source\.txt/,
    )
    assert.equal(fs.existsSync(screenshotMarker), false)
    assert.equal(fs.existsSync(path.join(captureDirectory, 'capture.json')), false)
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true })
  }
})

test('standalone capture rejects source changes made during the screenshot', () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wdu-deterministic-mutated-capture-'),
  )
  try {
    const repository = createIsolatedCaptureRepository(temporaryRoot)
    const captureDirectory = path.join(temporaryRoot, 'capture')
    const mutationPath = path.join(repository, 'changed-during-capture.txt')
    const result = spawnSync(
      process.execPath,
      [
        fs.realpathSync(
          path.join(
            repository,
            'tests/immersive/deterministic-capture/capture.mjs',
          ),
        ),
        '--out',
        captureDirectory,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          WDU_DETERMINISTIC: '1',
          WDU_FAKE_SCREENSHOT_MARKER: mutationPath,
          WDU_PLAYWRIGHT_CLI: writeFakePlaywright(temporaryRoot),
        },
      },
    )

    const output = `${result.stdout}\n${result.stderr}`
    assert.equal(result.status, 1, output)
    assert.match(
      output,
      /DETERMINISTIC_CAPTURE: FAIL after standalone capture requires a clean source tree:[\s\S]*changed-during-capture\.txt/,
    )
    assert.equal(fs.existsSync(mutationPath), true)
    assert.equal(fs.existsSync(path.join(captureDirectory, 'capture.json')), false)
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true })
  }
})

test('the browser fixture embeds the copyable runtime and declared capture contract', () => {
  const expected = validateExpectedMetadata(
    JSON.parse(
      fs.readFileSync(new URL('./expected-metadata.json', import.meta.url), 'utf8'),
    ),
  )
  const html = buildFixtureHtml({
    expected,
    runtimeSource: fs.readFileSync(
      new URL('../../../references/determinism-runtime.ts', import.meta.url),
      'utf8',
    ),
    template: fs.readFileSync(new URL('./fixture.html', import.meta.url), 'utf8'),
  })

  assert.doesNotMatch(
    html,
    /__WDU_RUNTIME__|__WDU_EXPECTED_JSON__|__WDU_MODE_INPUT_JSON__/,
  )
  assert.doesNotMatch(html, /export interface SceneClock/)
  assert.match(html, /function createClock/)
  assert.match(html, /createStableFrameMarker/)
  assert.match(html, /WDU_DETERMINISTIC=1/)
  assert.match(html, /ip-02c-minimal-canvas-v1/)
  assert.match(html, /data-capture-root/)
})

test('CI installs the pinned browser and runs the deterministic gate', () => {
  const workflow = fs.readFileSync(
    new URL('../../../.github/workflows/validate.yml', import.meta.url),
    'utf8',
  )

  assert.match(workflow, /deterministic-capture:/)
  assert.match(
    workflow,
    /playwright@1\.62\.1 playwright install --with-deps chromium/,
  )
  assert.match(
    workflow,
    /node --test tests\/immersive\/deterministic-capture\/capture-comparator\.test\.mjs/,
  )
  assert.match(
    workflow,
    /node tests\/immersive\/deterministic-capture\/compare-captures\.mjs/,
  )
  const expectedActionPins = new Map([
    [
      'actions/checkout',
      {
        revision: 'd23441a48e516b6c34aea4fa41551a30e30af803',
        version: 'v6.1.0',
        occurrences: 7,
      },
    ],
    [
      'actions/setup-node',
      {
        revision: '249970729cb0ef3589644e2896645e5dc5ba9c38',
        version: 'v6.5.0',
        occurrences: 7,
      },
    ],
    [
      'actions/cache',
      {
        revision: '55cc8345863c7cc4c66a329aec7e433d2d1c52a9',
        version: 'v6.1.0',
        occurrences: 1,
      },
    ],
    [
      'actions/upload-artifact',
      {
        revision: 'ea165f8d65b6e75b540449e92b4886f43607fa02',
        version: 'v4.6.2',
        occurrences: 2,
      },
    ],
  ])
  const actionUses = [
    ...workflow.matchAll(
      /^\s*(?:-\s+)?uses:\s+(actions\/[\w-]+)@([^\s#]+)\s+#\s+(v\d+\.\d+\.\d+)\s*$/gm,
    ),
  ].map((match) => ({ action: match[1], revision: match[2], version: match[3] }))

  assert.equal(actionUses.length, 17, 'every official action use must have a version comment')
  assert.doesNotMatch(workflow, /uses:\s+actions\/[\w-]+@v\d/)
  for (const [action, expectedPin] of expectedActionPins) {
    const uses = actionUses.filter((entry) => entry.action === action)
    assert.equal(uses.length, expectedPin.occurrences, `${action} occurrence count`)
    for (const use of uses) {
      assert.match(use.revision, /^[a-f0-9]{40}$/)
      assert.equal(use.revision, expectedPin.revision)
      assert.equal(use.version, expectedPin.version)
    }
  }
})
