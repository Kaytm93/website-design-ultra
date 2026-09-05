import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'

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
    yaml: 'add6c8b994',
    check: '3e3aa2fa3e',
  },
  '3d-runtime-quality': {
    yaml: '83b2e96b3f',
    check: '92d7137fc5',
  },
  'canvas-first-architecture': {
    yaml: 'e91077458a',
    check: 'cdc4027bd8',
  },
  'render-graph': {
    yaml: '8fb5b27742',
    check: 'ca27a788bb',
  },
  'loading-choreography': {
    yaml: '0c27d7369b',
    check: '6bf36e6a46',
  },
  'spatial-audio': {
    yaml: '759a80f86b',
    check: '7976ee6e0a',
  },
  'gpu-particle-systems': {
    check: 'f89884f613',
  },
  'procedural-3d': {
    check: '84cefbd72f',
  },
  'reference-intake': {
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
    assert.equal(digest(actual.check ?? ''), expected.check, `${name} checklist changed`)
  }
})

test('the vanilla contract is a routed reference, not master-skill prose', () => {
  const skill = fs.readFileSync(path.join(skillRoot, 'immersive-3d', 'SKILL.md'), 'utf8')
  const reference = path.join(skillRoot, 'r3f-patterns', 'references', 'vanilla-three.md')
  assert.ok(fs.existsSync(reference), 'vanilla baseline reference is missing')
  assert.match(skill, /r3f-patterns\/references\/vanilla-three\.md/)
  assert.doesNotMatch(skill, /vanilla-three-baseline\.md/)
  assert.doesNotMatch(skill, /## 6\. Vanilla Three\.js baseline/)
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
