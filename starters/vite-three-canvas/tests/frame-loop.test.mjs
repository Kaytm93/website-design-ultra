import assert from 'node:assert/strict'
import test from 'node:test'
import { createFrameLoop } from '../src/frame-loop.ts'

function harness() {
  let id = 0, renders = 0, pauses = 0, resumes = 0, continuous = true
  const pending = new Map()
  const loop = createFrameLoop({
    request(fn) { pending.set(++id, fn); return id },
    cancel(id) { pending.delete(id) },
    render() { renders++ },
    continuous: () => continuous,
    onPause() { pauses++ }, onResume() { resumes++ },
  })
  return { loop, pending, snapshot: () => ({ renders, pauses, resumes }),
    still() { continuous = false },
    tick() { const jobs = [...pending.values()]; pending.clear(); jobs.forEach(fn => fn(0)) },
  }
}

test('rapid pause/resume and repeated invalidation keep exactly one pending frame', () => {
  const h = harness()
  h.loop.setPaused(false)
  for (let i = 0; i < 20; i++) {
    h.loop.invalidate(); h.loop.setPaused(true); h.loop.setPaused(false)
    assert.equal(h.pending.size, 1)
  }
  h.tick()
  assert.equal(h.snapshot().renders, 1)
  assert.equal(h.pending.size, 1)
})
test('pausing cancels work and resets time only when resuming', () => {
  const h = harness()
  h.loop.setPaused(false); h.loop.setPaused(true); h.loop.setPaused(true); h.tick()
  assert.equal(h.snapshot().renders, 0)
  assert.equal(h.pending.size, 0)
  assert.deepEqual(h.snapshot(), { renders: 0, pauses: 1, resumes: 1 })
  h.loop.setPaused(false); h.tick()
  assert.equal(h.snapshot().resumes, 2)
})
test('a reduced or deterministic scene renders on demand and then stops scheduling', () => {
  const h = harness(); h.still(); h.loop.setPaused(false); h.tick()
  assert.equal(h.pending.size, 0)
  h.loop.invalidate(); h.loop.invalidate(); h.tick()
  assert.equal(h.snapshot().renders, 2)
  assert.equal(h.pending.size, 0)
})
test('a callback already dequeued by the host cannot render after pause or disposal', () => {
  for (const finish of ['pause', 'dispose']) {
    const h = harness(); h.loop.setPaused(false)
    const callback = [...h.pending.values()][0]
    if (finish === 'pause') h.loop.setPaused(true)
    else h.loop.dispose()
    callback(0)
    assert.equal(h.snapshot().renders, 0)
    assert.equal(h.pending.size, 0)
  }
})
test('disposal is idempotent and prevents later scheduling', () => {
  const h = harness(); h.loop.setPaused(false); h.loop.dispose(); h.loop.dispose()
  h.loop.setPaused(false); h.loop.invalidate(); h.tick()
  assert.equal(h.pending.size, 0)
  assert.equal(h.snapshot().renders, 0)
  assert.equal(h.snapshot().pauses, 1)
})
