import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const verifier = path.join(root, 'website-design-ultra/scripts/verify-browser.mjs')

// Exercise the real verifier process with a capacity-limited CLI double. This
// checks resource ownership and error paths, not rendering or input evidence.
for (const scenario of ['capture', 'screenshot-failure', 'not-deterministic']) {
  test(`checkpoint sessions are released before the next browser opens: ${scenario}`, (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-session-lifecycle-'))
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
    const cli = path.join(directory, 'browser-cli.mjs')
    const statePath = path.join(directory, 'state.json')
    fs.writeFileSync(cli, `#!${process.execPath}
import fs from 'node:fs'
const args = process.argv.slice(2)
if (args[0] === '--help') {
  console.log('run-code -s=<session> screenshot')
  process.exit(0)
}
const statePath = process.env.WDU_TEST_STATE
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : { active: [], events: [], maxActive: 0 }
const session = args[0].slice(3)
const action = args[1]
state.events.push([session, action])
let error = null
if (action === 'open') {
  if (state.active.length) error = 'browser capacity exceeded: previous checkpoint still running'
  state.active.push(session)
  state.maxActive = Math.max(state.maxActive, state.active.length)
} else if (action === 'close') {
  state.active = state.active.filter((value) => value !== session)
} else if (action === 'run-code' && args.includes('--raw')) {
  console.log(JSON.stringify({
    mode: process.env.WDU_TEST_SCENARIO === 'not-deterministic' ? 'live' : 'deterministic',
    pointer: 'idle', ready: 'true',
  }))
} else if (action === 'screenshot') {
  if (process.env.WDU_TEST_SCENARIO === 'screenshot-failure' && session.endsWith('first')) {
    error = 'intentional screenshot failure'
  } else {
    fs.writeFileSync(args[args.indexOf('--filename') + 1], 'CLI double; not browser evidence')
  }
}
fs.writeFileSync(statePath, JSON.stringify(state))
if (error) {
  console.error('### Error\\n' + error)
  process.exitCode = 1
}
`, { mode: 0o755 })
    const manifest = path.join(directory, 'manifest.json')
    fs.writeFileSync(manifest, JSON.stringify({
      schemaVersion: 1, surface: 'wdu.interaction-checkpoints', project: 'session-lifecycle',
      modeInput: 'WDU_DETERMINISTIC=1', readyMarker: 'html[data-wdu-ready="true"]',
      checkpoints: ['first', 'second', 'third'].map((id) => ({ id, interaction: 'ready' })),
    }))
    const out = path.join(directory, 'capture')
    const result = spawnSync(process.execPath, [
      verifier, '--url', 'http://127.0.0.1:1', '--out', out, '--checkpoints', manifest,
    ], {
      encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, WDU_PLAYWRIGHT_CLI: cli, WDU_TEST_STATE: statePath, WDU_TEST_SCENARIO: scenario },
    })
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    assert.equal(state.maxActive, 1, 'a completed checkpoint must release its browser before the next opens')
    assert.deepEqual(state.active, [], 'all sessions close, including fail and unavailable paths')
    assert.deepEqual(state.events.filter(([, action]) => ['open', 'close'].includes(action)),
      ['first', 'second', 'third'].flatMap((id) => [
        [`wdu-checkpoint-${id}`, 'open'], [`wdu-checkpoint-${id}`, 'close'],
      ]))
    assert.equal(result.status, { capture: 0, 'screenshot-failure': 1, 'not-deterministic': 2 }[scenario], result.stderr)
    const summary = JSON.parse(fs.readFileSync(path.join(out, 'checkpoints-summary.json'), 'utf8'))
    assert.deepEqual(summary.counts, {
      capture: { captured: 3, failed: 0, unavailable: 0 },
      'screenshot-failure': { captured: 2, failed: 1, unavailable: 0 },
      'not-deterministic': { captured: 0, failed: 0, unavailable: 3 },
    }[scenario])
  })
}
