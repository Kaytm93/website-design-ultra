/**
 * DOM-mirrored shader text effects visual fixture (IP-11B).
 *
 * Renders three DOM text labels in the page, each backed by a real DOM
 * element that owns the primary text semantics (visible, selectable,
 * translatable, screen-readable). Above each label, a small canvas
 * overlay renders a decorative scramble/glitch/dissolve effect whose
 * every uniform is mirrored from DOM events (pointer, focus, click,
 * keyboard) and DOM measurements (bbox, layout revision). The canvas
 * never invents interaction state.
 *
 * The DOM elements are the source of truth:
 *  - their text content is the headline text (changes apply to the DOM
 *    text node, never to the canvas);
 *  - their bounding box is read every frame so the canvas overlay
 *    re-aligns on reflow / resize;
 *  - their tabindex makes them focusable so keyboard parity is provable;
 *  - their role + aria-label makes them screen-reader visible;
 *  - the search/select/copy/translation paths use the DOM element
 *    directly — the canvas never holds those semantics.
 *
 * The three effects share the same shader: a uniform effect-id picks the
 * formula. Scramble uses pointer proximity; glitch uses activation; dissolve
 * uses activation's pulse age. A reduced-motion toggle in the controls
 * panel collapses all three to amplitude 0 while preserving the DOM
 * interaction paths.
 *
 * Determinism: under WDU_DETERMINISTIC=1 the mirror seeds the scramble and
 * dissolve uniformly from layout revision + elapsed clock; two runs hash
 * the same canvas pixels for the same input.
 *
 * @module
 */

import * as THREE from 'three';
import type { ExperimentContext } from '../../main.js';
import {
  createDomMirror,
  computeScrambleUniforms,
  computeGlitchUniforms,
  computeDissolveUniforms,
  updateEffectTime,
  type DomMirror,
  type EffectUniforms,
  DEFAULT_PULSE_DURATION_SECONDS,
} from '../../modules/dom-text-effects.js';

const SAMPLE_HEADLINE = 'Shader-driven UI keeps the DOM in charge';
const SAMPLE_GERMAN = 'Shader-getriebene UI behält das DOM im Griff';
const SAMPLE_SHORT = 'Drag · Focus · Activate';

interface LabelFixture {
  readonly id: string;
  readonly text: string;
  readonly lang: 'en' | 'de';
  readonly effectId: 0 | 1 | 2; // 0=scramble, 1=glitch, 2=dissolve
  readonly labelText: string;
  readonly mirror: DomMirror;
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly material: THREE.RawShaderMaterial;
  readonly mesh: THREE.Mesh;
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
}

