import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { exportFigmaArtifacts } from '../../../automation/reference-intake/export-figma-rest.mjs'
import { validateReferenceIntake } from '../../../automation/reference-intake/validate-reference-intake.mjs'

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, '../../..')
const AUTOMATION_DIRECTORY = path.join(REPOSITORY_ROOT, 'automation', 'reference-intake')
const FIXTURES = path.join(TEST_DIRECTORY, 'fixtures')
const VALID_FIXTURE = path.join(FIXTURES, 'reference-intake.valid.json')

test('a complete PNG/SVG intake validates entirely offline', () => {
  const report = validateReferenceIntake(VALID_FIXTURE)

  assert.equal(report.status, 'PASS')
  assert.equal(report.schemaVersion, 'wdu-reference-intake/v1')
  assert.equal(report.frameCount, 6)
  assert.deepEqual(report.formats, ['png', 'svg'])
  assert.deepEqual(report.unknownFields, [
    'camera.fov',
    'camera.position',
    'camera.target',
    'camera.near-far',
    'color-output',
    'tone-mapping',
    'spatial-type',
  ])
  assert.equal(report.sceneCodeStatus, 'ready-for-3d-art-direction')
})

test('a direction name or token path cannot stand in for frame evidence', () => {
  assert.throws(
    () => validateReferenceIntake(
      path.join(FIXTURES, 'reference-intake.invalid-token-citation.json'),
    ),
    /camera\.fov.*sourceFrame.*manifest frame id or unknown/i,
  )
})

test('a field without frame evidence must keep its value unknown', () => {
  assert.throws(
    () => validateReferenceIntake(
      path.join(FIXTURES, 'reference-intake.invalid-invented-value.json'),
    ),
    /camera\.fov.*value.*must remain unknown/i,
  )
})

test('an authentication credential key is rejected from offline artifacts', () => {
  assert.throws(
    () => validateReferenceIntake(
      path.join(FIXTURES, 'reference-intake.invalid-credential-key.json'),
    ),
    /writtenTokenBlock.*credential.*figmaAccessToken/i,
  )
})

test('the REST exporter rejects a credential-shaped value before any request', async () => {
  const inputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-figma-input-'))
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-figma-output-'))
  try {
    const config = JSON.parse(
      fs.readFileSync(path.join(FIXTURES, 'figma-export.config.json'), 'utf8'),
    )
    config.tokenBlock = 'tokens.json'
    fs.writeFileSync(
      path.join(inputDirectory, 'config.json'),
      `${JSON.stringify(config, null, 2)}\n`,
    )
    fs.writeFileSync(
      path.join(inputDirectory, 'tokens.json'),
      `${JSON.stringify({
        directionName: 'Measured graphite',
        grid: '12 columns',
        color: 'graphite',
        typography: 'neutral grotesk',
        spacing: '8px base',
        motion: 'slow settle',
        mustPreserve: [],
        mustAvoid: [],
        note: ['figd', '_', 'x'.repeat(24)].join(''),
      }, null, 2)}\n`,
    )
    await assert.rejects(
      exportFigmaArtifacts({
        configPath: path.join(inputDirectory, 'config.json'),
        outputDirectory,
        token: 'test-only-credential',
        fetchImpl: async () => {
          throw new Error('network should not start')
        },
      }),
      /tokenBlock.*credential-shaped value/i,
    )
  } finally {
    fs.rmSync(inputDirectory, { force: true, recursive: true })
    fs.rmSync(outputDirectory, { force: true, recursive: true })
  }
})

test('six ids cannot disguise one exported frame as two distinct references', () => {
  assert.throws(
    () => validateReferenceIntake(
      path.join(FIXTURES, 'reference-intake.invalid-duplicate-export.json'),
    ),
    /frame-06.*same artifact.*frame-02/i,
  )
})

test('an unresolved contradiction keeps the affected trace field unknown', () => {
  assert.throws(
    () => validateReferenceIntake(
      path.join(FIXTURES, 'reference-intake.invalid-hidden-contradiction.json'),
    ),
    /contradictions\[0\].*lighting.*must remain unknown/i,
  )
})

