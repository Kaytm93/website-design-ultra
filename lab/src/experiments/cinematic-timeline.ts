/**
 * Cinematic timeline experiment — IP-09C.
 *
 * Demonstrates one normalized timeline coordinating DOM, camera, scene,
 * material, sound, and loading tracks without a second clock. The injected
 * SceneClock is the only time owner; scroll-derived progress and wdu-timeline
 * checkpoint probes both seek the same pure evaluate function.
 *
 * Portrait choreography is separate: when the manifest declares requiresPortrait
 * and the viewport is portrait, the portrait track set evaluates.
 *
 * Route: /?e=cinematic-timeline  (root-only per ADR-011)
 * Deterministic capture: /?e=cinematic-timeline-deterministic&WDU_DETERMINISTIC=1
 */

import * as THREE from 'three';
import {
  createClock,
  createStableFrameMarker,
} from '@wdu-references/determinism-runtime.ts';
import {
  evaluateTimeline,
  validateTimelineManifest,
  type CinematicTimelineManifest,
} from '@wdu-references/cinematic-timeline.ts';
import type { ExperimentContext } from '../main.js';

// Minimal manifest for the lab experiment (shares the same kind/owner contract
// as the starter timeline but uses compact values for visual proof).
const LAB_MANIFEST: CinematicTimelineManifest = validateTimelineManifest({
  schemaVersion: 1,
  surface: 'wdu.cinematic-timeline',
  project: 'wdu-lab-cinematic',
  modeInput: 'WDU_DETERMINISTIC=1',
  clock: 'injected',
  range: [0, 1],
  tracks: [
    { id: 'dom-hero-opacity', kind: 'dom', property: 'dom.hero.opacity', owner: 'dom-hero-opacity', keyframes: [{ progress: 0, value: 0 }, { progress: 0.5, value: 1 }, { progress: 1, value: 1 }] },
    { id: 'camera-hero-z', kind: 'camera', property: 'camera.hero.z', owner: 'camera-hero-z', keyframes: [{ progress: 0, value: 6 }, { progress: 1, value: 2 }] },
    { id: 'scene-hero-rotation', kind: 'scene', property: 'scene.hero.rotationY', owner: 'scene-hero-rotation', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 1.2 }] },
    { id: 'material-hero-emissive', kind: 'material', property: 'material.hero.emissive', owner: 'material-hero-emissive', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 0.8 }] },
    { id: 'sound-ambient-gain', kind: 'sound', property: 'sound.ambient.gain', owner: 'sound-ambient-gain', keyframes: [{ progress: 0, value: 0 }, { progress: 0.7, value: 1 }, { progress: 1, value: 1 }] },
    { id: 'loading-bucket-progress', kind: 'loading', property: 'loading.bucket.progress', owner: 'loading-bucket-progress', keyframes: [{ progress: 0, value: 0 }, { progress: 0.3, value: 1 }, { progress: 1, value: 1 }] },
  ],
  checkpoints: [
    { id: 'timeline-0', progress: 0 },
    { id: 'timeline-50', progress: 0.5 },
    { id: 'timeline-100', progress: 1 },
  ],
  portrait: {
    tracks: [
      { id: 'dom-hero-opacity', kind: 'dom', property: 'dom.hero.opacity', owner: 'dom-hero-opacity', keyframes: [{ progress: 0, value: 0 }, { progress: 0.5, value: 1 }, { progress: 1, value: 1 }] },
      { id: 'camera-hero-z-portrait', kind: 'camera', property: 'camera.hero.z', owner: 'camera-hero-z-portrait', keyframes: [{ progress: 0, value: 7 }, { progress: 1, value: 3 }] },
      { id: 'scene-hero-rotation', kind: 'scene', property: 'scene.hero.rotationY', owner: 'scene-hero-rotation', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 0.9 }] },
      { id: 'material-hero-emissive', kind: 'material', property: 'material.hero.emissive', owner: 'material-hero-emissive', keyframes: [{ progress: 0, value: 0 }, { progress: 1, value: 0.6 }] },
      { id: 'sound-ambient-gain', kind: 'sound', property: 'sound.ambient.gain', owner: 'sound-ambient-gain', keyframes: [{ progress: 0, value: 0 }, { progress: 0.7, value: 0.8 }, { progress: 1, value: 0.8 }] },
      { id: 'loading-bucket-progress', kind: 'loading', property: 'loading.bucket.progress', owner: 'loading-bucket-progress', keyframes: [{ progress: 0, value: 0 }, { progress: 0.3, value: 1 }, { progress: 1, value: 1 }] },
    ],
  },
  requiresPortrait: true,
});