export function mount(ctx: ExperimentContext): void {
  const { root, clock, deterministic, controlsEl, errorEl } = ctx;

  // ── DOM host: primary text lives here ───────────────────────────────────
  const host = document.createElement('div');
  host.setAttribute('role', 'region');
  host.setAttribute('aria-label', 'DOM-mirrored shader text effects (IP-11B)');
  host.style.cssText = [
    'position:absolute',
    'inset:0',
    'overflow:auto',
    'padding:24px',
    'box-sizing:border-box',
    'background:#070708',
    'color:#e5e7ea',
    "font:16px/1.45 ui-sans-serif,system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif",
  ].join(';');
  root.appendChild(host);

  const title = document.createElement('h1');
  title.style.cssText = 'font-size:18px;margin:0 0 4px;color:#f3f4f6;';
  title.textContent = 'DOM-mirrored shader text effects (IP-11B)';
  host.appendChild(title);

  const blurb = document.createElement('p');
  blurb.style.cssText = 'max-width:520px;margin:0 0 16px;color:#9aa0a6;font-size:13px;';
  blurb.textContent =
    'Three labels. The DOM owns selection, copy, translation, and screen reading. ' +
    'Each canvas overlay is decorative; every uniform is mirrored from real DOM events.';
  host.appendChild(blurb);

  const stack = document.createElement('div');
  stack.style.cssText = 'display:flex;flex-direction:column;gap:18px;';
  host.appendChild(stack);

  // ── Three label fixtures ────────────────────────────────────────────────
  const fixtures: LabelFixture[] = [];
  const samples = [
    { id: 'en', text: SAMPLE_HEADLINE, lang: 'en' as const, effect: 0 as const, label: 'scramble (pointer)' },
    { id: 'de', text: SAMPLE_GERMAN, lang: 'de' as const, effect: 1 as const, label: 'glitch (focus / activate)' },
    { id: 'short', text: SAMPLE_SHORT, lang: 'en' as const, effect: 2 as const, label: 'dissolve (activate)' },
  ];

  for (const sample of samples) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

    const caption = document.createElement('span');
    caption.style.cssText = 'font-size:11px;color:#9aa0a6;letter-spacing:0.04em;text-transform:uppercase;';
    caption.textContent = sample.label;
    row.appendChild(caption);

    const label = document.createElement('div');
    label.id = `wdu-effect-label-${sample.id}`;
    label.tabIndex = 0;
    label.setAttribute('role', 'text');
    label.setAttribute('lang', sample.lang);
    label.setAttribute('aria-label', `${sample.label} – ${sample.text}`);
    label.dataset.wduTextRole = 'primary';
    label.textContent = sample.text;
    label.style.cssText = [
      'position:relative',
      'display:inline-block',
      'padding:8px 12px',
      'border-radius:4px',
      'border:1px solid #1a1a1a',
      'background:rgba(15,18,24,0.55)',
      'color:#e5e7ea',
      'font-size:18px',
      'line-height:1.35',
      'cursor:text',
      'user-select:text',
      '-webkit-user-select:text',
      'max-width:480px',
      'outline:none',
    ].join(';');
    label.addEventListener('focus', () => {
      label.style.boxShadow = '0 0 0 2px rgba(120,180,255,0.45)';
    });
    label.addEventListener('blur', () => {
      label.style.boxShadow = '';
    });
    row.appendChild(label);

    stack.appendChild(row);

    // Canvas overlay sized to the label's content box. The canvas is purely
    // decorative — pointer-events:none so the label owns selection.
    const canvas = document.createElement('canvas');
    canvas.setAttribute('data-wdu-effect', String(sample.effect));
    canvas.setAttribute('data-wdu-label-id', label.id);
    canvas.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      'pointer-events:none',
      'mix-blend-mode:screen',
      'opacity:0.85',
    ].join(';');
    // Position the canvas relative to the label by wrapping it inside an
    // absolutely positioned container.
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:relative;display:inline-block;';
    overlay.appendChild(label);
    overlay.appendChild(canvas);
    row.appendChild(overlay);

    const mirror = createDomMirror(label, {
      pulseDuration: DEFAULT_PULSE_DURATION_SECONDS,
      clock: ctx.clock,
    });

    // ── Three.js renderer for the overlay ─────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: deterministic,
      premultipliedAlpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT_SRC,
      fragmentShader: FRAG_SRC,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uEffect: { value: sample.effect },
        uIntensity: { value: 0 },
        uSeed: { value: 1 },
        uPulseAge: { value: 0 },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uHasPointer: { value: 0 },
        uLabelSize: { value: new THREE.Vector2(1, 1) },
        uReducedMotion: { value: false },
      },
      transparent: true,
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    fixtures.push({
      id: sample.id,
      text: sample.text,
      lang: sample.lang,
      effectId: sample.effect,
      labelText: sample.label,
      mirror,
      canvas,
      renderer,
      material,
      mesh,
      scene,
      camera,
    });
  }

  // ── Controls ────────────────────────────────────────────────────────────
  const motionLabel = document.createElement('label');
  motionLabel.style.cssText = 'display:flex;align-items:center;gap:0.5rem;font-size:12px;color:#cbd5e1;margin-top:12px;';
  const motionInput = document.createElement('input');
  motionInput.type = 'checkbox';
  const motionText = document.createElement('span');
  motionText.textContent = 'reduced motion (freeze all three effects to amplitude 0)';
  motionLabel.appendChild(motionInput);
  motionLabel.appendChild(motionText);
  controlsEl.appendChild(motionLabel);

  // ── Localization fixture toggle (English <-> German) ───────────────────
  const localeLabel = document.createElement('label');
  localeLabel.style.cssText = 'display:flex;align-items:center;gap:0.5rem;font-size:12px;color:#cbd5e1;margin-top:6px;';
  const localeSelect = document.createElement('select');
  for (const opt of [
    { value: 'en', label: 'English headline' },
    { value: 'de', label: 'German headline (lang=de, broken across reflow)' },
    { value: 'short', label: 'Short caption (portrait)' },
  ]) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    localeSelect.appendChild(o);
  }
  localeSelect.value = 'en';
  const localeText = document.createElement('span');
  localeText.textContent = 'localization fixture (re-flows DOM text)';
  localeLabel.appendChild(localeSelect);
  localeLabel.appendChild(localeText);
  controlsEl.appendChild(localeLabel);

  localeSelect.addEventListener('change', () => {
    const id = localeSelect.value;
    const target = fixtures.find((f) => f.id === id);
    if (!target) return;
    // Update only the headline element's text + lang to demonstrate that
    // selection, copy, and translation stay DOM-native; the canvas overlay
    // re-aligns on the next frame because ResizeObserver fires.
    const headline = document.getElementById(`wdu-effect-label-${target.id}`) as HTMLElement | null;
    if (!headline) return;
    headline.textContent = target.text;
    headline.setAttribute('lang', target.lang);
    target.mirror.refreshLayout();
  });

  // ── Resize handling: keep the canvas aligned with the DOM label ────────
  function syncOverlaySize(): void {
    for (const f of fixtures) {
      const rect = f.canvas.parentElement!.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      f.renderer.setSize(w, h, false);
      const u = f.material.uniforms;
      (u.uResolution.value as THREE.Vector2).set(w, h);
      (u.uLabelSize.value as THREE.Vector2).set(w, h);
    }
  }
  syncOverlaySize();
  window.addEventListener('resize', syncOverlaySize);

  // ── Animation loop ─────────────────────────────────────────────────────
  let frame = 0;
  const reducedMotion = (): boolean => motionInput.checked;

  function animate(): void {
    if (clock) clock.tick();

    for (const f of fixtures) {
      // Refresh the mirror's layout read. The mirror caches its own
      // ResizeObserver-driven layout revision; reading the latest bbox is
      // cheap and keeps the overlay aligned when the DOM reflows.
      const rect = f.canvas.parentElement!.getBoundingClientRect();
      f.mirror.refreshLayout();

      const baseState = f.mirror.state;
      const time = clock ? clock.elapsed : baseState.time;
      const state = updateEffectTime(baseState, time, { reducedMotion: reducedMotion() });

      const uniforms: EffectUniforms =
        f.effectId === 0
          ? computeScrambleUniforms(state)
          : f.effectId === 1
            ? computeGlitchUniforms(state)
            : computeDissolveUniforms(state);

      const u = f.material.uniforms;
      (u.uTime.value as number) = state.time;
      (u.uIntensity.value as number) = uniforms.intensity;
      (u.uSeed.value as number) = uniforms.seed >>> 0;
      (u.uPulseAge.value as number) = uniforms.pulseAge;
      (u.uReducedMotion.value as boolean) = state.reducedMotion;
      if (uniforms.pointerUv) {
        (u.uPointer.value as THREE.Vector2).set(uniforms.pointerUv.u, uniforms.pointerUv.v);
        (u.uHasPointer.value as number) = 1;
      } else {
        (u.uHasPointer.value as number) = 0;
      }
      // Tag the label with the latest bbox so deterministic capture can
      // verify canvas-vs-DOM alignment from outside the page.
      const widthCss = Math.round(rect.width);
      const heightCss = Math.round(rect.height);
      const labelEl = document.getElementById(`wdu-effect-label-${f.id}`) as HTMLElement | null;
      if (labelEl) {
        labelEl.setAttribute('data-wdu-overlay-width', String(widthCss));
        labelEl.setAttribute('data-wdu-overlay-height', String(heightCss));
        labelEl.setAttribute('data-wdu-layout-revision', String(state.layout.revision));
        labelEl.setAttribute('data-wdu-effect', String(f.effectId));
      }
      f.renderer.render(f.scene, f.camera);
    }

    frame += 1;
    if (deterministic && frame === 1) {
      document.documentElement.dataset.wduReady = 'true';
    }
    requestAnimationFrame(animate);
  }
  animate();

  // ── Cleanup on unload ──────────────────────────────────────────────────
  window.addEventListener('beforeunload', () => {
    for (const f of fixtures) {
      f.mirror.dispose();
      f.material.dispose();
      f.renderer.dispose();
    }
  });

  // Initial wire-up: ensure each fixture's canvas size is set even if the
  // ResizeObserver hasn't fired yet.
  syncOverlaySize();
  // errorEl is wired by main.ts already — keep the import alive so the
  // type contract is honored.
  void errorEl;
}

