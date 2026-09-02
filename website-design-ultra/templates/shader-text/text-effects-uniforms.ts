/**
 * Copyable shader-text uniform adapter.
 *
 * The canvas receives state from a DOM mirror. It does not invent interaction,
 * timing, or randomness. Choose the returned uniforms individually; there is
 * intentionally no apply-all helper.
 */

export interface ShaderTextDomState {
  readonly pointerUv?: readonly [number, number];
  readonly pointerInside: boolean;
  readonly focused: boolean;
  readonly activated: boolean;
  readonly pulseAge: number;
  readonly pulseDuration: number;
  readonly layoutRevision: number;
  readonly eventSeed: number;
  readonly elapsedSeconds: number;
  readonly reducedMotion: boolean;
}

export interface ShaderTextUniforms {
  readonly uScramble: {
    readonly amplitude: number;
    readonly seed: number;
    readonly pointerUv: readonly [number, number];
  };
  readonly uGlitch: {
    readonly amplitude: number;
    readonly seed: number;
    readonly pulseAge: number;
  };
  readonly uDissolve: {
    readonly amount: number;
    readonly edgeWidth: number;
    readonly seed: number;
  };
}

/**
 * Derive all three payloads from one DOM state snapshot.
 *
 * Production code may upload only the uniforms its selected effect uses; this
 * function keeps the shapes stable for a material binding and a deterministic
 * test. Every amplitude is bounded before it reaches GLSL.
 */
export function deriveShaderTextUniforms(state: ShaderTextDomState): ShaderTextUniforms {
  const pointer = state.pointerUv ?? [0.5, 0.5];
  const proximity = state.pointerInside ? proximityAt(pointer) : 0;
  const pulseDuration = Math.max(0.001, state.pulseDuration);
  const pulse = state.activated ? clamp01(1 - state.pulseAge / pulseDuration) : 0;
  const seed = mixSeed(state);
  const frozen = state.reducedMotion;

  return {
    uScramble: {
      amplitude: frozen ? 0 : clamp01(proximity),
      seed,
      pointerUv: pointer,
    },
    uGlitch: {
      amplitude: frozen ? 0 : clamp01((state.focused ? 0.15 : 0) + pulse * 0.85),
      seed: seed ^ 0x9e3779b9,
      pulseAge: frozen ? 0 : clamp01(state.pulseAge / pulseDuration),
    },
    uDissolve: {
      amount: frozen ? 0 : clamp01(state.activated ? state.pulseAge / pulseDuration : 0),
      edgeWidth: frozen ? 0.02 : 0.02 + clamp01(proximity) * 0.04,
      seed: seed ^ 0x85ebca6b,
    },
  };
}

function proximityAt([u, v]: readonly [number, number]): number {
  return clamp01(1 - Math.hypot(u - 0.5, v - 0.5) * 2);
}

function mixSeed(state: ShaderTextDomState): number {
  const frame = Math.floor(Math.max(0, state.elapsedSeconds) * 60) >>> 0;
  return (
    (state.eventSeed ^ Math.imul(state.layoutRevision, 0x45d9f3b)) ^
    Math.imul(frame, 0x27d4eb2d)
  ) >>> 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1 ? 1 : value;
}