test('a ready handoff cannot hide an unknown poster-target field', () => {
  assert.throws(
    () => validateReferenceIntake(
      path.join(FIXTURES, 'reference-intake.invalid-incomplete-poster.json'),
    ),
    /posterTarget\.tonalRange.*cannot be unknown/i,
  )
})

test('the optional Figma REST path writes only offline artifacts and never persists auth', async () => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-figma-export-'))
  const auth = ['test', 'only', 'credential'].join('-')
  const calls = []
  const assetDirectory = path.join(FIXTURES, 'assets')

  const fakeFetch = async (input, options = {}) => {
    const url = new URL(input)
    calls.push({ url: url.href, headers: options.headers ?? {} })
    if (url.hostname === 'api.figma.com' && url.pathname.includes('/nodes')) {
      const nodes = Object.fromEntries(
        url.searchParams.get('ids').split(',').map((nodeId) => [
          nodeId,
          { document: { id: nodeId, name: `Fixture ${nodeId}`, type: 'FRAME' } },
        ]),
      )
      return new Response(JSON.stringify({ nodes }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url.hostname === 'api.figma.com' && url.pathname.includes('/images/')) {
      const format = url.searchParams.get('format')
      const images = Object.fromEntries(
        url.searchParams.get('ids').split(',').map((nodeId) => {
          const index = Number(nodeId.split(':')[1])
          return [nodeId, `https://downloads.invalid/frame-${String(index).padStart(2, '0')}.${format}`]
        }),
      )
      return new Response(JSON.stringify({ images }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url.hostname === 'downloads.invalid') {
      return new Response(fs.readFileSync(path.join(assetDirectory, path.basename(url.pathname))), {
        status: 200,
      })
    }
    return new Response('not found', { status: 404 })
  }

  try {
    const report = await exportFigmaArtifacts({
      configPath: path.join(FIXTURES, 'figma-export.config.json'),
      outputDirectory,
      token: auth,
      fetchImpl: fakeFetch,
    })
    assert.equal(report.frameCount, 6)
    assert.deepEqual(report.formats, ['png', 'svg'])
    assert.equal(report.manifest, 'figma-export-manifest.json')

    const manifestSource = fs.readFileSync(
      path.join(outputDirectory, report.manifest),
      'utf8',
    )
    const manifest = JSON.parse(manifestSource)
    assert.equal(manifest.schemaVersion, 'wdu-figma-export/v1')
    assert.equal(manifest.frames.length, 6)
    assert.equal(manifest.writtenTokenBlock.file, 'tokens.json')
    assert.equal(manifestSource.includes(auth), false)
    assert.equal(
      fs.readFileSync(path.join(outputDirectory, 'tokens.json'), 'utf8'),
      fs.readFileSync(path.join(FIXTURES, 'tokens.json'), 'utf8'),
    )

    const apiCalls = calls.filter((call) => call.url.startsWith('https://api.figma.com/'))
    const downloadCalls = calls.filter((call) => call.url.startsWith('https://downloads.invalid/'))
    assert.equal(apiCalls.length, 3)
    assert.equal(apiCalls.every((call) => call.headers['X-Figma-Token'] === auth), true)
    assert.equal(downloadCalls.length, 6)
    assert.equal(downloadCalls.every((call) => !('X-Figma-Token' in call.headers)), true)
  } finally {
    fs.rmSync(outputDirectory, { force: true, recursive: true })
  }
})

test('instructions keep offline exports required and Figma REST optional', () => {
  const instructions = fs.readFileSync(path.join(AUTOMATION_DIRECTORY, 'README.md'), 'utf8')
  for (const marker of [
    'Required offline path',
    'six to ten',
    'PNG',
    'SVG',
    'written token block',
    'optional acceleration',
    'file_content:read',
    '90 days',
    'paid seat',
    'Dev Mode',
    'MCP',
    'browser login',
    'live Figma session',
    'FIGMA_ACCESS_TOKEN',
    'Never commit',
  ]) {
    assert.equal(instructions.includes(marker), true, marker)
  }
})
