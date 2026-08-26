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
    if (entry === 'node_modules' || entry === '.next' || entry === '.wdu-model-source') continue
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
    !file.startsWith('scripts/') &&
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

  const client = read('components/SceneClient.tsx')
  assert.ok(client.includes("'use client'"))
  assert.ok(client.includes('next/dynamic'))
  assert.ok(client.includes('ssr: false'), 'the canvas leaf must be client-only')

  const canvas = read('components/SceneCanvas.tsx')
  assert.ok(canvas.includes("'use client'"))
})

test('exactly one clock is created and no wall-clock path exists in scene code', () => {
  const clockSites = SOURCES.filter((file) => read(file).includes('createClock('))
  // The definition lives in the copied runtime; the scene bootstrap is the
  // only call site.
  assert.deepEqual(clockSites, ['components/SceneRuntime.tsx', 'lib/determinism-runtime.ts'])

  // lib/telemetry-surface.ts is excluded for the same reason as
  // determinism-runtime.ts: its collect() deadline is verifier plumbing at
  // the outer boundary (bounded real-time wait for the ready marker), never
  // scene code — the document itself is built only from the injected clock.
  const wallClockSites = SOURCES.filter(
    (file) =>
      file !== 'lib/determinism-runtime.ts' &&
      file !== 'lib/telemetry-surface.ts' &&
      /performance\.now|Date\.now/.test(read(file)),
  )
  assert.deepEqual(wallClockSites, [], 'scene code must not read a wall clock')
})

