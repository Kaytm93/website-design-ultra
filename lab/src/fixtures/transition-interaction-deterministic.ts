/**
 * Deterministic capture fixture for transition/interaction shader modules.
 *
 * Mounts the transition/interaction experiment with the deterministic
 * runtime contract active so interaction checkpoints remain comparable
 * across runs.
 *
 * @module
 */

import * as THREE from 'three';
import type { ExperimentContext } from '../main.js';
import { createStableFrameMarker, createRandomStreams } from '@wdu-references/determinism-runtime.ts';

export function mount(ctx: ExperimentContext): void {
  const { root, clock, deterministic } = ctx;

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: deterministic,
  });
  renderer.setSize(root.clientWidth, root.clientHeight);
  renderer.setPixelRatio(1);
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060608);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const streams = deterministic
    ? createRandomStreams('ip-08c-transition-interaction-deterministic')
    : createRandomStreams(`live-${Date.now()}`);

  const seed = deterministic ? streams.stream('render').next() * 100 : 11.0;

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(root.clientWidth, root.clientHeight) },
    uFrostedProgress: { value: 0.4 },
    uFrostedStrength: { value: 0.18 },
    uChromaticAmplitude: { value: 0.0 },
    uFlowStrength: { value: 0.25 },
    uShockwaveTime: { value: 0.6 },
    uShockwaveOrigin: { value: new THREE.Vector2(0.5, 0.5) },
    uShockwaveMaxRadius: { value: 0.8 },
    uShockwaveStrength: { value: 0.35 },
    uSeed: { value: seed },
    uReducedMotion: { value: false },
  };

  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `#version 300 es\nprecision highp float;\nin vec3 position;\nvoid main() { gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `#version 300 es\nprecision highp float;\nout vec4 fragColor;\nuniform float uTime;\nuniform vec2 uResolution;\nuniform float uFrostedProgress;\nuniform float uFrostedStrength;\nuniform float uChromaticAmplitude;\nuniform float uFlowStrength;\nuniform float uShockwaveTime;\nuniform vec2 uShockwaveOrigin;\nuniform float uShockwaveMaxRadius;\nuniform float uShockwaveStrength;\nuniform float uSeed;\nuniform bool uReducedMotion;\n\nvec3 frostedTransitionMask(vec2 uv, vec3 base, vec3 frosted, float progress, float strength, float seed) {\n  float cappedStrength = clamp(strength, 0.0, 0.25);\n  vec2 displacement = vec2(value2D(uv * 4.0 + seed) * cappedStrength, value2D(uv * 4.0 + seed + 0.5) * cappedStrength);\n  vec2 sampleUv = clamp(uv + displacement, 0.0, 1.0);\n  vec3 displaced = mix(base, frosted, smoothstep(0.0, 1.0, progress));\n  return mix(displaced, frosted, smoothstep(0.45, 0.55, progress));\n}\n\nvec3 chromaticOffset(vec2 uv, vec3 col, float amplitude, vec2 direction) {\n  float cappedAmplitude = clamp(amplitude, 0.0, 0.08);\n  vec2 redUv = clamp(uv + direction * cappedAmplitude, 0.0, 1.0);\n  vec2 blueUv = clamp(uv - direction * cappedAmplitude, 0.0, 1.0);\n  return vec3(redUv.x, col.g, blueUv.x);\n}\n\nvec2 clickShockwave(vec2 uv, vec2 origin, float time, float maxRadius, float strength) {\n  float cappedMaxRadius = clamp(maxRadius, 0.0, 1.0);\n  float cappedStrength = clamp(strength, 0.0, 0.5);\n  vec2 delta = uv - origin;\n  float dist = length(delta);\n  float radius = clamp(time * 0.5, 0.0, cappedMaxRadius);\n  float ring = smoothstep(radius - 0.05, radius, dist) - smoothstep(radius, radius + 0.05, dist);\n  return normalize(delta + 0.0001) * ring * cappedStrength;\n}\n\nvec2 flowFieldDeformation(vec2 uv, float time, float seed, float strength) {\n  float cappedStrength = clamp(strength, 0.0, 0.3);\n  vec3 p = vec3(uv * 3.0, time * 0.25 + seed * 0.01);\n  return clamp(uv + vec3(0.0, 0.0, 1.0).xy * cappedStrength * 0.1, 0.0, 1.0);\n}\n\nfloat hash2D(vec2 p) {\n  const float K = 12.9898;\n  const float K2 = 78.233;\n  float h = dot(p, vec2(K, K2));\n  return fract(sin(h) * 43758.5453);\n}\n\nfloat value2D(vec2 p) {\n  vec2 i = floor(p);\n  vec2 f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = hash2D(i);\n  float b = hash2D(i + vec2(1.0, 0.0));\n  float c = hash2D(i + vec2(0.0, 1.0));\n  float d = hash2D(i + vec2(1.0, 1.0));\n  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0 - 1.0;\n}\n\nvoid main() {\n  vec2 uv = gl_FragCoord.xy / uResolution;\n  vec3 col = 0.5 + 0.5 * cos(uTime * 0.6 + uv.xyx + vec3(0.0, 2.0, 4.0));\n\n  float activeTime = uReducedMotion ? 0.0 : uTime;\n  vec2 flowUv = flowFieldDeformation(uv, activeTime, uSeed, uFlowStrength);\n  col = 0.5 + 0.5 * cos(activeTime * 0.6 + flowUv.xyx + vec3(0.0, 2.0, 4.0));\n  col = frostedTransitionMask(flowUv, col, vec3(0.85, 0.88, 0.94), uFrostedProgress, uFrostedStrength, uSeed);\n\n  vec2 shockwaveOffset = clickShockwave(flowUv, uShockwaveOrigin, uShockwaveTime, uShockwaveMaxRadius, uShockwaveStrength);\n  vec2 shockedUv = clamp(flowUv + shockwaveOffset, 0.0, 1.0);\n  col = 0.5 + 0.5 * cos(activeTime * 0.6 + shockedUv.xyx + vec3(0.0, 2.0, 4.0));\n  col = frostedTransitionMask(shockedUv, col, vec3(0.85, 0.88, 0.94), uFrostedProgress, uFrostedStrength, uSeed);\n\n  if (uChromaticAmplitude > 0.001) {\n    col = chromaticOffset(shockedUv, col, uChromaticAmplitude, normalize(vec2(1.0, 0.5)));\n  }\n\n  fragColor = vec4(col, 1.0);\n}\n`,
    uniforms,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const stableFrame = deterministic
    ? createStableFrameMarker({ target: document.documentElement, stableFrame: 3 })
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
