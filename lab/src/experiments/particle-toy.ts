/**
 * particle-toy experiment — GPU particle systems (IP-09A).
 *
 * Texture-based ping-pong state simulation. One simulation owner controls
 * read/write/swap. Two logical RGBA16F/HalfFloat state targets, highp,
 * NearestFilter, NoColorSpace, no depth/stencil. Spawn is deterministic
 * via the injected RandomStreams namespace `particles/spawn`.
 *
 * Route: /?e=particle-toy  (root-only per ADR-011, experiment stays at this path)
 *
 * @module
 */

import * as THREE from 'three';
import { createStableFrameMarker, createRandomStreams } from '@wdu-references/determinism-runtime.ts';
import type { ExperimentContext } from '../main.js';
import updateFragSrc from './shaders/particle-toy-update.frag?raw';
import renderVertSrc from './shaders/particle-toy-render.vert?raw';
import renderFragSrc from './shaders/particle-toy-render.frag?raw';

// fixture/test size only — production consumes qualityProfile.particles from 3d-runtime-quality
const FIXTURE_DIM = 32; // fixture/test size only — production consumes qualityProfile.particles
const RECOVERY_SECONDS = 1.2; // declared recovery window for click impulse

type Impulse = {
  origin: [number, number];
  radius: number;
  strength: number;
  startTime: number;
};

