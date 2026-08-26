#!/usr/bin/env node

/**
 * IP-07C — archive a bounded live-evaluation evidence set into the
 * repository.
 *
 * The full live artifact set is large (PNG matrices, checkpoint captures,
 * build logs) and stays untracked; CI archives it wholesale as the
 * `immersive-evaluation` workflow artifact. This script commits the
 * machine-readable core instead: the suite summary, the green fixture's
 * structured result, its performance summary, its capture manifest, and
 * the interaction-checkpoint status summary. Every file is timestamp-free
 * so two runs of one commit stay comparable.
 *
 * Usage:
 *   node tests/immersive/evaluation/archive-ci-evidence.mjs \
 *     --run /tmp/wdu-eval-live --status PASS \
 *     [--destination tests/immersive/evaluation/ci-evidence]
 *
 * --status records whether the archived run passed (PASS) or was not
 * verified because browser/GPU capability was missing (UNAVAILABLE).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))

function parseArguments(argv) {
  const options = {
    run: null,
    status: null,
    destination: path.join(SCRIPT_DIRECTORY, 'ci-evidence'),
  }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--run') {
      options.run = path.resolve(argv[index + 1])
      index += 1
    } else if (argv[index] === '--status') {
      options.status = argv[index + 1]
      index += 1
    } else if (argv[index] === '--destination') {
      options.destination = path.resolve(argv[index + 1])
      index += 1
    } else if (argv[index] === '--help' || argv[index] === '-h') {
      console.log(
        'usage: archive-ci-evidence.mjs --run <dir> --status <PASS|UNAVAILABLE> [--destination <dir>]',
      )
      process.exit(0)
    }
  }
  if (!options.run || !['PASS', 'UNAVAILABLE'].includes(options.status)) {
    console.error(
      'usage: archive-ci-evidence.mjs --run <dir> --status <PASS|UNAVAILABLE> [--destination <dir>]',
    )
    process.exit(2)
  }
  return options
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  const suiteSummary = readJson(
    path.join(options.run, 'evaluation.json'),
  )
  if (!Array.isArray(suiteSummary.fixtures) || suiteSummary.fixtures.length === 0) {
    throw new Error('the run summary lists no fixtures')
  }

  const fixtureEntries = []
  for (const entry of suiteSummary.fixtures) {
    const fixtureResult = readJson(
      path.join(options.run, entry.fixture, 'evaluation.json'),
    )
    const record = {
      fixture: fixtureResult.fixture,
      kind: fixtureResult.kind,
      status: fixtureResult.status,
      expected: fixtureResult.expected,
      expectationMet: fixtureResult.expectationMet,
      gates: Object.fromEntries(
        Object.entries(fixtureResult.gates).map(([id, gate]) => [
          id,
          { status: gate.status, evidence: gate.evidence },
        ]),
      ),
      cost: {
        durationMs: fixtureResult.cost.durationMs,
        phasesMs: fixtureResult.cost.phasesMs,
        externalServices: fixtureResult.cost.externalServices,
        browserBackend: fixtureResult.cost.browserBackend,
      },
    }
    const files = [
      {
        file: path.join(options.run, entry.fixture, 'capture-standard', 'performance-summary.json'),
        target: path.join(options.destination, entry.fixture, 'performance-summary.json'),
      },
      {
        file: path.join(options.run, entry.fixture, 'capture-standard', 'capture.json'),
        target: path.join(options.destination, entry.fixture, 'capture.json'),
      },
      {
        file: path.join(options.run, entry.fixture, 'checkpoints', 'checkpoints-summary.json'),
        target: path.join(options.destination, entry.fixture, 'checkpoint-status.json'),
      },
    ]
    for (const item of files) {
      if (!fs.existsSync(item.file)) continue
      const parsed = readJson(item.file)
      delete parsed.outputDirectory
      fs.mkdirSync(path.dirname(item.target), { recursive: true })
      fs.writeFileSync(item.target, `${JSON.stringify(parsed, null, 2)}\n`)
    }
    const relativeEvidence = Object.fromEntries(
      Object.entries(record.gates).map(([id, gate]) => [
        id,
        gate.evidence.map((evidencePath) =>
          path.relative(options.run, path.resolve(options.run, evidencePath)),
        ),
      ]),
    )
    fixtureEntries.push({ record, relativeEvidence })
    fs.mkdirSync(path.dirname(path.join(options.destination, entry.fixture, 'evaluation.json')), {
      recursive: true,
    })
    fs.writeFileSync(
      path.join(options.destination, entry.fixture, 'evaluation.json'),
      `${JSON.stringify(record, null, 2)}\n`,
    )
  }

  const manifest = {
    schemaVersion: 1,
    acceptance: 'ip-07c-immersive-evaluation-ci',
    status: options.status,
    sourceCommit: suiteSummary.sourceCommit,
    durationMs: suiteSummary.durationMs,
    externalServices: suiteSummary.externalServices,
    fixtures: fixtureEntries.map(({ record }) => ({
      fixture: record.fixture,
      status: record.status,
      expectationMet: record.expectationMet,
      gates: Object.fromEntries(
        Object.entries(record.gates).map(([id, gate]) => [id, gate.status]),
      ),
      durationMs: record.cost.durationMs,
    })),
    note: 'archived from a local live run of tests/immersive/evaluation/run-implementation-evaluation.mjs; PNG matrices and build logs stay untracked and are archived by CI',
  }
  fs.writeFileSync(
    path.join(options.destination, 'evaluation.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )

  console.log(`ARCHIVED: ${options.status} fixtures=${fixtureEntries.length} -> ${options.destination}`)
}

main()
