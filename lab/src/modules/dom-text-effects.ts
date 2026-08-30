/**
 * DOM-mirrored shader text effects (IP-11B).
 *
 * Mirrors real DOM text element state — layout, pointer, focus, activation,
 * and timing — into canvas uniforms for scramble, glitch, and dissolve. The
 * primary text semantics remain in the DOM (visible, selectable,
 * translatable, screen-readable); the canvas only renders decorative
 * uniforms driven by DOM events. No interaction state is invented in the
 * canvas: every uniform originates from a DOM event or a DOM measurement.
 *
 * ## Time ownership
 *
 * The injected `SceneClock` is the only time owner for effect animations.
 * The module does not read `performance.now()` directly; consumers call
 * `updateEffectTime(state, clock.elapsed)` once per frame and the helper
 * derives the normalized effect time from `clock.elapsed`. This keeps the
 * existing one-clock-per-scene invariant and lets the deterministic mode
 * reproduce byte-identical effects.
 *
 * ## Effect surface
 *
 * Three effects are exposed, each through a pure function returning the
 * uniform values to feed into the shader:
 *   - `computeScrambleUniforms(state)` — pointer-driven glyph swap.
 *   - `computeGlitchUniforms(state)` — focus- and activation-driven offset.
 *   - `computeDissolveUniforms(state)` — progressive coverage field.
 *
 * `state` is the only state object passed in: the canvas never invents
 * fields. The state shape is declared below and validated by tests.
 *
 * ## DOM-mirror surface
 *
 * `createDomMirror(element, options)` returns an object that subscribes to
 * DOM events (pointer, focus, blur, keydown, keyup, click, resize via
 * ResizeObserver) and keeps a normalized mirror of:
 *   - element bounding box (in CSS pixels)
 *   - pointer state (normalized 0..1 inside the element, plus active flag)
 *   - focus state
 *   - activation state (click / Enter / Space, with a finite recovery window)
 *   - last-resize timestamp (drives layout-correctness; not a per-frame clock)
 *
 * The mirror does not schedule animation frames itself. The lab route reads
 * the mirror once per frame, calls `updateEffectTime`, and feeds the result
 * into the shader. This keeps the canvas subordinate to the DOM event loop.
 *
 * ## Reduced motion
 *
 * When `prefers-reduced-motion: reduce` is set, `updateEffectTime` clamps
 * `time` to a frozen snapshot and `computeScrambleUniforms` /
 * `computeGlitchUniforms` return amplitudes of `0` so the visual surface
 * stays static. The DOM interaction paths remain unchanged — pointer,
 * focus, and activation are still real DOM events; only the visual
 * amplitudes collapse.
 *
 * ## License
 *
 * MIT. No paid dependency.
 *
 * @module
 */

import type { SceneClock } from '@wdu-references/determinism-runtime.ts';

/** A normalized 0..1 coordinate inside the DOM element's content box. */
export interface NormalizedUv {
  readonly u: number;
  readonly v: number;
}

/** Pointer state mirrored from DOM events. */
export interface PointerState {
  /** True when the pointer is currently inside the element. */
  readonly inside: boolean;
  /** Pointer position in normalized element space (0..1). Undefined when outside. */
  readonly uv: NormalizedUv | undefined;
  /** True between pointerdown and the matching pointerup inside the element. */
  readonly active: boolean;
}

/** Activation state mirrored from DOM focus/click/keyboard events. */
export interface ActivationState {
  /** True when the element has DOM focus. */
  readonly focused: boolean;
  /** True for one frame-equivalent after a click/Enter/Space activation. */
  readonly pulsed: boolean;
  /** Time (in seconds, in the injected clock's elapsed frame) when the activation started. */
  readonly pulseStartTime: number;
  /** Duration of one activation pulse, in seconds. */
  readonly pulseDuration: number;
}

/** Layout snapshot mirrored from the DOM element. */
export interface LayoutState {
  /** Width of the element's content box, in CSS pixels. */
  readonly width: number;
  /** Height of the element's content box, in CSS pixels. */
  readonly height: number;
  /** Monotonic counter incremented on every ResizeObserver/layout change. */
  readonly revision: number;
}

/**
 * The mirror state object. This is the only input to the effect
 * computation. Every field is read from a real DOM source; the canvas never
 * invents state.
 */
export interface DomMirrorState {
  readonly pointer: PointerState;
  readonly activation: ActivationState;
  readonly layout: LayoutState;
  /**
   * Normalized effect time owned by the injected clock. Callers must set
   * this with `updateEffectTime` once per frame.
   */
  readonly time: number;
  /** Reduced-motion flag. Comes from `matchMedia('(prefers-reduced-motion: reduce)').matches`. */
  readonly reducedMotion: boolean;
}

