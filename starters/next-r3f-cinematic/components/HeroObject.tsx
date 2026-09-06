'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import {
  EquirectangularReflectionMapping,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  Vector3,
  type Material,
} from 'three'
import {
  HDRI_ASSET_URL,
  MODEL_ASSET_URL,
  heroRotationY,
  POINTER_ANCHOR_LOCAL,
  POINTER_HOVER_EMISSIVE,
  POINTER_HOVER_SCALE,
  POINTER_PRESSED_EMISSIVE,
  POINTER_PRESSED_SCALE,
  type PointerState,
} from '../lib/scene-config.ts'
import { useSceneRuntime } from './SceneRuntime.tsx'

type CrystalScene = {
  scene: Group
  materials: MeshPhysicalMaterial[]
}

/**
 * The procedural-crystal hero (J-C1). The optimized GLB is the output of the
 * existing procedural-crystal inspect/validate/optimize handoff. The source
 * GLTF materials are replaced on an owned clone with physical materials so
 * the cached loader result remains safe across context-loss remounts.
 *
 * DRACOLoader and RGBELoader both point at committed local files. The HDRI is
 * the CC0 Studio Small 08 template copied from website-design-ultra/templates/assets;
 * it supplies restrained reflections while the key light describes the crystal
 * facets and owns the only dynamic shadow map.
 */
export function HeroObject() {
  const {
    clock,
    heroMotion,
    motion,
    invalidateCaptureState,
    markAssetsReady,
    timelineEvaluationRef,
    loadingHold,
  } = useSceneRuntime()
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const invalidate = useThree((state) => state.invalidate)
  const gl = useThree((state) => state.gl)
  const groupRef = useRef<Group>(null)
  const materialRef = useRef<MeshPhysicalMaterial>(null)
  const phaseRef = useRef<number | null>(null)
  const pointerRef = useRef<PointerState>('idle')
  const anchorVector = useRef<Vector3 | null>(null)
  const lastAnchorRef = useRef<{ x: string; y: string } | null>(null)

  const gltf = useLoader(GLTFLoader, MODEL_ASSET_URL, (loader) => {
    const draco = new DRACOLoader()
    draco.setDecoderPath('/draco/')
    loader.setDRACOLoader(draco)
  })
  const hdri = useLoader(RGBELoader, HDRI_ASSET_URL)

  const crystal = useMemo<CrystalScene>(() => {
    const ownedScene = gltf.scene.clone(true)
    const materials: MeshPhysicalMaterial[] = []

    ownedScene.traverse((object) => {
      if (!(object as Mesh).isMesh) return
      const mesh = object as Mesh
      const sourceMaterial: Material | undefined = Array.isArray(mesh.material)
        ? mesh.material[0]
        : mesh.material
      const tip = sourceMaterial?.name.includes('Tip') || mesh.name.includes('014')
      const material = new MeshPhysicalMaterial({
        color: tip ? '#c8b5ff' : '#6f98e8',
        roughness: tip ? 0.2 : 0.28,
        metalness: 0.08,
        clearcoat: 0.35,
        clearcoatRoughness: 0.18,
        envMapIntensity: 0.85,
        emissive: '#000000',
        emissiveIntensity: 0.2,
      })
      material.name = tip
        ? 'WDU_Crystal_Tip_PhysicalMaterial'
        : 'WDU_Crystal_PhysicalMaterial'
      mesh.geometry = mesh.geometry.clone()
      mesh.material = material
      mesh.castShadow = true
      mesh.receiveShadow = true
      materials.push(material)
    })

    return { scene: ownedScene, materials }
  }, [gltf])

  if (phaseRef.current === null) {
    phaseRef.current = heroMotion.next() * Math.PI * 2
  }
  if (anchorVector.current === null) {
    anchorVector.current = new Vector3()
  }
  if (materialRef.current === null) {
    materialRef.current = crystal.materials[0] ?? null
  }

  const setPointer = (next: PointerState) => {
    if (pointerRef.current === next) return
    pointerRef.current = next
    document.documentElement.setAttribute('data-wdu-pointer', next)
    invalidateCaptureState()
    invalidate()
  }

  useEffect(() => {
    hdri.mapping = EquirectangularReflectionMapping
    const previousEnvironment = scene.environment
    scene.environment = hdri
    return () => {
      if (scene.environment === hdri) scene.environment = previousEnvironment
    }
  }, [hdri, scene])

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const state = pointerRef.current
    const evaluation = timelineEvaluationRef.current
    const timelineRot =
      !loadingHold && motion === 'full' && evaluation
        ? evaluation['scene.hero.rotationY']
        : 0
    const baseRot = heroRotationY(phaseRef.current ?? 0, clock.elapsed, motion)
    group.rotation.y = baseRot + (typeof timelineRot === 'number' ? timelineRot : 0)
    const scale =
      state === 'pressed'
        ? POINTER_PRESSED_SCALE
        : state === 'hover'
          ? POINTER_HOVER_SCALE
          : 1
    group.scale.setScalar(scale)

    for (const material of crystal.materials) {
      if (state === 'pressed') {
        material.emissive.setHex(POINTER_PRESSED_EMISSIVE)
      } else if (state === 'hover') {
        material.emissive.setHex(POINTER_HOVER_EMISSIVE)
      } else {
        const timelineEmissive =
          !loadingHold && motion === 'full' && evaluation
            ? evaluation['material.hero.emissive']
            : 0
        material.emissive.setHex(
          typeof timelineEmissive === 'number' && timelineEmissive > 0.35
            ? POINTER_HOVER_EMISSIVE
            : 0x000000,
        )
      }
    }

    // Project a stable point on the crystal into the DOM capture anchor. The
    // frozen camera and pose make this a pure function of the capture state.
    const anchor = anchorVector.current
    if (anchor) {
      anchor.set(
        POINTER_ANCHOR_LOCAL[0],
        POINTER_ANCHOR_LOCAL[1],
        POINTER_ANCHOR_LOCAL[2],
      )
      group.updateWorldMatrix(true, false)
      group.localToWorld(anchor)
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

  useEffect(() => {
    document.documentElement.setAttribute('data-wdu-pointer', pointerRef.current)
    return () => {
      document.documentElement.removeAttribute('data-wdu-pointer')
    }
  }, [])

  useEffect(() => {
    const start = () => setPointer('pressed')
    const end = () => setPointer('idle')
    window.addEventListener('wdu:press-start', start)
    window.addEventListener('wdu:press-end', end)
    return () => {
      window.removeEventListener('wdu:press-start', start)
      window.removeEventListener('wdu:press-end', end)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    markAssetsReady()
  }, [markAssetsReady])

  useEffect(() => {
    return () => {
      crystal.scene.traverse((object) => {
        if (!(object as Mesh).isMesh) return
        const mesh = object as Mesh
        mesh.geometry.dispose()
        const material = mesh.material
        if (Array.isArray(material)) {
          for (const entry of material) entry.dispose()
        } else {
          material.dispose()
        }
      })
    }
  }, [crystal])

  return (
    <group
      ref={groupRef}
      position={[0, -1.1, 0]}
      scale={1.05}
      onPointerOver={() => setPointer('hover')}
      onPointerOut={() => setPointer('idle')}
      onPointerDown={() => setPointer('pressed')}
      onPointerUp={() => setPointer('hover')}
    >
      <primitive object={crystal.scene} />
    </group>
  )
}
