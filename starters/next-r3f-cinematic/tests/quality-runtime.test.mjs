import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Execute the component's real effects with controlled R3F inputs. No browser
// pixels are claimed here: this reproduces R3F replacing DPR on a size change.
const source = fs.readFileSync(new URL('../components/QualityRuntime.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function mount(mode) {
  let cursor = 0
  let ready = false
  let dpr = 1.5
  let pixelRatio = 2
  let frameloop = 'always'
  let resets = 0
  const slots = []
  const effects = []
  const frames = new Map()
  const listeners = new Set()
  const gl = { domElement: {}, setPixelRatio(value) { pixelRatio = value } }
  const state = { gl, size: { width: 1280, height: 720 }, setFrameloop(value) { frameloop = value } }
  const quality = {
    qualityState: () => ({ dpr: { value: dpr } }),
    snapshot: () => ({ paused: false }),
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    resetMeasurement() { resets += 1 },
    attachVisibility() {}, dispose() {}, recordFrameTime() {},
  }
  const changed = (old, deps) => !old || deps.some((value, i) => !Object.is(value, old.deps[i]))
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value } },
    useCallback(fn, deps) {
      const i = cursor++
      if (changed(slots[i], deps)) slots[i] = { deps, value: fn }
      return slots[i].value
    },
    useEffect(fn, deps) {
      const i = cursor++
      if (changed(slots[i], deps)) effects.push(() => {
        slots[i]?.cleanup?.()
        slots[i] = { deps, cleanup: fn() }
      })
    },
  }
  const runtime = { quality, mode, clock: { delta: 1 / 60 }, stableFrameReached: () => ready }
  const exports = {}
  vm.runInNewContext(compiled, { exports, require(name) {
    if (name === 'react') return react
    if (name === '@react-three/fiber') return {
      useThree: (select) => select(state),
      useFrame(fn, priority) { frames.set(cursor++, { fn, priority }) },
    }
    if (name === './SceneRuntime.tsx') return { useSceneRuntime: () => runtime }
    throw new Error(`Unexpected import: ${name}`)
  } })
  function render() {
    cursor = 0
    exports.QualityRuntime()
    effects.splice(0).forEach((effect) => effect())
  }
  render()
  return {
    snapshot: () => ({ pixelRatio, frameloop, resets }),
    ready() {
      ready = true
      for (const { fn } of [...frames.values()].sort((a, b) => a.priority - b.priority)) fn()
    },
    resize(width, height) {
      pixelRatio = 2 // R3F's default viewport DPR replaces the imperative value.
      state.size = { width, height }
      render()
    },
    tierChange(value) { dpr = value; listeners.forEach((fn) => fn()) },
  }
}

for (const mode of ['live', 'deterministic']) {
  test(`${mode}: resize restores controller DPR and invalidates old measurements`, () => {
    const scene = mount(mode)
    scene.ready()
    for (const [width, height] of [[1, 1], [1280, 720], [390, 844]]) {
      const before = scene.snapshot()
      scene.resize(width, height)
      assert.equal(scene.snapshot().pixelRatio, 1.5)
      assert.equal(scene.snapshot().resets, before.resets + 1)
      assert.equal(scene.snapshot().frameloop, mode === 'deterministic' ? 'never' : 'always')
    }
    scene.tierChange(1.25)
    assert.equal(scene.snapshot().pixelRatio, 1.25)
    assert.equal(scene.snapshot().frameloop, mode === 'deterministic' ? 'never' : 'always')
  })
}