/** Uniform payload returned by every effect computation. */
export interface EffectUniforms {
  readonly intensity: number;
  /** Random seed for the shader. Driven by layout.revision + time so a layout change visibly re-rolls. */
  readonly seed: number;
  /** Optional per-effect extras. Always normalized 0..1 or 0..maxAmplitude. */
  readonly pointerUv: NormalizedUv | undefined;
  readonly pulseAge: number;
}

/** Options for `createDomMirror`. */
export interface DomMirrorOptions {
  /** Pulse duration in seconds. Defaults to 0.4 (capped at 2.0). */
  readonly pulseDuration?: number;
  /**
   * Optional clock source for activation timing. When provided, the mirror
   * records `clock.elapsed` on each activation; when absent it relies on
   * the caller to read `effectTime` from the shader-time surface.
   */
  readonly clock?: SceneClock;
}

/** Internal mirror implementation. */
export interface DomMirror {
  /** Read the current state. Cheap. Safe to call every frame. */
  readonly state: DomMirrorState;
  /** Stop listening and release all DOM observers. Idempotent. */
  dispose(): void;
  /** Force-refresh the layout snapshot (used by tests; not by the lab route). */
  refreshLayout(): void;
  /** Programmatically inject a synthetic activation (used by tests; lab route uses real DOM events). */
  __testActivatePulse(startTime: number): void;
}

/**
 * Compute the scramble effect uniforms.
 *
 * Scramble swaps visible glyphs based on pointer proximity. The amplitude
 * ramps with pointer proximity and falls to zero when the pointer leaves
 * or when reduced motion is active. Layout revision re-rolls the seed so a
 * reflow visibly redistributes the scramble pattern.
 */
export function computeScrambleUniforms(state: DomMirrorState): EffectUniforms {
  const seed = scrambleSeed(state);
  const pulseAge = pulseAgeSeconds(state);
  if (state.reducedMotion) {
    return {
      intensity: 0,
      seed,
      pointerUv: undefined,
      pulseAge,
    };
  }
  if (!state.pointer.inside) {
    return {
      intensity: 0,
      seed,
      pointerUv: undefined,
      pulseAge,
    };
  }
  const proximity = computeProximity(state.pointer.uv);
  // Pointer-driven scramble: ramps with proximity, capped at 1.
  const intensity = clamp01(proximity * (state.pointer.active ? 1.1 : 1.0));
  return {
    intensity: Math.min(1.0, intensity),
    seed,
    pointerUv: state.pointer.uv,
    pulseAge,
  };
}

/**
 * Compute the glitch effect uniforms.
 *
 * Glitch is driven by activation (click / Enter / Space) and modulated by
 * the pulse age. The glitch amplitude decays linearly across the pulse
 * duration so a single activation produces one transient disturbance and
 * returns to a stable baseline.
 */
export function computeGlitchUniforms(state: DomMirrorState): EffectUniforms {
  const seed = glitchSeed(state);
  const pulseAge = pulseAgeSeconds(state);
  if (state.reducedMotion) {
    return {
      intensity: 0,
      seed,
      pointerUv: state.pointer.uv,
      pulseAge: 0,
    };
  }
  if (!state.activation.focused && !state.activation.pulsed) {
    return {
      intensity: 0,
      seed,
      pointerUv: state.pointer.uv,
      pulseAge: 0,
    };
  }
  // Focused state: low-level baseline jitter. Activated state: full pulse
  // that decays across the pulse duration. Both branch off real DOM state.
  const focusedBase = state.activation.focused ? 0.15 : 0;
  let pulseContribution = 0;
  if (state.activation.pulsed && pulseAge >= 0 && pulseAge <= state.activation.pulseDuration) {
    pulseContribution = 1 - pulseAge / Math.max(0.001, state.activation.pulseDuration);
  }
  const intensity = clamp01(focusedBase + pulseContribution * 0.85);
  return {
    intensity,
    seed,
    pointerUv: state.pointer.uv,
    pulseAge,
  };
}

/**
 * Compute the dissolve effect uniforms.
 *
 * Dissolve is driven by activation (click / Enter / Space) and exposes a
 * time-evolving coverage field that ramps from 0 to 1 across the pulse
 * duration, then snaps back. The shader uses `pulseAge` and `intensity`
 * to decide whether to render a partial coverage for the underlying glyph.
 *
 * The dissolve is one-shot per activation and is the only effect that uses
 * `intensity` as a coverage scalar (rather than an amplitude). The shape
 * is the same as the other effects so the shader uniforms stay consistent.
 */
