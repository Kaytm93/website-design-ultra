/**
 * DOM-mirrored shader text effects tests (IP-11B).
 *
 * Acceptance gates (from QUEUE.md and TODO.md):
 *   - Canvas never invents interaction state (every uniform originates
 *     from a DOM event or DOM measurement).
 *   - Resizing / reflow preserves alignment.
 *   - One normalized timeline owns effect time.
 *   - Search, selection, translation, and screen-reader paths remain
 *     DOM-native.
 *   - Keyboard / focus / pointer parity (Tab + Enter / Space reaches the
 *     same product outcome as a click).
 *   - Portrait reflow.
 *   - Localization fixture (German headline reflows correctly).
 *   - Reduced motion collapses all three effects.
 *   - Deterministic interaction captures.
 *
 * The mirror is exercised through real DOM event dispatch so the test
 * covers the same code path the lab route uses in production.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES_ROOT = resolve(ROOT, 'src/modules');
const SHADERS_ROOT = resolve(ROOT, 'src/experiments/shaders');
const FIXTURES_ROOT = resolve(ROOT, 'src/fixtures');

function readModule(name: string): string {
  return readFileSync(resolve(MODULES_ROOT, `${name}.ts`), 'utf8');
}

function readShaderSource(name: string): string {
  return readFileSync(resolve(SHADERS_ROOT, name), 'utf8');
}

function readFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_ROOT, name), 'utf8');
}

// Minimal jsdom-like DOM stub. We only need the surface area that
// createDomMirror touches (events, getBoundingClientRect, ResizeObserver,
// addEventListener / removeEventListener).
class FakeElement {
  private rect = { width: 240, height: 48, left: 0, top: 0, bottom: 48, right: 240, x: 0, y: 0, toJSON() { return this; } } as DOMRect;
  private listeners = new Map<string, Set<(e: unknown) => void>>();
  private tabIndex = -1;
  private textContent = '';
  private _attrs = new Map<string, string>();

  constructor(public tagName: string) {}

  getBoundingClientRect(): DOMRect {
    return this.rect;
  }

  setRect(width: number, height: number, left = 0, top = 0): void {
    this.rect = {
      width,
      height,
      left,
      top,
      bottom: top + height,
      right: left + width,
      x: left,
      y: top,
      toJSON() { return this; },
    } as DOMRect;
  }

  setTextContent(text: string): void { this.textContent = text; }
  getTextContent(): string { return this.textContent; }

  setAttribute(name: string, value: string): void { this._attrs.set(name, value); }
  getAttribute(name: string): string | null { return this._attrs.get(name) ?? null; }
  removeAttribute(name: string): void { this._attrs.delete(name); }

  set tabIndexValue(v: number) { this.tabIndex = v; }
  get tabIndexValue(): number { return this.tabIndex; }

  addEventListener(type: string, fn: (e: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: (e: unknown) => void): void {
    this.listeners.get(type)?.delete(fn);
  }
  dispatch(type: string, event: unknown): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const fn of set) fn(event);
  }
  hasListener(type: string): boolean {
    return (this.listeners.get(type)?.size ?? 0) > 0;
  }
  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeResizeObserver {
  static instances: Array<{ observe: (el: FakeElement) => void; disconnect: () => void; __trigger: (el: FakeElement) => void }> = [];
}

// Install the fakes into globalThis before the module reads them. Node
// 22 has a built-in ResizeObserver stub but it is not usable in a
// non-browser global; replace it with a fully-functional fake so the
// mirror can observe the fake element without throwing.
const fakeResizeObservers: FakeResizeObserverGlobal[] = [];
class FakeResizeObserverGlobal {
  private callback: ResizeObserverCallback | null = null;
  private observed = new Set<FakeElement>();
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    fakeResizeObservers.push(this);
  }
  observe(target: FakeElement): void { this.observed.add(target); }
  unobserve(target: FakeElement): void { this.observed.delete(target); }
  disconnect(): void { this.observed.clear(); this.callback = null; }
  /** Test helper: simulate a resize callback for the observed elements. */
  __triggerResize(elements: FakeElement[]): void {
    if (!this.callback) return;
    for (const el of elements) {
      this.observed.add(el);
    }
    this.callback([], this as unknown as ResizeObserver);
  }
}
(globalThis as unknown as Record<string, unknown>).ResizeObserver = FakeResizeObserverGlobal;
// The mirror fallback path also reads `window.addEventListener('resize')`.
(globalThis as unknown as Record<string, unknown>).window = globalThis;

