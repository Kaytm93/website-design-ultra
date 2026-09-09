import assert from 'node:assert/strict'
import test from 'node:test'
import { readStoredMotionPreference, writeStoredMotionPreference } from '../lib/motion-preference.ts'
test('blocked or exhausted storage does not break motion controls', () => {
  const blocked = { getItem() { throw Error('blocked') }, setItem() { throw Error('quota') } }
  assert.equal(readStoredMotionPreference(blocked), null)
  assert.doesNotThrow(() => writeStoredMotionPreference(blocked, 'reduced'))
})