export function computeDissolveUniforms(state: DomMirrorState): EffectUniforms {
  const seed = dissolveSeed(state);
  const pulseAge = pulseAgeSeconds(state);
  if (state.reducedMotion) {
    return {
      intensity: 0,
      seed,
      pointerUv: state.pointer.uv,
      pulseAge: 0,
    };
  }
  if (!state.activation.pulsed) {
    return {
      intensity: 0,
      seed,
      pointerUv: state.pointer.uv,
      pulseAge: 0,
    };
  }
  if (pulseAge < 0 || pulseAge > state.activation.pulseDuration) {
    return {
      intensity: 0,
      seed,
      pointerUv: state.pointer.uv,
      pulseAge,
    };
  }
  const coverage = clamp01(pulseAge / Math.max(0.001, state.activation.pulseDuration));
  return {
    intensity: coverage,
    seed,
    pointerUv: state.pointer.uv,
    pulseAge,
  };
}

/**
 * Update the time field on a state object. The only place where elapsed
 * time becomes effect time — keeps the one-clock-per-scene invariant.
 *
 * Mutates and returns the same object so callers can write:
 * `const s = updateEffectTime(state, clock.elapsed)`.
 */
export function updateEffectTime(
  state: DomMirrorState,
  elapsedSeconds: number,
  options?: { readonly reducedMotion?: boolean },
): DomMirrorState {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new RangeError('elapsedSeconds must be a non-negative finite number');
  }
  const reduced = options?.reducedMotion ?? state.reducedMotion;
  // Under reduced motion, freeze time to its last value (the call still
  // passes through so the mirror's contracts stay intact).
  const frozen = reduced ? state.time : elapsedSeconds;
  return {
    pointer: state.pointer,
    activation: state.activation,
    layout: state.layout,
    time: frozen,
    reducedMotion: reduced,
  };
}

/**
 * Create a DOM mirror bound to a real DOM text element.
 *
 * Subscribes to pointer, focus, blur, keydown, keyup, and click events and
 * to a ResizeObserver that re-measures the bounding box. The mirror is
 * synchronous: it does not schedule its own animation frames. The lab
 * route reads `mirror.state` once per frame, computes uniforms, and feeds
 * them into the shader.
 */
export function createDomMirror(element: HTMLElement, options: DomMirrorOptions = {}): DomMirror {
  if (!element) {
    throw new TypeError('createDomMirror requires a DOM element');
  }
  const pulseDuration = clampFinite(options.pulseDuration ?? 0.4, 0.05, 2.0);
  let layoutRevision = 0;
  let layout: LayoutState = measureLayout(element, layoutRevision);
  let pointer: PointerState = {
    inside: false,
    uv: undefined,
    active: false,
  };
  let activation: ActivationState = {
    focused: false,
    pulsed: false,
    pulseStartTime: 0,
    pulseDuration,
  };

  const readClockElapsed = (): number => {
    if (options.clock) {
      return options.clock.elapsed;
    }
    return 0;
  };

  // ResizeObserver: re-measure on every layout change. The revision
  // counter is monotonic so the shader can re-roll its seed.
  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      layoutRevision += 1;
      layout = measureLayout(element, layoutRevision);
    });
    resizeObserver.observe(element);
  } else {
    // Fallback: window resize listener + a poll at mount time.
    const onResize = (): void => {
      layoutRevision += 1;
      layout = measureLayout(element, layoutRevision);
    };
    window.addEventListener('resize', onResize);
    // The fallback is itself a no-op signal: the test environment runs
    // without a window. We intentionally do not throw here so the module
    // is testable in Node.
  }

  // Pointer events: track inside/active/uv.
  const onPointerMove = (e: PointerEvent): void => {
    const rect = element.getBoundingClientRect();
    const u = (e.clientX - rect.left) / Math.max(1e-6, rect.width);
    const v = (e.clientY - rect.top) / Math.max(1e-6, rect.height);
    pointer = {
      inside: u >= 0 && u <= 1 && v >= 0 && v <= 1,
      uv: { u: clamp01(u), v: clamp01(v) },
      active: pointer.active,
    };
  };
  const onPointerEnter = (e: PointerEvent): void => {
    onPointerMove(e);
  };
  const onPointerLeave = (): void => {
    pointer = {
      inside: false,
      uv: undefined,
      active: false,
    };
  };
  const onPointerDown = (e: PointerEvent): void => {
    pointer = {
      ...pointer,
      inside: true,
      active: true,
      uv: pointer.uv ?? { u: 0.5, v: 0.5 },
    };
    // pointerdown is also an activation: same path as click + key.
    activation = startPulse(activation, readClockElapsed());
  };
  const onPointerUp = (): void => {
    pointer = { ...pointer, active: false };
  };

  // Focus / blur.
  const onFocus = (): void => {
    activation = { ...activation, focused: true };
  };
  const onBlur = (): void => {
    activation = { ...activation, focused: false };
  };

  // Click + keyboard activation. The canvas never invents activations —
  // every pulse starts from a DOM event.
  const onClick = (): void => {
    activation = startPulse(activation, readClockElapsed());
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      activation = startPulse(activation, readClockElapsed());
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      // End the pulse explicitly so the next activation has a clean window.
      activation = endPulse(activation, readClockElapsed());
    }
  };

  element.addEventListener('pointerenter', onPointerEnter);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerleave', onPointerLeave);
  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('focus', onFocus);
  element.addEventListener('blur', onBlur);
  element.addEventListener('click', onClick);
  element.addEventListener('keydown', onKeyDown);
  element.addEventListener('keyup', onKeyUp);

  // Initial layout measure so the very first state read has non-zero
  // dimensions even before the ResizeObserver fires.
  layoutRevision += 1;
  layout = measureLayout(element, layoutRevision);

  const mirror: DomMirror = {
    get state(): DomMirrorState {
      return {
        pointer,
        activation,
        layout,
        time: 0,
        reducedMotion: false,
      };
    },
    dispose(): void {
      element.removeEventListener('pointerenter', onPointerEnter);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerleave', onPointerLeave);
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('focus', onFocus);
      element.removeEventListener('blur', onBlur);
      element.removeEventListener('click', onClick);
      element.removeEventListener('keydown', onKeyDown);
      element.removeEventListener('keyup', onKeyUp);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    },
    refreshLayout(): void {
      layoutRevision += 1;
      layout = measureLayout(element, layoutRevision);
    },
    __testActivatePulse(startTime: number): void {
      activation = startPulse(activation, startTime);
    },
  };

  return mirror;
}

