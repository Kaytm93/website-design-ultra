#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  auditClaudeTrace,
  auditCodexTrace,
  evaluateTrace,
  extractClaudeStructuredOutput,
  parseJsonLines,
  pluginIdentity,
  pluginTreeDigest,
  selfTestTraceAudit,
} from './forward-trace.mjs'

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const casesPath = path.join(pluginRoot, 'tests', 'forward', 'cases.json')
const schemaPath = path.join(pluginRoot, 'tests', 'forward', 'response.schema.json')

function die(message) {
  console.error(`Forward tests: ${message}`)
  process.exit(1)
}

function valueAtPath(root, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => value?.[key], root)
}

function gitDescribe() {
  const run = (args) =>
    spawnSync('git', ['-C', pluginRoot, ...args], { encoding: 'utf8' }).stdout?.trim() || null
  const inside = spawnSync('git', ['-C', pluginRoot, 'rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
  })
  if (inside.status !== 0) return { repository: false }
  const status = run(['status', '--porcelain'])
  return {
    repository: true,
    commit: run(['rev-parse', 'HEAD']),
    tag: run(['describe', '--tags', '--exact-match']) ?? null,
    branch: run(['rev-parse', '--abbrev-ref', 'HEAD']),
    clean: status === '' || status === null,
  }
}

function parseArguments(argv) {
  const options = {
    dryRun: false,
    selected: [],
    provider: 'codex',
    model: null,
    effort: 'medium',
    maxBudgetUsd: '0.75',
    timeoutMs: 300000,
    report: null,
    traceDir: null,
    requireLive: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dry-run') {
      options.dryRun = true
    } else if (argument === '--require-live') {
      options.requireLive = true
    } else if (argument === '--case') {
      options.selected.push(argv[index + 1])
      index += 1
    } else if (argument === '--provider') {
      options.provider = argv[index + 1]
      index += 1
    } else if (argument === '--model') {
      options.model = argv[index + 1]
      index += 1
    } else if (argument === '--effort') {
      options.effort = argv[index + 1]
      index += 1
    } else if (argument === '--max-budget-usd') {
      options.maxBudgetUsd = argv[index + 1]
      index += 1
    } else if (argument === '--timeout-ms') {
      options.timeoutMs = Number.parseInt(argv[index + 1], 10)
      index += 1
    } else if (argument === '--report') {
      options.report = path.resolve(argv[index + 1])
      index += 1
    } else if (argument === '--trace-dir') {
      options.traceDir = path.resolve(argv[index + 1])
      index += 1
    } else if (argument === '--help') {
      console.log(`Usage:
  node scripts/run-forward-tests.mjs --dry-run
  node scripts/run-forward-tests.mjs [--case dashboard] [--provider codex|claude]
                                     [--model sonnet] [--effort medium]
                                     [--max-budget-usd 0.75]
                                     [--timeout-ms 300000]
                                     [--report /absolute/path/report.json]
                                     [--trace-dir /absolute/path/traces]
                                     [--require-live]

Live runs need an authenticated Codex or Claude Code CLI. Each case loads this
plugin source read-only, requests schema-constrained output, and exits non-zero
when skill routing or required contracts are missing.

Provider availability follows ADR-010: a missing or unauthenticated CLI reports
UNAVAILABLE, leaves the launch gate open, and exits 0 unless --require-live is
set. It is never reported as a pass.

--trace-dir writes the raw provider event stream per case. Those files are the
archivable evidence behind a routing claim; --report links them by name.`)
      process.exit(0)
    } else {
      die(`unknown argument "${argument}"`)
    }
  }

  if (!Number.isFinite(Number(options.maxBudgetUsd)) || Number(options.maxBudgetUsd) <= 0) {
    die('--max-budget-usd must be a positive number')
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 10000) {
    die('--timeout-ms must be an integer of at least 10000')
  }
  if (!['codex', 'claude'].includes(options.provider)) {
    die('--provider must be "codex" or "claude"')
  }
  return options
}

