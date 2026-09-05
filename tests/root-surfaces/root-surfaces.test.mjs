/**
 * The root-surface walk must describe the tree, not the host.
 *
 * `validate-content.mjs` classifies a starter's and the lab's files by path.
 * The dot-segment rule in that classification exists because the copy linter
 * skips dot-directories it walks into. Applied to an absolute path it stopped
 * being a rule about the tree: a checkout under a dot-directory —
 * `.claude/worktrees/<name>/`, where agent worktrees live — marked every file
 * in the repository as generated output, the lab counted zero source files,
 * and the validator reported it as a defect in the lab fixture's copy. CI
 * checks out to a normal path and never saw it.
 *
 * These cases run the real walk against roots whose absolute paths carry a
 * dot-segment, and pin the exclusions that rule is actually there for.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  countLabSources,
  isGeneratedVendorPath,
} from '../../website-design-ultra/scripts/root-surfaces.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** One lab-shaped tree: four source files, and everything a walk must skip. */
const LAB_TREE = {
  'routes/glass.tsx': 'export const Glass = () => null\n',
  'routes/particles.tsx': 'export const Particles = () => null\n',
  'lib/scene.ts': 'export const scene = {}\n',
  'README.md': '# lab\n',
  '.next/build-manifest.json': '{}\n',
  '.cache/routes/glass.tsx': 'export const Stale = () => null\n',
  'node_modules/three/index.js': 'module.exports = {}\n',
  'dist/routes/glass.js': 'export const Built = () => null\n',
  'package-lock.json': '{}\n',
  'tsconfig.tsbuildinfo': '{}\n',
}
const LAB_TREE_SOURCE_COUNT = 4

/** Materialize a tree under `root` and return `root`. */
function writeTree(root, tree) {
  for (const [relative, content] of Object.entries(tree)) {
    const target = path.join(root, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }
  return root
}

/**
 * A scratch directory whose own name begins with a dot, so every path below it
 * carries a dot-segment in its absolute form — the shape that broke the walk.
 */
function dottedRoot(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), '.wdu-root-surfaces-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  assert.ok(
    path
      .resolve(root)
      .split(path.sep)
      .some((segment) => segment.startsWith('.')),
    'the scratch root must actually contain a dot-segment for this suite to test anything',
  )
  return root
}

function plainRoot(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'wdu-root-surfaces-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return root
}

test('the lab walk counts sources under a root whose absolute path is dotted', (t) => {
  const labRoot = writeTree(path.join(dottedRoot(t), 'lab'), LAB_TREE)
  assert.equal(countLabSources(labRoot), LAB_TREE_SOURCE_COUNT)
})

test('the same tree counts the same from a dotted and an undotted root', (t) => {
  const dotted = writeTree(path.join(dottedRoot(t), 'lab'), LAB_TREE)
  const plain = writeTree(path.join(plainRoot(t), 'lab'), LAB_TREE)
  assert.equal(countLabSources(dotted), countLabSources(plain))
})

test('dot-directories, vendor output and lockfiles inside the surface stay excluded', (t) => {
  const labRoot = writeTree(path.join(dottedRoot(t), 'lab'), LAB_TREE)
  for (const excluded of [
    '.next/build-manifest.json',
    '.cache/routes/glass.tsx',
    'node_modules/three/index.js',
    'dist/routes/glass.js',
    'package-lock.json',
    'tsconfig.tsbuildinfo',
  ]) {
    assert.equal(
      isGeneratedVendorPath(path.join(labRoot, excluded), labRoot),
      true,
      `${excluded} must stay excluded`,
    )
  }
  for (const source of ['routes/glass.tsx', 'lib/scene.ts', 'README.md']) {
    assert.equal(
      isGeneratedVendorPath(path.join(labRoot, source), labRoot),
      false,
      `${source} is the surface's own source`,
    )
  }
})

test('a dot-segment above the surface root never classifies the files below it', (t) => {
  const checkout = path.join(dottedRoot(t), 'worktrees', 'wdu', 'lab')
  const labRoot = writeTree(checkout, { 'routes/glass.tsx': 'export const Glass = () => null\n' })
  assert.equal(isGeneratedVendorPath(path.join(labRoot, 'routes/glass.tsx'), labRoot), false)
  assert.equal(countLabSources(labRoot), 1)
})

test('the shipped lab fixture the validator asserts on is non-empty', () => {
  const fixtureLab = path.join(
    repoRoot,
    'website-design-ultra/tests/copy/fixtures/root-surfaces/lab',
  )
  assert.ok(fs.existsSync(fixtureLab), 'the root-surface lab fixture must exist')
  assert.ok(countLabSources(fixtureLab) > 0, 'the lab fixture must carry routes')
})
