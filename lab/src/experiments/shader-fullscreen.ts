/**
 * shader-fullscreen experiment
 *
 * A fullscreen GLSL shader with uniform controls, sub-second HMR on shader
 * file changes, and deterministic capture support. The shader source is
 * imported via Vite's ?raw suffix so every file change triggers a hot module
 * update that recompiles the shader manually — catching compile errors before
 * they reach the renderer.
 *
 * @module
 */

import * as THREE from 'three';
import { createStableFrameMarker } from '@wdu-references/determinism-runtime.ts';
import type { ExperimentContext } from '../main.js';
import { compileShader, linkProgram, displayError, clearError } from '../compile-error.js';
import { UniformPanel } from '../uniform-controls.js';
import vertSrc from './shader-fullscreen.vert?raw';
import fragSrc from './shader-fullscreen.frag?raw';

export function mount(ctx: ExperimentContext): void {
  const { root, clock, deterministic, errorEl, controlsEl } = ctx;

  // ── Renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: deterministic,
  });
  renderer.setSize(root.clientWidth, root.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  root.appendChild(renderer.domElement);

  const gl = renderer.getContext() as WebGL2RenderingContext | null;

  // ── Scene ─────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0c);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(root.clientWidth, root.clientHeight) },
  };

  let material = new THREE.ShaderMaterial({
    vertexShader: vertSrc,
    fragmentShader: fragSrc,
    uniforms,
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // ── Uniform panel ─────────────────────────────────────────────────────────
  const panel = new UniformPanel(controlsEl, (name, value) => {
    if (name === 'uTime' && uniforms.uTime) {
      uniforms.uTime.value = value as number;
    }
  });
  panel.add({ name: 'uTime', type: 'float', value: 0, min: 0, max: 10, step: 0.01 });

  // ── HMR — recompile shader on file change ─────────────────────────────────
  function recompileShader(
    newVertSrc: string,
    newFragSrc: string,
  ): boolean {
    if (!gl) return false;

    // Manual compile check — errors are caught before the material is updated
    const vertResult = compileShader(gl, newVertSrc, 'vertex');
    if (vertResult.error) {
      displayError(vertResult.error);
      return false;
    }

    const fragResult = compileShader(gl, newFragSrc, 'fragment');
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

    // Compilation succeeded — apply the new shader
    gl.deleteShader(vertResult.shader);
    gl.deleteShader(fragResult.shader);
    gl.deleteProgram(linkResult.program);

    clearError();
    material.vertexShader = newVertSrc;
    material.fragmentShader = newFragSrc;
    material.needsUpdate = true;
    return true;
  }

  if (import.meta.hot) {
    import.meta.hot.accept('./shader-fullscreen.vert?raw', (mod) => {
      if (mod) recompileShader(mod.default, material.fragmentShader);
    });
    import.meta.hot.accept('./shader-fullscreen.frag?raw', (mod) => {
      if (mod) recompileShader(material.vertexShader, mod.default);
    });
  }

  // ── Deterministic capture ─────────────────────────────────────────────────
  const stableFrame = deterministic
    ? createStableFrameMarker({ target: document.documentElement, stableFrame: 3 })
    : null;

  // ── Animation loop ────────────────────────────────────────────────────────
  let frame = 0;
  function animate(): void {
    // Freeze completely once the stable frame is reached — keeps the canvas
    // buffer from the ready frame for deterministic capture.
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

  // ── Resize ────────────────────────────────────────────────────────────────
  function onResize(): void {
    const w = root.clientWidth;
    const h = root.clientHeight;
    renderer.setSize(w, h);
    uniforms.uResolution.value.set(w, h);
  }
  window.addEventListener('resize', onResize);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  // The experiment root is cleared by main.ts when a new experiment loads.
  // No explicit cleanup registration needed here.
}