function validateFixtures(cases, schema) {
  if (!Array.isArray(cases) || cases.length < 5) {
    die(`expected at least 5 cases, found ${Array.isArray(cases) ? cases.length : 'invalid JSON'}`)
  }
  if (schema.type !== 'object' || !schema.properties?.skills) {
    die('response schema is missing the skills contract')
  }

  const identifiers = new Set()
  for (const testCase of cases) {
    if (!/^[a-z0-9-]+$/.test(testCase.id)) die(`invalid case id "${testCase.id}"`)
    if (identifiers.has(testCase.id)) die(`duplicate case id "${testCase.id}"`)
    identifiers.add(testCase.id)
    if (!['design', 'immersive'].includes(testCase.command)) {
      die(`${testCase.id}: unsupported command "${testCase.command}"`)
    }
    if (!testCase.prompt || !testCase.requiredSkills?.length) {
      die(`${testCase.id}: prompt and requiredSkills are required`)
    }
    if (
      !testCase.trace?.allowedSkills?.length ||
      !Array.isArray(testCase.trace.allowedReferences) ||
      !Array.isArray(testCase.trace.requiredFiles) ||
      !Array.isArray(testCase.trace.forbiddenFiles) ||
      !Number.isInteger(testCase.trace.maxReferenceFiles) ||
      !Number.isInteger(testCase.trace.maxEstimatedPluginTokens)
    ) {
      die(`${testCase.id}: complete trace contract is required`)
    }
    for (const skill of testCase.requiredSkills) {
      if (!testCase.trace.allowedSkills.includes(skill)) {
        die(`${testCase.id}: required skill "${skill}" is not trace-allowed`)
      }
    }
    for (const term of testCase.requiredTerms ?? []) {
      try {
        new RegExp(term, 'i')
      } catch {
        die(`${testCase.id}: invalid requiredTerms regex "${term}"`)
      }
    }
  }
  return selfTestTraceAudit(pluginRoot)
}

/**
 * Provider availability, in the ADR-010 shape: a missing capability is reported
 * as UNAVAILABLE with a reason, never as a pass and never as a routing failure.
 */
function probeProvider(provider) {
  const version = spawnSync(provider, ['--version'], { encoding: 'utf8' })
  if (version.error || version.status !== 0) {
    return { status: 'UNAVAILABLE', reason: 'cli-missing', detail: `${provider} CLI not on PATH` }
  }
  const cliVersion = (version.stdout ?? '').trim().split('\n')[0] ?? null

  if (provider === 'claude') {
    const auth = spawnSync('claude', ['auth', 'status', '--json'], { encoding: 'utf8' })
    let parsed = null
    try {
      parsed = JSON.parse(auth.stdout ?? '')
    } catch {
      parsed = null
    }
    if (auth.status !== 0 || !parsed?.loggedIn) {
      return {
        status: 'UNAVAILABLE',
        reason: 'not-authenticated',
        detail: 'claude auth status reports no active login',
        cliVersion,
      }
    }
    return { status: 'AVAILABLE', cliVersion, authMethod: parsed.authMethod ?? null }
  }

  const login = spawnSync('codex', ['login', 'status'], { encoding: 'utf8' })
  if (login.status !== 0 && !login.error) {
    const detail = (login.stderr || login.stdout || '').trim()
    if (/not logged in|no credentials|unauthor/i.test(detail)) {
      return { status: 'UNAVAILABLE', reason: 'not-authenticated', detail, cliVersion }
    }
  }
  return { status: 'AVAILABLE', cliVersion }
}

function writeTrace(options, testCase, provider, stdout) {
  if (!options.traceDir) return null
  fs.mkdirSync(options.traceDir, { recursive: true })
  const file = path.join(options.traceDir, `${provider}-${testCase.id}.jsonl`)
  fs.writeFileSync(file, stdout ?? '')
  return file
}

