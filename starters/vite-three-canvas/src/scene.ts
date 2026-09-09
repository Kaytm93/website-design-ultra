/**
 * The scene: one renderer, one camera owner, one clock, one disposal path.
 *
 * This is the only module that imports Three.js. Everything the tests assert —
 * the pose function, the geometry, the lifecycle state machine, the quality
 * controller — lives in modules that do not, so the contract is verified in
 * Node and this file stays the thin binding between it and the GPU.
 */

import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'

import { CAMERA_STATIONS, type StationId } from './camera-stations.ts'
import { createClock, createStableFrameMarker, getCameraStation } from './determinism-runtime.ts'
import type { SceneClock, StableFrameMarker } from './determinism-runtime.ts'
import { buildHeroGeometry } from './hero-geometry.ts'
import type { MotionPreference } from './motion-preference.ts'
import { ROOT_SEED, STABLE_FRAME, STEP_SECONDS, dprCeiling, heroRotationY } from './scene-config.ts'

export interface SceneHandle {
  readonly renderer: WebGLRenderer
  readonly marker: StableFrameMarker
  readonly clock: SceneClock
  /** Advance and draw exactly one frame. */
  renderFrame(): void
  applyStation(id: StationId): void
  setMotion(motion: MotionPreference): void
  setDpr(dpr: number): void
  resize(width: number, height: number): void
  /** Release every GPU resource this module allocated. */
  dispose(): void
}

export interface SceneOptions {
  readonly canvas: HTMLCanvasElement
  readonly markerTarget: { setAttribute(n: string, v: string): void; removeAttribute(n: string): void }
  readonly station: StationId
  readonly motion: MotionPreference
  readonly deterministic: boolean
  readonly coarsePointer: boolean
  readonly width: number
  readonly height: number
}

/** The seeded static pose reduced motion holds, in radians. */
const STATIC_PHASE = 0.42

export function createScene(options: SceneOptions): SceneHandle {
  const renderer = new WebGLRenderer({
    canvas: options.canvas,
    antialias: true,
    // A capture has to read the drawing buffer after the frame, so it may not
    // be cleared on present.
    preserveDrawingBuffer: options.deterministic,
    powerPreference: 'high-performance',
  })
  // Color management, stated once, before anything is drawn.
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap

  const scene = new Scene()
  scene.background = new Color(0x0a0b10)

  const camera = new PerspectiveCamera(36, options.width / options.height, 0.1, 40)

  const geometryData = buildHeroGeometry(ROOT_SEED)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(geometryData.positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(geometryData.normals, 3))
  geometry.setAttribute('heroHeight', new BufferAttribute(geometryData.heights, 1))
  geometry.computeBoundingSphere()

  // Roughness is high enough that diffuse response carries the form. A
  // near-mirror dielectric needs an environment to reflect, and this scene
  // deliberately loads no asset — so the surface has to read from direct light
  // alone. `flatShading` is what makes each facet its own plane.
  const material = new MeshStandardMaterial({
    color: 0xbcd3ec,
    roughness: 0.52,
    metalness: 0,
    flatShading: true,
  })

  const hero = new Mesh(geometry, material)
  hero.castShadow = true
  hero.receiveShadow = true
  // Subject anchored right of centre: the copy owns the left of the frame, so
  // a centred hero would sit under the headline at every desktop width.
  hero.position.x = 0.42
  scene.add(hero)

  // The ground exists so the key light has something to land on. Without a
  // receiver the shadow map is computed and thrown away, the shards float, and
  // the light stops reading as a light. It is one plane, unlit apart from the
  // shadow, and it is the last thing in the material hierarchy.
  const ground = new Mesh(
    new PlaneGeometry(9, 9),
    new MeshStandardMaterial({ color: 0x0e1119, roughness: 0.95, metalness: 0 }),
  )
  ground.rotation.x = -Math.PI / 2
  // The shard bases sit at y=0. A ground plane at the same height z-fights with
  // them and the contact reads as black speckle rather than as a contact.
  ground.position.y = -0.012
  ground.receiveShadow = true
  scene.add(ground)

  // One dynamic shadow owner, per the art-direction invariant. The other two
  // lights cast nothing: the hemisphere separates the up-facing facets from the
  // down-facing ones, and the rim detaches the silhouette from the ground.
  const key = new DirectionalLight(0xfff4e6, 3.4)
  key.position.set(-2.8, 4.6, 3.2)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 14
  // The shadow camera is tightened around the subject so the map's resolution
  // is spent on it rather than on empty ground, and the bias removes the acne
  // that a near-coplanar base facet produces against its own shadow.
  key.shadow.camera.left = -3
  key.shadow.camera.right = 3
  key.shadow.camera.top = 3
  key.shadow.camera.bottom = -3
  key.shadow.bias = -0.0012
  key.shadow.normalBias = 0.02
  scene.add(key)

  const rim = new DirectionalLight(0x6f8fd0, 1.5)
  rim.position.set(3.4, 1.2, -2.6)
  scene.add(rim)

  scene.add(new HemisphereLight(0xb9d2f2, 0x16182a, 1.1))

  const clock: SceneClock = createClock(
    options.deterministic
      ? { mode: 'deterministic', stepSeconds: STEP_SECONDS }
      : { mode: 'live', targetStepSeconds: STEP_SECONDS },
  )

  const marker = createStableFrameMarker({
    target: options.markerTarget,
    stableFrame: STABLE_FRAME,
  })

  let motion: MotionPreference = options.motion
  let stationApplied = false
  let stableFrameReached = false
  const target = new Vector3()

  const applyStation = (id: StationId) => {
    const station = getCameraStation(CAMERA_STATIONS, id)
    camera.position.set(station.position[0], station.position[1], station.position[2])
    camera.fov = station.fov
    target.set(station.target[0], station.target[1], station.target[2])
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    stationApplied = true
    marker.invalidate()
  }

  const setDpr = (dpr: number) => {
    renderer.setPixelRatio(Math.min(dpr, dprCeiling(options.coarsePointer)))
    marker.invalidate()
  }

  const resize = (width: number, height: number) => {
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    marker.invalidate()
  }

  applyStation(options.station)
  setDpr(options.coarsePointer ? 1 : 1.5)
  resize(options.width, options.height)

  return {
    renderer,
    marker,
    clock,
    renderFrame() {
      // A deterministic capture must photograph one defined frame, so the clock
      // stops advancing once the marker is up. Without this the pose depends on
      // how many frames elapsed before the screenshot, which is wall-clock
      // timing wearing a deterministic label.
      if (options.deterministic && marker.ready) return
      if (!options.deterministic || !stableFrameReached) clock.tick()
      hero.rotation.y = heroRotationY(STATIC_PHASE, clock.elapsed, motion)
      renderer.render(scene, camera)
      const ready = marker.afterVisibleRender({
        frame: clock.frame,
        assetsReady: true,
        cameraStationApplied: stationApplied,
        streamsInitialized: true,
      })
      if (ready) stableFrameReached = true
    },
    applyStation,
    setMotion(next: MotionPreference) {
      motion = next
      marker.invalidate()
    },
    setDpr,
    resize,
    dispose() {
      marker.invalidate()
      geometry.dispose()
      material.dispose()
      ground.geometry.dispose()
      ;(ground.material as MeshStandardMaterial).dispose()
      key.shadow.map?.dispose()
      renderer.dispose()
      scene.clear()
    },
  }
}
