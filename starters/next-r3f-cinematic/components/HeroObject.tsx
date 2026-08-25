'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, type Mesh, type MeshStandardMaterial } from 'three'
import {
  heroRotationY,
  POINTER_ANCHOR_LOCAL,
  POINTER_HOVER_EMISSIVE,
  POINTER_HOVER_SCALE,
  POINTER_PRESSED_EMISSIVE,
  POINTER_PRESSED_SCALE,
  type PointerState,
} from '../lib/scene-config.ts'
import { useSceneRuntime } from './SceneRuntime.tsx'

/**
 * Pointer-interaction state machine (IP-06A). The state is written
 * synchronously in the pointer event handler — ref first, then the capture
 * attribute, then the capture-state invalidation, then the React state that
 * re-renders the canvas once. Because the deterministic clock stays frozen
 * and the pose deltas are instantaneous, the captured hover/pressed/recovered
 * poses are pure functions of the declared interaction state, byte-identical
 * across runs regardless of which frame the input landed on.
 *
 * The pose deltas are the signature behaviour the checkpoints photograph:
 * a hover lifts the subject, a press compresses it. Live mode behaves the
 * same; the deterministic capture just declares the state instead of hoping
 * input timing repeats.
 */
export function HeroObject() {
  const { clock, heroMotion, motion, invalidateCaptureState } = useSceneRuntime()
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const gl = useThree((state) => state.gl)
  const meshRef = useRef<Mesh>(null)
  const materialRef = useRef<MeshStandardMaterial>(null)
  const phaseRef = useRef<number | null>(null)
  const pointerRef = useRef<PointerState>('idle')
  const anchorVector = useRef<Vector3 | null>(null)
  const lastAnchorRef = useRef<{ x: string; y: string } | null>(null)
  if (phaseRef.current === null) {
    phaseRef.current = heroMotion.next() * Math.PI * 2
  }
  if (anchorVector.current === null) {
    anchorVector.current = new Vector3()
  }

  const setPointer = (next: PointerState) => {
    if (pointerRef.current === next) return
    pointerRef.current = next
    document.documentElement.setAttribute('data-wdu-pointer', next)
    invalidateCaptureState()
    // One flushed render (R3F invalidate works with frameloop 'never'): the
    // pose subscriber reads the ref, the frame renders, and the ready marker
    // re-sets — all in one deterministic step.
    invalidate()
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
    const state = pointerRef.current
    mesh.rotation.y = heroRotationY(phaseRef.current ?? 0, clock.elapsed, motion)
    const scale =
      state === 'pressed'
        ? POINTER_PRESSED_SCALE
        : state === 'hover'
          ? POINTER_HOVER_SCALE
          : 1
    mesh.scale.setScalar(scale)
    const material = materialRef.current
    if (material) {
      material.emissive.setHex(
        state === 'pressed'
          ? POINTER_PRESSED_EMISSIVE
          : state === 'hover'
            ? POINTER_HOVER_EMISSIVE
            : 0x000000,
      )
    }

    // The deterministic pointer target: project the anchor point on the tube
    // into normalized device coordinates and record them on the canvas
    // element, where the DOM capture anchor (PointerTargetAnchor) reads them.
    // The frozen camera and pose make this a stable pure function of the
    // capture contract. The write is deduplicated so the live loop does not
    // dirty the DOM every frame.
    const anchor = anchorVector.current
    if (anchor) {
      anchor.set(
        POINTER_ANCHOR_LOCAL[0],
        POINTER_ANCHOR_LOCAL[1],
        POINTER_ANCHOR_LOCAL[2],
      )
      // Update the world matrix from the pose applied above in this same
      // subscriber pass, so the anchor is exact for the frame being rendered.
      mesh.updateWorldMatrix(true, false)
      mesh.localToWorld(anchor)
      anchor.project(camera)
      const x = String(anchor.x)
      const y = String(anchor.y)
      const previous = lastAnchorRef.current
      if (!previous || previous.x !== x || previous.y !== y) {
        lastAnchorRef.current = { x, y }
        gl.domElement.setAttribute('data-wdu-pointer-x', x)
        gl.domElement.setAttribute('data-wdu-pointer-y', y)
      }
    }
  }, 0)

  // The capture attribute and its cleanup. The attribute is written by
  // setPointer for transitions; this effect seeds the boot state and removes
  // the attribute on unmount so it never points at a dead scene.
  useEffect(() => {
    document.documentElement.setAttribute('data-wdu-pointer', pointerRef.current)
    return () => {
      document.documentElement.removeAttribute('data-wdu-pointer')
    }
  }, [])

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
      <mesh
        ref={meshRef}
        onPointerOver={() => setPointer('hover')}
        onPointerOut={() => setPointer('idle')}
        onPointerDown={() => setPointer('pressed')}
        onPointerUp={() => setPointer('hover')}
      >
        <torusKnotGeometry args={[0.85, 0.26, 220, 32]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#d8c9a3"
          roughness={0.55}
          metalness={0.15}
        />
      </mesh>
      <mesh position={[0, -1.35, 0]}>
        <cylinderGeometry args={[1.5, 1.7, 0.35, 48]} />
        <meshStandardMaterial color="#23262e" roughness={0.85} metalness={0.05} />
      </mesh>
    </group>
  )
}