function runClaude(testCase, prompt, schema, options) {
  const args = [
    '--print',
    '--plugin-dir',
    pluginRoot,
    '--add-dir',
    pluginRoot,
    '--tools',
    'Read,Glob,Grep',
    '--permission-mode',
    'dontAsk',
    '--no-session-persistence',
    // Isolation. Without this the run inherits the operator's own skills,
    // CLAUDE.md and MCP servers, so an installed copy of this same plugin can
    // answer the prompt and the trace measures the wrong tree.
    '--setting-sources',
    '',
    '--strict-mcp-config',
    '--exclude-dynamic-system-prompt-sections',
    '--output-format',
    'stream-json',
    '--verbose',
    '--json-schema',
    JSON.stringify(schema),
    '--max-budget-usd',
    options.maxBudgetUsd,
  ]
  if (options.model) args.push('--model', options.model)
  if (options.effort) args.push('--effort', options.effort)
  args.push(prompt)

  const run = spawnSync('claude', args, {
    cwd: pluginRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeoutMs,
  })
  const tracePath = writeTrace(options, testCase, 'claude', run.stdout)
  if (run.error || run.status !== 0) return { run, tracePath }

  const events = parseJsonLines(run.stdout)
  const result = extractClaudeStructuredOutput(events)
  if (!result) {
    run.status = 1
    run.stderr = `${run.stderr ?? ''}\n${testCase.id}: no structured_output in the Claude event stream.`
  }
  return { run, result, trace: auditClaudeTrace(events, pluginRoot), tracePath }
}

function runCodex(testCase, prompt, options) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-forward-'))
  const outputPath = path.join(temporaryDirectory, `${testCase.id}.json`)
  const codexPrompt = `${prompt}

Treat ${pluginRoot} as the plugin source. Start with commands/${testCase.command}.md
and apply its routing gates before opening skill bodies. Read only the selected
SKILL.md files and the references they select.`
  const run = spawnSync(
    'codex',
    [
      'exec',
      '--skip-git-repo-check',
      '--ephemeral',
      '--ignore-user-config',
      '--ignore-rules',
      '--sandbox',
      'read-only',
      '--json',
      '--config',
      `model_reasoning_effort="${options.effort}"`,
      '--output-schema',
      schemaPath,
      '--output-last-message',
      outputPath,
      '--cd',
      pluginRoot,
      codexPrompt,
    ],
    {
      cwd: pluginRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: options.timeoutMs,
    },
  )
  const tracePath = writeTrace(options, testCase, 'codex', run.stdout)

  let result
  if (!run.error && run.status === 0 && fs.existsSync(outputPath)) {
    try {
      result = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    } catch {
      // Reported as a provider error below.
    }
  }
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  if (!result && !run.error && run.status === 0) {
    run.status = 1
    run.stderr = `${run.stderr ?? ''}\nCodex did not emit valid schema output.`
  }
  return {
    run,
    result,
    trace: auditCodexTrace(parseJsonLines(run.stdout), pluginRoot),
    tracePath,
  }
}

function evaluate(testCase, result, trace) {
  const failures = []
  const skills = new Set(result.skills ?? [])

  if (result.caseId !== testCase.id) {
    failures.push(`caseId was "${result.caseId}"`)
  }
  for (const skill of testCase.requiredSkills) {
    if (!skills.has(skill)) failures.push(`missing skill route "${skill}"`)
  }
  for (const [dottedPath, minimum] of Object.entries(testCase.minimums ?? {})) {
    const value = valueAtPath(result, dottedPath)
    if (!Array.isArray(value) || value.length < minimum) {
      failures.push(`${dottedPath} needs at least ${minimum} entries`)
    }
  }

  const serialized = JSON.stringify(result)
  for (const term of testCase.requiredTerms ?? []) {
    if (!new RegExp(term, 'i').test(serialized)) {
      failures.push(`missing signal /${term}/i`)
    }
  }
  failures.push(...evaluateTrace(testCase, result, trace))
  return failures
}

function writeReport(options, payload) {
  if (!options.report) return
  fs.mkdirSync(path.dirname(options.report), { recursive: true })
  fs.writeFileSync(options.report, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`Report: ${options.report}`)
}