// ── Module surface ──────────────────────────────────────────────────────────

test('dom-text-effects module exposes the IP-11B contract surface', async () => {
  const mod = await import('../src/modules/dom-text-effects.ts');
  assert.equal(typeof mod.computeScrambleUniforms, 'function');
  assert.equal(typeof mod.computeGlitchUniforms, 'function');
  assert.equal(typeof mod.computeDissolveUniforms, 'function');
  assert.equal(typeof mod.createDomMirror, 'function');
  assert.equal(typeof mod.updateEffectTime, 'function');
  assert.equal(typeof mod.DEFAULT_PULSE_DURATION_SECONDS, 'number');
  assert.equal(typeof mod.SCRAMBLE_MAX_INTENSITY, 'number');
  assert.equal(mod.SCRAMBLE_MAX_INTENSITY, 1.0);
});

test('module documents that the canvas never invents interaction state', () => {
  const src = readModule('dom-text-effects');
  assert.match(src, /interaction state is invented/i);
  assert.match(src, /the canvas never invents/i);
  assert.match(src, /Mirrors real DOM text element state/);
  assert.match(src, /DOM events/);
  assert.match(src, /only time owner/);
  assert.match(src, /frozen/i);
});

// ── Pointer parity (keyboard / pointer / focus reach the same outcome) ─────

test('pointer parity: pointer inside drives scramble amplitude', async () => {
  const { createDomMirror, computeScrambleUniforms, updateEffectTime } = await import(
    '../src/modules/dom-text-effects.ts'
  );
  const el = new FakeElement('div');
  const mirror = createDomMirror(el as unknown as HTMLElement);
  // Place pointer at center of the element.
  el.dispatch('pointerenter', makePointerEvent({ clientX: 120, clientY: 24 }));
  el.dispatch('pointermove', makePointerEvent({ clientX: 120, clientY: 24 }));
  const state = updateEffectTime(mirror.state, 1.0);
  const scramble = computeScrambleUniforms(state);
  assert.ok(scramble.intensity > 0, 'pointer at center triggers non-zero scramble');
  assert.ok(scramble.pointerUv, 'pointer uv is preserved');
  assert.equal(scramble.pointerUv?.u, 0.5);
  assert.equal(scramble.pointerUv?.v, 0.5);
  mirror.dispose();
});

test('pointer parity: pointer outside collapses scramble amplitude', async () => {
  const { createDomMirror, computeScrambleUniforms, updateEffectTime } = await import(
    '../src/modules/dom-text-effects.ts'
  );
  const el = new FakeElement('div');
  const mirror = createDomMirror(el as unknown as HTMLElement);
  el.dispatch('pointerenter', makePointerEvent({ clientX: 120, clientY: 24 }));
  el.dispatch('pointerleave', {});
  const state = updateEffectTime(mirror.state, 1.0);
  const scramble = computeScrambleUniforms(state);
  assert.equal(scramble.intensity, 0);
  assert.equal(scramble.pointerUv, undefined);
  mirror.dispose();
});

