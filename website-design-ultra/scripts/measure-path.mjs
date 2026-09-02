#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const casesPath = path.join(pluginRoot, 'tests', 'forward', 'cases.json')
const DEFAULT_HERO_PATH_MAX_BYTES = 57_000

function fail(message) {
  console.error(`Path measurement: ${message}`)
  process.exitCode = 1
}

function parseCase(argv) {
  const index = argv.indexOf('--case')
  if (index === -1 || !argv[index + 1]) {
    fail('usage: node scripts/measure-path.mjs --case <case-id>')
    return null
  }
  if (argv.length !== 2 || index !== 0) {
    fail('only --case <case-id> is supported')
    return null
  }
  return argv[index + 1]
}

function caseFiles(testCase) {
  const files = new Set([
    ...(testCase.requiredSkills ?? []).map((skill) => `skills/${skill}/SKILL.md`),
    ...(testCase.trace?.requiredFiles ?? []),
  ])
  return [...files].sort()
}

function measure(files) {
  let bytes = 0
  const entries = files.map((relative) => {
    const absolute = path.join(pluginRoot, relative)
    if (!fs.existsSync(absolute)) throw new Error(`missing ${relative}`)
    const size = fs.statSync(absolute).size
    bytes += size
    return { relative, bytes: size }
  })
  return { bytes, tokens: Math.ceil(bytes / 4), entries }
}

const caseId = parseCase(process.argv.slice(2))
if (!caseId) process.exit()

let cases
try {
  cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'))
} catch (error) {
  fail(`cannot read tests/forward/cases.json: ${error.message}`)
  process.exit()
}
const testCase = cases.find((candidate) => candidate.id === caseId)
if (!testCase) {
  fail(`unknown case "${caseId}"`)
  process.exit()
}

let result
try {
  result = measure(caseFiles(testCase))
} catch (error) {
  fail(error.message)
  process.exit()
}

const pathBudget =
  testCase.trace?.maxPathBytes ??
  (caseId === '3d-hero' ? DEFAULT_HERO_PATH_MAX_BYTES : null)
const pathPasses = pathBudget === null || result.bytes <= pathBudget
const tokenBudget = testCase.trace?.maxEstimatedPluginTokens ?? null
const tokenPasses = tokenBudget === null || result.tokens <= tokenBudget
const bytesLabel = `${result.bytes.toLocaleString('en-US')} bytes`
const kbLabel = `${(result.bytes / 1000).toFixed(2)} KB`
const pathLimitLabel = pathBudget === null ? 'no byte cap declared' : `${Math.round(pathBudget / 1000)} KB`
console.log(`${caseId}: ${result.entries.length} files`)
console.log(`Minimum path: ${bytesLabel} (${kbLabel}) <= ${pathLimitLabel}: ${pathPasses ? 'PASS' : 'FAIL'}`)
console.log(
  `Estimated plugin tokens: ${result.tokens.toLocaleString('en-US')}` +
    (tokenBudget === null
      ? ''
      : ` <= ${tokenBudget.toLocaleString('en-US')}: ${tokenPasses ? 'PASS' : 'FAIL'}`),
)
for (const entry of result.entries) console.log(`- ${entry.bytes.toString().padStart(5)} ${entry.relative}`)

if (!pathPasses || !tokenPasses) process.exitCode = 1
