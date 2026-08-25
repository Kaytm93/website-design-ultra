#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  readPngDimensions,
  requireCleanSourceState,
  sha256Hex,
  validateExpectedMetadata,
} from './compare-captures.mjs'

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '../../..')
const DEFAULT_EXPECTED = path.join(SCRIPT_DIRECTORY, 'expected-metadata.json')
const FIXTURE_TEMPLATE = path.join(SCRIPT_DIRECTORY, 'fixture.html')
const RUNTIME_SOURCE = path.join(REPOSITORY_ROOT, 'references/determinism-runtime.ts')

function replaceExactlyOnce(source, marker, replacement) {
  const first = source.indexOf(marker)
  const last = source.lastIndexOf(marker)
  if (first === -1 || first !== last) {
    throw new Error(`fixture template must contain exactly one ${marker}`)
  }
  return `${source.slice(0, first)}${replacement}${source.slice(first + marker.length)}`
}

export function buildFixtureHtml({ expected, runtimeSource, template }) {
  const runtimeJavaScript = stripTypeScriptTypes(runtimeSource, {
    mode: 'strip',
    sourceMap: false,
  })
  const embeddedMetadata = JSON.stringify(expected).replaceAll('<', '\\u003c')
  let html = replaceExactlyOnce(
    template,
    '/* __WDU_RUNTIME__ */',
    runtimeJavaScript,
  )
  html = replaceExactlyOnce(html, '__WDU_EXPECTED_JSON__', embeddedMetadata)
  html = replaceExactlyOnce(
    html,
    '__WDU_MODE_INPUT_JSON__',
    JSON.stringify(expected.deterministicRuntime.modeInput),
  )
  return html
}

function report(status, message) {
  const output = `DETERMINISTIC_CAPTURE: ${status} ${message}`
  if (status === 'CAPTURED') console.log(output)
  else console.error(output)
}

class CaptureUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CaptureUnavailableError'
  }
}

function parseArguments(argv) {
  const options = { expected: DEFAULT_EXPECTED, out: null, help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--out') {
      options.out = path.resolve(argv[index + 1] ?? '')
      index += 1
    } else if (argument === '--expected') {
      options.expected = path.resolve(argv[index + 1] ?? '')
      index += 1
    } else if (argument === '--help') {
      options.help = true
    } else {
      throw new Error(`unknown argument ${JSON.stringify(argument)}`)
    }
  }
  if (!options.help && !options.out) throw new Error('--out is required')
  return options
}

function playwrightCommand(expected) {
  const explicit = process.env.WDU_PLAYWRIGHT_CLI
  if (explicit) return { command: explicit, prefix: [] }
  return {
    command: 'npx',
    prefix: [
      '--yes',
      '--package',
      `playwright@${expected.deviceProfile.playwrightVersion}`,
      'playwright',
    ],
  }
}

function run(command, args, timeout = 120_000) {
  return spawnSync(command.command, [...command.prefix, ...args], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout,
  })
}

function combinedOutput(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
}

function verifyPlaywright(expected) {
  const command = playwrightCommand(expected)
  const probe = run(command, ['--version'])
  if (probe.error || probe.status !== 0) {
    throw new CaptureUnavailableError(
      `Playwright CLI unavailable: ${probe.error?.message ?? combinedOutput(probe) ?? probe.status}`,
    )
  }
  const required = `Version ${expected.deviceProfile.playwrightVersion}`
  if (combinedOutput(probe) !== required) {
    throw new Error(
      `Playwright version mismatch: expected ${JSON.stringify(required)}, received ${JSON.stringify(combinedOutput(probe))}`,
    )
  }
  return command
}

function prepareEmptyDirectory(directory) {
  if (fs.existsSync(directory)) {
    if (!fs.statSync(directory).isDirectory()) {
      throw new Error(`output path is not a directory: ${directory}`)
    }
    if (fs.readdirSync(directory).length > 0) {
      throw new Error(`output directory is not empty: ${directory}`)
    }
  } else {
    fs.mkdirSync(directory, { recursive: true })
  }
}

function isBrowserUnavailable(result) {
  if (result.error?.code === 'ENOENT') return true
  return /Executable doesn't exist|Please run .*playwright install|browser executable|Chromium distribution .*not found|Failed to launch browser/i.test(
    combinedOutput(result),
  )
}

function writeJson(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}

