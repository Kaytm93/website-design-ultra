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
import { strictObjectSchemaFailures } from './forward-schema.mjs'

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
    repeat: 1,
    minPassRate: 1,
    providerCli: null,
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
    } else if (argument === '--provider-cli') {
      options.providerCli = argv[index + 1]
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
    } else if (argument === '--repeat') {
      // Number(), not parseInt(): parseInt('2.5') is 2, and silently running a
      // different number of attempts than asked for corrupts every rate below.
      options.repeat = Number(argv[index + 1])
      index += 1
    } else if (argument === '--min-pass-rate') {
      options.minPassRate = Number(argv[index + 1])
      index += 1
    } else if (argument === '--help') {
      console.log(`Usage:
  node scripts/run-forward-tests.mjs --dry-run
  node scripts/run-forward-tests.mjs [--case dashboard] [--provider codex|claude]
                                     [--provider-cli /absolute/path/to/cli]
                                     [--model sonnet] [--effort medium]
                                     [--max-budget-usd 0.75]
                                     [--timeout-ms 300000]
                                     [--report /absolute/path/report.json]
                                     [--trace-dir /absolute/path/traces]
                                     [--repeat 5] [--min-pass-rate 0.8]
                                     [--require-live]

Live runs need an authenticated Codex or Claude Code CLI. Each case loads this
plugin source read-only, requests schema-constrained output, and exits non-zero
when skill routing or required contracts are missing.

Provider availability follows ADR-010: a missing or unauthenticated CLI reports
UNAVAILABLE, leaves the launch gate open, and exits 0 unless --require-live is
set. It is never reported as a pass.

--provider-cli selects one executable for version, authentication, and the live
run. Use it when Codex or Claude Code is installed outside PATH.

--trace-dir writes the raw provider event stream per case. Those files are
archivable evidence for that attempt's routing result; --report links them by
name.

Routing is not deterministic. A single attempt per case measures one sample of
a distribution, so one green run is not evidence that a case is stable and one
red run is not evidence of a regression. --repeat N runs every case N times and
scores it by pass rate; --min-pass-rate is the per-case threshold that has to
be met. The defaults (--repeat 1 --min-pass-rate 1) reproduce the older
all-or-nothing behaviour, which is only meaningful as a smoke test.

Cost scales with cases x repeats x --max-budget-usd. Seven cases at --repeat 5
and 0.60 is up to 21 USD.`)
      process.exit(0)
    } else {
      die(`unknown argument "${argument}"`)
    }
  }

  if (!Number.isFinite(Number(options.maxBudgetUsd)) || Number(options.maxBudgetUsd) <= 0) {
    die('--max-budget-usd must be a positive number')
  }
  if (!Number.isInteger(options.repeat) || options.repeat < 1) {
    die('--repeat must be a positive integer')
  }
  if (!Number.isFinite(options.minPassRate) || options.minPassRate <= 0 || options.minPassRate > 1) {
    die('--min-pass-rate must be greater than 0 and at most 1')
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 10000) {
    die('--timeout-ms must be an integer of at least 10000')
  }
  if (!['codex', 'claude'].includes(options.provider)) {
    die('--provider must be "codex" or "claude"')
  }
  if (options.providerCli !== null && !options.providerCli?.trim()) {
    die('--provider-cli needs a non-empty executable path')
  }
  if (options.providerCli && !path.isAbsolute(options.providerCli)) {
    die('--provider-cli must be an absolute path')
  }
  options.providerExecutable = options.providerCli ?? options.provider
  return options
}

function unwrapProviderError(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    try {
      return unwrapProviderError(JSON.parse(trimmed)) ?? trimmed
    } catch {
      return trimmed
    }
  }
  if (!value || typeof value !== 'object') return null
  for (const candidate of [
    value.error?.message,
    value.message,
    value.result,
    value.error,
  ]) {
    const unwrapped = unwrapProviderError(candidate)
    if (unwrapped) return unwrapped
  }
  return null
}