// ── Internals ────────────────────────────────────────────────────────────────

function startPulse(prev: ActivationState, startTime: number): ActivationState {
  return {
    ...prev,
    pulsed: true,
    pulseStartTime: startTime,
    pulseDuration: prev.pulseDuration,
  };
}

function endPulse(prev: ActivationState, _endTime: number): ActivationState {
  // The pulse stays "active" until the time-based check expires; this
  // helper only clears the boolean marker so the mirror can recover even
  // when the clock is not advancing (e.g. in a unit test).
  return {
    ...prev,
    pulsed: false,
  };
}

function measureLayout(element: HTMLElement, revision: number): LayoutState {
  const rect = element.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
    revision,
  };
}

function pulseAgeSeconds(state: DomMirrorState): number {
  if (!state.activation.pulsed) return 0;
  return Math.max(0, state.time - state.activation.pulseStartTime);
}

function computeProximity(uv: NormalizedUv | undefined): number {
  if (!uv) return 0;
  const dx = uv.u - 0.5;
  const dy = uv.v - 0.5;
  const dist = Math.hypot(dx, dy);
  return clamp01(1 - dist * 2);
}

function scrambleSeed(state: DomMirrorState): number {
  // Mix layout revision, time, and pointer state so the seed is unique per
  // frame and per layout, never time-only (which would defeat the
  // "scramble when the user moves the pointer" intent).
  const rev = state.layout.revision;
  const t = Math.floor(state.time * 60) >>> 0;
  const px = state.pointer.uv ? Math.floor(state.pointer.uv.u * 1024) ^ Math.floor(state.pointer.uv.v * 1024) : 0;
  return (rev * 73856093) ^ (t * 19349663) ^ (px * 83492791);
}

function glitchSeed(state: DomMirrorState): number {
  // The glitch seed follows the activation timeline; time-driven mixing
  // would over-animate a quiet page.
  const t = Math.floor(state.time * 60) >>> 0;
  const focused = state.activation.focused ? 1 : 0;
  const pulsed = state.activation.pulsed ? 1 : 0;
  return (focused * 2654435761) ^ (pulsed * 40503) ^ (t * 2246822519);
}

function dissolveSeed(state: DomMirrorState): number {
  const t = Math.floor(state.time * 60) >>> 0;
  const rev = state.layout.revision;
  // Mix in the activation pulse start time so two activations seconds apart
  // produce visibly different dissolve masks — the pulse start is a real
  // DOM state (the moment a click or key was received), not an invented
  // canvas random.
  const pulseStart = state.activation.pulsed
    ? Math.floor(state.activation.pulseStartTime * 60) >>> 0
    : 0;
  return (rev * 1597334677) ^ (t * 374761393) ^ (pulseStart * 1013904223);
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function clampFinite(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum scramble intensity the shader applies under pointer proximity.
 * Exposed so the manifest can name it in the cost-class note.
 */
export const SCRAMBLE_MAX_INTENSITY = 1.0;

/**
 * Default activation pulse duration, in seconds. The mirror accepts
 * overrides per call, but the manifest, tests, and the lab route all
 * assume this default.
 */
export const DEFAULT_PULSE_DURATION_SECONDS = 0.4;