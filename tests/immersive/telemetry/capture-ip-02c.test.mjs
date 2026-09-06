import assert from 'node:assert/strict'
import test from 'node:test'
import { startFixtureServer, TRANSFER_PROBE_PATH, TRANSFER_PROBE_BYTES } from './capture-ip-02c.mjs'

test('the capture server supplies an uncached, successful transfer probe on every navigation', async () => {
  const { server, url } = await startFixtureServer('<p>fixture</p>')
  try {
    assert.equal(await (await fetch(url)).text(), '<p>fixture</p>')
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(new URL(TRANSFER_PROBE_PATH, url))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal((await response.arrayBuffer()).byteLength, TRANSFER_PROBE_BYTES)
    }
    assert.equal((await fetch(new URL('/missing', url))).status, 404)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
