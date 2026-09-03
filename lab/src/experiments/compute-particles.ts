/**
 * Real WebGPU compute fixture for the copyable particle template.
 *
 * This is intentionally a root-only lab route (ADR-011), not an installed
 * plugin runtime. A missing navigator.gpu or missing GPUDevice is UNAVAILABLE;
 * it is never converted into a PASS by a source-text check.
 */

import * as THREE from 'three/webgpu'
import { createComputeParticles } from '@wdu-templates/particles/compute-particles.ts'
import type { ExperimentContext } from '../main.js'

interface Evidence {
  device: boolean
  dispatch: boolean
  render: boolean
  status: 'PASS' | 'UNAVAILABLE' | 'FAIL'
  reason?: string
}

function evidenceElement(root: HTMLElement): HTMLElement {
  const element = document.createElement('output')
  element.setAttribute('data-testid', 'compute-particles-webgpu')
  element.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;'
  root.appendChild(element)
  return element
}

function setEvidence(element: HTMLElement, evidence: Evidence): void {
  element.dataset.webgpuDevice = String(evidence.device)
  element.dataset.computeDispatch = String(evidence.dispatch)
  element.dataset.computeRender = String(evidence.render)
  element.setAttribute('data-webgpu-device', String(evidence.device))
  element.setAttribute('data-compute-dispatch', String(evidence.dispatch))
  element.setAttribute('data-compute-render', String(evidence.render))
  element.dataset.status = evidence.status
  if (evidence.reason) element.dataset.reason = evidence.reason
  element.textContent = evidence.status === 'PASS'
    ? 'WebGPU GPUDevice compute dispatch and render PASS'
    : `WebGPU UNAVAILABLE: ${evidence.reason ?? 'device execution unavailable'}`
  document.documentElement.dataset.wduComputeStatus = evidence.status
  document.documentElement.dataset.wduComputeDevice = String(evidence.device)
  document.documentElement.dataset.wduComputeDispatch = String(evidence.dispatch)
}

function unavailable(root: HTMLElement, element: HTMLElement, reason: string): void {
  const poster = document.createElement('p')
  poster.textContent = 'GPU particle field — static poster fallback (WebGPU unavailable)'
  poster.style.cssText = 'margin:0;padding:32px;color:#dbeafe;background:#0f172a;font:16px system-ui;'
  root.appendChild(poster)
  setEvidence(element, { device: false, dispatch: false, render: false, status: 'UNAVAILABLE', reason })
}

function fixtureState(count: number): {
  position: Float32Array
  velocity: Float32Array
  morphA: Float32Array
  morphB: Float32Array
} {
  const position = new Float32Array(count * 4)
  const velocity = new Float32Array(count * 4)
  const morphA = new Float32Array(count * 4)
  const morphB = new Float32Array(count * 4)
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2
    const slot = i * 4
    position[slot] = Math.cos(angle) * 0.8
    position[slot + 1] = Math.sin(angle) * 0.8
    position[slot + 3] = 1
    morphA[slot] = Math.cos(angle) * 1.2
    morphA[slot + 1] = Math.sin(angle) * 1.2
    morphA[slot + 2] = 0
    morphA[slot + 3] = 1
    morphB[slot] = Math.sign(Math.cos(angle)) * 1.2
    morphB[slot + 1] = Math.sign(Math.sin(angle)) * 1.2
    morphB[slot + 2] = Math.sin(angle * 3) * 0.4
    morphB[slot + 3] = 1
  }
  return { position, velocity, morphA, morphB }
}

function installThreeR185SwizzleCompatibility(): void {
  // Three r185 passes the no-op string `rgba`; current Chromium requires the
  // optional descriptor field to be omitted unless component swizzle is used.
  type TextureViewDescriptor = Record<string, unknown>
  type TexturePrototype = {
    createView: (descriptor?: TextureViewDescriptor) => unknown
  }
  type TextureConstructor = { prototype: TexturePrototype }
  const textureConstructor = (globalThis as unknown as { GPUTexture?: TextureConstructor }).GPUTexture
  if (!textureConstructor) return
  const originalCreateView = textureConstructor.prototype.createView
  textureConstructor.prototype.createView = function createCompatibleView(descriptor) {
    if (descriptor?.swizzle === 'rgba') {
      const compatibleDescriptor = { ...descriptor }
      delete compatibleDescriptor.swizzle
      return originalCreateView.call(this, compatibleDescriptor)
    }
    return originalCreateView.call(this, descriptor)
  }
}