function terminalProviderError(stdout) {
  for (const event of parseJsonLines(stdout).reverse()) {
    if (event.type === 'turn.failed') {
      const message = unwrapProviderError(event.error)
      if (message) return message
    }
    if (event.type === 'error') {
      const message = unwrapProviderError(event)
      if (message) return message
    }
    if (event.type === 'result' && (event.is_error || event.subtype === 'error')) {
      const message = unwrapProviderError(event)
      if (message) return message
    }
    // A budget or turn-limit termination is a well-formed result event with a
    // non-success subtype and no error payload. Without this it falls through
    // to the raw stream and reads like a crash.
    if (event.type === 'result' && event.subtype && event.subtype !== 'success') {
      return (
        `provider stopped: ${event.subtype}` +
        (typeof event.total_cost_usd === 'number'
          ? ` after $${event.total_cost_usd.toFixed(4)}`
          : '') +
        (event.num_turns ? ` / ${event.num_turns} turns` : '')
      )
    }
  }
  return null
}

function providerErrorMessage(run) {
  const eventError = terminalProviderError(run.stdout)
  const spawnError = run.error?.message?.trim()
  const stderr = run.stderr?.trim()
  const stdout = run.stdout?.trim()
  const status = `provider exited with status ${run.status ?? 'null'}${
    run.signal ? ` / ${run.signal}` : ''
  }`
  const primary = eventError || spawnError || stderr || stdout || status
  const diagnostics = []
  if (eventError && stderr && stderr !== eventError) diagnostics.push(stderr)
  if (spawnError && spawnError !== primary) diagnostics.push(spawnError)
  return [primary, diagnostics.length ? `Diagnostics:\n${diagnostics.join('\n')}` : null]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 2000)
}

function validateFixtures(cases, schema) {
  if (!Array.isArray(cases) || cases.length < 5) {
    die(`expected at least 5 cases, found ${Array.isArray(cases) ? cases.length : 'invalid JSON'}`)
  }
  if (schema.type !== 'object' || !schema.properties?.skills) {
    die('response schema is missing the skills contract')
  }
  const schemaFailures = strictObjectSchemaFailures(schema)
  if (schemaFailures.length) {
    die(`response schema is not strict-output compatible: ${schemaFailures.join('; ')}`)
  }

  const schemaRegression = strictObjectSchemaFailures({
    type: 'object',
    additionalProperties: false,
    required: [],
    properties: {
      copy: {
        type: 'object',
        additionalProperties: false,
        required: ['lines'],
        properties: { lines: { type: 'array' }, slopChecks: { type: 'array' } },
      },
    },
  })
  if (
    !schemaRegression.some((failure) => failure.includes('required is missing copy')) ||
    !schemaRegression.some((failure) => failure.includes('required is missing slopChecks'))
  ) {
    die('strict-output schema validator self-test failed')
  }
  const recursiveSchemaRegression = strictObjectSchemaFailures({
    $defs: { nested: { type: 'object' } },
  })
  if (
    !recursiveSchemaRegression.some((failure) =>
      failure.includes('$.$defs.nested: properties must be an object'),
    )
  ) {
    die('recursive strict-output schema validator self-test failed')
  }
  const duplicateRequiredRegression = strictObjectSchemaFailures({
    type: 'object',
    additionalProperties: false,
    required: ['value', 'value'],
    properties: { value: { type: 'string' } },
  })
  if (!duplicateRequiredRegression.some((failure) => failure.includes('required repeats value'))) {
    die('strict-output duplicate-required self-test failed')
  }

  const providerErrorRegression = providerErrorMessage({
    status: 1,
    stderr: 'Reading additional input from stdin...',
    stdout:
      '{"type":"turn.failed","error":{"message":"{\\"error\\":{\\"code\\":\\"invalid_json_schema\\",\\"message\\":\\"Missing slopChecks\\"}}"}}',
  })
  if (
    !providerErrorRegression.startsWith('Missing slopChecks') ||
    !providerErrorRegression.includes('Diagnostics:')
  ) {
    die('provider error selection self-test failed')
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
    if (testCase.lintCopy !== undefined) {
      const { path: copyPath, profile, locales } = testCase.lintCopy
      if (!copyPath || !profile || !Array.isArray(locales) || !locales.length) {
        die(`${testCase.id}: lintCopy needs path, profile, and a non-empty locales list`)
      }
    }
    if (testCase.forbiddenTerms !== undefined) {
      const { paths, patterns } = testCase.forbiddenTerms
      if (!Array.isArray(paths) || !paths.length || !Array.isArray(patterns) || !patterns.length) {
        die(`${testCase.id}: forbiddenTerms needs a non-empty paths and patterns list`)
      }
      /**
       * A response may legitimately name the pattern its copy avoided. Scoping a
       * forbidden pattern at a subtree that also carries the model's own
       * commentary turns that honesty into a failure, so require a leaf path.
       */
      for (const scope of paths) {
        if (!scope.includes('.')) {
          die(`${testCase.id}: forbiddenTerms path "${scope}" is a whole subtree; point it at the copy leaf`)
        }
      }
      for (const pattern of patterns) {
        try {
          new RegExp(pattern, 'i')
        } catch {
          die(`${testCase.id}: invalid forbiddenTerms regex "${pattern}"`)
        }
      }
    }
  }
  return selfTestTraceAudit(pluginRoot)
}

