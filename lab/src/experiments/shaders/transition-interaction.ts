/**
 * Transition and interaction shader module experiment.
 *
 * Demonstrates frosted transition/displacement mask, capped chromatic
 * offset, click shockwave, and flow-field deformation on a single
 * fullscreen quad. Effects are opt-in only; the experiment explicitly
 * selects which modules run through the uniform panel. Reduced motion
 * freezes animated time and replaces the shockwave with its initial
 * state.
 *
 * @module
 */

import * as THREE from 'three';
import type { ExperimentContext } from '../../main.js';
import { compileShader, linkProgram, displayError, clearError } from '../../compile-error.js';
import { UniformPanel } from '../../uniform-controls.js';
import vertSrc from './transition-interaction.vert?raw';
import fragSrc from './transition-interaction.frag?raw';

type EffectToggle = {
  label: string;
  checked: boolean;
};

const EFFECT_TOGGLES: EffectToggle[] = [
  { label: 'flow', checked: true },
  { label: 'frosted', checked: true },
  { label: 'shockwave', checked: true },
  { label: 'chromatic', checked: false },
];

export function mount(ctx: ExperimentContext): void {
  const { root, clock, deterministic, errorEl, controlsEl } = ctx;

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: deterministic,
  });
  renderer.setSize(root.clientWidth, root.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  root.appendChild(renderer.domElement);

  const gl = renderer.getContext() as WebGL2RenderingContext | null;
  const withGlsl3Header = (source: string): string =>
    source.startsWith('#version') ? source : `#version 300 es\n${source}`;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060608);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(root.clientWidth, root.clientHeight) },
    uFrostedProgress: { value: 0.4 },
    uFrostedStrength: { value: 0.18 },
    uChromaticAmplitude: { value: 0.04 },
    uFlowStrength: { value: 0.25 },
    uShockwaveTime: { value: 0.6 },
    uShockwaveOrigin: { value: new THREE.Vector2(0.5, 0.5) },
    uShockwaveMaxRadius: { value: 0.8 },
    uShockwaveStrength: { value: 0.35 },
    uSeed: { value: 11.0 },
    uReducedMotion: { value: false },
  };

  let material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vertSrc,
    fragmentShader: fragSrc,
    uniforms,
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const panel = new UniformPanel(controlsEl, (name: string, value: number | boolean) => {
    switch (name) {
      case 'uTime':
        uniforms.uTime.value = value as number;
        break;
      case 'uFrostedProgress':
        uniforms.uFrostedProgress.value = value as number;
        break;
      case 'uFrostedStrength':
        uniforms.uFrostedStrength.value = value as number;
        break;
      case 'uChromaticAmplitude':
        uniforms.uChromaticAmplitude.value = value as number;
        break;
      case 'uFlowStrength':
        uniforms.uFlowStrength.value = value as number;
        break;
      case 'uShockwaveTime':
        uniforms.uShockwaveTime.value = value as number;
        break;
      case 'uShockwaveMaxRadius':
        uniforms.uShockwaveMaxRadius.value = value as number;
        break;
      case 'uShockwaveStrength':
        uniforms.uShockwaveStrength.value = value as number;
        break;
      case 'uSeed':
        uniforms.uSeed.value = value as number;
        break;
    }
  });

  panel.add({ name: 'uTime', type: 'float', value: 0, min: 0, max: 20, step: 0.01 });
  panel.add({ name: 'uFrostedProgress', type: 'float', value: 0.4, min: 0, max: 1, step: 0.01 });
  panel.add({ name: 'uFrostedStrength', type: 'float', value: 0.18, min: 0, max: 0.25, step: 0.01 });
  panel.add({ name: 'uChromaticAmplitude', type: 'float', value: 0.04, min: 0, max: 0.08, step: 0.001 });
  panel.add({ name: 'uFlowStrength', type: 'float', value: 0.25, min: 0, max: 0.3, step: 0.01 });
  panel.add({ name: 'uShockwaveTime', type: 'float', value: 0.6, min: 0, max: 2, step: 0.01 });
  panel.add({ name: 'uShockwaveMaxRadius', type: 'float', value: 0.8, min: 0, max: 1, step: 0.01 });
  panel.add({ name: 'uShockwaveStrength', type: 'float', value: 0.35, min: 0, max: 0.5, step: 0.01 });
  panel.add({ name: 'uSeed', type: 'float', value: 11, min: 0, max: 100, step: 1 });

  const toggleContainer = document.createElement('div');
  toggleContainer.style.marginTop = '1rem';
  const toggleLabel = document.createElement('div');
  toggleLabel.textContent = 'Effect toggles';
  toggleLabel.style.fontSize = '0.75rem';
  toggleLabel.style.opacity = '0.8';
  toggleContainer.appendChild(toggleLabel);
  controlsEl.appendChild(toggleContainer);

  const checkboxByEffect = new Map<string, HTMLInputElement>();
  for (const effect of EFFECT_TOGGLES) {
    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '0.5rem';
    row.style.fontSize = '0.75rem';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = effect.checked;
    checkboxByEffect.set(effect.label, input);

    const text = document.createElement('span');
    text.textContent = effect.label;

    row.appendChild(input);
    row.appendChild(text);
    toggleContainer.appendChild(row);
  }

  const motionToggle = document.createElement('label');
  motionToggle.style.display = 'flex';
  motionToggle.style.alignItems = 'center';
  motionToggle.style.gap = '0.5rem';
  motionToggle.style.fontSize = '0.75rem';
  motionToggle.style.marginTop = '0.5rem';
  const motionInput = document.createElement('input');
  motionInput.type = 'checkbox';
  motionInput.checked = false;
  const motionText = document.createElement('span');
  motionText.textContent = 'reduced motion';
  motionToggle.appendChild(motionInput);
  motionToggle.appendChild(motionText);
  controlsEl.appendChild(motionToggle);

  function applyEffectState(): void {
    const reducedMotion = motionInput.checked;
    uniforms.uReducedMotion.value = reducedMotion;
    uniforms.uFlowStrength.value = checkboxByEffect.get('flow')!.checked && !reducedMotion ? 0.25 : 0.0;
    uniforms.uFrostedProgress.value = checkboxByEffect.get('frosted')!.checked ? 0.4 : 0.0;
    uniforms.uFrostedStrength.value = checkboxByEffect.get('frosted')!.checked ? 0.18 : 0.0;
    uniforms.uShockwaveTime.value = checkboxByEffect.get('shockwave')!.checked && !reducedMotion ? 0.6 : 0.0;
    uniforms.uShockwaveStrength.value = checkboxByEffect.get('shockwave')!.checked && !reducedMotion ? 0.35 : 0.0;
    uniforms.uChromaticAmplitude.value = checkboxByEffect.get('chromatic')!.checked ? 0.04 : 0.0;
  }

  for (const input of checkboxByEffect.values()) {
    input.addEventListener('change', applyEffectState);
  }
  motionInput.addEventListener('change', applyEffectState);
  applyEffectState();

  function recompileShader(newVert: string, newFrag: string): boolean {
    if (!gl) return false;

    const vertResult = compileShader(gl, withGlsl3Header(newVert), 'vertex');
    if (vertResult.error) {
      displayError(vertResult.error);
      return false;
    }
    const fragResult = compileShader(gl, withGlsl3Header(newFrag), 'fragment');
    if (fragResult.error) {
      gl.deleteShader(vertResult.shader);
      displayError(fragResult.error);
      return false;
    }
    const linkResult = linkProgram(gl, vertResult.shader, fragResult.shader);
    if (linkResult.error) {
      gl.deleteShader(vertResult.shader);
      gl.deleteShader(fragResult.shader);
      displayError(linkResult.error);
      return false;
    }

    gl.deleteShader(vertResult.shader);
    gl.deleteShader(fragResult.shader);
    gl.deleteProgram(linkResult.program);

    clearError();
    material.vertexShader = newVert;
    material.fragmentShader = newFrag;
    material.needsUpdate = true;
    return true;
  }

  if (import.meta.hot) {
    import.meta.hot.accept('./transition-interaction.vert?raw', (mod) => {
      if (mod) recompileShader(mod.default, material.fragmentShader);
    });
    import.meta.hot.accept('./transition-interaction.frag?raw', (mod) => {
      if (mod) recompileShader(material.vertexShader, mod.default);
    });
  }

  const stableFrame = deterministic
    ? (ctx as any).createStableFrameMarker?.({ target: document.documentElement, stableFrame: 3 })
    : null;

  let frame = 0;
  function animate(): void {
    if (deterministic && stableFrame?.ready) return;

    clock.tick();
    uniforms.uTime.value = clock.elapsed;

    renderer.render(scene, camera);
    frame += 1;

    if (deterministic && stableFrame) {
      stableFrame.afterVisibleRender({
        frame,
        assetsReady: true,
        cameraStationApplied: true,
        streamsInitialized: true,
      });
    }

    requestAnimationFrame(animate);
  }
  animate();

  function onResize(): void {
    const w = root.clientWidth;
    const h = root.clientHeight;
    renderer.setSize(w, h);
    uniforms.uResolution.value.set(w, h);
  }
  window.addEventListener('resize', onResize);
}
