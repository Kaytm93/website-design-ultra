import * as THREE from 'three/webgpu'
import {
  Fn,
  color,
  computeKernel,
  float,
  instanceIndex,
  mix,
  storage,
  uniform,
} from 'three/tsl'

/**
 * Copyable WebGPU path for a persistent particle field.
 *
 * `count` is supplied by the caller from `qualityProfile.particles`; this
 * template intentionally does not define a production tier. Each particle is
 * one vec4 in each storage buffer: xyz is position/velocity and w is the
 * stable life/seed channel. A WebGL2 project must keep the texture ping-pong
 * fallback from `templates/shaders/particle-toy-*.{vert,frag}` instead.
 */
export interface ComputeParticleOptions {
  /** Particle count from the active quality profile, not a hard-coded tier. */
  count: number
  /** Optional deterministic initial state, packed as count vec4 values. */
  initialPosition?: Float32Array
  initialVelocity?: Float32Array
  /** Two stable, packed morph targets. They are read-only during dispatch. */
  morphA?: Float32Array
  morphB?: Float32Array
}

function packedState(values: Float32Array | undefined, count: number): Float32Array {
  const expected = count * 4
  if (!values) return new Float32Array(expected)
  if (values.length !== expected) {
    throw new RangeError(`particle state must contain ${expected} float values`)
  }
  return values.slice()
}

function checkedCount(count: number): number {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError('particle count must be a positive safe integer')
  }
  return count
}

export function createComputeParticles(options: ComputeParticleOptions) {
  const count = checkedCount(options.count)
  const positionsAttribute = new THREE.StorageInstancedBufferAttribute(
    packedState(options.initialPosition, count),
    4,
  )
  const velocitiesAttribute = new THREE.StorageInstancedBufferAttribute(
    packedState(options.initialVelocity, count),
    4,
  )
  const morphAAttribute = new THREE.StorageInstancedBufferAttribute(
    packedState(options.morphA, count),
    4,
  )
  const morphBAttribute = new THREE.StorageInstancedBufferAttribute(
    packedState(options.morphB, count),
    4,
  )

  // Storage buffers are the persistent compute state; no per-frame allocation.
  const positionBuffer = storage(positionsAttribute, 'vec4', count)
  const velocityBuffer = storage(velocitiesAttribute, 'vec4', count)
  const morphABuffer = storage(morphAAttribute, 'vec4', count).toReadOnly()
  const morphBBuffer = storage(morphBAttribute, 'vec4', count).toReadOnly()

  const delta = uniform(1 / 60)
  const time = uniform(0)
  const morphProgress = uniform(0)
  const morphStrength = uniform(2.5)
  const fieldOrigin = uniform(new THREE.Vector3())
  const fieldStrength = uniform(0.2)
  const fieldRadius = uniform(1.8)

  // Fn + instanceIndex form one invocation-local update. The two buffers are
  // updated in place by the compute kernel; morph targets stay read-only.
  const update = Fn(() => {
    const position = positionBuffer.element(instanceIndex).toVar()
    const velocity = velocityBuffer.element(instanceIndex).toVar()
    const target = mix(
      morphABuffer.element(instanceIndex),
      morphBBuffer.element(instanceIndex),
      morphProgress,
    ).toVar()

    const toTarget = target.xyz.sub(position.xyz)
    const toField = fieldOrigin.sub(position.xyz)
    const distance = toField.length()
    const falloff = float(1).sub(distance.div(fieldRadius)).clamp(0, 1)
    const field = toField.normalize().mul(falloff.mul(fieldStrength))
    const nextVelocity = velocity.xyz
      .add(toTarget.mul(morphStrength))
      .add(field)
      .mul(0.995)

    position.xyz.assign(position.xyz.add(nextVelocity.mul(delta)))
    velocity.xyz.assign(nextVelocity)
    position.w.assign(position.w.sub(delta.mul(0.2)).max(0))
    positionBuffer.element(instanceIndex).assign(position)
    velocityBuffer.element(instanceIndex).assign(velocity)
  })()

  // `count` enables Three's generated instanceIndex bounds guard. Workgroups
  // are deliberately explicit so the dispatch remains inspectable and stable.
  const computeKernelNode = computeKernel(update, [64])
  computeKernelNode.count = count

  // Velocity colour is a render-only node: fast particles move toward the hot
  // colour while positionBuffer remains the source of the rendered location.
  const positionAttribute = positionBuffer.toAttribute().xyz
  const velocityAttribute = velocityBuffer.toAttribute().xyz
  const velocitySpeed = velocityAttribute.length().mul(2).clamp(0, 1)
  const velocityColor = mix(color('#38bdf8'), color('#f97316'), velocitySpeed)

  let disposed = false

  return {
    count,
    positionBuffer,
    velocityBuffer,
    morphABuffer,
    morphBBuffer,
    computeKernel: computeKernelNode,
    positionNode: positionAttribute,
    velocityColor,
    morphProgress,
    fieldOrigin,
    setMorphProgress(value: number): void {
      morphProgress.value = Math.max(0, Math.min(1, value))
    },
    setField(x: number, y: number, z = 0): void {
      fieldOrigin.value.set(x, y, z)
    },
    async step(renderer: THREE.WebGPURenderer, deltaSeconds: number): Promise<void> {
      if (disposed) return
      delta.value = Math.max(0, Math.min(1 / 30, deltaSeconds))
      time.value += delta.value
      await renderer.computeAsync(computeKernelNode)
    },
    dispose(): void {
      // Storage attributes are owned by the consuming geometry. Dispose that
      // geometry/material with the renderer; this system owns no per-frame data.
      disposed = true
    },
  }
}