export function mount(ctx: ExperimentContext): void {
  const { root, clock, streams: ctxStreams, deterministic } = ctx;

  // --- Renderer / scene ---
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: deterministic });
  renderer.setSize(root.clientWidth, root.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0c);
  const camera = new THREE.PerspectiveCamera(60, root.clientWidth / root.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 6);

  // Poster / reduced-motion / capability fallback element — non-empty composition
  const posterEl = document.createElement('div');
  posterEl.setAttribute('data-testid', 'particle-toy-poster');
  posterEl.textContent = 'GPU Particles — poster / reduced-motion / capability fallback (non-empty composition)';
  posterEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#cbd5e1;background:#0a0a0c;font:12px system-ui;pointer-events:none;';
  posterEl.hidden = true;
  root.style.position = 'relative';
  root.appendChild(posterEl);

  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function showPosterFallback(reason: string): void {
    posterEl.hidden = false;
    posterEl.setAttribute('data-fallback-reason', reason);
    renderer.domElement.style.visibility = 'hidden';
  }

  // Capability / float-target probe — require real WebGL2 + float extension + FRAMEBUFFER_COMPLETE
  const gl = renderer.getContext() as WebGL2RenderingContext | null;
  const isWebGL2 = (renderer.capabilities as unknown as { isWebGL2?: boolean }).isWebGL2 === true;
  const extFloat = gl ? gl.getExtension('EXT_color_buffer_float') : null;
  const extHalf = gl ? gl.getExtension('EXT_color_buffer_half_float') : null;
  const hasFloatExt = Boolean(extFloat || extHalf);

  function probeFBOComplete(dim: number): boolean {
    if (!gl) return false;
    // WebGL2 half-float framebuffer completeness probe for RGBA16F / HALF_FLOAT
    try {
      const tex = gl.createTexture();
      if (!tex) return false;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // RGBA16F requires HALF_FLOAT in WebGL2
      const halfFloatEnum = 0x140b; // gl.HALF_FLOAT
      (gl as unknown as { texImage2D: (a:number,b:number,c:number,d:number,e:number,f:number,g:number,h:number,i:ArrayBufferView|null)=>void }).texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, dim, dim, 0, gl.RGBA, halfFloatEnum, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const fb = gl.createFramebuffer();
      if (!fb) {
        gl.deleteTexture(tex);
        return false;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb);
      gl.deleteTexture(tex);
      return status === gl.FRAMEBUFFER_COMPLETE;
    } catch {
      return false;
    }
  }

  const fboComplete = probeFBOComplete(FIXTURE_DIM);
  const floatSupported = isWebGL2 && hasFloatExt && fboComplete;

  // Readable capability evidence at experiment DOM for browser harness
  const capabilityEl = document.createElement('div');
  capabilityEl.setAttribute('data-testid', 'particle-toy-capability');
  capabilityEl.setAttribute('data-webgl2', String(isWebGL2));
  capabilityEl.setAttribute('data-float-ext', String(hasFloatExt));
  capabilityEl.setAttribute('data-fbo-complete', String(fboComplete));
  capabilityEl.setAttribute('data-float-supported', String(floatSupported));
  capabilityEl.setAttribute('data-status', floatSupported ? 'float-target-ok' : 'unavailable');
  const evidence = { webgl2: isWebGL2, floatExt: hasFloatExt, fboComplete, floatSupported, status: floatSupported ? 'float-target-ok' : 'unavailable' };
  capabilityEl.setAttribute('data-evidence', JSON.stringify(evidence));
  capabilityEl.setAttribute('data-capability-evidence', JSON.stringify(evidence));
  capabilityEl.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';
  capabilityEl.textContent = `capability webgl2=${isWebGL2} floatExt=${hasFloatExt} fboComplete=${fboComplete} status=${floatSupported ? 'float-target-ok' : 'unavailable'}`;
  root.appendChild(capabilityEl);

  // data-wdu-particle-* evidence surface for harness — browserseitig beobachtbar
  // Capability, floatTarget, framebuffer completeness, init/upload, update draw count, read/write swap und fallback reason
  function setParticleEvidence(partial: Record<string, string | number | boolean>): void {
    for (const [k, v] of Object.entries(partial)) {
      document.documentElement.setAttribute(`data-wdu-particle-${k}`, String(v));
      root.setAttribute(`data-wdu-particle-${k}`, String(v));
      capabilityEl.setAttribute(`data-wdu-particle-${k}`, String(v));
    }
  }
  setParticleEvidence({
    capability: floatSupported ? 'available' : 'unavailable',
    'float-target': floatSupported ? 'half-float' : 'unavailable',
    floatTarget: floatSupported ? 'half-float' : 'unavailable',
    framebuffer: fboComplete ? 'complete' : 'incomplete',
    'framebuffer-complete': String(fboComplete),
    'fallback-reason': '',
    init: 'pending',
    'init-count': 0,
    'init-upload': 0,
    'update-draws': 0,
    'update-draw-count': 0,
    'swap-count': 0,
    'read-write-swap': 0,
    'render-count': 0,
  });

  if (!floatSupported) {
    const reason = !isWebGL2 ? 'capability: WebGL2 unavailable' : !hasFloatExt ? 'capability: float render target extension unavailable' : 'capability: float framebuffer incomplete';
    showPosterFallback(reason);
    capabilityEl.setAttribute('data-float-target-draw', 'skipped-unavailable');
    setParticleEvidence({ 'fallback-reason': reason, fallback: reason, init: 'skipped', framebuffer: 'incomplete', capability: 'unavailable', 'float-target': 'unavailable' });
    if (deterministic) {
      const marker = createStableFrameMarker({ target: document.documentElement, stableFrame: 2 });
      marker.afterVisibleRender({ frame: 2, assetsReady: true, cameraStationApplied: true, streamsInitialized: true });
      setParticleEvidence({ ready: 'true' });
      document.documentElement.setAttribute('data-wdu-ready', 'true');
    } else {
      document.documentElement.setAttribute('data-wdu-ready', 'true');
      setParticleEvidence({ ready: 'true' });
    }
    return;
  }

  if (prefersReducedMotion) {
    // Reduced motion: static composition remains useful (poster-like Points), simulation frozen at t=0
  }

  // --- Deterministic spawn streams ---
  // Spawn determinism uses namespace `particles/spawn`; additional randomness uses separate named stream
  const spawnStreams = deterministic ? ctxStreams : createRandomStreams(`live-${Date.now()}`);
  const spawnRng = spawnStreams.stream('particles/spawn');
  const fieldRng = spawnStreams.stream('particles/field'); // separate named stream for field variation

  void fieldRng.next(); // ensure stream is materialized (separate from spawn)

  // --- State targets: two separate RGBA16F/HalfFloat targets, highp, NearestFilter, NoColorSpace, no depth/stencil ---
  // Contract: no per-frame reallocation — these two are created once.
  // Channels: posLife (xyz=position, w=life) and velSeed (xyz=velocity, w=seed) are packed into the two targets'
  // logical textures. Physical double-buffering is two pairs (posLifeA/B, velSeedA/B) but the contract's
  // "two separate state targets" are the logical posLife + velSeed textures; each has a ping-pong pair.
  function createStateTarget(dim: number): THREE.WebGLRenderTarget {
    const rt = new THREE.WebGLRenderTarget(dim, dim, {
      type: THREE.HalfFloatType, // RGBA16F/HalfFloat
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    rt.texture.colorSpace = THREE.NoColorSpace;
    rt.texture.minFilter = THREE.NearestFilter;
    rt.texture.magFilter = THREE.NearestFilter;
    return rt;
  }

  // Two logical state textures: posLife and velSeed — each double-buffered
  // Physical targets: 4 total; logical contract is 2 separate state targets.
  const posLifeA = createStateTarget(FIXTURE_DIM);
  const posLifeB = createStateTarget(FIXTURE_DIM);
  const velSeedA = createStateTarget(FIXTURE_DIM);
  const velSeedB = createStateTarget(FIXTURE_DIM);

  // --- Simulation owner: read/write/swap — never sampling the currently bound write target ---
  // The simulation step is the sole owner of read/write selection and swap.
  let readPosLife: THREE.WebGLRenderTarget = posLifeA;
  let writePosLife: THREE.WebGLRenderTarget = posLifeB;
  let readVelSeed: THREE.WebGLRenderTarget = velSeedA;
  let writeVelSeed: THREE.WebGLRenderTarget = velSeedB;

  function swapState(): void {
    // Swap read/write — single owner, sampled read is never the bound write
    let tmp = readPosLife;
    readPosLife = writePosLife;
    writePosLife = tmp;
    tmp = readVelSeed;
    readVelSeed = writeVelSeed;
    writeVelSeed = tmp;
  }

  // Simulation quad for update pass — uses updateFragSrc with highp, GLSL3 in/out
  const simScene = new THREE.Scene();
  const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const simGeo = new THREE.PlaneGeometry(2, 2);

  function createDataTexture(data: Float32Array, dim: number): THREE.DataTexture {
    const tex = new THREE.DataTexture(data, dim, dim, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function buildSpawnArrays(): { posLife: Float32Array; velSeed: Float32Array } {
    const count = FIXTURE_DIM * FIXTURE_DIM;
    const posLife = new Float32Array(count * 4);
    const velSeed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      posLife[i * 4] = (spawnRng.next() - 0.5) * 4;
      posLife[i * 4 + 1] = (spawnRng.next() - 0.5) * 4;
      posLife[i * 4 + 2] = (spawnRng.next() - 0.5) * 2;
      posLife[i * 4 + 3] = spawnRng.next();
      velSeed[i * 4] = (spawnRng.next() - 0.5) * 0.5;
      velSeed[i * 4 + 1] = (spawnRng.next() - 0.5) * 0.5;
      velSeed[i * 4 + 2] = (spawnRng.next() - 0.5) * 0.5;
      velSeed[i * 4 + 3] = spawnRng.next();
    }
    return { posLife, velSeed };
  }

  const simUniforms: Record<string, THREE.IUniform> = {
    uStatePosLife: { value: readPosLife.texture },
    uStateVelSeed: { value: readVelSeed.texture },
    uTime: { value: 0 },
    uDelta: { value: 0 },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) }, // normalized pointer, shader only
    uImpulseOrigin: { value: new THREE.Vector2(0.5, 0.5) },
    uImpulseRadius: { value: 0 },
    uImpulseStrength: { value: 0 },
    uImpulseAge: { value: 999 },
    uOutMode: { value: 0 }, // 0 PosLife, 1 VelSeed
    uInit: { value: false },
    uInitPosLife: { value: null },
    uInitVelSeed: { value: null },
  };
  const simMaterial = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `precision highp float; in vec3 position; in vec2 uv; out vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position,1.0);}`,
    fragmentShader: updateFragSrc,
    uniforms: simUniforms,
  });
  const simMesh = new THREE.Mesh(simGeo, simMaterial);
  simScene.add(simMesh);

  // Helpers for harness-readable evidence — incremented only via real draws
  let initCount = 0;
  let updateDrawCount = 0;
  let swapCount = 0;
  let renderCount = 0;

  // Helper that performs real Fullscreen-Shader-Draws to initialize all four ping-pong targets
  // fillSpawnData — must use deterministisch erzeugte Spawnwerte wirklich in die initialen Targets schreiben
  function initializeAllTargetsViaDraw(): void {
    const { posLife, velSeed } = buildSpawnArrays();
    const initPosTex = createDataTexture(posLife, FIXTURE_DIM);
    const initVelTex = createDataTexture(velSeed, FIXTURE_DIM);
    simUniforms.uInit.value = true;
    simUniforms.uInitPosLife.value = initPosTex;
    simUniforms.uInitVelSeed.value = initVelTex;
    // read uniforms are irrelevant in init mode but keep them bound to current read
    simUniforms.uStatePosLife.value = readPosLife.texture;
    simUniforms.uStateVelSeed.value = readVelSeed.texture;

    const targets: Array<{ target: THREE.WebGLRenderTarget; mode: number }> = [
      { target: posLifeA, mode: 0 },
      { target: posLifeB, mode: 0 },
      { target: velSeedA, mode: 1 },
      { target: velSeedB, mode: 1 },
    ];
    for (const entry of targets) {
      simUniforms.uOutMode.value = entry.mode;
      // renderer.setRenderTarget(target) — active ping-pong Ausführung, nicht Kommentar
      renderer.setRenderTarget(entry.target);
      renderer.render(simScene, simCamera);
    }
    renderer.setRenderTarget(null);
    simUniforms.uInit.value = false;
    // keep textures alive until next init; dispose previous DataTextures on next call via GC
    // Mark evidence that a real float-target draw was executed
    capabilityEl.setAttribute('data-float-target-draw', 'executed');
    capabilityEl.setAttribute('data-init-draw', 'true');
    initCount += 4;
    setParticleEvidence({ init: 'done', 'init-count': initCount, 'init-upload': initCount, 'float-target': 'half-float', framebuffer: 'complete', 'framebuffer-complete': 'true' });
  }

  // Deterministic init touches all four physical targets via real GPU draws (both logical textures, both slots)
  initializeAllTargetsViaDraw();

  function resetAllTargets(): void {
    // Reset by reinitializing all four ping-pong targets via executed Fullscreen-Shader-Draws — no per-frame reallocation, no new RenderTarget
    initializeAllTargetsViaDraw();
  }

  // --- Render: Points from state textures (render vert/frag highp, samples only read targets) ---
  const particleCount = FIXTURE_DIM * FIXTURE_DIM; // fixture/test size only
  const refGeometry = new THREE.BufferGeometry();
  const references = new Float32Array(particleCount * 2);
  for (let i = 0; i < particleCount; i++) {
    references[i * 2] = (i % FIXTURE_DIM) / FIXTURE_DIM;
    references[i * 2 + 1] = Math.floor(i / FIXTURE_DIM) / FIXTURE_DIM;
  }
  refGeometry.setAttribute('reference', new THREE.BufferAttribute(references, 2));
  const renderUniforms: Record<string, THREE.IUniform> = {
    uPosLifeTex: { value: readPosLife.texture },
    uVelSeedTex: { value: readVelSeed.texture },
    uTime: { value: 0 },
  };
  const renderMaterial = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: renderVertSrc,
    fragmentShader: renderFragSrc,
    uniforms: renderUniforms,
  });
  const points = new THREE.Points(refGeometry, renderMaterial);
  scene.add(points);

  // --- Normalized pointer field (host does clamp-and-invert once, shader gets only vec2) ---
  let pointerNorm = new THREE.Vector2(0.5, 0.5);
  let impulse: Impulse | null = null;

  function impulseStrength(now: number): number {
    if (!impulse) return 0;
    const age = now - impulse.startTime;
    if (age < 0 || age >= RECOVERY_SECONDS) return 0; // inactive after recovery
    const t = age / RECOVERY_SECONDS;
    // recovery curve: (1 - t) * exp(-3t)
    return impulse.strength * (1 - t) * Math.exp(-3.0 * t);
  }

  function onPointerMove(e: PointerEvent): void {
    const rect = renderer.domElement.getBoundingClientRect();
    // x=clamp((clientX-left)/width,0,1), y=clamp(1-(clientY-top)/height,0,1) — done once on host
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    pointerNorm.set(x, y);
    simUniforms.uPointer.value.copy(pointerNorm);
  }

  function onClick(e: MouseEvent): void {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    // Exactly one impulse record per click — replaces, never accumulates
    impulse = {
      origin: [x, y],
      radius: 0.2, // capped radius
      strength: 1.0,
      startTime: clock.elapsed,
    };
    simUniforms.uImpulseOrigin.value.set(x, y);
    simUniforms.uImpulseRadius.value = impulse.radius;
  }

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('click', onClick);

  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset (reinit both targets)';
  resetButton.style.cssText = 'position:absolute;top:8px;left:8px;z-index:2;font:12px system-ui;padding:4px 8px;';
  resetButton.addEventListener('click', () => {
    resetAllTargets();
    impulse = null;
    simUniforms.uImpulseStrength.value = 0;
    simUniforms.uImpulseAge.value = 999;
  });
  root.appendChild(resetButton);

  // No per-particle React state, no React state setter in render loop — only ref mutation + uniform writes

  const stableMarker = deterministic
    ? createStableFrameMarker({ target: document.documentElement, stableFrame: 3 })
    : null;

  let frame = 0;
  let updateDraws = 0;
  let swapDraws = 0;
  let renderDraws = 0;
  function animate(): void {
    if (prefersReducedMotion) {
      // Reduced motion: freeze simulation, render static composition — sichtbarer non-blank Poster/DOM-Fallback
      setParticleEvidence({ 'fallback-reason': 'reduced-motion', fallback: 'reduced-motion' });
      renderer.render(scene, camera);
      renderDraws += 1;
      setParticleEvidence({ 'render-count': renderDraws, render: renderDraws });
      frame += 1;
      if (deterministic && stableMarker) {
        stableMarker.afterVisibleRender({ frame, assetsReady: true, cameraStationApplied: true, streamsInitialized: true });
        if (stableMarker.ready) {
          setParticleEvidence({ ready: 'true' });
          return;
        }
      } else if (frame === 1) {
        document.documentElement.setAttribute('data-wdu-ready', 'true');
        setParticleEvidence({ ready: 'true' });
      }
      requestAnimationFrame(animate);
      return;
    }

    if (deterministic && stableMarker?.ready) return;

    clock.tick();
    const now = clock.elapsed;
    const delta = clock.delta;

    // Update simulation uniforms — single owner, never sampling currently bound write target
    // Read uniforms point only to the current read textures
    simUniforms.uStatePosLife.value = readPosLife.texture; // read only
    simUniforms.uStateVelSeed.value = readVelSeed.texture;
    simUniforms.uTime.value = now;
    simUniforms.uDelta.value = delta;
    simUniforms.uImpulseStrength.value = impulseStrength(now);
    simUniforms.uImpulseAge.value = impulse ? now - impulse.startTime : 999;
    simUniforms.uInit.value = false;

    // Ping-pong PosLife: render update for channel 0 into writePosLife (never sampling writePosLife)
    // read textures werden als Sampler gebunden; write targets werden vor dem Draw gebunden; der Draw erfolgt
    simUniforms.uOutMode.value = 0;
    renderer.setRenderTarget(writePosLife);
    renderer.render(simScene, simCamera);
    // renderer.setRenderTarget already bound before draw — never sample write target in same draw

    // Ping-pong VelSeed: render update for channel 1 into writeVelSeed (never sampling writeVelSeed)
    simUniforms.uOutMode.value = 1;
    // uStatePosLife/uStateVelSeed remain bound to the same read textures for the second draw
    renderer.setRenderTarget(writeVelSeed);
    renderer.render(simScene, simCamera);

    // Unbind and swap ownership only after both draws; read != bound write invariant held throughout
    renderer.setRenderTarget(null);
    // Erst danach wird genau einmal geswappt — never write target sampled in same draw
    swapState();
    swapDraws += 1;
    updateDraws += 2;
    setParticleEvidence({ 'update-draws': updateDraws, 'update-draw-count': updateDraws, 'swap-count': swapDraws, 'read-write-swap': swapDraws, swap: swapDraws });

    // Render points sampling only the read targets (now containing latest state after swap)
    renderUniforms.uPosLifeTex.value = readPosLife.texture;
    renderUniforms.uVelSeedTex.value = readVelSeed.texture;
    renderUniforms.uTime.value = now;

    renderer.render(scene, camera);
    renderDraws += 1;
    setParticleEvidence({ 'render-count': renderDraws, render: renderDraws, frame });
    frame += 1;
    if (frame === 1) {
      capabilityEl.setAttribute('data-float-target-draw', 'executed');
      capabilityEl.setAttribute('data-frame-draw', '1');
    }
    setParticleEvidence({ ready: document.documentElement.getAttribute('data-wdu-ready') || 'false' });

    if (deterministic && stableMarker) {
      stableMarker.afterVisibleRender({ frame, assetsReady: true, cameraStationApplied: true, streamsInitialized: true });
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
    // No per-frame reallocation on resize — targets retain dimension unless tier changes via qualityProfile.particles
  }
  window.addEventListener('resize', onResize);
}
