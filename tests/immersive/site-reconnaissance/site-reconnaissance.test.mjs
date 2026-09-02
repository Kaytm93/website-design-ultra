import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  validateSiteReconnaissance,
} from '../../../automation/site-reconnaissance/validate-site-reconnaissance.mjs'
import {
  validateSiteReconnaissanceDescription,
} from '../../../automation/site-reconnaissance/validate-description.mjs'

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, '../../..')
const FIXTURE_DIRECTORY = path.join(TEST_DIRECTORY, 'fixtures')
const VALID_LEDGER = path.join(FIXTURE_DIRECTORY, 'site-reconnaissance.valid.json')
const SKILL_PATH = path.join(
  REPOSITORY_ROOT,
  'website-design-ultra/skills/site-reconnaissance/SKILL.md',
)

function readValidLedger() {
  return JSON.parse(fs.readFileSync(VALID_LEDGER, 'utf8'))
}

function withLedger(mutator, callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-site-recon-'))
  fs.cpSync(path.join(FIXTURE_DIRECTORY, 'evidence'), path.join(directory, 'evidence'), {
    recursive: true,
  })
  const ledger = readValidLedger()
  mutator(ledger)
  const ledgerPath = path.join(directory, 'ledger.json')
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)
  try {
    return callback(ledgerPath)
  } finally {
    fs.rmSync(directory, { force: true, recursive: true })
  }
}

test('the public reference fixture produces at least ten evidenced ledger fields', () => {
  const report = validateSiteReconnaissance(VALID_LEDGER)

  assert.equal(report.status, 'PASS')
  assert.equal(report.schemaVersion, 'wdu-site-reconnaissance/v1')
  assert.equal(report.sourceUrl, 'https://threejs.org/examples/#webgl_loader_gltf')
  assert.equal(report.evidenceCount, 5)
  assert.equal(report.supportedFieldCount, 13)
  assert.deepEqual(report.supportedByGroup, {
    bundle: 2,
    network: 2,
    renderer: 3,
    inspector: 3,
    shader: 3,
  })
})

test('a screenshot-only activation is rejected before the ledger can pass', () => {
  withLedger(
    (ledger) => {
      ledger.activation.screenshotOnly = true
    },
    (ledgerPath) => {
      assert.throws(
        () => validateSiteReconnaissance(ledgerPath),
        /screenshot alone cannot activate/i,
      )
    },
  )
})

test('an Inspector screenshot cannot replace semantic Inspector evidence', () => {
  withLedger(
    (ledger) => {
      const inspector = ledger.evidence.find((entry) => entry.kind === 'inspector')
      inspector.kind = 'screenshot'
      inspector.format = 'png'
      inspector.primary = false
    },
    (ledgerPath) => {
      assert.throws(
        () => validateSiteReconnaissance(ledgerPath),
        /missing primary inspector artifact/i,
      )
    },
  )
})

test('a ledger with fewer than ten supported fields is rejected', () => {
  withLedger(
    (ledger) => {
      for (const row of ledger.ledger.slice(-4)) row.value = 'unknown'
    },
    (ledgerPath) => {
      assert.throws(
        () => validateSiteReconnaissance(ledgerPath),
        /at least 10 supported fields.*found 9/i,
      )
    },
  )
})

test('unavailable runtime capabilities can never be reported as PASS evidence', () => {
  withLedger(
    (ledger) => {
      ledger.runtime.gpu = 'UNAVAILABLE'
    },
    (ledgerPath) => {
      assert.throws(
        () => validateSiteReconnaissance(ledgerPath),
        /runtime\.gpu: UNAVAILABLE cannot be reported as PASS evidence/i,
      )
    },
  )
})

test('credentials and local hosts cannot masquerade as public references', () => {
  withLedger(
    (ledger) => {
      ledger.activation.sourceUrl = 'https://user:secret@localhost/reference'
    },
    (ledgerPath) => {
      assert.throws(
        () => validateSiteReconnaissance(ledgerPath),
        /credentials are forbidden/i,
      )
    },
  )
})

test('the skill description contains the positive gate and its screenshot negative gate', () => {
  const description = fs.readFileSync(SKILL_PATH, 'utf8')
  const report = validateSiteReconnaissanceDescription(description, SKILL_PATH)

  assert.equal(report.status, 'PASS')
  assert.match(report.description, /renderer\.info/)
  assert.match(report.description, /does not activate this skill\.$/)
})

test('a description that omits the screenshot negative gate is rejected', () => {
  const description = fs.readFileSync(SKILL_PATH, 'utf8').replace(
    'A screenshot alone,',
    'A screenshot,',
  )

  assert.throws(
    () => validateSiteReconnaissanceDescription(description),
    /missing screenshot alone/i,
  )
})
