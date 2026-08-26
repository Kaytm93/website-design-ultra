'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { Group, Mesh } from 'three'
import { useSceneRuntime } from './SceneRuntime.tsx'
import { MODEL_ASSET_URL, productRotationY } from '../lib/scene-config.ts'

/**
 * The one optimized model (IP-07A). The GLB is a committed, meshopt-compressed
 * asset produced by scripts/build-model.mjs through the documented
 * inspect/validate/optimize pipeline; the MeshoptDecoder is three's bundled
 * JS decoder, bundled into the client chunk, so the runtime fetches no
 * decoder files and nothing undeclared.
 *
 * The ready marker gates on load completion (SceneRuntime.markAssetsReady),
 * so readiness proves the model actually loaded and rendered. The rotation is
 * a pure function of the capture contract: seeded phase plus the injected
 * clock in full motion, the seeded static pose in reduced motion.
 *
 * Disposal releases every geometry and material on unmount, so repeated
 * mount/unmount cycles return the renderer's resource counters to the same
 * baseline.
 */
export function ProductModel() {
  const { clock, productMotion, motion, markAssetsReady } = useSceneRuntime()
  const groupRef = useRef<Group>(null)
  const phaseRef = useRef<number | null>(null)
  if (phaseRef.current === null) {
    phaseRef.current = productMotion.next() * Math.PI * 2
  }

  // useLoader suspends until the committed GLB is fetched and decoded; the
  // loader extension configures the meshopt decoder once per load.
  const gltf = useLoader(GLTFLoader, MODEL_ASSET_URL, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder)
  })

  // Report asset readiness only after the model resolved (this component
  // renders only then). The marker gates on it, so data-wdu-ready proves the
  // model is in the frame.
  useEffect(() => {
    markAssetsReady()
  }, [markAssetsReady])

  // Explicit disposal (IP-05C pattern): traverse the loaded scene and release
  // every geometry and material. R3F disposes declarative resources; this
  // call is the documented contract the lifecycle assertions read.
  useEffect(() => {
    return () => {
      gltf.scene.traverse((object) => {
        if ((object as Mesh).isMesh) {
          const mesh = object as Mesh
          mesh.geometry.dispose()
          const material = mesh.material
          if (Array.isArray(material)) {
            for (const entry of material) entry.dispose()
          } else if (material && 'dispose' in material) {
            material.dispose()
          }
        }
      })
    }
  }, [gltf])

  // Priority 0: within the pre-render subscriber pass, SceneRuntime's clock
  // tick (priority -1) has already run, so this frame's motion reads this
  // frame's time. Speed is per-second, not per-frame, so it is frame-rate
  // independent.
  //
  // NOTE: the priority must never be positive. R3F treats a subscriber with
  // priority > 0 as a manual render owner and switches off its automatic
  // gl.render call, which would leave the canvas blank (tests/structure.test.mjs
  // guards this).
  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    group.rotation.y = productRotationY(phaseRef.current ?? 0, clock.elapsed, motion)
  }, 0)

  return <group ref={groupRef} position={[0, -0.15, 0]} scale={1.05}>
    <primitive object={gltf.scene} />
  </group>
}