function capture(options, expected, command, sourceCommit) {
  prepareEmptyDirectory(options.out)
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wdu-deterministic-capture-'),
  )
  try {
    const template = fs.readFileSync(FIXTURE_TEMPLATE, 'utf8')
    const runtimeSource = fs.readFileSync(RUNTIME_SOURCE, 'utf8')
    const expectedSource = fs.readFileSync(options.expected)
    const generatedFixture = buildFixtureHtml({ expected, runtimeSource, template })
    const generatedFixturePath = path.join(temporaryRoot, 'fixture.html')
    const capturePath = path.join(options.out, expected.captureFile)
    fs.writeFileSync(generatedFixturePath, generatedFixture)

    const profile = expected.deviceProfile
    const screenshot = run(
      command,
      [
        'screenshot',
        '--browser',
        profile.browser,
        '--color-scheme',
        profile.colorScheme,
        '--lang',
        profile.locale,
        '--timezone',
        profile.timezoneId,
        '--user-agent',
        profile.userAgent,
        '--viewport-size',
        `${profile.viewport.width},${profile.viewport.height}`,
        '--wait-for-selector',
        expected.deterministicRuntime.readyMarker,
        '--timeout',
        '30000',
        pathToFileURL(generatedFixturePath).href,
        capturePath,
      ],
      120_000,
    )

    if (screenshot.error || screenshot.status !== 0) {
      const detail = screenshot.error?.message ?? combinedOutput(screenshot) ?? screenshot.status
      if (isBrowserUnavailable(screenshot)) {
        throw new CaptureUnavailableError(`bundled Chromium unavailable: ${detail}`)
      }
      throw new Error(`browser capture failed: ${detail}`)
    }
    if (!fs.existsSync(capturePath)) {
      throw new Error('Playwright exited without writing capture.png')
    }

    const sourceCommitAfter = requireCleanSourceState(
      REPOSITORY_ROOT,
      'after standalone capture',
    )
    if (sourceCommitAfter !== sourceCommit) {
      throw new Error(
        `source commit changed during standalone capture: before ${sourceCommit}; after ${sourceCommitAfter}`,
      )
    }

    const png = fs.readFileSync(capturePath)
    const dimensions = readPngDimensions(png)
    if (
      dimensions.width !== profile.viewport.width * profile.deviceScaleFactor ||
      dimensions.height !== profile.viewport.height * profile.deviceScaleFactor
    ) {
      throw new Error(
        `captured PNG dimensions ${dimensions.width}x${dimensions.height} do not match declared profile ${profile.viewport.width * profile.deviceScaleFactor}x${profile.viewport.height * profile.deviceScaleFactor}`,
      )
    }

    const metadata = {
      schemaVersion: 1,
      status: 'CAPTURED',
      fixtureId: expected.fixtureId,
      acceptance: expected.acceptance,
      source: {
        commit: sourceCommit,
        fixtureTemplateSha256: sha256Hex(Buffer.from(template)),
        runtimeSourceSha256: sha256Hex(Buffer.from(runtimeSource)),
        expectedMetadataSha256: sha256Hex(expectedSource),
        generatedFixtureSha256: sha256Hex(Buffer.from(generatedFixture)),
      },
      deterministicRuntime: expected.deterministicRuntime,
      deviceProfile: profile,
      deviceProfileSha256: expected.deviceProfileSha256,
      png: {
        file: expected.captureFile,
        sha256: sha256Hex(png),
        bytes: png.length,
        ...dimensions,
      },
    }
    writeJson(path.join(options.out, 'capture.json'), metadata)
    report(
      'CAPTURED',
      `commit=${metadata.source.commit} device-profile-sha256=${metadata.deviceProfileSha256} png-sha256=${metadata.png.sha256} artifacts=${options.out}`,
    )
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true })
  }
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2))
    if (options.help) {
      console.log(`Usage: WDU_DETERMINISTIC=1 node capture.mjs --out <directory>
  [--expected <expected-metadata.json>]

Exit codes: 0 = capture written, 1 = capture failed, 2 = browser or
Playwright unavailable. WDU_PLAYWRIGHT_CLI may name an explicit Playwright CLI.`)
      return
    }
    const expected = validateExpectedMetadata(
      JSON.parse(fs.readFileSync(options.expected, 'utf8')),
    )
    if (process.env.WDU_DETERMINISTIC !== '1') {
      throw new Error('WDU_DETERMINISTIC=1 is required')
    }
    const sourceCommit = requireCleanSourceState(
      REPOSITORY_ROOT,
      'before standalone capture',
    )
    const command = verifyPlaywright(expected)
    capture(options, expected, command, sourceCommit)
  } catch (error) {
    const unavailable = error instanceof CaptureUnavailableError
    report(
      unavailable ? 'UNAVAILABLE' : 'FAIL',
      error instanceof Error ? error.message : String(error),
    )
    process.exitCode = unavailable ? 2 : 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
