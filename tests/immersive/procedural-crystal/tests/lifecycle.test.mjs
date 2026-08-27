import assert from 'node:assert/strict'
import test from 'node:test'

import { createQualityController } from '../lib/quality-controller.ts'
import { QUALITY_CONFIG } from '../lib/quality-config.ts'

test('the quality controller starts at medium and reaches poster on forcePoster', () => {
  let now = 0
  const q = createQualityController({ ...QUALITY_CONFIG, now: () => now })
  assert.equal(q.qualityState().tier, 'medium')
  q.forcePoster('webgl unavailable')
  // The poster tier is the failure state (context loss / missing WebGL) and
  // is by design not a tier the controller steps down out of — recovery
  // comes from the DOM remount, not measured adaptation.
  assert.equal(q.qualityState().tier, 'poster')
})

test('repeated quality-controller teardown does not leak intervals', () => {
  // The function-form attachVisibility(path) returns a detach handle that
  // MUST clear the interval it scheduled. We inject a counting scheduler
  // and assert the runtime surface explicitly: every attach produces one
  // interval, every detach clears that interval, and after N cycles no
  // intervals remain. A real leak leaves scheduled handles uncleared.
  const scheduled = new Set()
  const cleared = []
  const scheduler = {
    setInterval(handle, _ms) {
      const tag = Symbol('interval')
      scheduled.add(tag)
      return tag
    },
    clearInterval(handle) {
      cleared.push(handle)
      scheduled.delete(handle)
    },
  }

  let now = 0
  for (let i = 0; i < 5; i += 1) {
    const q = createQualityController({ ...QUALITY_CONFIG, now: () => now, scheduler })
    const detach = q.attachVisibility(() => true)
    detach()
  }

  assert.equal(scheduled.size, 0, 'attach/detach left intervals uncleared')
  assert.equal(cleared.length, 5, 'one clearInterval per attach/detach cycle')
})

test('recordFrameTime honors the hysteresis gate (no double-promotion in cooldown)', () => {
  let now = 0
  const q = createQualityController({ ...QUALITY_CONFIG, now: () => now })
  q.forcePoster('webgl unavailable')
  // Within cooldown: frame timing must not bounce back to medium even when
  // the recorded frames would otherwise justify it.
  now += 100
  for (let i = 0; i < 200; i += 1) {
    now += 50
    q.recordFrameTime(5)
  }
  assert.equal(q.qualityState().tier, 'poster')
  // Past cooldown: a sustained stretch of fast frames can promote again.
  now += QUALITY_CONFIG.cooldownMs + 1
  for (let i = 0; i < 200; i += 1) {
    now += 50
    q.recordFrameTime(5)
  }
  assert.notEqual(q.qualityState().tier, 'poster')
})