/**
 * Provider availability, in the ADR-010 shape: a missing capability is reported
 * as UNAVAILABLE with a reason, never as a pass and never as a routing failure.
 */
function probeProvider(provider, executable) {
  const version = spawnSync(executable, ['--version'], { encoding: 'utf8' })
  if (version.error || version.status !== 0) {
    return {
      status: 'UNAVAILABLE',
      reason: 'cli-missing',
      detail: `could not run ${provider} CLI "${executable}"`,
      executable,
    }
  }
  const cliVersion = (version.stdout ?? '').trim().split('\n')[0] ?? null

  if (provider === 'claude') {
    const auth = spawnSync(executable, ['auth', 'status', '--json'], { encoding: 'utf8' })
    let parsed = null
    try {
      parsed = JSON.parse(auth.stdout ?? '')
    } catch {
      parsed = null
    }
    const detail = (auth.stderr || auth.stdout || '').trim()
    if (parsed?.loggedIn === false) {
      return {
        status: 'UNAVAILABLE',
        reason: 'not-authenticated',
        detail: 'claude auth status reports no active login',
        cliVersion,
        executable,
      }
    }
    if (auth.error || auth.status !== 0 || !parsed || parsed.loggedIn !== true) {
      return {
        status: 'UNAVAILABLE',
        reason: 'auth-probe-failed',
        detail: detail || auth.error?.message || 'claude auth status returned no JSON',
        cliVersion,
        executable,
      }
    }
    return {
      status: 'AVAILABLE',
      cliVersion,
      authMethod: parsed.authMethod ?? null,
      executable,
    }
  }

  const login = spawnSync(executable, ['login', 'status'], { encoding: 'utf8' })
  if (login.error || login.status !== 0) {
    const detail = (login.stderr || login.stdout || login.error?.message || '').trim()
    if (/not logged in|no credentials|unauthor/i.test(detail)) {
      return {
        status: 'UNAVAILABLE',
        reason: 'not-authenticated',
        detail,
        cliVersion,
        executable,
      }
    }
    return {
      status: 'UNAVAILABLE',
      reason: 'auth-probe-failed',
      detail: detail || 'codex login status failed',
      cliVersion,
      executable,
    }
  }
  return { status: 'AVAILABLE', cliVersion, executable }
}