// ── Shaders ──────────────────────────────────────────────────────────────────

const VERT_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uIntensity;
uniform float uSeed;
uniform float uPulseAge;
uniform vec2 uPointer;
uniform int uHasPointer;
uniform int uEffect;
uniform vec2 uLabelSize;
uniform bool uReducedMotion;

// Hash helper used by scramble + glitch. Output in [0, 1).
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 effectColor(float localSeed, float coverage, vec2 uv) {
  // Coverage 0 = no effect (transparent), 1 = full amplitude.
  if (coverage <= 0.0) return vec3(0.0);

  if (uEffect == 0) {
    // Scramble: a tile pattern gated by pointer proximity, derived from
    // uPointer. Tiles re-roll from uSeed + time. The color is additive
    // (transparent base) and never opaque, so the DOM text beneath
    // remains the visual authority.
    float tileX = floor(uv.x * 12.0);
    float tileY = floor(uv.y * 4.0);
    float r = hash21(vec2(tileX + uSeed, tileY + uSeed * 0.31));
    float g = hash21(vec2(tileX + uSeed * 1.7, tileY - uSeed * 0.21));
    float b = hash21(vec2(tileX - uSeed * 0.7, tileY + uSeed * 1.1));
    float distFromPointer = length(uv - uPointer);
    float falloff = 1.0 - smoothstep(0.0, 0.45, distFromPointer);
    float amp = coverage * falloff;
    return vec3(r, g, b) * amp * 0.65;
  }

  if (uEffect == 1) {
    // Glitch: channel offset driven by uSeed; pulse age adds a transient
    // burst that decays to zero within one pulse duration.
    float offset = (hash21(vec2(uSeed, uv.y * 32.0)) - 0.5) * 0.04 * coverage;
    float band = step(0.7, hash21(vec2(floor(uv.y * 6.0), uSeed + 1.0))) * coverage;
    float pulse = max(0.0, 1.0 - uPulseAge / 0.4) * coverage;
    float r = 0.85 * band + 0.4 * pulse;
    float g = 0.25 * band;
    float b = 0.95 * band + 0.3 * pulse;
    return vec3(r, g, b) * coverage + vec3(offset, 0.0, -offset) * pulse;
  }

  // Dissolve (default / fallback).
  float t = clamp(uPulseAge / 0.4, 0.0, 1.0);
  float mask = smoothstep(0.0, 1.0, t);
  float dist = hash21(vec2(floor(uv.x * 24.0), floor(uv.y * 8.0)) + vec2(uSeed));
  float threshold = step(1.0 - mask, dist);
  vec3 base = vec3(0.7, 0.85, 1.0) * threshold * mask;
  return base;
}

void main() {
  // Compose in normalized element space so a reflow + ResizeObserver
  // re-measurement preserves alignment automatically: the geometry stays
  // a unit quad, uResolution scales it, and the DOM's bounding box owns
  // the size.
  vec2 uv = vUv;
  float intensity = uReducedMotion ? 0.0 : clamp(uIntensity, 0.0, 1.0);
  vec3 color = effectColor(uSeed, intensity, uv);
  // Output uses premultiplied alpha (renderer is created with
  // premultipliedAlpha: true). The DOM text underneath must remain
  // visible — the alpha is the effect coverage.
  fragColor = vec4(color * intensity, intensity);
}
`;