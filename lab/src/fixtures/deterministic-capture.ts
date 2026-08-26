/**
 * deterministic-capture fixture
 *
 * Renders a minimal deterministically seeded scene, fires the
 * data-wdu-ready marker after the first stable frame, and holds the
 * frame. Intended to produce a byte-identifiable output for the
 * deterministic capture comparator.
 *
 * @module
 */

import * as THREE from 'three';
import {
  createStableFrameMarker,
  createRandomStreams,
} from '@wdu-references/determinism-runtime.ts';
import type { ExperimentContext } from '../main.js';

export function mount(ctx: ExperimentContext): void {
  const { root, clock, deterministic } = ctx;

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(root.clientWidth, root.clientHeight);
  renderer.setPixelRatio(1);
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222244);

  const camera = new THREE.PerspectiveCamera(60, root.clientWidth / root.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 3);

  // Seeded geometry — always the same in deterministic mode
  const streams = deterministic
    ? createRandomStreams('ip-08a-deterministic-capture-v1')
    : createRandomStreams(`live-${Date.now()}`);

  const rng = streams.stream('capture-geometry');
  const count = 50;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (rng.next() - 0.5) * 4;
    positions[i * 3 + 1] = (rng.next() - 0.5) * 4;
    positions[i * 3 + 2] = (rng.next() - 0.5) * 4;
    colors[i * 3] = rng.next();
    colors[i * 3 + 1] = rng.next();
    colors[i * 3 + 2] = rng.next();
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const points = new THREE.Points(
    geom,
    new THREE.PointsMaterial({ size: 0.08, vertexColors: true }),
  );
  scene.add(points);

  // Stable frame marker
  const stableFrame = deterministic
    ? createStableFrameMarker({ target: document.documentElement, stableFrame: 3 })
    : null;

  let frame = 0;
  function animate(): void {
    // Freeze completely once the stable frame is reached
    if (deterministic && stableFrame?.ready) return;

    clock.tick();

    // Fixed rotation in deterministic mode
    points.rotation.x = deterministic ? 0.3 : clock.elapsed * 0.15;
    points.rotation.y = deterministic ? 0.5 : clock.elapsed * 0.2;

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
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  // Cleanup is handled by main.ts clearing the root element.
}