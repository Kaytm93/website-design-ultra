import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { settlePage } from '../../../website-design-ultra/scripts/verify-browser.mjs'

function browser(mode, waitForReady) {
  let paints = 0
  const context = vm.createContext({
    document: { documentElement: { getAttribute: () => mode }, fonts: { ready: Promise.resolve() }, images: [] },
    requestAnimationFrame(callback) { paints += 1; queueMicrotask(callback) },
  })
  const page = {
    async waitForLoadState(state) { assert.equal(state, 'domcontentloaded') },
    async evaluate(fn) { return vm.runInContext(`(${fn.toString()})()`, context) },
    async waitForSelector(selector, options) {
      assert.equal(selector, 'html[data-wdu-ready="true"]')
      assert.equal(options.state, 'attached')
      assert.equal(options.timeout, 10_000)
      await waitForReady()
    },
    async waitForTimeout(ms) { assert.equal(ms, 150) },
  }
  return { page, paints: () => paints }
}

test('a delayed deterministic scene settles only after readiness and DOM paints', async () => {
  let release
  const ready = new Promise((resolve) => { release = resolve })
  const b = browser('deterministic', () => ready)
  let complete = false
  const settled = settlePage(b.page).then(() => { complete = true })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(complete, false, 'a loading poster is not the settled reduced-motion state')
  assert.equal(b.paints(), 0)
  release()
  await settled
  assert.equal(b.paints(), 2)
})

test('a declared scene that never becomes ready leaves capture unavailable', async () => {
  const b = browser('deterministic', () => { throw new Error('ready marker timed out') })
  await assert.rejects(settlePage(b.page), /ready marker timed out/)
  assert.equal(b.paints(), 0)
})

test('ordinary pages need no scene marker', async () => {
  const b = browser(null, () => assert.fail('a generic page has no WDU readiness contract'))
  await settlePage(b.page)
  assert.equal(b.paints(), 0)
})
