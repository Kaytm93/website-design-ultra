/**
 * The vanilla production contract, asserted.
 *
 * `r3f-patterns/references/vanilla-three.md` lists six obligations a plain
 * Three.js scene keeps even though it has no React to keep them for it. Each
 * one gets a case here. The point is not that the starter happens to satisfy
 * them today: it is that a copy which drops one fails loudly, which is the
 * failure mode the contract exists to prevent.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(join(root, file), 'utf8')

const pkg = JSON.parse(read('package.json'))
const scene = read('src/scene.ts')
const main = read('src/main.ts')
const html = read('index.html')

test('the Three.js version is pinned to an exact release', () => {
  const three = pkg.dependencies.three
  assert.match(three, /^\d+\.\d+\.\d+$/, 'three must be an exact version, not a range')
  assert.equal(
    pkg.devDependencies['@types/three'],
    three,
    'the type package must track the same release the code is verified against',
  )
})

test('output color space and tone mapping are set before anything is drawn', () => {
  assert.match(scene, /renderer\.outputColorSpace = SRGBColorSpace/)
  assert.match(scene, /renderer\.toneMapping = ACESFilmicToneMapping/)
  assert.match(scene, /toneMappingExposure/)
})

test('DPR is capped, and the cap is a pointer capability rather than a width', () => {
  const config = read('src/scene-config.ts')
  assert.match(config, /DPR_CEILING_DESKTOP = 2\b/)
  assert.match(config, /DPR_CEILING_MOBILE = 1\.5\b/)
  assert.match(scene, /Math\.min\(dpr, dprCeiling\(options\.coarsePointer\)\)/)
  assert.doesNotMatch(
    config,
    /innerWidth|max-width/,
    'a narrow desktop window is still a desktop; the ceiling follows the pointer',
  )
})

test('all three pause reasons are wired: hidden, offscreen, and context loss', () => {
  assert.match(read('src/lifecycle.ts'), /visibilitychange/)
  assert.match(main, /new IntersectionObserver/)
  assert.match(main, /webglcontextlost/)
  assert.match(main, /webglcontextrestored/)
})

test('the reduced-motion media query is observed, not only read once', () => {
  assert.match(main, /prefers-reduced-motion: reduce/)
  const lifecycle = read('src/lifecycle.ts')
  assert.match(lifecycle, /reducedMotionQuery\.addEventListener\('change', onMotion\)/)
  assert.match(lifecycle, /reducedMotionQuery\.removeEventListener\('change', onMotion\)/)
})

test('every GPU resource the scene allocates is released on teardown', () => {
  for (const call of [
    'geometry.dispose()',
    'material.dispose()',
    'renderer.dispose()',
    'scene.clear()',
  ]) {
    assert.ok(scene.includes(call), `dispose path is missing ${call}`)
  }
  assert.match(main, /scene\.dispose\(\)/)
  assert.match(main, /lifecycle\.dispose\(\)/)
  assert.match(main, /observer\?\.disconnect\(\)/)
})

test('the DOM layer is in the document, not created by the script', () => {
  assert.match(html, /<h1>/, 'the heading must exist before any script runs')
  assert.match(html, /data-scene-poster/)
  assert.match(html, /data-motion-toggle/)
  assert.ok(
    html.indexOf('<h1>') < html.indexOf('<script'),
    'the copy must precede the module that upgrades it',
  )
  assert.doesNotMatch(main, /createElement\('h1'\)/)
})

test('a missing renderer leaves the page intact instead of throwing', () => {
  assert.match(
    main,
    /} catch \{[\s\S]*posterLayer\.hidden = false[\s\S]*return\n {2}\}/,
    'construction failure must fall back to the poster, not to a blank page',
  )
})

test('the hero is neither a torus knot nor a default cube', () => {
  const sources = ['src/scene.ts', 'src/hero-geometry.ts', 'src/scene-config.ts']
  for (const file of sources) {
    const text = read(file)
    assert.doesNotMatch(text, /TorusKnot/i, `${file} ships a torus knot`)
    assert.doesNotMatch(text, /new BoxGeometry\(\s*\)/, `${file} ships a default cube`)
  }
})