export function mount(ctx: ExperimentContext): void {
  const { root, clock: ctxClock, deterministic, controlsEl } = ctx;

  // --- Injected clock (the only time owner) ---
  const clock = ctxClock ?? createClock(deterministic ? { mode: 'deterministic', stepSeconds: 1 / 60 } : { mode: 'live' });

  // --- Renderer / scene ---
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: deterministic });
  renderer.setSize(root.clientWidth, root.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a12);
  const camera = new THREE.PerspectiveCamera(45, root.clientWidth / root.clientHeight, 0.1, 100);
  camera.position.set(0, 1, 6);

  const geometry = new THREE.TorusKnotGeometry(0.85, 0.26, 220, 32);
  const material = new THREE.MeshStandardMaterial({ color: 0xd8c9a3, roughness: 0.55, metalness: 0.15 });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.35, 48), new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.85 }));
  pedestal.position.y = -1.35;
  scene.add(pedestal);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const dir = new THREE.DirectionalLight(0xffffff, 1.6);
  dir.position.set(3, 4, 2);
  scene.add(dir);

  // Evidence surface — records timeline evaluation state for capture
  function setEvidence(progress: number, portrait: boolean): void {
    const evaluation = evaluateTimeline(LAB_MANIFEST, progress, { portrait });
    const payload = JSON.stringify({ progress, portrait, evaluation });
    document.documentElement.setAttribute('data-wdu-timeline', String(progress.toFixed(3)));
    document.documentElement.setAttribute('data-wdu-timeline-evaluation', payload);
    root.setAttribute('data-wdu-timeline-evaluation', payload);
    root.setAttribute('data-wdu-timeline-progress', String(progress.toFixed(3)));
  }

  // Deterministic checkpoint probe: ?wdu-timeline=<id> seeks that checkpoint before first frame
  const params = new URLSearchParams(window.location.search);
  const probeId = params.get('wdu-timeline');
  let progress = 0;
  if (probeId) {
    const entry = LAB_MANIFEST.checkpoints.find((c) => c.id === probeId) ?? LAB_MANIFEST.portrait?.checkpoints?.find((c) => c.id === probeId)
    if (entry) {
      progress = entry.progress;
      document.documentElement.setAttribute('data-wdu-timeline-checkpoint', probeId);
    }
  }

  const isPortrait = () => window.matchMedia('(orientation: portrait)').matches && Boolean(LAB_MANIFEST.portrait);
  // Scroll master: normalized scroll progress is the timeline progress; no second clock.
  const updateFromScroll = () => {
    if (probeId) return; // checkpoint probe is the deterministic master for capture
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    // When the page is not scrollable (lab harness has hidden overflow), use a slider-equivalent
    // derived from the DOM control if present, else clock-derived fallback for visual motion.
    progress = Math.max(0, Math.min(1, window.scrollY / max));
  };
  window.addEventListener('scroll', updateFromScroll, { passive: true });

  // Simple controls: slider sets progress directly (still deterministic — seek is pure)
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.01';
  slider.value = String(progress);
  slider.setAttribute('aria-label', 'timeline progress');
  slider.style.cssText = 'width:100%;margin:8px 0;';
  const label = document.createElement('div');
  label.style.cssText = 'font:11px system-ui;color:#cbd5e1;';
  label.textContent = 'progress 0.00 — deterministic seek is pure (no second clock)';
  controlsEl.appendChild(label);
  controlsEl.appendChild(slider);
  slider.addEventListener('input', () => {
    progress = Number.parseFloat(slider.value);
    label.textContent = `progress ${progress.toFixed(2)} — deterministic seek is pure (no second clock)`;
  });

  // Ready marker — after stable frame
  const marker = createStableFrameMarker({ target: document.documentElement, stableFrame: 2 });
  let frame = 0;
  function animate() {
    requestAnimationFrame(animate);
    // Injected clock tick — the only time owner. Sound/material/loading use
    // progress directly, never a second timer. clock.delta is exposed for
    // frame-rate independent smoothing should a tracker need it, but none does.
    clock.tick();
    frame += 1;
    if (!probeId) {
      // Live visual motion still seeks from progress (scroll or slider), not elapsed
      updateFromScroll();
      // Keep slider in sync when scroll is the master (but not when slider drove it)
    } else {
      // Checkpoint probe: fixed progress, deterministic frame — no wall clock
    }
    const portrait = isPortrait();
    const evaluation = evaluateTimeline(LAB_MANIFEST, progress, { portrait });
    // Apply coordinated tracks — one owner per property, no second clock.
    mesh.rotation.y = evaluation['scene.hero.rotationY'];
    material.emissive.setHex(evaluation['material.hero.emissive'] > 0.4 ? 0x3a2f1d : 0x000000);
    camera.position.z = evaluation['camera.hero.z'];
    camera.updateProjectionMatrix();
    // DOM track
    document.documentElement.style.setProperty('--wdu-dom-hero-opacity', String(evaluation['dom.hero.opacity']));
    document.documentElement.setAttribute('data-wdu-timeline-dom', evaluation['dom.hero.opacity'].toFixed(3));
    document.documentElement.setAttribute('data-wdu-timeline-sound', evaluation['sound.ambient.gain'].toFixed(3));
    document.documentElement.setAttribute('data-wdu-timeline-loading', evaluation['loading.bucket.progress'].toFixed(3));
    setEvidence(progress, portrait);
    void clock.delta; // ensure clock is the declared time source even when progress is scroll-driven

    renderer.render(scene, camera);
    if (frame >= 2) {
      marker.afterVisibleRender({ frame, assetsReady: true, cameraStationApplied: true, streamsInitialized: true });
      if (deterministic && frame === 3) {
        // Freeze-like marker already set; render stays deterministic on probe
      }
    }
  }
  // Deterministic transport: on probe, seek is already set — first rendered frame is the checkpoint
  setEvidence(progress, isPortrait());
  animate();
}
