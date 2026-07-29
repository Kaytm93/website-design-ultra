import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const digestIgnored = new Set(['.git', '.playwright-cli', 'node_modules', '.DS_Store'])
// Archived evidence is *about* the tree; it is not part of what a model can
// route over. Keeping it out of the digest means recording a trace does not
// invalidate the digest that trace was recorded against.
const digestIgnoredPaths = new Set(['tests/forward/traces'])

/**
 * Content digest of the plugin tree under test.
 *
 * A routing claim is about a specific tree, not about a folder name. The digest
 * is reproducible on any checkout, so a recorded trace can be re-bound to the
 * exact source it was produced from — with or without git.
 */
export function pluginTreeDigest(pluginRoot) {
  const root = path.resolve(pluginRoot)
  const files = []

  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (digestIgnored.has(entry.name)) continue
      const target = path.join(directory, entry.name)
      const relative = toPosix(path.relative(root, target))
      if (digestIgnoredPaths.has(relative)) continue
      if (entry.isDirectory()) walk(target)
      else if (entry.isFile()) files.push(target)
    }
  }
  walk(root)

  const tree = crypto.createHash('sha256')
  for (const file of files.sort()) {
    const relative = path.relative(root, file).replaceAll('\\', '/')
    const content = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    tree.update(`${relative}\0${content}\n`)
  }
  return { fileCount: files.length, sha256: tree.digest('hex') }
}