const options = parseArguments(process.argv.slice(2))
const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'))
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
const selfTest = validateFixtures(cases, schema)
const identity = pluginIdentity(pluginRoot)
const provenance = { ...gitDescribe(), tree: pluginTreeDigest(pluginRoot) }

const selectedCases = options.selected.length
  ? cases.filter((testCase) => options.selected.includes(testCase.id))
  : cases
for (const identifier of options.selected) {
  if (!cases.some((testCase) => testCase.id === identifier)) {
    die(`unknown case "${identifier}"`)
  }
}

if (options.dryRun) {
  console.log(
    `Forward fixture validation passed: ${selectedCases.length} cases, ${selfTest.replayed} recorded traces replayed; no model behavior was tested`,
  )
  for (const testCase of selectedCases) {
    console.log(`- ${testCase.id}: /website-design-ultra:${testCase.command}`)
  }
  process.exit(0)
}

const availability = probeProvider(options.provider)
if (availability.status === 'UNAVAILABLE') {
  console.error(
    `UNAVAILABLE ${options.provider}: ${availability.detail} (${availability.reason}).`,
  )
  console.error(
    'No routing claim is proven for this provider. The launch gate stays open and the result is unverified.',
  )
  writeReport(options, {
    generatedAt: new Date().toISOString(),
    provider: options.provider,
    providerStatus: availability,
    plugin: identity,
    provenance,
    selfTest,
    results: selectedCases.map((testCase) => ({ id: testCase.id, status: 'unavailable' })),
  })
  process.exit(options.requireLive ? 1 : 0)
}

const results = []
let failedCases = 0
for (const testCase of selectedCases) {
  const prompt = `Case ID: ${testCase.id}

/website-design-ultra:${testCase.command} ${testCase.prompt}

Use the loaded website-design-ultra plugin and return only the schema-constrained
planning contract. List every plugin skill actually used by exact folder name.
For non-3D work, return null/empty values for immersive fields. Read every routed
SKILL.md explicitly, then read only the references needed for this case. Do not
scan skill or reference directories broadly. The provider tool trace, not your
reported skill list, is the source of truth. Do not modify files.`

  const providerResult =
    options.provider === 'claude'
      ? runClaude(testCase, prompt, schema, options)
      : runCodex(testCase, prompt, options)
  const { run, tracePath } = providerResult

  if (run.error || run.status !== 0) {
    failedCases += 1
    const providerError = (
      run.stderr ||
      run.stdout ||
      run.error?.message ||
      `provider exited with status ${run.status ?? 'null'}${run.signal ? ` / ${run.signal}` : ''}`
    )
      .trim()
      .slice(0, 2000)
    console.error(`FAIL ${testCase.id}: ${providerError}`)
    results.push({
      id: testCase.id,
      status: 'provider-error',
      failures: [providerError],
      tracePath,
    })
    continue
  }

  const { result, trace } = providerResult
  const failures = evaluate(testCase, result, trace)
  if (failures.length) {
    failedCases += 1
    console.error(`FAIL ${testCase.id}: ${failures.join('; ')}`)
  } else {
    console.log(
      `PASS ${testCase.id} (${trace.accessedFiles.length} plugin files, ~${trace.estimatedPluginTokens} plugin tokens)`,
    )
  }
  results.push({
    id: testCase.id,
    status: failures.length ? 'failed' : 'passed',
    failures,
    result,
    trace,
    tracePath,
  })
}

writeReport(options, {
  generatedAt: new Date().toISOString(),
  provider: options.provider,
  providerStatus: availability,
  model: options.model,
  effort: options.effort,
  plugin: identity,
  provenance,
  selfTest,
  results,
})

if (failedCases) {
  console.error(`Forward tests failed: ${failedCases}/${selectedCases.length}`)
  process.exit(1)
}
console.log(`Forward tests passed: ${selectedCases.length}/${selectedCases.length}`)
