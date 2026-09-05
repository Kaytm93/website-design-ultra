import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import os from 'node:os'
import { auditClaudeTrace, auditCodexTrace, evaluateTrace } from '../../website-design-ultra/scripts/forward-trace.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const pluginRoot = path.join(repoRoot, 'website-design-ultra')
const skillRoot = path.join(pluginRoot, 'skills')

const compressed3dSkills = [
  'immersive-3d',
  '3d-art-direction',
  '3d-runtime-quality',
  'loading-choreography',
  'procedural-3d',
  'canvas-first-architecture',
  'render-graph',
  'spatial-audio',
  'gpu-particle-systems',
  'reference-intake',
]

const baselineHashes = {
  '3d-art-direction': {
    items: 9,
    yaml: 'add6c8b994',
    check: 'bef083483e',
  },
  '3d-runtime-quality': {
    items: 8,
    yaml: '83b2e96b3f',
    check: '92d7137fc5',
  },
  'canvas-first-architecture': {
    items: 9,
    yaml: 'e91077458a',
    check: 'cdc4027bd8',
  },
  'render-graph': {
    items: 8,
    yaml: '8fb5b27742',
    check: 'ca27a788bb',
  },
  'loading-choreography': {
    items: 8,
    yaml: '0c27d7369b',
    check: '6bf36e6a46',
  },
  'spatial-audio': {
    items: 10,
    yaml: '759a80f86b',
    check: '7976ee6e0a',
  },
  'gpu-particle-systems': {
    items: 9,
    check: 'f89884f613',
  },
  'procedural-3d': {
    items: 6,
    check: '84cefbd72f',
  },
  'reference-intake': {
    items: 7,
    check: 'c9d7db20bd',
  },
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 10)
}

function blocks(markdown) {
  return {
    yaml: [...markdown.matchAll(/```yaml\n(.*?)\n```/gs)].map((match) => match[1]),
    check: markdown.match(/## Check\n([\s\S]*)$/)?.[1] ?? null,
  }
}

test('the ten compressed 3D skills stay within the 5 KB budget', () => {
  for (const name of compressed3dSkills) {
    const file = path.join(skillRoot, name, 'SKILL.md')
    assert.ok(fs.statSync(file).size <= 5000, `${name} exceeds 5000 bytes`)
  }
})

test('contract YAML and checklists preserve their baseline bytes', () => {
  for (const [name, expected] of Object.entries(baselineHashes)) {
    const actual = blocks(fs.readFileSync(path.join(skillRoot, name, 'SKILL.md'), 'utf8'))
    if (expected.yaml) {
      assert.equal(actual.yaml.length, 1, `${name} YAML block count changed`)
      assert.equal(digest(actual.yaml[0]), expected.yaml, `${name} YAML changed`)
    }
    // The hash is the byte contract; the count is what the hash is *for*.
    // Re-baselining a hash after an intended addition is routine, and a hash
    // alone cannot tell an addition from a deletion — so a dropped item has to
    // fail a second, independently stated assertion.
    assert.ok(
      (actual.check ?? '').match(/^- \[ \]/gm)?.length >= expected.items,
      `${name} lost a checklist item`,
    )
    assert.equal(digest(actual.check ?? ''), expected.check, `${name} checklist changed`)
  }
})

test('the vanilla contract is routed, not master-skill prose', () => {
  const skill = fs.readFileSync(path.join(skillRoot, 'immersive-3d', 'SKILL.md'), 'utf8')
  // J-B4 lifted the contract out of §6 into a reference; J-D1 promoted it to a
  // skill with a runnable starter behind it. What the test is for is unchanged:
  // the master skill routes to the contract and does not restate it. Either
  // destination satisfies that; inline prose satisfies neither.
  const reference = path.join(skillRoot, 'r3f-patterns', 'references', 'vanilla-three.md')
  const skillTarget = path.join(skillRoot, 'vanilla-three-production', 'SKILL.md')
  assert.ok(
    fs.existsSync(reference) || fs.existsSync(skillTarget),
    'the vanilla baseline exists as neither a reference nor a skill',
  )
  assert.match(skill, /r3f-patterns\/references\/vanilla-three\.md|`vanilla-three-production`/)
  assert.doesNotMatch(skill, /vanilla-three-baseline\.md/)
  assert.doesNotMatch(skill, /## 6\. Vanilla Three\.js baseline/)
  // The contract's own obligations must not have leaked back into the master.
  assert.doesNotMatch(skill, /setAnimationLoop|IntersectionObserver|matchMedia/)
})

test('the path measurement command enforces the 3D hero bounds', () => {
  const result = spawnSync(process.execPath, ['scripts/measure-path.mjs', '--case', '3d-hero'], {
    cwd: pluginRoot,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /3d-hero/)
  assert.match(result.stdout, /57,?000|57 KB/i)
  assert.match(result.stdout, /15,?000|15 KB/i)
})

test('content validation binds each declared path budget', () => {
  const validator = fs.readFileSync(path.join(pluginRoot, 'scripts', 'validate-content.mjs'), 'utf8')
  assert.match(validator, /measure-path\.mjs/)
  assert.match(validator, /maxEstimatedPluginTokens/)
  assert.match(validator, /spawnSync/)
})

test('non-hero cases do not inherit the 3D byte cap', () => {
  const result = spawnSync(process.execPath, ['scripts/measure-path.mjs', '--case', 'editorial'], {
    cwd: pluginRoot,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /no byte cap declared/i)
})

test('the tweak command enforces its installed baseline budget, including the command', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-tweak-budget-'))
  try {
    for (const relative of ['scripts/measure-path.mjs', 'commands/tweak.md', 'skills/core-rules/SKILL.md']) {
      const destination = path.join(temporary, relative)
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.copyFileSync(path.join(pluginRoot, relative), destination)
    }
    const run = () => spawnSync(process.execPath, ['scripts/measure-path.mjs', '--command', 'tweak'], {
      cwd: temporary, encoding: 'utf8',
    })
    assert.equal(run().status, 0)
    fs.appendFileSync(path.join(temporary, 'commands/tweak.md'), 'x'.repeat(8000))
    assert.equal(run().status, 1, 'an oversized command must fail even when the router fits')
    assert.ok(fs.statSync(path.join(skillRoot, 'core-rules/SKILL.md')).size <= 6000)
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
})

test('provider traces count repeated owner reads without double-counting path matches', () => {
  const file = 'skills/core-rules/SKILL.md'
  const command = `cat '${path.join(pluginRoot, file)}'`
  const codexEvent = (id) => ({ type: 'item.completed', item: { id, type: 'command_execution', command } })
  const claudeEvent = (id) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name: 'Read', input: { file_path: path.join(pluginRoot, file) } }] } })
  const testCase = {
    requiredSkills: ['core-rules'],
    trace: { allowedSkills: ['core-rules'], allowedReferences: [], maxReferenceFiles: 0,
      maxEstimatedPluginTokens: 15000, maxFileReads: { [file]: 1 } },
  }
  for (const [audit, event] of [[auditCodexTrace, codexEvent], [auditClaudeTrace, claudeEvent]]) {
    const single = audit([event('a')], pluginRoot)
    assert.equal(single.readCounts[file], 1)
    assert.deepEqual(evaluateTrace(testCase, { skills: ['core-rules'] }, single), [])
    const repeated = audit([event('a'), event('b')], pluginRoot)
    assert.equal(repeated.readCounts[file], 2)
    assert.ok(evaluateTrace(testCase, { skills: ['core-rules'] }, repeated).some((failure) => failure.includes('read count')))
  }
})