test('exactly one camera owner exists', () => {
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

test('the fixture declares exactly one asset manifest', () => {
  const productionDirs = ['app', 'components', 'lib', 'public']
  const manifests = relativePaths().filter(
    (file) =>
      productionDirs.some((dir) => file.startsWith(`${dir}/`)) &&
      /manifest/i.test(file),
  )
  assert.deepEqual(manifests, ['lib/asset-manifest.json'])
})

test('the one optimized model is declared and local', () => {
  const manifest = JSON.parse(read('lib/asset-manifest.json'))
  const model = manifest.assets.find((asset) => asset.id === 'orbit-one-model')
  assert.ok(model, 'the manifest must declare the model asset')
  assert.equal(model.kind, 'model')
  assert.ok(model.url.startsWith('/'), 'model url must be a local path')
  assert.ok(
    read('lib/scene-config.ts').includes(`'${model.url}'`),
    'scene-config must reference the declared model url',
  )
})

test('no Vite starter, no particle template, no network-fetching helpers', () => {
  const files = relativePaths()
  assert.ok(!files.some((file) => /vite\.config/.test(file)), 'no vite.config may exist')
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

test('scene source declares no runtime fetch of undeclared assets', () => {
  // Every runtime asset is a manifest entry with a local url; no scene source
  // may construct a remote fetch. The model loads through the manifest url.
  for (const file of SOURCES) {
    const source = read(file)
    assert.ok(
      !/https?:\/\//.test(source),
      `${file} must not contain a remote url (runtime assets are local and manifest-declared)`,
    )
    assert.ok(
      !/\bfetch\(/.test(source),
      `${file} must not fetch at runtime (the loader reads the manifest url)`,
    )
  }
})

test('determinism is wired into the scene bootstrap', () => {
  const runtime = read('components/SceneRuntime.tsx')
  assert.ok(runtime.includes('createRandomStreams'))
  assert.ok(runtime.includes("stream('product-motion')"))
  assert.ok(runtime.includes('createStableFrameMarker'))
  assert.ok(runtime.includes('afterVisibleRender'))
  assert.ok(runtime.includes('onCameraApplied'))
  assert.ok(runtime.includes('markAssetsReady'), 'readiness must gate on the model')

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

  const runtime = read('components/SceneRuntime.tsx')
  assert.ok(runtime.includes('createQualityController'))
  assert.ok(runtime.includes('clock.elapsed * 1000'), 'controller time comes from the one clock')
})

test('the shared telemetry surface is created at exactly one site and exposed', () => {
  const surfaceSites = SOURCES.filter((file) =>
    read(file).includes('createImmersiveTelemetrySurface('),
  )
  assert.deepEqual(surfaceSites, [
    'components/SceneRuntime.tsx',
    'lib/telemetry-surface.ts',
  ])

  const runtime = read('components/SceneRuntime.tsx')
  assert.ok(runtime.includes('__WDU_IMMERSIVE_TELEMETRY__'))
  assert.ok(runtime.includes('delete globalThis'), 'the handle is removed on unmount')
  assert.ok(runtime.includes('telemetry.recordReady'), 'ready time is recorded on the surface')

  const qualityRuntime = read('components/QualityRuntime.tsx')
  assert.ok(
    qualityRuntime.includes('telemetry.recordFrameTimeMs'),
    'the telemetry sampler shares the quality sample source',
  )

  const gate = read('components/ContextLossGate.tsx')
  assert.ok(gate.includes('telemetry.recordContextLoss'), 'context loss reaches the surface')
})

test('fallback and lifecycle contracts are wired', () => {
  const client = read('components/SceneClient.tsx')
  assert.ok(client.includes('MotionControl'))
  assert.ok(client.includes('<Poster'))
  assert.ok(client.includes("variant={portrait ? 'portrait' : 'desktop'}"))
  assert.ok(client.includes('wdu:remount-scene'), 'the remount surface exists')
  assert.ok(client.includes('data-wdu-station'))
  assert.ok(client.includes('data-wdu-motion'))
  assert.ok(client.includes('data-wdu-context'))
  assert.ok(client.includes('hero-portrait'), 'portrait composition is wired')
  assert.ok(client.includes('restore-button'), 'the DOM action exists')
  assert.ok(
    client.includes('webglSupported'),
    'the WebGL gate decides whether the canvas mounts',
  )

  const motionControl = read('components/MotionControl.tsx')
  assert.ok(motionControl.includes('aria-pressed'), 'the control is a pressed-state button group')
  assert.ok(motionControl.includes('disabled={locked}'), 'deterministic mode locks the control')

  const poster = read('components/Poster.tsx')
  assert.ok(poster.includes('poster-desktop'))
  assert.ok(poster.includes('poster-portrait'))
  assert.ok(poster.includes('aria-hidden="true"'), 'the poster is decorative')

  const gate = read('components/ContextLossGate.tsx')
  assert.ok(gate.includes('webglcontextlost'))
  assert.ok(gate.includes('addEventListener'))
  assert.ok(gate.includes('removeEventListener'))
  assert.ok(gate.includes("forcePoster('context lost')"))
  assert.ok(gate.includes('preventDefault'))

  const model = read('components/ProductModel.tsx')
  assert.ok(model.includes('setMeshoptDecoder'), 'the meshopt decoder is wired')
  assert.ok(model.includes('markAssetsReady'), 'the model gates readiness')
  assert.ok(model.includes('.dispose()'), 'the model disposes its resources')
  assert.ok(model.includes('productRotationY'))

  const boundary = read('components/ModelErrorBoundary.tsx')
  assert.ok(boundary.includes("recordError('resource-load'"), 'load failures reach the surface')

  const runtime = read('components/SceneRuntime.tsx')
  assert.ok(runtime.includes('__WDU_CINEMATIC__'))
  assert.ok(runtime.includes('invalidateReady'))
  assert.ok(runtime.includes('stableFrameReached'))
  assert.ok(
    runtime.includes("if (mode === 'deterministic' && stableFrameReachedRef.current) return"),
    'the injected clock stops ticking once the stable frame is reached',
  )

  const qualityRuntime = read('components/QualityRuntime.tsx')
  assert.ok(qualityRuntime.includes("setFrameloop('never')"), 'the capture freeze exists')

  // R3F treats a useFrame subscriber with priority > 0 as a manual render
  // owner and disables its automatic gl.render call, leaving the canvas
  // blank. No subscriber in this fixture may use a positive priority.
  const positivePrioritySites = SOURCES.filter((file) =>
    /useFrame\s*\\([\s\S]{0,200}?,\s*[1-9]\d*\s*\\)/.test(read(file)),
  )
  assert.deepEqual(
    positivePrioritySites,
    [],
    'a positive useFrame priority would silently disable automatic rendering',
  )
})
