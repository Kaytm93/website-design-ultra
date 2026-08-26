/**
 * Foundational shader module experiment.
 *
 * Demonstrates simplex/value/curl noise, Fresnel, iridescence, and dissolve
 * on a single fullscreen quad. Every effect is controlled by a uniform panel
 * so the manifest cost class and reduced-motion behavior can be inspected
 * interactively.
 *
 * @module
 */

import * as THREE from 'three';
import { createStableFrameMarker } from '@wdu-references/determinism-runtime.ts';
import type { ExperimentContext } from '../../main.js';
import { compileShader, linkProgram, displayError, clearError } from '../../compile-error.js';
import { UniformPanel } from '../../uniform-controls.js';
import vertSrc from './foundational-shaders.vert?raw';
import fragSrc from './foundational-shaders.frag?raw';

export function mount(ctx: ExperimentContext): void {
  const { root, clock, deterministic, errorEl, controlsEl } = ctx;

  // ---- Renderer ----------------------------------------------------------
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

  // ---- Scene / camera ----------------------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060608);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---- Uniforms ----------------------------------------------------------
  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(root.clientWidth, root.clientHeight) },
    uNoiseStrength: { value: 0.7 },
    uCurlStrength: { value: 0.4 },
    uIridescenceThickness: { value: 380.0 },
    uDissolveThreshold: { value: 0.5 },
    uSeed: { value: 7.0 },
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

  // ---- Uniform panel -----------------------------------------------------
  const panel = new UniformPanel(controlsEl, (name, value) => {
    switch (name) {
      case 'uTime':
        uniforms.uTime.value = value as number;
        break;
      case 'uNoiseStrength':
        uniforms.uNoiseStrength.value = value as number;
        break;
      case 'uCurlStrength':
        uniforms.uCurlStrength.value = value as number;
        break;
      case 'uIridescenceThickness':
        uniforms.uIridescenceThickness.value = value as number;
        break;
      case 'uDissolveThreshold':
        uniforms.uDissolveThreshold.value = value as number;
        break;
      case 'uSeed':
        uniforms.uSeed.value = value as number;
        break;
    }
  });

  panel.add({ name: 'uTime', type: 'float', value: 0, min: 0, max: 20, step: 0.01 });
  panel.add({ name: 'uNoiseStrength', type: 'float', value: 0.7, min: 0, max: 1, step: 0.01 });
  panel.add({ name: 'uCurlStrength', type: 'float', value: 0.4, min: 0, max: 1, step: 0.01 });
  panel.add({ name: 'uIridescenceThickness', type: 'float', value: 380, min: 200, max: 900, step: 1 });
  panel.add({ name: 'uDissolveThreshold', type: 'float', value: 0.5, min: 0, max: 1, step: 0.01 });
  panel.add({ name: 'uSeed', type: 'float', value: 7, min: 0, max: 100, step: 1 });

  // ---- HMR ---------------------------------------------------------------
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
    import.meta.hot.accept('./foundational-shaders.vert?raw', (mod) => {
      if (mod) recompileShader(mod.default, material.fragmentShader);
    });
    import.meta.hot.accept('./foundational-shaders.frag?raw', (mod) => {
      if (mod) recompileShader(material.vertexShader, mod.default);
    });
  }

  // ---- Deterministic capture ---------------------------------------------
  const stableFrame = deterministic
    ? createStableFrameMarker({ target: document.documentElement, stableFrame: 3 })
    : null;

  // ---- Render loop -------------------------------------------------------
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

  // ---- Resize -------------------------------------------------------------
  function onResize(): void {
    const w = root.clientWidth;
    const h = root.clientHeight;
    renderer.setSize(w, h);
    uniforms.uResolution.value.set(w, h);
  }
  window.addEventListener('resize', onResize);
}
