import assert from 'node:assert/strict'
import test from 'node:test'
import { createQualityController } from '../lib/quality-controller.ts'
import { QUALITY_CONFIG } from '../lib/quality-config.ts'

function environment(t, visibilityState = 'visible') {
  const listeners = new Set(), observers = []
  const document = { visibilityState,
    addEventListener(type, fn) { listeners.add(fn) },
    removeEventListener(type, fn) { listeners.delete(fn) },
  }
  for (const [name, value] of Object.entries({ document, IntersectionObserver: class {
    constructor(callback) { this.callback = callback; this.connected = false; observers.push(this) }
    observe() { this.connected = true }
    disconnect() { this.connected = false }
  } })) {
    const prior = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    t.after(() => prior ? Object.defineProperty(globalThis, name, prior) : delete globalThis[name])
  }
  const controller = createQualityController({ ...QUALITY_CONFIG, storage: null, now: () => 0 })
  t.after(() => controller.dispose())
  return { controller, listeners, observers,
    attach() { controller.attachVisibility({ ownerDocument: document }) },
    screen(value) { observers.at(-1).callback([{ isIntersecting: value }]) },
    tab(value) { document.visibilityState = value; listeners.forEach(fn => fn()) },
  }
}

test('returning to a visible tab does not resume a scene still outside the viewport', t => {
  const h = environment(t); h.attach(); h.screen(false); h.tab('hidden'); h.tab('visible')
  assert.equal(h.controller.snapshot().paused, true)
  h.screen(true)
  assert.equal(h.controller.snapshot().paused, false)
})
test('intersection cannot resume a scene in a hidden tab, including initial attachment', t => {
  const h = environment(t, 'hidden'); h.attach()
  assert.equal(h.controller.snapshot().paused, true)
  h.screen(true)
  assert.equal(h.controller.snapshot().paused, true)
  h.tab('visible')
  assert.equal(h.controller.snapshot().paused, false)
})
test('repeated attachment replaces observers and effect cleanup can reattach', t => {
  const h = environment(t)
  h.attach(); h.attach()
  assert.equal(h.listeners.size, 1)
  assert.equal(h.observers.filter(o => o.connected).length, 1)
  h.controller.dispose()
  assert.equal(h.listeners.size, 0)
  assert.equal(h.observers.filter(o => o.connected).length, 0)
  h.attach(); h.screen(false)
  assert.equal(h.listeners.size, 1)
  assert.equal(h.controller.snapshot().paused, true)
})
test('a blocked sessionStorage getter cannot prevent construction', t => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw Error('blocked') } })
  t.after(() => prior ? Object.defineProperty(globalThis, 'sessionStorage', prior) : delete globalThis.sessionStorage)
  assert.doesNotThrow(() => createQualityController({ ...QUALITY_CONFIG, now: () => 0 }))
})
