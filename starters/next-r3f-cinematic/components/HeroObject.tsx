'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { heroRotationY } from '../lib/scene-config.ts'
import { useSceneRuntime } from './SceneRuntime.tsx'

/**
 * The procedural subject: a matte torus knot on a low pedestal. Its rotation
 * phase comes from the named 'hero-motion' stream. Full motion advances the
 * pose from the injected clock; reduced motion (IP-05C) holds the seeded
 * static pose — the strongest static shot — so the same seed, clock, station,
 * and motion select identical frames in both modes. There are no particles
 * and no network assets in this scene.
 */
export function HeroObject() {
  const { clock, heroMotion, motion } = useSceneRuntime()
  const meshRef = useRef<THREE.Mesh>(null)
  const phaseRef = useRef<number | null>(null)
  if (phaseRef.current === null) {
    phaseRef.current = heroMotion.next() * Math.PI * 2
  }

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
    const mesh = meshRef.current
    if (!mesh) return
    mesh.rotation.y = heroRotationY(phaseRef.current ?? 0, clock.elapsed, motion)
  }, 0)

  // Explicit disposal (IP-05C): the geometry and material are released when
  // the scene unmounts, so repeated mount/unmount cycles (route transitions,
  // restore after context loss) return the renderer's resource counters to
  // the same baseline. React Three Fiber also disposes declarative resources
  // on unmount; dispose() is idempotent, and this call is the documented
  // contract the lifecycle assertions read.
  useEffect(() => {
    return () => {
      const mesh = meshRef.current
      mesh?.geometry.dispose()
      const material = mesh?.material
      if (material && 'dispose' in material) material.dispose()
    }
  }, [])

  return (
    <group>
      <mesh ref={meshRef}>
        <torusKnotGeometry args={[0.85, 0.26, 220, 32]} />
        <meshStandardMaterial color="#d8c9a3" roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[0, -1.35, 0]}>
        <cylinderGeometry args={[1.5, 1.7, 0.35, 48]} />
        <meshStandardMaterial color="#23262e" roughness={0.85} metalness={0.05} />
      </mesh>
    </group>
  )
}
