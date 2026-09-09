import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createProject } from '../../scripts/create-project.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('all copied runtime contracts match their source in the full checkout', () => {
  for (const dir of ['starters/next-r3f-cinematic/lib', 'starters/vite-three-canvas/src']) {
    for (const file of fs.readdirSync(path.join(root, 'references')).filter(file => file.endsWith('.ts'))) {
      const copy = path.join(root, dir, file)
      if (!fs.existsSync(copy)) continue
      assert.ok(fs.readFileSync(copy).equals(fs.readFileSync(path.join(root, 'references', file))), copy)
    }
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'references/package.json'))), { type: 'module' })
})
for (const starter of ['next', 'vanilla']) {
  test(`${starter}: clean export includes runnable verifier, tests, license and exact dependencies`, t => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-export-'))
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }))
    const out = createProject({ starter, out: path.join(temp, 'my site') })
    const pkg = JSON.parse(fs.readFileSync(path.join(out, 'package.json')))
    assert.equal(pkg.scripts['verify:browser'], 'node scripts/verify-browser.mjs')
    assert.equal(pkg.scripts['verify:ip06a'], undefined)
    assert.ok(fs.existsSync(path.join(out, 'LICENSE')))
    assert.equal(fs.existsSync(path.join(out, 'node_modules')), false)
    assert.equal(fs.existsSync(path.join(out, '.next')), false)
    assert.equal(fs.existsSync(path.join(out, 'dist')), false)
    const help = spawnSync(process.execPath, ['scripts/verify-browser.mjs', '--help'], { cwd: out, encoding: 'utf8' })
    assert.equal(help.status, 0, help.stderr)
    const checks = starter === 'next' ? ['tests/cinematic-timeline.test.mjs', 'tests/runtime.test.mjs',
      'tests/interaction-checkpoints.test.mjs', 'tests/quality-controller.test.mjs'] : ['tests/scene-contract.test.mjs']
    const run = spawnSync(process.execPath, ['--test', ...checks], { cwd: out, encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr || run.stdout)
    assert.doesNotMatch(run.stdout, /# SKIP/)
    // A second invocation must never overwrite project work.
    fs.writeFileSync(path.join(out, 'my-work.txt'), 'keep')
    assert.throws(() => createProject({ starter, out }), /already exists/)
    assert.equal(fs.readFileSync(path.join(out, 'my-work.txt'), 'utf8'), 'keep')
  })
}
test('invalid starter and destinations inside the source repository are refused', () => {
  assert.throws(() => createProject({ starter: 'missing', out: '../test' }), /Choose --starter/)
  assert.throws(() => createProject({ starter: 'next', out: root }), /outside/)
})