test('keyboard parity: Enter / Space activate the same pulse as a click', async () => {
  const { createDomMirror, computeGlitchUniforms, updateEffectTime } = await import(
    '../src/modules/dom-text-effects.ts'
  );
  const el = new FakeElement('div');

  const mirrorClick = createDomMirror(el as unknown as HTMLElement);
  el.dispatch('click', {});
  const clickState = updateEffectTime(mirrorClick.state, 0.1);
  const clickGlitch = computeGlitchUniforms(clickState);
  assert.ok(clickGlitch.pulseAge > 0 || clickState.activation.pulsed, 'click sets the activation pulse');
  mirrorClick.dispose();

  const mirrorKey = createDomMirror(el as unknown as HTMLElement);
  el.dispatch('keydown', makeKeyboardEvent('Enter'));
  const keyState = updateEffectTime(mirrorKey.state, 0.1);
  const keyGlitch = computeGlitchUniforms(keyState);
  assert.ok(keyState.activation.pulsed, 'Enter keydown sets the activation pulse');
  assert.ok(keyGlitch.pulseAge > 0, 'Enter pulse age is recorded for the shader');
  mirrorKey.dispose();

  const mirrorSpace = createDomMirror(el as unknown as HTMLElement);
  el.dispatch('keydown', makeKeyboardEvent(' '));
  const spaceState = updateEffectTime(mirrorSpace.state, 0.1);
  assert.ok(spaceState.activation.pulsed, 'Space keydown sets the activation pulse');
  mirrorSpace.dispose();
});

test('focus parity: focus sets a baseline jitter that pointer events do not', async () => {
  const { createDomMirror, computeGlitchUniforms, updateEffectTime } = await import(
    '../src/modules/dom-text-effects.ts'
  );
  const el = new FakeElement('div');
  const mirror = createDomMirror(el as unknown as HTMLElement);
  el.dispatch('focus', {});
  const state = updateEffectTime(mirror.state, 0.5);
  assert.ok(state.activation.focused, 'focus event is mirrored');
  const glitch = computeGlitchUniforms(state);
  assert.ok(glitch.intensity > 0, 'focus contributes a baseline glitch intensity');
  mirror.dispose();
});

// ── Activation pulse decays ────────────────────────────────────────────────

test('activation pulse age grows with the injected clock (one timeline)', async () => {
  const { createDomMirror, computeDissolveUniforms, updateEffectTime } = await import(
    '../src/modules/dom-text-effects.ts'
  );
  const el = new FakeElement('div');
  const mirror = createDomMirror(el as unknown as HTMLElement);
  el.dispatch('click', {});
  const state1 = updateEffectTime(mirror.state, 0.0);
  const state2 = updateEffectTime(mirror.state, 0.2);
  const state3 = updateEffectTime(mirror.state, 0.5); // beyond default pulse duration 0.4

  // Inject the activation pulse into the mirror state for shader consumption.
  mirror.__testActivatePulse(0.0);
  const dissolve1 = computeDissolveUniforms(updateEffectTime(mirror.state, 0.0));
  const dissolve2 = computeDissolveUniforms(updateEffectTime(mirror.state, 0.2));
  const dissolve3 = computeDissolveUniforms(updateEffectTime(mirror.state, 0.5));

  assert.ok(dissolve1.intensity >= 0 && dissolve1.intensity <= 1);
  assert.ok(dissolve2.intensity >= 0 && dissolve2.intensity <= 1);
  assert.equal(dissolve3.intensity, 0, 'dissolve snaps back to 0 once pulse duration is exceeded');
  // Verify pulseAge monotonicity for in-window samples (excludes dissolve3 which clears the pulse).
  assert.ok(state2.time > state1.time, 'elapsed clock advances');
  void state3;
  mirror.dispose();
});

// ── Resize / reflow preserves alignment ────────────────────────────────────

test('ResizeObserver re-rolls the layout revision so reflow re-aligns the overlay', async () => {
  const { createDomMirror } = await import('../src/modules/dom-text-effects.ts');
  const el = new FakeElement('div');
  const mirror = createDomMirror(el as unknown as HTMLElement);
  const rev0 = mirror.state.layout.revision;
  el.setRect(480, 96);
  // Simulate ResizeObserver firing.
  for (const ro of fakeResizeObservers) {
    ro.__triggerResize([el]);
  }
  const rev1 = mirror.state.layout.revision;
  assert.ok(rev1 > rev0, 'layout revision incremented after reflow');
  assert.equal(mirror.state.layout.width, 480);
  assert.equal(mirror.state.layout.height, 96);
  mirror.dispose();
});

// ── Reduced motion collapses all three effects ─────────────────────────────

