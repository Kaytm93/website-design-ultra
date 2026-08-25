import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir) {
  const entries = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (entry === 'node_modules' || entry === '.next') continue
    if (statSync(full).isDirectory()) {
      entries.push(...walk(full))
    } else {
      entries.push(join(dir, entry))
    }
  }
  return entries
}

function relativePaths() {
  return walk(root)
    .map((file) => file.slice(root.length + 1).replaceAll('\\', '/'))
    .sort()
}

const SOURCES = relativePaths().filter(
  (file) =>
    /\.(ts|tsx)$/.test(file) &&
    !file.startsWith('tests/') &&
    file !== 'next-env.d.ts' &&
    file !== 'next.config.mjs',
)

function read(file) {
  return readFileSync(join(root, file), 'utf8')
}

test('the page is a server component and the canvas is a client-only leaf', () => {
  const page = read('app/page.tsx')
  assert.ok(
    !page.includes("'use client'") && !page.includes('"use client"'),
    'app/page.tsx must not be a client component',
  )
  assert.ok(page.includes('SceneClient'), 'the page must mount the client loader')

  const loader = read('components/SceneClient.tsx')
  assert.ok(loader.includes("'use client'"))
  assert.ok(loader.includes('next/dynamic'))
  assert.ok(loader.includes('ssr: false'), 'the canvas leaf must be client-only')

  const canvas = read('components/SceneCanvas.tsx')
  assert.ok(canvas.includes("'use client'"))
})

test('exactly one clock is created and no wall-clock path exists in scene code', () => {
  const clockSites = SOURCES.filter((file) => read(file).includes('createClock('))
  // The definition lives in the copied runtime; the scene bootstrap is the
  // only call site.
  assert.deepEqual(clockSites, ['components/SceneRuntime.tsx', 'lib/determinism-runtime.ts'])

  const wallClockSites = SOURCES.filter(
    (file) =>
      file !== 'lib/determinism-runtime.ts' &&
      /performance\.now|Date\.now/.test(read(file)),
  )
  assert.deepEqual(wallClockSites, [], 'scene code must not read a wall clock')
})

test('exactly one camera owner exists', () => {
  // The invariant is camera *writes*: position, lookAt, or field of view.
  // (QualityRuntime legitimately reads the R3F store for gl and setFrameloop,
  // never the camera.)
  const cameraWriters = SOURCES.filter(
    (file) =>
      file.startsWith('components/') &&
      /camera\.position|camera\.lookAt|camera\.fov/.test(read(file)),
  )
  assert.deepEqual(cameraWriters, ['components/CameraRig.tsx'])

  const stationLookups = SOURCES.filter((file) => /getCameraStation\b/.test(read(file)))
  // Definition in the runtime, server-side validation in the page, and the
  // single application site in the rig.
  assert.deepEqual(stationLookups, [
    'app/page.tsx',
    'components/CameraRig.tsx',
    'lib/determinism-runtime.ts',
  ])
})

test('process environment is read only at the application boundary', () => {
  const envSites = SOURCES.filter((file) => read(file).includes('process.env'))
  assert.deepEqual(envSites, ['lib/runtime-config.ts'])
})

test('the starter declares exactly one asset manifest', () => {
  const productionDirs = ['app', 'components', 'lib', 'public']
  const manifests = relativePaths().filter(
    (file) =>
      productionDirs.some((dir) => file.startsWith(`${dir}/`)) &&
      /manifest/i.test(file),
  )
  assert.deepEqual(manifests, ['lib/asset-manifest.json'])
})

test('no Vite starter and no particle template is introduced', () => {
  const files = relativePaths()
  assert.ok(
    !files.some((file) => /vite\.config/.test(file)),
    'no vite.config may exist',
  )
  assert.ok(!files.some((file) => /particle/i.test(file)), 'no particle template files')
  assert.ok(
    !files.some((file) => /gpu-particle/i.test(file)),
    'no gpu-particle-lab template',
  )

  const pkg = JSON.parse(read('package.json'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  assert.ok(!('vite' in deps), 'vite must not be a dependency')
  assert.ok(!('@react-three/drei' in deps), 'no network-fetching helpers in the matrix')
})

test('determinism is wired into the scene bootstrap', () => {
  const runtime = read('components/SceneRuntime.tsx')
  assert.ok(runtime.includes('createRandomStreams'))
  assert.ok(runtime.includes("stream('hero-motion')"))
  assert.ok(runtime.includes('createStableFrameMarker'))
  assert.ok(runtime.includes('afterVisibleRender'))
  assert.ok(runtime.includes('onCameraApplied'))

  const config = read('lib/runtime-config.ts')
  assert.ok(config.includes('WDU_DETERMINISTIC'))
  assert.ok(config.includes('WDU_STATION'))

  const rig = read('components/CameraRig.tsx')
  assert.ok(rig.includes('onCameraApplied'), 'the rig reports station application')
})

test('the quality controller is created at exactly one site and owns every transition', () => {
  const qualitySites = SOURCES.filter((file) => read(file).includes('createQualityController('))
  // Definition in the copied controller, single creation site in the runtime.
  assert.deepEqual(qualitySites, [
    'components/SceneRuntime.tsx',
    'lib/quality-controller.ts',
  ])

  const canvas = read('components/SceneCanvas.tsx')
  assert.ok(!/dpr=/.test(canvas), 'the Canvas carries no dpr prop: the controller owns DPR')

  const dprWriters = SOURCES.filter((file) => read(file).includes('setPixelRatio'))
  assert.deepEqual(
    dprWriters,
    ['components/QualityRuntime.tsx'],
    'QualityRuntime is the only site that writes pixel ratio',
  )

  const qualityRuntime = read('components/QualityRuntime.tsx')
  assert.ok(!qualityRuntime.includes('useState'), 'no per-frame React state for quality')
  assert.ok(qualityRuntime.includes('recordFrameTime'))
  assert.ok(qualityRuntime.includes('attachVisibility'))

  // The only two R3F store readers: CameraRig (the camera owner) and
  // QualityRuntime (gl + setFrameloop). No other component touches the store.
  const storeReaders = SOURCES.filter((file) => read(file).includes('useThree'))
  assert.deepEqual(storeReaders, ['components/CameraRig.tsx', 'components/QualityRuntime.tsx'])

  const runtime = read('components/SceneRuntime.tsx')
  assert.ok(runtime.includes('createQualityController'))
  assert.ok(runtime.includes('clock.elapsed * 1000'), 'controller time comes from the one clock')
})

test('the quality controller and its config read no wall clock', () => {
  const wallClock = /performance\.now|Date\.now/
  for (const file of ['lib/quality-controller.ts', 'lib/quality-config.ts']) {
    assert.ok(!wallClock.test(read(file)), `${file} must not read a wall clock`)
  }
})
