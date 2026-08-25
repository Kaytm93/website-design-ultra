'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { useSceneRuntime } from './SceneRuntime.tsx'

/**
 * The procedural subject: a matte torus knot on a low pedestal. Its rotation
 * phase comes from the named 'hero-motion' stream, and its speed reads the
 * injected clock, so the same seed, clock, and station capture identical
 * frames. There are no particles and no network assets in this scene.
 */
export function HeroObject() {
  const { clock, heroMotion } = useSceneRuntime()
  const meshRef = useRef<THREE.Mesh>(null)
  const phaseRef = useRef<number | null>(null)
  if (phaseRef.current === null) {
    phaseRef.current = heroMotion.next() * Math.PI * 2
  }

  // Priority 1: the SceneRuntime clock tick (priority 0) has already run, so
  // this frame's motion reads this frame's time. Speed is per-second, not
  // per-frame, so it is frame-rate independent.
  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.rotation.y = (phaseRef.current ?? 0) + clock.elapsed * 0.4
  }, 1)

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
