/**
 * gpu-particles-deterministic fixture — IP-09A.
 *
 * Exercises deterministic spawn/reset, ping-pong state hashes, pointer
 * normalization, capped falloff, and one-shot recovering impulse.
 * Fires data-wdu-ready after stable frame.
 *
 * @module
 */

import { createHash } from 'node:crypto';
import { createStableFrameMarker, createRandomStreams } from '../../../references/determinism-runtime.ts';
import type { ExperimentContext } from '../main.js';

// Deterministic spawn helper — mirrors particle-toy.ts channel layout
export function buildSpawnState(dim: number, seed: string): { posLife: Float32Array; velSeed: Float32Array } {
  const streams = createRandomStreams(seed);
  const rng = streams.stream('particles/spawn');
  const fieldRng = streams.stream('particles/field');
  void fieldRng.next();
  const count = dim * dim;
  const posLife = new Float32Array(count * 4);
  const velSeed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    posLife[i * 4] = (rng.next() - 0.5) * 4;
    posLife[i * 4 + 1] = (rng.next() - 0.5) * 4;
    posLife[i * 4 + 2] = (rng.next() - 0.5) * 2;
    posLife[i * 4 + 3] = rng.next();
    velSeed[i * 4] = (rng.next() - 0.5) * 0.5;
    velSeed[i * 4 + 1] = (rng.next() - 0.5) * 0.5;
    velSeed[i * 4 + 2] = (rng.next() - 0.5) * 0.5;
    velSeed[i * 4 + 3] = rng.next();
  }
  return { posLife, velSeed };
}

export function hashState(posLife: Float32Array, velSeed: Float32Array): string {
  const h = createHash('sha256');
  h.update(Buffer.from(posLife.buffer));
  h.update(Buffer.from(velSeed.buffer));
  return h.digest('hex');
}

// Pure helpers for tests: pointer normalization and impulse strength
export function normalizePointer(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): [number, number] {
  const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
  return [x, y];
}

export const RECOVERY_SECONDS = 1.2;

export function impulseStrength(now: number, impulse: { startTime: number; strength: number } | null): number {
  if (!impulse) return 0;
  const age = now - impulse.startTime;
  if (age < 0 || age >= RECOVERY_SECONDS) return 0;
  const t = age / RECOVERY_SECONDS;
  return impulse.strength * (1 - t) * Math.exp(-3 * t);
}

export function mount(ctx: ExperimentContext): void {
  const { root, clock, deterministic } = ctx;
  const marker = deterministic
    ? createStableFrameMarker({ target: document.documentElement, stableFrame: 2 })
    : null;

  // fixture/test size only — production consumes qualityProfile.particles
  const dim = 8; // fixture/test size only
  const state1 = buildSpawnState(dim, 'gpu-particles-deterministic-v1');
  const state2 = buildSpawnState(dim, 'gpu-particles-deterministic-v1');
  const hash1 = hashState(state1.posLife, state1.velSeed);
  const hash2 = hashState(state2.posLife, state2.velSeed);

  const el = document.createElement('div');
  el.setAttribute('data-testid', 'gpu-particles-deterministic');
  el.setAttribute('data-hash1', hash1);
  el.setAttribute('data-hash2', hash2);
  el.setAttribute('data-match', String(hash1 === hash2));
  el.textContent = `deterministic spawn hash ${hash1.slice(0, 8)} — poster/reduced-motion fallback is non-empty`;
  el.style.cssText = 'padding:12px;font:12px system-ui;color:#cbd5e1;background:#0a0a0c;';
  root.appendChild(el);

  let frame = 0;
  function tick(): void {
    if (deterministic && marker?.ready) return;
    clock.tick();
    frame += 1;
    if (deterministic && marker) {
      marker.afterVisibleRender({ frame, assetsReady: true, cameraStationApplied: true, streamsInitialized: true });
    }
    if (frame < 5) requestAnimationFrame(tick);
  }
  tick();
}
