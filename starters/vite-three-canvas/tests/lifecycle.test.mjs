/**
 * The lifecycle state machine, driven without a browser.
 *
 * Three reasons pause the loop and each is independent. The case that matters
 * is the one a single boolean gets wrong: a scene that becomes visible again
 * while still scrolled out of view must stay paused.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { createLifecycle } from '../src/lifecycle.ts'

function harness({ hidden = false, reduced = false } = {}) {
  const events = []
  const visibilityListeners = new Set()
  const motionListeners = new Set()
  const state = { hidden, reduced }

  const lifecycle = createLifecycle({
    host: {
      onRunStateChange: (runState, reason) => events.push({ type: 'run', runState, reason }),
      onReducedMotionChange: (value) => events.push({ type: 'motion', value }),
      onContextChange: (lost) => events.push({ type: 'context', lost }),
    },
    reducedMotionQuery: {
      get matches() {
        return state.reduced
      },
      addEventListener: (_type, listener) => motionListeners.add(listener),
      removeEventListener: (_type, listener) => motionListeners.delete(listener),
    },
    visibility: {
      get hidden() {
        return state.hidden
      },
      addEventListener: (_type, listener) => visibilityListeners.add(listener),
      removeEventListener: (_type, listener) => visibilityListeners.delete(listener),
    },
  })

  return {
    lifecycle,
    events,
    setHidden(value) {
      state.hidden = value
      for (const listener of visibilityListeners) listener()
    },
    setReduced(value) {
      state.reduced = value
      for (const listener of motionListeners) listener({ matches: value })
    },
    listenerCount: () => visibilityListeners.size + motionListeners.size,
  }
}

test('a visible, on-screen scene with a context runs', () => {
  const { lifecycle } = harness()
  assert.equal(lifecycle.runState, 'running')
})

test('a scene that starts hidden never reports a running state first', () => {
  const { lifecycle, events } = harness({ hidden: true })
  assert.equal(lifecycle.runState, 'paused')
  assert.deepEqual(
    events.filter((event) => event.type === 'run').map((event) => event.runState),
    ['paused'],
  )
})

test('any one reason pauses, and only the absence of all three resumes', () => {
  const rig = harness()
  rig.lifecycle.setOffscreen(true)
  assert.equal(rig.lifecycle.runState, 'paused')

  rig.setHidden(true)
  rig.setHidden(false)
  assert.equal(
    rig.lifecycle.runState,
    'paused',
    'coming back from hidden while still offscreen must not resume',
  )

  rig.lifecycle.setOffscreen(false)
  assert.equal(rig.lifecycle.runState, 'running')
})

test('context loss pauses and reports separately from visibility', () => {
  const rig = harness()
  rig.lifecycle.setContextLost(true)
  assert.equal(rig.lifecycle.runState, 'paused')
  assert.deepEqual(
    rig.events.filter((event) => event.type === 'context'),
    [{ type: 'context', lost: true }],
  )
  const reason = rig.events.findLast((event) => event.type === 'run').reason
  assert.deepEqual(reason, { hidden: false, offscreen: false, contextLost: true })

  rig.lifecycle.setContextLost(false)
  assert.equal(rig.lifecycle.runState, 'running')
})

test('an unchanged state emits nothing', () => {
  const rig = harness()
  const before = rig.events.length
  rig.lifecycle.setOffscreen(false)
  rig.setHidden(false)
  rig.lifecycle.setContextLost(false)
  assert.equal(rig.events.length, before, 'no-op transitions must not notify')
})

test('the reduced-motion query is reported on change only', () => {
  const rig = harness()
  rig.setReduced(true)
  rig.setReduced(true)
  assert.deepEqual(
    rig.events.filter((event) => event.type === 'motion'),
    [{ type: 'motion', value: true }],
  )
  assert.equal(rig.lifecycle.reducedMotion, true)
})

test('dispose removes every listener and is idempotent', () => {
  const rig = harness()
  assert.equal(rig.listenerCount(), 2)
  rig.lifecycle.dispose()
  assert.equal(rig.listenerCount(), 0)
  assert.doesNotThrow(() => rig.lifecycle.dispose())

  const before = rig.events.length
  rig.lifecycle.setOffscreen(true)
  assert.equal(rig.events.length, before, 'a disposed lifecycle must not still emit')
})