function writeTrace(options, testCase, provider, stdout) {
  if (!options.traceDir) return null
  fs.mkdirSync(options.traceDir, { recursive: true })
  // Repeated attempts would otherwise overwrite each other, and the whole point
  // of repeating is being able to compare the attempts against one another.
  const suffix = options.repeat > 1 ? `-${String(options.attempt).padStart(2, '0')}` : ''
  const file = path.join(options.traceDir, `${provider}-${testCase.id}${suffix}.jsonl`)
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
    // Cases differ threefold in size. A single cap sized for the small ones
    // terminates the large ones mid-run, and a truncated attempt is then scored
    // as a routing miss. configurator peaked at 0.64 against a 0.60 cap.
    '--max-budget-usd',
    String(testCase.maxBudgetUsd ?? options.maxBudgetUsd),
  ]
  if (options.model) args.push('--model', options.model)
  if (options.effort) args.push('--effort', options.effort)
  args.push(prompt)

  const run = spawnSync(options.providerExecutable, args, {
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
  const args = ['exec']
  if (options.model) args.push('--model', options.model)
  args.push(
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
  )
  const run = spawnSync(
    options.providerExecutable,
    args,
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

  /**
   * Forbidden patterns are scoped to the subtrees that hold shipped copy. A
   * contract may legitimately name the pattern it avoided; the copy may not
   * contain it.
   */
  if (testCase.forbiddenTerms) {
    for (const dottedPath of testCase.forbiddenTerms.paths) {
      const subtree = valueAtPath(result, dottedPath)
      if (subtree === undefined || subtree === null) {
        failures.push(`forbiddenTerms path "${dottedPath}" is missing from the response`)
        continue
      }
      const scoped = JSON.stringify(subtree)
      for (const pattern of testCase.forbiddenTerms.patterns) {
        const match = scoped.match(new RegExp(pattern, 'i'))
        if (match) {
          failures.push(`${dottedPath} contains slop pattern /${pattern}/i: "${match[0].slice(0, 60)}"`)
        }
      }
    }
  }
  failures.push(...lintGeneratedCopy(testCase, result))
  failures.push(...evaluateTrace(testCase, result, trace))
  return failures
}

/**
 * The catalogue has one executable form. Asserting Tier-1 patterns as regexes in
 * a fixture would duplicate scripts/lint-copy.mjs and drift from it, and a flat
 * pattern cannot express a Tier-3 budget at all, so the eval runs the linter the
 * project runs.
 */
function lintGeneratedCopy(testCase, result) {
  if (!testCase.lintCopy) return []
  const lines = valueAtPath(result, testCase.lintCopy.path)
  if (!Array.isArray(lines) || !lines.length) {
    return [`lintCopy path "${testCase.lintCopy.path}" holds no copy lines`]
  }

  const scratch = path.join(
    os.tmpdir(),
    `wdu-copy-${testCase.id}-${process.pid}-${Date.now()}.md`,
  )
  fs.writeFileSync(scratch, `${lines.join('\n\n')}\n`)
  try {
    const linter = spawnSync(
      process.execPath,
      [
        path.join(pluginRoot, 'scripts', 'lint-copy.mjs'),
        '--path',
        scratch,
        '--profile',
        testCase.lintCopy.profile,
        '--locale',
        testCase.lintCopy.locales.join(','),
        '--json',
      ],
      { encoding: 'utf8' },
    )
    let report = null
    try {
      report = JSON.parse(linter.stdout ?? '')
    } catch {
      report = null
    }
    if (!report) return ['lintCopy produced no linter report']
    if (report.status === 'PASS') return []
    return report.findings.map(
      (finding) => `copy lint tier ${finding.tier} ${finding.rule}: ${finding.quote}`,
    )
  } finally {
    fs.rmSync(scratch, { force: true })
  }
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
  for (const fixture of selfTest.fixtures ?? []) {
    console.log(
      `- historical ${fixture.provider}/${fixture.case}: plugin ${fixture.pluginVersion}, tree ${fixture.treeSha256.slice(0, 12)}, ${fixture.accessedFileCount} files`,
    )
  }
  console.log('Current case contracts:')
  for (const testCase of selectedCases) {
    console.log(`- ${testCase.id}: /website-design-ultra:${testCase.command}`)
  }
  process.exit(0)
}

const availability = probeProvider(options.provider, options.providerExecutable)
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
const attemptsByCase = new Map(selectedCases.map((testCase) => [testCase.id, []]))
for (const testCase of selectedCases) {
 for (let attempt = 1; attempt <= options.repeat; attempt += 1) {
  options.attempt = attempt
  const label = options.repeat > 1 ? `${testCase.id} [${attempt}/${options.repeat}]` : testCase.id
  const prompt = `Case ID: ${testCase.id}

/website-design-ultra:${testCase.command} ${testCase.prompt}

Use the loaded website-design-ultra plugin and return only the schema-constrained
planning contract. List every plugin skill actually used by exact folder name.
For non-3D work, return null/empty values for immersive fields. Read every routed
SKILL.md explicitly, then read only the references needed for this case. Always
return copy.lines and copy.slopChecks; use empty arrays when copy is not applicable. Do not
scan skill or reference directories broadly. The provider tool trace, not your
reported skill list, is the source of truth. Do not modify files.`

  const providerResult =
    options.provider === 'claude'
      ? runClaude(testCase, prompt, schema, options)
      : runCodex(testCase, prompt, options)
  const { run, tracePath } = providerResult

  if (run.error || run.status !== 0) {
    const providerError = providerErrorMessage(run)
    console.error(`FAIL ${label}: ${providerError}`)
    const record = {
      id: testCase.id,
      attempt,
      status: 'provider-error',
      failures: [providerError],
      tracePath,
    }
    results.push(record)
    attemptsByCase.get(testCase.id).push(record)
    continue
  }

  const { result, trace } = providerResult
  const failures = evaluate(testCase, result, trace)
  if (failures.length) {
    console.error(`FAIL ${label}: ${failures.join('; ')}`)
  } else {
    console.log(
      `PASS ${label} (${trace.accessedFiles.length} plugin files, ~${trace.estimatedPluginTokens} plugin tokens)`,
    )
  }
  const record = {
    id: testCase.id,
    attempt,
    status: failures.length ? 'failed' : 'passed',
    failures,
    result,
    trace,
    tracePath,
  }
  results.push(record)
  attemptsByCase.get(testCase.id).push(record)
 }
}

// Score by pass rate, not by the last attempt. A case is only as good as the
// distribution it produces; a single green attempt says nothing about it.
const summary = selectedCases.map((testCase) => {
  const attempts = attemptsByCase.get(testCase.id)
  const passed = attempts.filter((a) => a.status === 'passed').length
  // A crashed or timed-out CLI says nothing about routing. Counting it as a
  // routing failure understates the rate and hides the infrastructure problem.
  const errored = attempts.filter((a) => a.status === 'provider-error').length
  const scored = attempts.length - errored
  const passRate = scored ? passed / scored : 0
  // Count each distinct failure once per attempt so a reproducible failure is
  // visibly different from one that appeared in a single attempt.
  const failureCounts = {}
  for (const a of attempts) {
    if (a.status === 'provider-error') continue
    for (const f of new Set(a.failures ?? [])) failureCounts[f] = (failureCounts[f] ?? 0) + 1
  }
  return {
    id: testCase.id,
    attempts: attempts.length,
    scored,
    errored,
    passed,
    passRate,
    // With every attempt errored there is no evidence either way, so the case
    // cannot be called green. It is reported as unscored, not as a pass.
    meetsThreshold: scored > 0 && passRate >= options.minPassRate,
    failureCounts,
  }
})

writeReport(options, {
  generatedAt: new Date().toISOString(),
  provider: options.provider,
  providerStatus: availability,
  model: options.model,
  effort: options.effort,
  plugin: identity,
  provenance,
  selfTest,
  repeat: options.repeat,
  minPassRate: options.minPassRate,
  summary,
  results,
})

if (options.repeat > 1) {
  console.log(`\nPass rate over ${options.repeat} attempts (threshold ${options.minPassRate}):`)
  for (const entry of summary) {
    const rate = `${entry.passed}/${entry.scored}`
    const mark = entry.scored === 0 ? 'NONE ' : entry.meetsThreshold ? 'ok  ' : 'UNDER'
    const note = entry.errored ? `  (${entry.errored} provider error(s) excluded)` : ''
    console.log(
      `  ${mark} ${entry.id.padEnd(14)} ${rate.padStart(5)}  ${(entry.passRate * 100).toFixed(0)}%${note}`,
    )
    // Reproducible failures are the actionable ones; one-offs are noise.
    for (const [failure, count] of Object.entries(entry.failureCounts).sort((a, b) => b[1] - a[1])) {
      if (count > 1) console.log(`        ${count}x ${failure}`)
    }
  }
}

const under = summary.filter((entry) => !entry.meetsThreshold)
if (under.length) {
  console.error(
    `\nForward tests below threshold: ${under.length}/${summary.length} case(s) under ${options.minPassRate} (${under.map((e) => `${e.id} ${e.passed}/${e.scored}`).join(', ')})`,
  )
  process.exit(1)
}
console.log(
  `\nForward tests met threshold: ${summary.length}/${summary.length} case(s) at or above ${options.minPassRate}`,
)
