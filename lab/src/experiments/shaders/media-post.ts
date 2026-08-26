/**
 * Media and post shader module experiment — IP-08D.
 *
 * Demonstrates video texture states, render-graph-compatible LUT placement,
 * and frame-rate-independent film grain. Every effect is opt-in via the
 * uniform panel; there is no generic apply-all path. The manifest marks
 * each module noCombine and the fixture validates the contract offline.
 *
 * @module
 */

import * as THREE from 'three';
import { createStableFrameMarker } from '@wdu-references/determinism-runtime.ts';
import type { ExperimentContext } from '../../main.js';
import { compileShader, linkProgram, displayError, clearError } from '../../compile-error.js';
import { UniformPanel } from '../../uniform-controls.js';
import vertSrc from './media-post.vert?raw';
import fragSrc from './media-post.frag?raw';

const VIDEO_LABELS = ['locked', 'loading', 'playing', 'failure', 'fallback'] as const;

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

  // Create a tiny neutral LUT strip texture (sRGB-encoded identity).
  function createNeutralLutStrip(size: number): THREE.DataTexture {
    const width = size * size;
    const height = size;
    const data = new Uint8Array(width * height * 4);
    for (let b = 0; b < size; b += 1) {
      for (let g = 0; g < size; g += 1) {
        for (let r = 0; r < size; r += 1) {
          const slice = b;
          const x = slice * size + r;
          const y = g;
          const idx = (y * width + x) * 4;
          data[idx] = Math.round((r / (size - 1)) * 255);
          data[idx + 1] = Math.round((g / (size - 1)) * 255);
          data[idx + 2] = Math.round((b / (size - 1)) * 255);
          data[idx + 3] = 255;
        }
      }
    }
    const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
  }

  // Tiny checker video texture placeholder (sRGB bytes).
  function createVideoPlaceholder(): THREE.DataTexture {
    const w = 2;
    const h = 2;
    const data = new Uint8Array([
      200, 80, 80, 255, 80, 200, 80, 255,
      80, 80, 200, 255, 220, 220, 180, 255,
    ]);
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  const lutStrip = createNeutralLutStrip(16);
  const videoTex = createVideoPlaceholder();

  const uniforms: Record<string, { value: unknown }> = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(root.clientWidth, root.clientHeight) },
    uVideoTexture: { value: videoTex },
    uSceneTexture: { value: videoTex },
    uLutStrip: { value: lutStrip },
    uLutSize: { value: 16.0 },
    uLutIntensity: { value: 0.0 },
    uGrainIntensity: { value: 0.35 },
    uSeed: { value: 7.0 },
    uVideoState: { value: 2 },
    uFallbackColor: { value: new THREE.Vector3(0.14, 0.16, 0.19) },
    uReducedMotion: { value: false },
  };

  let material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vertSrc,
    fragmentShader: fragSrc,
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const panel = new UniformPanel(controlsEl, (name, value) => {
    switch (name) {
      case 'uTime':
        (uniforms.uTime as { value: number }).value = value as number;
        break;
      case 'uLutIntensity':
        (uniforms.uLutIntensity as { value: number }).value = value as number;
        break;
      case 'uLutSize':
        (uniforms.uLutSize as { value: number }).value = value as number;
        break;
      case 'uGrainIntensity':
        (uniforms.uGrainIntensity as { value: number }).value = value as number;
        break;
      case 'uSeed':
        (uniforms.uSeed as { value: number }).value = value as number;
        break;
      case 'uVideoState':
        (uniforms.uVideoState as { value: number }).value = value as number;
        break;
      case 'uReducedMotion':
        (uniforms.uReducedMotion as { value: boolean }).value = value as boolean;
        break;
    }
  });

  panel.add({ name: 'uTime', type: 'float', value: 0, min: 0, max: 20, step: 0.01 });
  panel.add({ name: 'uVideoState', type: 'float', value: 2, min: 0, max: 4, step: 1 });
  panel.add({ name: 'uFallbackColor_r', type: 'float', value: 0.14, min: 0, max: 1, step: 0.01 });
  panel.add({ name: 'uLutIntensity', type: 'float', value: 0.0, min: 0, max: 1, step: 0.01 });
  panel.add({ name: 'uLutSize', type: 'float', value: 16, min: 8, max: 32, step: 8 });
  panel.add({ name: 'uGrainIntensity', type: 'float', value: 0.35, min: 0, max: 1, step: 0.01 });
  panel.add({ name: 'uSeed', type: 'float', value: 7, min: 0, max: 100, step: 1 });

  // Video state selector (human-readable)
  const stateContainer = document.createElement('div');
  stateContainer.style.marginTop = '1rem';
  const stateLabel = document.createElement('div');
  stateLabel.textContent = 'Video state';
  stateLabel.style.fontSize = '0.75rem';
  stateLabel.style.opacity = '0.8';
  stateContainer.appendChild(stateLabel);
  const stateSelect = document.createElement('select');
  stateSelect.style.width = '100%';
  stateSelect.style.fontSize = '0.75rem';
  for (let i = 0; i < VIDEO_LABELS.length; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${i}: ${VIDEO_LABELS[i]}`;
    if (i === 2) opt.selected = true;
    stateSelect.appendChild(opt);
  }
  stateSelect.addEventListener('change', () => {
    (uniforms.uVideoState as { value: number }).value = Number(stateSelect.value);
  });
  stateContainer.appendChild(stateSelect);
  controlsEl.appendChild(stateContainer);

  // Reduced motion toggle
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
  motionInput.addEventListener('change', () => {
    (uniforms.uReducedMotion as { value: boolean }).value = motionInput.checked;
  });

  // Grain / LUT toggles
  const grainToggle = document.createElement('label');
  grainToggle.style.display = 'flex';
  grainToggle.style.alignItems = 'center';
  grainToggle.style.gap = '0.5rem';
  grainToggle.style.fontSize = '0.75rem';
  grainToggle.style.marginTop = '0.5rem';
  const grainInput = document.createElement('input');
  grainInput.type = 'checkbox';
  grainInput.checked = true;
  const grainText = document.createElement('span');
  grainText.textContent = 'film grain';
  grainToggle.appendChild(grainInput);
  grainToggle.appendChild(grainText);
  controlsEl.appendChild(grainToggle);

  const lutToggle = document.createElement('label');
  lutToggle.style.display = 'flex';
  lutToggle.style.alignItems = 'center';
  lutToggle.style.gap = '0.5rem';
  lutToggle.style.fontSize = '0.75rem';
  lutToggle.style.marginTop = '0.2rem';
  const lutInput = document.createElement('input');
  lutInput.type = 'checkbox';
  lutInput.checked = false;
  const lutText = document.createElement('span');
  lutText.textContent = 'LUT (identity)';
  lutToggle.appendChild(lutInput);
  lutToggle.appendChild(lutText);
  controlsEl.appendChild(lutToggle);

  function applyEffectState(): void {
    const reduced = motionInput.checked;
    const grainOn = grainInput.checked && !reduced;
    const lutOn = lutInput.checked;
    (uniforms.uReducedMotion as { value: boolean }).value = reduced;
    (uniforms.uGrainIntensity as { value: number }).value = grainOn ? 0.35 : 0.0;
    (uniforms.uLutIntensity as { value: number }).value = lutOn ? 1.0 : 0.0;
  }
  grainInput.addEventListener('change', applyEffectState);
  lutInput.addEventListener('change', applyEffectState);
  motionInput.addEventListener('change', applyEffectState);

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
    import.meta.hot.accept('./media-post.vert?raw', (mod) => {
      if (mod) recompileShader(mod.default, material.fragmentShader);
    });
    import.meta.hot.accept('./media-post.frag?raw', (mod) => {
      if (mod) recompileShader(material.vertexShader, mod.default);
    });
  }

  const stableFrame = deterministic
    ? createStableFrameMarker({ target: document.documentElement, stableFrame: 3 })
    : null;

  let frame = 0;
  function animate(): void {
    if (deterministic && stableFrame?.ready) return;
    clock.tick();
    (uniforms.uTime as { value: number }).value = clock.elapsed;
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
    (uniforms.uResolution.value as THREE.Vector2).set(w, h);
  }
  window.addEventListener('resize', onResize);
}
