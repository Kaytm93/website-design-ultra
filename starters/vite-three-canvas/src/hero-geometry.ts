/**
 * The hero shape, generated from the root seed.
 *
 * Generated rather than imported for three reasons. There is no asset to fetch,
 * so the starter has no loading path to get wrong before the contract is even
 * demonstrated. There is no binary in the diff. And the shape is neither a
 * torus knot nor a default cube, which the plugin's own surfaces may not ship —
 * a starter is the code most likely to be copied unchanged, so the shape it
 * hands over has to be one worth keeping.
 *
 * The output is a plain `Float32Array` triangle soup with flat per-face
 * normals. It carries no Three.js import: the caller wraps it in a
 * `BufferGeometry`. That keeps this module testable in Node without a WebGL
 * context, which is what lets `tests/hero-geometry.test.mjs` assert
 * determinism rather than assert that a mesh was constructed.
 */

import { createRandomStreams, type RootSeed } from './determinism-runtime.ts'
import {
  HERO_BASE_RADIUS,
  HERO_MAX_HEIGHT,
  HERO_MIN_HEIGHT,
  HERO_RADIAL_SEGMENTS,
  HERO_SHARD_COUNT,
} from './scene-config.ts'

export interface HeroGeometryData {
  /** Flat triangle positions, three floats per vertex. */
  readonly positions: Float32Array
  /** Flat per-face normals, parallel to `positions`. */
  readonly normals: Float32Array
  /** 0 at the base, 1 at the tip — drives the base-to-tip color ramp. */
  readonly heights: Float32Array
  readonly triangleCount: number
}

interface Shard {
  readonly originX: number
  readonly originZ: number
  readonly height: number
  readonly radius: number
  readonly leanX: number
  readonly leanZ: number
  readonly twist: number
}

function planShards(seed: RootSeed): Shard[] {
  const streams = createRandomStreams(seed)
  const placement = streams.stream('hero:placement')
  const proportion = streams.stream('hero:proportion')
  const lean = streams.stream('hero:lean')

  const shards: Shard[] = []
  for (let index = 0; index < HERO_SHARD_COUNT; index += 1) {
    // Shards spiral outward rather than scattering, so the cluster reads as one
    // silhouette from every station instead of as separate objects.
    const angle = (index / HERO_SHARD_COUNT) * Math.PI * 2 + placement.next() * 0.7
    const spread = (index === 0 ? 0 : 0.34 + placement.next() * 0.46)
    const growth = 1 - index / (HERO_SHARD_COUNT + 2)
    shards.push({
      originX: Math.cos(angle) * spread,
      originZ: Math.sin(angle) * spread,
      height: HERO_MIN_HEIGHT + (HERO_MAX_HEIGHT - HERO_MIN_HEIGHT) * growth * (0.7 + proportion.next() * 0.3),
      radius: HERO_BASE_RADIUS * (0.45 + growth * 0.55) * (0.8 + proportion.next() * 0.4),
      leanX: (lean.next() - 0.5) * 0.36,
      leanZ: (lean.next() - 0.5) * 0.36,
      twist: lean.next() * Math.PI,
    })
  }
  return shards
}

function pushTriangle(
  positions: number[],
  normals: number[],
  heights: number[],
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
  maxHeight: number,
): void {
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const uz = b[2] - a[2]
  const vx = c[0] - a[0]
  const vy = c[1] - a[1]
  const vz = c[2] - a[2]
  let nx = uy * vz - uz * vy
  let ny = uz * vx - ux * vz
  let nz = ux * vy - uy * vx
  const length = Math.hypot(nx, ny, nz) || 1
  nx /= length
  ny /= length
  nz /= length

  for (const vertex of [a, b, c]) {
    positions.push(vertex[0], vertex[1], vertex[2])
    normals.push(nx, ny, nz)
    heights.push(Math.min(1, Math.max(0, vertex[1] / maxHeight)))
  }
}

/**
 * Build the hero geometry for a seed. Same seed, same bytes — that is the whole
 * contract, and it is what makes a deterministic capture of this scene
 * meaningful.
 */
export function buildHeroGeometry(seed: RootSeed = 'vite-three-canvas-v1'): HeroGeometryData {
  const shards = planShards(seed)
  const positions: number[] = []
  const normals: number[] = []
  const heights: number[] = []
  const maxHeight = Math.max(...shards.map((shard) => shard.height))

  for (const shard of shards) {
    const tip: readonly [number, number, number] = [
      shard.originX + shard.leanX * shard.height,
      shard.height,
      shard.originZ + shard.leanZ * shard.height,
    ]
    const ring: (readonly [number, number, number])[] = []
    for (let segment = 0; segment < HERO_RADIAL_SEGMENTS; segment += 1) {
      const angle = (segment / HERO_RADIAL_SEGMENTS) * Math.PI * 2 + shard.twist
      ring.push([
        shard.originX + Math.cos(angle) * shard.radius,
        0,
        shard.originZ + Math.sin(angle) * shard.radius,
      ])
    }

    for (let segment = 0; segment < HERO_RADIAL_SEGMENTS; segment += 1) {
      const current = ring[segment]!
      const next = ring[(segment + 1) % HERO_RADIAL_SEGMENTS]!
      // Side facet, wound so the outward normal faces the camera.
      pushTriangle(positions, normals, heights, current, next, tip, maxHeight)
      // Base facet. It faces down, into the ground: a base whose normal points
      // up is lit like a table top, which is what made the shards read as
      // pedestals rather than as shards standing in the ground.
      pushTriangle(
        positions,
        normals,
        heights,
        [shard.originX, 0, shard.originZ],
        current,
        next,
        maxHeight,
      )
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    heights: new Float32Array(heights),
    triangleCount: positions.length / 9,
  }
}

/** Triangle count the budget check in `immersive-3d` §3 is measured against. */
export const HERO_TRIANGLE_COUNT = HERO_SHARD_COUNT * HERO_RADIAL_SEGMENTS * 2
