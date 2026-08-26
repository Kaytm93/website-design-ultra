/**
 * particle-toy experiment — placeholder for future GPU particle systems.
 *
 * No particle code is shipped here; this is a structural placeholder that
 * proves the experiment routing works and provides a minimal render loop
 * for the particle-lab harness. Concrete particle experiments will land in
 * IP-09A (TODO.md T2.3).
 *
 * @module
 */

import * as THREE from 'three';
import type { ExperimentContext } from '../main.js';
import { UniformPanel } from '../uniform-controls.js';

export function mount(ctx: ExperimentContext): void {
  const { root, clock, controlsEl } = ctx;

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setSize(root.clientWidth, root.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0c);

  const camera = new THREE.PerspectiveCamera(60, root.clientWidth / root.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 3);

  // A simple point cloud placeholder
  const count = 100;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 4;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geom,
    new THREE.PointsMaterial({ color: 0x4488ff, size: 0.05 }),
  );
  scene.add(points);

  const panel = new UniformPanel(controlsEl, () => {});
  panel.add({ name: 'particle-count', type: 'int', value: count, min: 10, max: 1000, step: 10 });

  let frame = 0;
  function animate(): void {
    clock.tick();
    points.rotation.y = clock.elapsed * 0.2;
    renderer.render(scene, camera);
    frame += 1;
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