const markdownPathPattern = /(?:commands|skills)\/[a-zA-Z0-9._/-]+\.md/g
const pluginFileTail = /(?:^|\/)(?:commands|skills)\/[^\s"';&|]*\.md$/

function isContentReadCommand(command) {
  const shellReader =
    /(?:^|[;&|]\s*|[\s"'])(?:cat|sed|awk|head|tail|less|more|perl|python\d*|ruby|rg)(?:\s|$)/i
  const nodeReader = /\bnode\b[^;&|]*(?:readFile|readFileSync|createReadStream)\b/
  return shellReader.test(command) || nodeReader.test(command)
}

export function parseJsonLines(stdout) {
  const events = []
  for (const line of (stdout ?? '').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      events.push(JSON.parse(trimmed))
    } catch {
      // Provider warnings may be interleaved with JSONL. Ignore non-events.
    }
  }
  return events
}

function toPosix(value) {
  return value.replaceAll('\\', '/')
}

export function pluginIdentity(pluginRoot) {
  for (const manifest of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    const manifestPath = path.join(pluginRoot, manifest)
    if (!fs.existsSync(manifestPath)) continue
    try {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      if (parsed.name) return { name: parsed.name, version: parsed.version ?? null }
    } catch {
      // Fall through to the next manifest.
    }
  }
  return { name: null, version: null }
}

/**
 * Bind a provider-reported path to the plugin root under test.
 *
 * Evidence is only evidence when it is bound to the artifact under test. A path
 * that merely *looks* like a plugin file (an installed copy in ~/.claude, a
 * sibling checkout) is reported as `off-root` instead of silently counting as a
 * read of this plugin, and instead of being silently dropped.
 */
export function resolvePluginFile(candidate, pluginRoot) {
  if (typeof candidate !== 'string' || !candidate.trim()) return { status: 'not-plugin' }

  const root = path.resolve(pluginRoot)
  const raw = toPosix(candidate.trim())
  const looksLikePluginFile = pluginFileTail.test(raw)

  const isTildePath = raw === '~' || raw.startsWith('~/')
  const expanded = isTildePath ? path.join(os.homedir(), raw.slice(1)) : raw
  const absolute = path.isAbsolute(expanded) ? path.resolve(expanded) : path.resolve(root, expanded)
  const relative = path.relative(root, absolute)
  const inRoot = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)

  if (!inRoot) {
    return looksLikePluginFile ? { status: 'off-root', candidate: raw } : { status: 'not-plugin' }
  }

  const relativePath = toPosix(relative)
  if (!/^(?:commands|skills)\/.+\.md$/.test(relativePath)) return { status: 'not-plugin' }
  if (!fs.existsSync(absolute)) return { status: 'missing', relativePath }
  return { status: 'in-root', relativePath }
}

function collect(target, resolution) {
  if (resolution.status === 'in-root') target.files.add(resolution.relativePath)
  else if (resolution.status === 'off-root') target.offRoot.add(resolution.candidate)
  else if (resolution.status === 'missing') target.missing.add(resolution.relativePath)
}

function filesFromCommand(command, pluginRoot, target) {
  if (!isContentReadCommand(command)) return

  for (const match of command.matchAll(markdownPathPattern)) {
    collect(target, resolvePluginFile(match[0], pluginRoot))
  }
  for (const match of command.matchAll(/(?:^|[\s"'=])((?:~|\/)[^\s"';&|]*\.md)/g)) {
    collect(target, resolvePluginFile(match[1], pluginRoot))
  }

  const changedDirectory = command.match(
    /\bcd\s+["']?([^"';&|]*skills\/[a-z0-9-]+)["']?[^;&|]*[;&|]+\s*[^;&|]*\bSKILL\.md\b/i,
  )
  if (changedDirectory) {
    collect(target, resolvePluginFile(`${changedDirectory[1]}/SKILL.md`, pluginRoot))
  }
}

function isBroadContentRead(command) {
  if (!isContentReadCommand(command)) return false
  if (/\brg\s+--files\b/i.test(command)) return false

  const markdownGlob = /(?:commands|skills)\/[^ \n"';&|]*[*?{][^ \n"';&|]*/i
  const directoryTarget =
    /(?:commands|skills)(?:\/|\b)(?![a-z0-9._/-]+\.md\b)[^;&|]*(?:-g\s+["']?\*?\.md|--glob\s+["']?\*?\.md|-name\s+["']?\*?\.md)/i
  const recursiveReader =
    /\bfind\b[^;&|]*(?:commands|skills)[^;&|]*\b-exec\b|\bfind\b[^|]*\|\s*xargs\s+(?:cat|sed|awk|head|tail|rg)\b/i
  return markdownGlob.test(command) || directoryTarget.test(command) || recursiveReader.test(command)
}

/**
 * A Claude `Skill` invocation is namespaced `plugin:skill` for plugin skills.
 * Only skills that belong to the plugin under test and exist on disk count as
 * load evidence; a same-named skill from another plugin or from the user's own
 * installation is recorded separately and never credited.
 */
function skillFileFromInvocation(rawSkill, pluginRoot, pluginName) {
  if (typeof rawSkill !== 'string') return { status: 'ignored' }
  const trimmed = rawSkill.trim()
  const segments = trimmed.split(':')
  if (segments.length > 2) return { status: 'ignored' }

  let namespace = null
  let name = segments[0]
  if (segments.length === 2) {
    namespace = segments[0]
    name = segments[1]
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name ?? '')) return { status: 'ignored' }
  if (namespace && pluginName && namespace !== pluginName) {
    return { status: 'foreign', skill: trimmed }
  }

  const relativePath = `skills/${name}/SKILL.md`
  if (!fs.existsSync(path.join(pluginRoot, relativePath))) {
    return { status: 'foreign', skill: trimmed }
  }
  return { status: 'in-root', relativePath }
}

function emptyTarget() {
  return {
    files: new Set(),
    offRoot: new Set(),
    missing: new Set(),
    broadReads: new Set(),
    foreignSkills: new Set(),
  }
}

function summarizeTrace(target, pluginRoot, providerUsage = {}) {
  const uniqueFiles = [...target.files].sort()
  const referenceFiles = uniqueFiles.filter((file) => file.includes('/references/'))
  const skillFiles = uniqueFiles.filter((file) => /^skills\/[^/]+\/SKILL\.md$/.test(file))
  const commandFiles = uniqueFiles.filter((file) => file.startsWith('commands/'))
  let observedBytes = 0

  for (const file of uniqueFiles) {
    const absolutePath = path.join(pluginRoot, file)
    if (fs.existsSync(absolutePath)) observedBytes += fs.statSync(absolutePath).size
  }

  return {
    accessedFiles: uniqueFiles,
    skillFiles,
    referenceFiles,
    commandFiles,
    broadReads: [...target.broadReads],
    offRootReads: [...target.offRoot].sort(),
    missingFiles: [...target.missing].sort(),
    foreignSkills: [...target.foreignSkills].sort(),
    observedBytes,
    estimatedPluginTokens: Math.ceil(observedBytes / 4),
    providerUsage,
  }
}

export function auditCodexTrace(events, pluginRoot) {
  const target = emptyTarget()
  let providerUsage = {}

  for (const event of events) {
    if (event.type === 'item.completed' && event.item?.type === 'command_execution') {
      const command = event.item.command ?? ''
      filesFromCommand(command, pluginRoot, target)
      if (isBroadContentRead(command)) target.broadReads.add(command)
    }
    if (event.type === 'turn.completed' && event.usage) providerUsage = event.usage
  }
  return summarizeTrace(target, pluginRoot, providerUsage)
}

export function auditClaudeTrace(events, pluginRoot) {
  const target = emptyTarget()
  const { name: pluginName } = pluginIdentity(pluginRoot)
  let providerUsage = {}

  for (const event of events) {
    const blocks = event.message?.content
    if (event.type === 'assistant' && Array.isArray(blocks)) {
      for (const block of blocks) {
        if (block.type !== 'tool_use') continue
        const toolName = block.name?.toLowerCase()
        const input = block.input ?? {}

        if (toolName === 'read') {
          collect(target, resolvePluginFile(input.file_path ?? input.path, pluginRoot))
        } else if (toolName === 'grep') {
          const resolution = resolvePluginFile(input.path, pluginRoot)
          collect(target, resolution)
          if (
            input.output_mode === 'content' &&
            resolution.status !== 'in-root' &&
            /(?:commands|skills)(?:\/|$)/.test(input.path ?? '')
          ) {
            target.broadReads.add(`Grep ${input.path} (${input.pattern ?? ''})`)
          }
        } else if (toolName === 'bash') {
          const command = input.command ?? ''
          filesFromCommand(command, pluginRoot, target)
          if (isBroadContentRead(command)) target.broadReads.add(command)
        } else if (toolName === 'skill') {
          const invocation = skillFileFromInvocation(
            input.skill ?? input.name,
            pluginRoot,
            pluginName,
          )
          if (invocation.status === 'in-root') target.files.add(invocation.relativePath)
          else if (invocation.status === 'foreign') target.foreignSkills.add(invocation.skill)
        }
      }
    }
    if (event.type === 'result' && event.usage) providerUsage = event.usage
  }
  return summarizeTrace(target, pluginRoot, providerUsage)
}

function tryParseJson(value) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function extractClaudeStructuredOutput(events) {
  const resultEvent = [...events].reverse().find((event) => event.type === 'result')
  if (!resultEvent) return null
  if (resultEvent.structured_output && typeof resultEvent.structured_output === 'object') {
    return resultEvent.structured_output
  }
  if (typeof resultEvent.result === 'string') {
    const direct = tryParseJson(resultEvent.result)
    if (direct) return direct
    const fenced = resultEvent.result.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenced) return tryParseJson(fenced[1])
  }
  return null
}

function skillNameFromFile(file) {
  return file.match(/^skills\/([^/]+)\/SKILL\.md$/)?.[1] ?? null
}

export function evaluateTrace(testCase, result, trace) {
  const failures = []
  const contract = testCase.trace
  if (!contract) return ['missing trace contract']

  const accessed = new Set(trace.accessedFiles)
  const observedSkills = new Set(trace.skillFiles.map(skillNameFromFile).filter(Boolean))
  const reportedSkills = new Set(result.skills ?? [])
  const allowedSkills = new Set(contract.allowedSkills ?? testCase.requiredSkills)
  const allowedReferences = new Set(contract.allowedReferences ?? [])

  for (const file of contract.requiredFiles ?? []) {
    if (!accessed.has(file)) failures.push(`trace did not observe required file "${file}"`)
  }
  for (const file of contract.forbiddenFiles ?? []) {
    if (accessed.has(file)) failures.push(`trace observed forbidden file "${file}"`)
  }
  for (const skill of testCase.requiredSkills) {
    if (!observedSkills.has(skill)) failures.push(`trace did not observe skill "${skill}"`)
  }
  for (const skill of observedSkills) {
    if (!allowedSkills.has(skill)) failures.push(`trace observed unexpected skill "${skill}"`)
  }
  for (const skill of reportedSkills) {
    if (!observedSkills.has(skill)) failures.push(`reported skill "${skill}" lacks read evidence`)
  }
  for (const file of trace.referenceFiles) {
    if (!allowedReferences.has(file)) failures.push(`trace observed unexpected reference "${file}"`)
  }
  if (trace.referenceFiles.length > contract.maxReferenceFiles) {
    failures.push(
      `trace observed ${trace.referenceFiles.length} references; budget is ${contract.maxReferenceFiles}`,
    )
  }
  if (trace.estimatedPluginTokens > contract.maxEstimatedPluginTokens) {
    failures.push(
      `trace estimate ${trace.estimatedPluginTokens} plugin tokens exceeds ${contract.maxEstimatedPluginTokens}`,
    )
  }
  for (const broadRead of trace.broadReads) {
    failures.push(`trace cannot prove selective disclosure after broad read: ${broadRead}`)
  }
  for (const offRoot of trace.offRootReads ?? []) {
    failures.push(`trace observed a plugin-shaped read outside the tested root: ${offRoot}`)
  }
  for (const missing of trace.missingFiles ?? []) {
    failures.push(`trace referenced "${missing}", which does not exist in the tested root`)
  }
  for (const foreign of trace.foreignSkills ?? []) {
    failures.push(`trace observed a skill outside the tested plugin: ${foreign}`)
  }
  return failures
}

function assert(condition, message) {
  if (!condition) throw new Error(`provider trace parser self-test failed: ${message}`)
}

/**
 * Fixture conformance: recorded provider event streams are replayed against the
 * parser, so the Claude path stays covered on machines where no Claude Code CLI
 * is authenticated. Each fixture carries the expectations it was recorded with.
 */
export function replayRecordedTraces(pluginRoot) {
  const directory = path.join(pluginRoot, 'tests', 'forward', 'traces')
  if (!fs.existsSync(directory)) return { replayed: 0, fixtures: [] }

  let replayed = 0
  const fixtures = []
  for (const name of fs.readdirSync(directory).sort()) {
    if (!name.endsWith('.jsonl')) continue
    const expectationPath = path.join(directory, name.replace(/\.jsonl$/, '.expected.json'))
    assert(fs.existsSync(expectationPath), `${name}: recorded trace has no expectation file`)

    const expected = JSON.parse(fs.readFileSync(expectationPath, 'utf8'))
    assert(
      typeof expected.pluginVersion === 'string' && /^\d+\.\d+\.\d+/.test(expected.pluginVersion),
      `${name}: recorded trace has no semantic pluginVersion`,
    )
    assert(
      typeof expected.treeSha256 === 'string' && /^[a-f0-9]{64}$/.test(expected.treeSha256),
      `${name}: recorded trace has no valid treeSha256`,
    )
    // Recorded absolute paths are stored as {{PLUGIN_ROOT}} so the fixture stays
    // portable while still exercising absolute-path resolution and root binding.
    const raw = fs
      .readFileSync(path.join(directory, name), 'utf8')
      .replaceAll('{{PLUGIN_ROOT}}', toPosix(path.resolve(pluginRoot)))
    const events = parseJsonLines(raw)
    const trace =
      expected.provider === 'claude'
        ? auditClaudeTrace(events, pluginRoot)
        : auditCodexTrace(events, pluginRoot)

    for (const file of expected.accessedFiles ?? []) {
      assert(trace.accessedFiles.includes(file), `${name}: replay lost "${file}"`)
    }
    for (const file of expected.forbiddenFiles ?? []) {
      assert(!trace.accessedFiles.includes(file), `${name}: replay produced forbidden "${file}"`)
    }
    if (Number.isInteger(expected.accessedFileCount)) {
      assert(
        trace.accessedFiles.length === expected.accessedFileCount,
        `${name}: replay saw ${trace.accessedFiles.length} files, recorded ${expected.accessedFileCount}`,
      )
    }
    assert(trace.broadReads.length === 0, `${name}: replay reported a broad read`)
    assert(trace.offRootReads.length === 0, `${name}: replay reported an off-root read`)
    fixtures.push({
      file: name,
      provider: expected.provider,
      case: expected.case,
      pluginVersion: expected.pluginVersion,
      treeSha256: expected.treeSha256,
      accessedFileCount: trace.accessedFiles.length,
    })
    replayed += 1
  }
  return { replayed, fixtures }
}

export function selfTestTraceAudit(pluginRoot) {
  const { name: pluginName } = pluginIdentity(pluginRoot)
  assert(pluginName, 'plugin manifest name is unreadable')

  const codex = auditCodexTrace(
    [
      {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command:
            "/bin/zsh -lc \"sed -n '1,80p' skills/color-palettes/SKILL.md && sed -n '1,80p' skills/color-palettes/references/neutral-product.md\"",
        },
      },
      { type: 'turn.completed', usage: { input_tokens: 123 } },
    ],
    pluginRoot,
  )
  assert(
    codex.accessedFiles.includes('skills/color-palettes/references/neutral-product.md'),
    'codex relative read was not resolved',
  )
  assert(codex.broadReads.length === 0, 'codex selective read was flagged as broad')
  assert(codex.providerUsage.input_tokens === 123, 'codex usage was not captured')

  // Codex normally wraps a single reader in `/bin/zsh -lc "..."`. The opening
  // quote is the command boundary; requiring whitespace immediately before
  // `sed` dropped real reads unless a second `&& sed` happened to be present.
  const wrappedCodex = auditCodexTrace(
    [
      {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: '/bin/zsh -lc "sed -n \'1,80p\' skills/core-rules/SKILL.md"',
        },
      },
    ],
    pluginRoot,
  )
  assert(
    wrappedCodex.accessedFiles.includes('skills/core-rules/SKILL.md'),
    'single shell-wrapped Codex read was not resolved',
  )

  const claude = auditClaudeTrace(
    [
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: path.join(pluginRoot, 'skills/core-rules/SKILL.md') },
            },
          ],
        },
      },
    ],
    pluginRoot,
  )
  assert(
    claude.accessedFiles.includes('skills/core-rules/SKILL.md'),
    'claude absolute read was not resolved',
  )

  // Regression: plugin skills are invoked namespaced (`plugin:skill`). An
  // unnamespaced matcher dropped every Skill event, so a correct run failed as
  // "trace did not observe skill".
  const namespaced = auditClaudeTrace(
    [
      {
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', name: 'Skill', input: { skill: `${pluginName}:ui-states` } }],
        },
      },
    ],
    pluginRoot,
  )
  assert(
    namespaced.accessedFiles.includes('skills/ui-states/SKILL.md'),
    'namespaced Skill invocation was not credited',
  )

  // Regression: a same-named skill from another plugin is never evidence.
  const foreign = auditClaudeTrace(
    [
      {
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'other-plugin:ui-states' } }],
        },
      },
    ],
    pluginRoot,
  )
  assert(foreign.accessedFiles.length === 0, 'foreign plugin skill was credited as evidence')
  assert(foreign.foreignSkills.length === 1, 'foreign plugin skill was not recorded')

  // Regression: an installed copy of this plugin says nothing about the tree
  // under test, and must not be silently dropped either.
  const offRoot = auditClaudeTrace(
    [
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/tmp/some-other-checkout/skills/core-rules/SKILL.md' },
            },
          ],
        },
      },
    ],
    pluginRoot,
  )
  assert(offRoot.accessedFiles.length === 0, 'off-root read was credited as evidence')
  assert(offRoot.offRootReads.length === 1, 'off-root read was silently dropped')

  const broad = auditCodexTrace(
    [
      {
        type: 'item.completed',
        item: { type: 'command_execution', command: 'rg -n "fallback" skills -g "*.md"' },
      },
    ],
    pluginRoot,
  )
  assert(broad.broadReads.length === 1, 'broad read was not detected')

  const listing = auditCodexTrace(
    [{ type: 'item.completed', item: { type: 'command_execution', command: 'rg --files skills' } }],
    pluginRoot,
  )
  assert(listing.broadReads.length === 0, 'file listing was misread as a content read')

  const mentionOnly = auditCodexTrace(
    [
      {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: 'printf "%s\\n" skills/core-rules/SKILL.md',
        },
      },
    ],
    pluginRoot,
  )
  assert(mentionOnly.accessedFiles.length === 0, 'path mention was credited as read evidence')

  return replayRecordedTraces(pluginRoot)
}
