'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import type { Group, Mesh } from 'three'
import { MODEL_ASSET_URL, crystalRotationY } from '../lib/scene-config.ts'
import type { SceneClock } from '../lib/determinism-runtime.ts'
import type { MotionPreference } from '../lib/runtime-config.ts'

/**
 * The one optimized model (IP-10C). The GLB is a committed, Draco-compressed
 * asset produced by scripts/build-model.mjs through the documented
 * inspect/validate/optimize pipeline. The DRACOLoader's decoder path is set
 * to '/draco/' — the committed local decoder directory; the runtime fetches
 * no external URL.
 *
 * Disposal releases every geometry and material on unmount, so repeated
 * mount/unmount cycles return the renderer's resource counters to the same
 * baseline (verified by the lifecycle resource assertions).
 */
export function ProductModel({
  clock,
  motion,
  markAssetsReady,
}: {
  clock: SceneClock
  motion: MotionPreference
  markAssetsReady: () => void
}) {
  const groupRef = useRef<Group>(null)
  const phaseRef = useRef<number | null>(null)
  if (phaseRef.current === null) {
    // seeded phase keeps deterministic mode deterministic; live mode seeds
    // on first mount as well, then advances from the injected clock.
    phaseRef.current = Math.PI / 4
  }

  const gltf = useLoader(GLTFLoader, MODEL_ASSET_URL, (loader) => {
    const draco = new DRACOLoader()
    draco.setDecoderPath('/draco/')
    loader.setDRACOLoader(draco)
  })

  useEffect(() => {
    markAssetsReady()
  }, [markAssetsReady, gltf])

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

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    group.rotation.y = crystalRotationY(phaseRef.current ?? 0, clock.elapsed, motion)
  }, 0)

  return (
    <group ref={groupRef} position={[0, 0.6, 0]} scale={1}>
      <primitive object={gltf.scene} />
    </group>
  )
}