async function mountWebGPU(ctx: ExperimentContext): Promise<void> {
  const { root } = ctx
  root.style.cssText = 'position:relative;min-height:320px;background:#020617;'
  const evidence = evidenceElement(root)
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu
  if (!gpu) {
    unavailable(root, evidence, 'navigator.gpu is unavailable')
    return
  }
  installThreeR185SwizzleCompatibility()

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 320
    canvas.style.cssText = 'display:block;width:100%;height:320px;'
    root.appendChild(canvas)

    const renderer = new THREE.WebGPURenderer({ canvas, antialias: true })
    await renderer.init()
    const gpuDevice: unknown = (renderer.backend as unknown as { device?: unknown }).device
    if (!gpuDevice) {
      unavailable(root, evidence, 'WebGPURenderer initialized without a GPUDevice')
      renderer.dispose()
      return
    }

    // fixture/test size only — production count comes from qualityProfile.particles
    const count = 64
    const state = fixtureState(count)
    const particles = createComputeParticles({
      count,
      initialPosition: state.position,
      initialVelocity: state.velocity,
      morphA: state.morphA,
      morphB: state.morphB,
    })
    particles.setField(0, 0, 0)
    particles.setMorphProgress(0.5)

    const geometry = new THREE.PlaneGeometry(0.16, 0.16)
    const material = new THREE.SpriteNodeMaterial({ transparent: true })
    material.positionNode = particles.positionNode
    material.colorNode = particles.velocityColor
    const points = new THREE.InstancedMesh(geometry, material, count)
    points.frustumCulled = false
    const snapshotPositions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      snapshotPositions[i * 3] = state.position[i * 4]
      snapshotPositions[i * 3 + 1] = state.position[i * 4 + 1]
      snapshotPositions[i * 3 + 2] = state.position[i * 4 + 2]
    }
    const snapshotGeometry = new THREE.BufferGeometry()
    snapshotGeometry.setAttribute('position', new THREE.Float32BufferAttribute(snapshotPositions, 3))
    const snapshotMaterial = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.08, sizeAttenuation: false })
    const snapshot = new THREE.Points(snapshotGeometry, snapshotMaterial)
    snapshot.frustumCulled = false
    const anchorGeometry = new THREE.CircleGeometry(0.035, 12)
    const anchorMaterial = new THREE.MeshBasicNodeMaterial({ color: 0x38bdf8 })
    const anchor = new THREE.InstancedMesh(anchorGeometry, anchorMaterial, count)
    const anchorMatrix = new THREE.Matrix4()
    for (let i = 0; i < count; i += 1) {
      anchorMatrix.makeTranslation(state.position[i * 4], state.position[i * 4 + 1], state.position[i * 4 + 2])
      anchor.setMatrixAt(i, anchorMatrix)
    }
    anchor.instanceMatrix.needsUpdate = true
    anchor.frustumCulled = false
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x020617)
    scene.add(points)
    scene.add(snapshot)
    scene.add(anchor)
    const camera = new THREE.OrthographicCamera(-2, 2, 1, -1, 0.1, 10)
    camera.position.z = 5

    await particles.step(renderer, 1 / 60)
    await renderer.renderAsync(scene, camera)
    setEvidence(evidence, { device: true, dispatch: true, render: true, status: 'PASS' })
    document.documentElement.dataset.wduReady = 'true'
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    setEvidence(evidence, { device: false, dispatch: false, render: false, status: 'FAIL', reason })
    throw error
  }
}

export function mount(ctx: ExperimentContext): void {
  void mountWebGPU(ctx)
}
