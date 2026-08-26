/**
 * Deterministic capture fixture for media/post shader modules — IP-08D.
 *
 * Mounts the media-post experiment with deterministic runtime so captures
 * remain comparable. Uses the seeded clock and stable-frame marker.
 *
 * @module
 */

import * as THREE from 'three';
import { createStableFrameMarker, createRandomStreams } from '@wdu-references/determinism-runtime.ts';
import type { ExperimentContext } from '../main.js';

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
    ? createRandomStreams('ip-08d-media-post-deterministic')
    : createRandomStreams(`live-${Date.now()}`);
  const seed = deterministic ? streams.stream('render').next() * 100 : 7.0;

  function createNeutralLut(size: number): THREE.DataTexture {
    const width = size * size;
    const height = size;
    const data = new Uint8Array(width * height * 4);
    for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
      const x = b * size + r;
      const y = g;
      const idx = (y * width + x) * 4;
      data[idx] = Math.round((r / (size - 1)) * 255);
      data[idx + 1] = Math.round((g / (size - 1)) * 255);
      data[idx + 2] = Math.round((b / (size - 1)) * 255);
      data[idx + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  function createVideoTex(): THREE.DataTexture {
    const data = new Uint8Array([200, 80, 80, 255, 80, 200, 80, 255, 80, 80, 200, 255, 220, 220, 180, 255]);
    const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  const lutStrip = createNeutralLut(16);
  const videoTex = createVideoTex();

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(root.clientWidth, root.clientHeight) },
    uVideoTexture: { value: videoTex },
    uSceneTexture: { value: videoTex },
    uLutStrip: { value: lutStrip },
    uLutSize: { value: 16.0 },
    uLutIntensity: { value: 0.0 },
    uGrainIntensity: { value: 0.35 },
    uSeed: { value: seed },
    uVideoState: { value: 2 },
    uFallbackColor: { value: new THREE.Vector3(0.14, 0.16, 0.19) },
    uReducedMotion: { value: false },
  };

  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `#version 300 es\nprecision highp float;\nin vec3 position;\nvoid main() { gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `#version 300 es\nprecision highp float;\nuniform float uTime;\nuniform vec2 uResolution;\nuniform sampler2D uSceneTexture;\nuniform sampler2D uVideoTexture;\nuniform sampler2D uLutStrip;\nuniform float uLutSize;\nuniform float uLutIntensity;\nuniform float uGrainIntensity;\nuniform float uSeed;\nuniform int uVideoState;\nuniform vec3 uFallbackColor;\nuniform bool uReducedMotion;\nout vec4 fragColor;\n#define VIDEO_STATE_LOCKED 0\n#define VIDEO_STATE_LOADING 1\n#define VIDEO_STATE_PLAYING 2\n#define VIDEO_STATE_FAILURE 3\n#define VIDEO_STATE_FALLBACK 4\nvec4 sampleVideoTexture(sampler2D videoTex, vec2 uv, int state, vec3 fallbackColor){vec2 c=clamp(uv,0.0,1.0);if(state==2){vec4 s=texture(videoTex,c);vec3 l=pow(s.rgb,vec3(2.2));float lum=dot(l,vec3(0.2126,0.7152,0.0722));if(s.a<0.01||lum<0.001)return vec4(fallbackColor,1.0);return vec4(l,1.0);}if(state==0)return vec4(fallbackColor*0.85,1.0);if(state==1)return vec4(fallbackColor,1.0);return vec4(fallbackColor,1.0);}\nvec4 sampleVideoTextureReducedMotion(sampler2D t,vec2 uv,int s,vec3 f,bool rm){if(rm)return vec4(f,1.0);return sampleVideoTexture(t,uv,s,f);}\nvec3 applyLutWebGL2(vec3 c,sampler2D strip,float sz,float intensity){float ci=clamp(intensity,0.0,1.0);vec3 cl=clamp(c,0.0,1.0);float r=cl.r*(sz-1.0);float g=cl.g*(sz-1.0);float b=cl.b*(sz-1.0);float sl=floor(b);float sh=min(sl+1.0,sz-1.0);float bf=fract(b);vec2 uvl=vec2((sl*sz+r+0.5)/(sz*sz),(g+0.5)/sz);vec2 uvh=vec2((sh*sz+r+0.5)/(sz*sz),(g+0.5)/sz);vec3 ll=pow(texture(strip,uvl).rgb,vec3(2.2));vec3 lh=pow(texture(strip,uvh).rgb,vec3(2.2));vec3 lm=mix(ll,lh,bf);return mix(cl,lm,ci);}\nfloat hashGrain(vec2 p,float seed){float h=dot(p,vec2(127.1,311.7))+seed*19.19;return fract(sin(h)*43758.5453123);}\nvec3 filmGrain(vec2 uv,float t,float seed,float intensity){float ci=clamp(intensity,0.0,1.0);float q=floor(t*60.0+0.0001)/60.0;float gt=q*13.7+seed*7.33;vec2 guv=uv*1.7+vec2(gt*0.13,gt*0.07);float n=hashGrain(guv*512.0,seed+gt);float c=(n*2.0-1.0)*ci*0.08;return vec3(c);}\nvec3 filmGrainReducedMotion(vec2 uv,float t,float seed,float intensity,bool rm){if(rm)return vec3(0.0);return filmGrain(uv,t,seed,intensity);}\nvoid main(){vec2 uv=gl_FragCoord.xy/uResolution;float at=uReducedMotion?0.0:uTime;float gt=uReducedMotion?0.0:uTime;vec4 v=sampleVideoTextureReducedMotion(uVideoTexture,uv,uVideoState,uFallbackColor,uReducedMotion);vec3 sl=v.rgb*0.9+vec3(0.02,0.02,0.03);vec3 lut=uLutIntensity>0.001?applyLutWebGL2(sl,uLutStrip,uLutSize,uLutIntensity):sl;vec3 g=filmGrainReducedMotion(uv,gt,uSeed,uGrainIntensity,uReducedMotion);vec3 c=clamp(lut+g,0.0,1.0);fragColor=vec4(pow(c,vec3(1.0/2.2)),1.0);}`,
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
