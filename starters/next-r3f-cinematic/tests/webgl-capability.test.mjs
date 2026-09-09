import assert from 'node:assert/strict'
import test from 'node:test'
import { supportsWebGL2 } from '../lib/webgl-capability.ts'
test('missing or blocked WebGL2 retains the DOM fallback', () => {
  assert.equal(supportsWebGL2(() => ({ getContext: () => null })), false)
  assert.equal(supportsWebGL2(() => { throw Error('blocked') }), false)
})
test('a successful probe releases its temporary context', () => {
  let released = 0
  assert.equal(supportsWebGL2(() => ({ getContext: () => ({
    isContextLost: () => false,
    getExtension: () => ({ loseContext() { released++ } }),
  }) })), true)
  assert.equal(released, 1)
})
