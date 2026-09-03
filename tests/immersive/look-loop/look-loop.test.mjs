import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  TARGET_COMPARISON_SCHEMA_VERSION,
  TARGET_COMPARISON_SURFACE_ID,
  compareTargetFrame,
} from '../../../website-design-ultra/scripts/target-comparison.mjs'
import { encodePng, readPngPixels } from '../interaction-capture/compare-baselines.mjs'

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
)
const ART_DIRECTION = path.join(
  REPOSITORY_ROOT,
  'website-design-ultra/skills/3d-art-direction/SKILL.md',
)
const IMMERSIVE_COMMAND = path.join(REPOSITORY_ROOT, 'website-design-ultra/commands/immersive.md')
const VERIFIER = path.join(REPOSITORY_ROOT, 'website-design-ultra/scripts/verify-browser.mjs')
const FORWARD_CASES = path.join(REPOSITORY_ROOT, 'website-design-ultra/tests/forward/cases.json')
const FIXTURE_ROOT = path.join(
  REPOSITORY_ROOT,
  'tests/immersive/look-loop/fixtures',
)

function writePng(file, width, height, rgba) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, encodePng(width, height, rgba))
}

function posterPixels(width, height) {
  const pixels = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const subject = x > 8 && x < width - 9 && y > 4 && y < height - 5
      pixels[offset] = subject ? 137 : 16
      pixels[offset + 1] = subject ? 167 : 24
      pixels[offset + 2] = subject ? 177 : 32
      pixels[offset + 3] = 255
    }
  }
  return pixels
}

function shiftedLight(pixels, width, height) {
  const shifted = Buffer.from(pixels)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x < 6 || y < 6) continue
      const offset = (y * width + x) * 4
      shifted[offset] = Math.min(255, shifted[offset] + 38)
      shifted[offset + 1] = Math.max(0, shifted[offset + 1] - 22)
      shifted[offset + 2] = Math.max(0, shifted[offset + 2] - 14)
    }
  }
  return shifted
}

test('target comparison writes a report and diff PNG, and correction scores better than light shift', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-look-loop-'))
  const width = 24
  const height = 16
  const target = posterPixels(width, height)
  const shifted = shiftedLight(target, width, height)
  const targetPath = path.join(root, 'poster-target.png')
  const shiftedPath = path.join(root, 'live-light-shifted.png')
  const correctedPath = path.join(root, 'live-corrected.png')
  writePng(targetPath, width, height, target)
  writePng(shiftedPath, width, height, shifted)
  writePng(correctedPath, width, height, target)

  const worse = compareTargetFrame({
    targetPath,
    liveFramePath: shiftedPath,
    out: path.join(root, 'iteration-01-light-shift'),
    iteration: 'light-shift',
  })
  const better = compareTargetFrame({
    targetPath,
    liveFramePath: correctedPath,
    out: path.join(root, 'iteration-02-corrected-light'),
    iteration: 'corrected-light',
  })

  assert.equal(worse.report.schemaVersion, TARGET_COMPARISON_SCHEMA_VERSION)
  assert.equal(worse.report.surface, TARGET_COMPARISON_SURFACE_ID)
  assert.equal(worse.report.status, 'FAIL')
  assert.equal(better.report.status, 'PASS')
  assert.ok(
    worse.report.comparison.meanAbsDifference > better.report.comparison.meanAbsDifference,
    'the shifted key light must score farther from the poster target',
  )
  assert.ok(
    worse.report.comparison.changedPixels > better.report.comparison.changedPixels,
    'the shifted key light must change more pixels than the correction',
  )
  assert.equal(worse.report.iteration, 'light-shift')
  assert.equal(better.report.iteration, 'corrected-light')
  assert.equal(worse.report.diffArtifact, 'target-diff.png')
  assert.equal(better.report.diffArtifact, 'target-diff.png')
  assert.ok(fs.existsSync(path.join(root, 'iteration-01-light-shift', 'target-comparison.json')))
  assert.ok(fs.existsSync(path.join(root, 'iteration-01-light-shift', 'target-diff.png')))
  assert.ok(fs.existsSync(path.join(root, 'iteration-02-corrected-light', 'target-comparison.json')))
  assert.ok(fs.existsSync(path.join(root, 'iteration-02-corrected-light', 'target-diff.png')))

  const diff = readPngPixels(
    fs.readFileSync(path.join(root, 'iteration-01-light-shift', 'target-diff.png')),
  )
  assert.equal(diff.width, width)
  assert.equal(diff.height, height)
})

test('the committed fixture records a worse light shift and a better correction', () => {
  const shifted = JSON.parse(
    fs.readFileSync(
      path.join(FIXTURE_ROOT, 'target-comparison.json'),
      'utf8',
    ),
  )
  const corrected = JSON.parse(
    fs.readFileSync(
      path.join(FIXTURE_ROOT, 'iteration-02-corrected-light', 'target-comparison.json'),
      'utf8',
    ),
  )

  assert.equal(shifted.status, 'FAIL')
  assert.equal(corrected.status, 'PASS')
  assert.ok(
    shifted.comparison.meanAbsDifference > corrected.comparison.meanAbsDifference,
    'fixture must prove that correcting the light reduces target distance',
  )
  assert.ok(
    shifted.comparison.changedPixels > corrected.comparison.changedPixels,
    'fixture must prove that correcting the light reduces changed pixels',
  )
  assert.ok(
    fs.existsSync(path.join(FIXTURE_ROOT, shifted.diffArtifact)),
  )
  assert.ok(
    fs.existsSync(path.join(FIXTURE_ROOT, 'iteration-02-corrected-light', corrected.diffArtifact)),
  )
})

test('target comparison reports a structural failure for mismatched dimensions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-look-loop-invalid-'))
  const targetPath = path.join(root, 'poster-target.png')
  const livePath = path.join(root, 'live-frame.png')
  writePng(targetPath, 4, 4, Buffer.alloc(4 * 4 * 4, 0x20))
  writePng(livePath, 5, 4, Buffer.alloc(5 * 4 * 4, 0x20))

  const result = compareTargetFrame({ targetPath, liveFramePath: livePath, out: path.join(root, 'out') })

  assert.equal(result.report.status, 'FAIL')
  assert.match(result.report.reason, /dimensions differ/)
  assert.equal(result.exitCode, 1)
  assert.ok(fs.existsSync(path.join(root, 'out', 'target-comparison.json')))
})

test('art direction and immersive output require a target comparison or explicit NOT_APPLICABLE', () => {
  const direction = fs.readFileSync(ART_DIRECTION, 'utf8')
  const command = fs.readFileSync(IMMERSIVE_COMMAND, 'utf8')
  const verifier = fs.readFileSync(VERIFIER, 'utf8')
  assert.match(verifier, /--target/)
  assert.match(verifier, /data-wdu-mode="deterministic"/)
  assert.match(direction, /Look-Loop|look loop/i)
  assert.match(direction, /target-comparison\.json/)
  assert.match(direction, /target-diff\.png|Diff-PNG/i)
  assert.match(direction, /iteration/i)
  assert.match(command, /comparison artifact|target-comparison\.json/i)
  assert.match(command, /NOT_APPLICABLE/)
})

test('the 3d-hero forward case requires an iteration signal', () => {
  const cases = JSON.parse(fs.readFileSync(FORWARD_CASES, 'utf8'))
  const hero = cases.find((entry) => entry.id === '3d-hero')
  assert.ok(hero, '3d-hero forward case must exist')
  assert.ok(
    hero.requiredTerms.some((term) => /iteration/i.test(term)),
    '3d-hero must require a look-loop iteration in its forward contract',
  )
})