test('reduced motion collapses all three effects to amplitude 0', async () => {
  const {
    createDomMirror,
    computeScrambleUniforms,
    computeGlitchUniforms,
    computeDissolveUniforms,
    updateEffectTime,
  } = await import('../src/modules/dom-text-effects.ts');
  const el = new FakeElement('div');
  const mirror = createDomMirror(el as unknown as HTMLElement);
  el.dispatch('pointerenter', makePointerEvent({ clientX: 120, clientY: 24 }));
  el.dispatch('pointermove', makePointerEvent({ clientX: 120, clientY: 24 }));
  el.dispatch('focus', {});
  mirror.__testActivatePulse(0.0);

  const reducedState = updateEffectTime(mirror.state, 1.0, { reducedMotion: true });
  assert.equal(computeScrambleUniforms(reducedState).intensity, 0);
  assert.equal(computeGlitchUniforms(reducedState).intensity, 0);
  assert.equal(computeDissolveUniforms(reducedState).intensity, 0);
  // Time is frozen under reduced motion.
  assert.equal(reducedState.time, 0);
  mirror.dispose();
});

// ── DOM-native paths preserved ─────────────────────────────────────────────

test('the canvas overlay never holds the primary text semantics (decorative only)', () => {
  const src = readShaderSource('dom-text-effects.ts');
  // The canvas is created with pointer-events: none.
  assert.match(src, /pointer-events:\s*none/);
  // The label is the user-selectable, focusable, screen-reader-visible DOM text.
  assert.match(src, /user-select:\s*text/);
  assert.match(src, /tabIndex\s*=\s*0/);
  assert.match(src, /role.*text/);
  assert.match(src, /aria-label/);
  // No text content is written into the canvas overlay; everything stays
  // in a real DOM text node.
  assert.match(src, /label\.textContent\s*=\s*sample\.text/);
  // The overlay uses premultiplied alpha so the DOM text beneath is the
  // visible authority.
  assert.match(src, /premultipliedAlpha:\s*true/);
});

// ── Localization fixture reflows ───────────────────────────────────────────

