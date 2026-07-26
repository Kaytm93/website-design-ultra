import fs from 'node:fs'
import path from 'node:path'

const markdownPathPattern = /(?:commands|skills)\/[a-zA-Z0-9._/-]+\.md/g

export function parseJsonLines(stdout) {
  const events = []
  for (const line of stdout.split(/\r?\n/)) {
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

function normalizePluginFile(candidate, pluginRoot) {
  if (typeof candidate !== 'string') return null
  const normalizedCandidate = candidate.replaceAll('\\', '/')
  const normalizedRoot = pluginRoot.replaceAll('\\', '/').replace(/\/+$/, '')
  const withoutRoot = normalizedCandidate.startsWith(`${normalizedRoot}/`)
    ? normalizedCandidate.slice(normalizedRoot.length + 1)
    : normalizedCandidate
  const marker = withoutRoot.match(/(?:^|\/)((?:commands|skills)\/.+\.md)$/)
  if (!marker) return null
  const relativePath = path.posix.normalize(marker[1])
  if (relativePath.startsWith('../')) return null
  return relativePath
}

function filesFromCommand(command, pluginRoot) {
  const files = new Set()
  for (const match of command.matchAll(markdownPathPattern)) {
    const file = normalizePluginFile(match[0], pluginRoot)
    if (file) files.add(file)
  }

  const changedDirectory = command.match(
    /\bcd\s+["']?([^"';&|]*skills\/[a-z0-9-]+)["']?[^;&|]*[;&|]+\s*[^;&|]*\bSKILL\.md\b/i,
  )
  if (changedDirectory) {
    const directory = normalizePluginFile(`${changedDirectory[1]}/SKILL.md`, pluginRoot)
    if (directory) files.add(directory)
  }
  return files
}

function isBroadContentRead(command) {
  const contentReader =
    /(?:^|[;&|]\s*|\s)(?:cat|sed|awk|head|tail|less|more|perl|python\d*|ruby|rg)(?:\s|$)/i
  if (!contentReader.test(command)) return false
  if (/\brg\s+--files\b/i.test(command)) return false

  const markdownGlob = /(?:commands|skills)\/[^ \n"';&|]*[*?{][^ \n"';&|]*/i
  const directoryTarget =
    /(?:commands|skills)(?:\/|\b)(?![a-z0-9._/-]+\.md\b)[^;&|]*(?:-g\s+["']?\*?\.md|--glob\s+["']?\*?\.md|-name\s+["']?\*?\.md)/i
  const recursiveReader =
    /\bfind\b[^;&|]*(?:commands|skills)[^;&|]*\b-exec\b|\bfind\b[^|]*\|\s*xargs\s+(?:cat|sed|awk|head|tail|rg)\b/i
  return markdownGlob.test(command) || directoryTarget.test(command) || recursiveReader.test(command)
}

function summarizeTrace(accessedFiles, broadReads, pluginRoot, providerUsage = {}) {
  const uniqueFiles = [...new Set(accessedFiles)].sort()
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
    broadReads: [...new Set(broadReads)],
    observedBytes,
    estimatedPluginTokens: Math.ceil(observedBytes / 4),
    providerUsage,
  }
}

export function auditCodexTrace(events, pluginRoot) {
  const accessedFiles = []
  const broadReads = []
  let providerUsage = {}

  for (const event of events) {
    if (event.type === 'item.completed' && event.item?.type === 'command_execution') {
      const command = event.item.command ?? ''
      accessedFiles.push(...filesFromCommand(command, pluginRoot))
      if (isBroadContentRead(command)) broadReads.push(command)
    }
    if (event.type === 'turn.completed' && event.usage) providerUsage = event.usage
  }
  return summarizeTrace(accessedFiles, broadReads, pluginRoot, providerUsage)
}

export function auditClaudeTrace(events, pluginRoot) {
  const accessedFiles = []
  const broadReads = []
  let providerUsage = {}

  for (const event of events) {
    const blocks = event.message?.content
    if (event.type === 'assistant' && Array.isArray(blocks)) {
      for (const block of blocks) {
        if (block.type !== 'tool_use') continue
        const toolName = block.name?.toLowerCase()
        const input = block.input ?? {}

        if (toolName === 'read') {
          const file = normalizePluginFile(input.file_path ?? input.path, pluginRoot)
          if (file) accessedFiles.push(file)
        } else if (toolName === 'grep') {
          const file = normalizePluginFile(input.path, pluginRoot)
          if (file) accessedFiles.push(file)
          else if (/(?:commands|skills)(?:\/|$)/.test(input.path ?? '')) {
            broadReads.push(`Grep ${input.path}`)
          }
        } else if (toolName === 'bash') {
          const command = input.command ?? ''
          accessedFiles.push(...filesFromCommand(command, pluginRoot))
          if (isBroadContentRead(command)) broadReads.push(command)
        } else if (toolName === 'skill') {
          const skill = input.skill ?? input.name
          if (/^[a-z0-9-]+$/.test(skill ?? '')) {
            accessedFiles.push(`skills/${skill}/SKILL.md`)
          }
        }
      }
    }
    if (event.type === 'result' && event.usage) providerUsage = event.usage
  }
  return summarizeTrace(accessedFiles, broadReads, pluginRoot, providerUsage)
}

export function extractClaudeStructuredOutput(events) {
  const resultEvent = [...events].reverse().find((event) => event.type === 'result')
  if (!resultEvent) return null
  if (resultEvent.structured_output && typeof resultEvent.structured_output === 'object') {
    return resultEvent.structured_output
  }
  if (typeof resultEvent.result === 'string') {
    try {
      return JSON.parse(resultEvent.result)
    } catch {
      return null
    }
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
  return failures
}

export function selfTestTraceAudit(pluginRoot) {
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
  const broad = auditCodexTrace(
    [
      {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: 'rg -n "fallback" skills -g "*.md"',
        },
      },
    ],
    pluginRoot,
  )

  if (
    !codex.accessedFiles.includes('skills/color-palettes/references/neutral-product.md') ||
    codex.broadReads.length !== 0 ||
    codex.providerUsage.input_tokens !== 123 ||
    !claude.accessedFiles.includes('skills/core-rules/SKILL.md') ||
    broad.broadReads.length !== 1
  ) {
    throw new Error('provider trace parser self-test failed')
  }
}
