import assert from 'node:assert/strict'
import test from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { BrowserUnavailableError, createBrowserContext, closeContext } from '../../starters/next-r3f-cinematic/scripts/browser-context.mjs'
import { browserExitCode } from './run.mjs'

const viewport = { width: 390, height: 844 }
const bounds = { attempts: 2, timeoutMs: 20, cleanupTimeoutMs: 10 }

test('retries a protocol rejection and creates the portrait viewport before page startup', async () => {
  const context = { close: async () => {} }
  let calls = 0
  const browser = { async newContext(options) {
    assert.deepEqual(options, { viewport })
    if (++calls === 1) throw Error('Browser.setDownloadBehavior: Failed to find browser context')
    return context
  } }
  assert.equal(await createBrowserContext(browser, { viewport }, bounds), context)
  assert.equal(calls, 2)
})

test('a never-settling context exhausts bounded retries as UNAVAILABLE', { timeout: 1_000 }, async () => {
  let calls = 0
  await assert.rejects(createBrowserContext({ newContext() {
    calls++
    return new Promise(() => {})
  } }, { viewport }, bounds), error => error instanceof BrowserUnavailableError &&
    /attempt 2\/2.*timed out/.test(error.message))
  assert.equal(calls, 2)
})

test('a late context is disposed without replacing the successful retry', async () => {
  let resolveLate
  let closed = 0
  const late = new Promise(resolve => { resolveLate = resolve })
  const current = {}
  let calls = 0
  const result = await createBrowserContext({ newContext: () => ++calls === 1 ? late : Promise.resolve(current) }, { viewport }, bounds)
  resolveLate({ close: async () => { closed++ } })
  await sleep(5)
  assert.equal(result, current)
  assert.equal(closed, 1)
})

test('broken cleanup cannot hang or replace an assertion', { timeout: 1_000 }, async () => {
  await closeContext({ close: () => new Promise(() => {}) }, 10)
  await closeContext({ close: async () => { throw Error('transport closed') } }, 10)
})

test('exit status preserves unavailable, assertion failures, mixed failures and incomplete runs', () => {
  assert.equal(browserExitCode(0, 'passed', []), 0)
  assert.equal(browserExitCode(1, 'failed', [{ unavailable: true }]), 2)
  assert.equal(browserExitCode(1, 'failed', [{ unavailable: false }]), 1)
  assert.equal(browserExitCode(1, 'failed', [{ unavailable: true }, { unavailable: false }]), 1)
  assert.equal(browserExitCode(0, null, []), 1)
  assert.equal(browserExitCode(null, null, [], true), 2)
})