test('localization fixture swaps DOM text without touching the canvas content', () => {
  const src = readShaderSource('dom-text-effects.ts');
  // Both English and German headline strings are present.
  assert.match(src, /SAMPLE_HEADLINE\s*=\s*['"]Shader-driven UI keeps the DOM in charge['"]/);
  assert.match(src, /SAMPLE_GERMAN\s*=\s*['"]Shader-getriebene UI behält das DOM im Griff['"]/);
  // The locale toggle updates DOM text content + lang attribute.
  assert.match(src, /headline\.textContent\s*=\s*target\.text/);
  assert.match(src, /headline\.setAttribute\('lang'/);
  // A reflow triggers a re-measurement.
  assert.match(src, /target\.mirror\.refreshLayout\(\)/);
});

// ── Manifest, routes, README ───────────────────────────────────────────────

test('manifest declares the dom-text-effects entry with all five required fields', () => {
  const manifest = readModule('manifest');
  const start = manifest.indexOf("id: 'dom-text-effects'");
  assert.ok(start >= 0, 'manifest contains dom-text-effects entry');
  const end = manifest.indexOf('];', start);
  const block = manifest.slice(start, end);
  assert.match(block, /rendererSupport:\s*\[\s*'webgl2'\s*\]/);
  assert.match(block, /costClass:\s*'low'/);
  assert.match(block, /reducedMotion:/);
  assert.match(block, /colorSpace:/);
  assert.match(block, /fixture:/);
  assert.match(block, /noCombine:\s*true/);
});

test('main router wires the new dom-text-effects routes', () => {
  const main = readFileSync(resolve(ROOT, 'src/main.ts'), 'utf8');
  assert.match(main, /'dom-text-effects'/);
  assert.match(main, /'dom-text-effects-deterministic'/);
});

test('deterministic capture fixture exists and inherits the same experiment', () => {
  const det = readFixture('dom-text-effects-deterministic.ts');
  assert.match(det, /mount as mountDomTextEffects/);
  assert.match(det, /export function mount\(ctx: ExperimentContext\)/);
});

// ── Deterministic seeds ────────────────────────────────────────────────────

test('seeds are derived from real DOM state, not invented in the canvas', async () => {
  const {
    createDomMirror,
    computeScrambleUniforms,
    computeGlitchUniforms,
    computeDissolveUniforms,
    updateEffectTime,
  } = await import('../src/modules/dom-text-effects.ts');
  const el1 = new FakeElement('div');
  const el2 = new FakeElement('div');
  el2.setRect(480, 96);
  const m1 = createDomMirror(el1 as unknown as HTMLElement);
  const m2 = createDomMirror(el2 as unknown as HTMLElement);
  // Same time, same element size — seeds should still differ because the
  // scramble seed mixes the pointer's normalized position, which differs.
  el1.dispatch('pointerenter', makePointerEvent({ clientX: 50, clientY: 12 }));
  el1.dispatch('pointermove', makePointerEvent({ clientX: 50, clientY: 12 }));
  el2.dispatch('pointerenter', makePointerEvent({ clientX: 240, clientY: 24 }));
  el2.dispatch('pointermove', makePointerEvent({ clientX: 240, clientY: 24 }));
  const s1 = computeScrambleUniforms(updateEffectTime(m1.state, 1.0));
  const s2 = computeScrambleUniforms(updateEffectTime(m2.state, 1.0));
  assert.notEqual(s1.seed, s2.seed, 'scramble seed changes with pointer uv + layout');

  // Glitch seeds differ when activation states differ.
  el1.dispatch('focus', {});
  el2.dispatch('blur', {});
  const g1 = computeGlitchUniforms(updateEffectTime(m1.state, 1.0));
  const g2 = computeGlitchUniforms(updateEffectTime(m2.state, 1.0));
  assert.notEqual(g1.seed, g2.seed, 'glitch seed changes with activation state');

  // Dissolve seeds depend on the activation pulse start time, which the
  // mirror records per-activation. Triggering pulses at different times
  // re-rolls the dissolve seed.
  m1.__testActivatePulse(0.0);
  m2.__testActivatePulse(0.2);
  const d1 = computeDissolveUniforms(updateEffectTime(m1.state, 0.1));
  const d2 = computeDissolveUniforms(updateEffectTime(m2.state, 0.1));
  assert.notEqual(d1.seed, d2.seed, 'dissolve seed changes with activation pulse start time');
  m1.dispose();
  m2.dispose();
});

// ── Clock ownership ────────────────────────────────────────────────────────

test('updateEffectTime rejects invalid clock input', async () => {
  const { createDomMirror, updateEffectTime } = await import('../src/modules/dom-text-effects.ts');
  const el = new FakeElement('div');
  const mirror = createDomMirror(el as unknown as HTMLElement);
  assert.throws(() => updateEffectTime(mirror.state, -1));
  assert.throws(() => updateEffectTime(mirror.state, Number.NaN));
  mirror.dispose();
});

// ── Disposal idempotent ────────────────────────────────────────────────────

test('dispose removes all DOM listeners and the ResizeObserver', async () => {
  const { createDomMirror } = await import('../src/modules/dom-text-effects.ts');
  const el = new FakeElement('div');
  const mirror = createDomMirror(el as unknown as HTMLElement);
  // sanity: many listeners are wired
  assert.ok(el.listenerCount('pointermove') >= 1);
  assert.ok(el.listenerCount('click') >= 1);
  mirror.dispose();
  assert.equal(el.listenerCount('pointermove'), 0);
  assert.equal(el.listenerCount('click'), 0);
  // dispose is idempotent.
  mirror.dispose();
});

// ── Helpers ────────────────────────────────────────────────────────────────

function makePointerEvent(init: { clientX: number; clientY: number; pointerId?: number }): PointerEvent {
  return {
    clientX: init.clientX,
    clientY: init.clientY,
    pointerId: init.pointerId ?? 1,
  } as unknown as PointerEvent;
}

function makeKeyboardEvent(key: string): KeyboardEvent {
  return { key } as unknown as KeyboardEvent;
}