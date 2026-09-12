#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const casesPath = path.join(pluginRoot, 'tests', 'forward', 'cases.json')
const DEFAULT_HERO_PATH_MAX_BYTES = 57_000

/**
 * Two different paths, two different budgets.
 *
 * The *required* path is the prose a case cannot finish without: the skills it
 * names and the files it must read. A byte cap on that is a compression target,
 * and it is what this command measured until 2026-09-12.
 *
 * The *instructed* path is every file the plugin tells a model it may open for
 * that brief: the command, the allowed skills, the allowed references. That is
 * the set `forward-trace.mjs` scores a live run against, so it is the set
 * `maxEstimatedPluginTokens` has to describe. Measuring the required subset and
 * declaring the result as the token budget is how `3d-hero` came to carry a
 * 15,000 budget that passed here and cost 21,161 live: nine allowed references
 * and the command file were outside the measurement.
 */
function fail(message) {
  console.error(`Path measurement: ${message}`)
  process.exitCode = 1
}

function parseSelection(argv) {
  if (argv.length === 1 && argv[0] === '--all') return { mode: '--all' }
  if (argv.length !== 2 || !['--case', '--command'].includes(argv[0])) {
    fail('usage: node scripts/measure-path.mjs --case <case-id> | --command tweak | --all')
    return null
  }
  if (argv[0] === '--command' && argv[1] !== 'tweak') {
    fail(`unknown command "${argv[1]}"`)
    return null
  }
  return { mode: argv[0], id: argv[1] }
}

function requiredFiles(testCase) {
  return [...new Set([
    ...(testCase.requiredSkills ?? []).map((skill) => `skills/${skill}/SKILL.md`),
    ...(testCase.trace?.requiredFiles ?? []),
  ])].sort()
}

function instructedFiles(testCase) {
  return [...new Set([
    `commands/${testCase.command}.md`,
    ...(testCase.trace?.allowedSkills ?? []).map((skill) => `skills/${skill}/SKILL.md`),
    ...(testCase.trace?.allowedReferences ?? []),
  ])].sort()
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

function readCases() {
  try {
    return JSON.parse(fs.readFileSync(casesPath, 'utf8'))
  } catch (error) {
    fail(`cannot read tests/forward/cases.json: ${error.message}`)
    return null
  }
}

const selection = parseSelection(process.argv.slice(2))
if (!selection) process.exit()

if (selection.mode === '--command') {
  try {
    const result = measure(['commands/tweak.md', 'skills/core-rules/SKILL.md'])
    console.log(`tweak: ${result.entries.length} files (existing design; no new font, motion or headline contract)`)
    console.log(`Plugin path: ${result.bytes} bytes <= 8000: ${result.bytes <= 8000 ? 'PASS' : 'FAIL'}`)
    console.log(`Estimated plugin tokens: ${result.tokens}`)
    for (const entry of result.entries) console.log(`- ${entry.bytes} ${entry.relative}`)
    console.log('Conditional domain reads add to this baseline; linter execution does not read its source into context.')
    if (result.bytes > 8000) process.exitCode = 1
  } catch (error) {
    fail(error.message)
  }
  process.exit()
}

/** The number `maxEstimatedPluginTokens` has to carry for this case. */
export function instructedTokens(testCase) {
  return measure(instructedFiles(testCase)).tokens
}

if (selection.mode === '--all') {
  const cases = readCases()
  if (!cases) process.exit()
  console.log('case                             required  instructed  declared  verdict')
  for (const testCase of cases) {
    let required
    let instructed
    try {
      required = measure(requiredFiles(testCase))
      instructed = measure(instructedFiles(testCase))
    } catch (error) {
      fail(`${testCase.id}: ${error.message}`)
      continue
    }
    const declared = testCase.trace?.maxEstimatedPluginTokens ?? null
    const matches = declared === instructed.tokens
    if (!matches) process.exitCode = 1
    console.log(
      `${testCase.id.padEnd(32)} ${String(required.tokens).padStart(8)}` +
        ` ${String(instructed.tokens).padStart(11)} ${String(declared ?? '-').padStart(9)}` +
        `  ${matches ? 'PASS' : `FAIL: declare ${instructed.tokens}`}`,
    )
  }
  process.exit()
}

const caseId = selection.id
const cases = readCases()
if (!cases) process.exit()
const testCase = cases.find((candidate) => candidate.id === caseId)
if (!testCase) {
  fail(`unknown case "${caseId}"`)
  process.exit()
}

let required
let instructed
try {
  required = measure(requiredFiles(testCase))
  instructed = measure(instructedFiles(testCase))
} catch (error) {
  fail(error.message)
  process.exit()
}

const pathBudget =
  testCase.trace?.maxPathBytes ??
  (caseId === '3d-hero' ? DEFAULT_HERO_PATH_MAX_BYTES : null)
const pathPasses = pathBudget === null || required.bytes <= pathBudget
const tokenBudget = testCase.trace?.maxEstimatedPluginTokens ?? null
const tokenPasses = tokenBudget === instructed.tokens
const pathLimitLabel = pathBudget === null ? 'no byte cap declared' : `${Math.round(pathBudget / 1000)} KB`

console.log(`${caseId}: ${required.entries.length} required files, ${instructed.entries.length} instructed files`)
console.log(
  `Minimum path: ${required.bytes.toLocaleString('en-US')} bytes` +
    ` (${(required.bytes / 1000).toFixed(2)} KB) <= ${pathLimitLabel}: ${pathPasses ? 'PASS' : 'FAIL'}`,
)
console.log(
  `Instructed path: ${instructed.bytes.toLocaleString('en-US')} bytes,` +
    ` ${instructed.tokens.toLocaleString('en-US')} estimated plugin tokens`,
)
console.log(
  tokenBudget === null
    ? 'maxEstimatedPluginTokens: not declared'
    : `maxEstimatedPluginTokens ${tokenBudget.toLocaleString('en-US')} ` +
      `${tokenPasses ? '==' : '!='} instructed ${instructed.tokens.toLocaleString('en-US')}: ` +
      `${tokenPasses ? 'PASS' : `FAIL, declare ${instructed.tokens}`}`,
)
for (const entry of instructed.entries) {
  const mandatory = required.entries.some((candidate) => candidate.relative === entry.relative)
  console.log(`- ${entry.bytes.toString().padStart(5)} ${mandatory ? '*' : ' '} ${entry.relative}`)
}
console.log('* required; the rest are allowed reads the skills instruct for this brief.')

if (!pathPasses || !tokenPasses) process.exitCode = 1
