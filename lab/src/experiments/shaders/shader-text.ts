/**
 * J-D5 production shader-text lab headline.
 *
 * A real DOM h1 is the semantic and visual reading authority. A decorative
 * WebGL canvas sits above it with pointer-events:none and aria-hidden=true.
 * The atlas is generated from the existing deterministic MSDF foundation; the
 * three selected effect uniforms come from DOM pointer/focus/activation state.
 */

import * as THREE from 'three';
import type { ExperimentContext } from '../../main.js';
import {
  computeDissolveUniforms,
  computeGlitchUniforms,
  computeScrambleUniforms,
  createDomMirror,
  updateEffectTime,
} from '../../modules/dom-text-effects.js';
import { generateAtlas, stableAtlasHash } from '../../modules/sdf-text.js';

const SAMPLE_HEADLINE = 'The interface keeps its meaning in the document';
const SAMPLE_HEADLINE_DE = 'Die Oberfläche behält ihre Bedeutung im Dokument';

export function mount(ctx: ExperimentContext): void {
  const { root, clock, deterministic, controlsEl } = ctx;
  root.style.background = '#0b0d10';
  root.style.color = '#eef2f5';
  root.style.fontFamily = 'ui-sans-serif,system-ui,sans-serif';

  const region = document.createElement('main');
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', 'Shader text production fixture');
  region.style.cssText = 'position:absolute;inset:0;padding:clamp(24px,6vw,80px);overflow:auto;';
  root.appendChild(region);

  const label = document.createElement('p');
  label.textContent = 'shader-text / production';
  label.style.cssText = 'margin:0 0 12px;color:#8da1b5;font:12px/1.2 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;';
  region.appendChild(label);

  const headline = document.createElement('h1');
  headline.id = 'shader-text-lab-headline';
  headline.tabIndex = 0;
  headline.setAttribute('lang', 'en');
  headline.setAttribute('translate', 'yes');
  headline.setAttribute('aria-label', SAMPLE_HEADLINE);
  headline.dataset.wduTextRole = 'primary';
  headline.textContent = SAMPLE_HEADLINE;
  headline.style.cssText = [
    'position:relative',
    'z-index:1',
    'max-width:18ch',
    'margin:0',
    'font-size:clamp(2.2rem,8vw,6rem)',
    'line-height:.95',
    'letter-spacing:-.045em',
    'color:#eef2f5',
    'user-select:text',
    '-webkit-user-select:text',
    'outline-offset:8px',
  ].join(';');
  region.appendChild(headline);

  const canvas = document.createElement('canvas');
  canvas.id = 'shader-text-decorative-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  canvas.dataset.wduCanvasDecorative = 'true';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;mix-blend-mode:screen;';
  region.appendChild(canvas);

  const note = document.createElement('p');
  note.textContent = 'Select the heading, focus it, or switch language. The canvas mirrors the DOM without owning its meaning.';
  note.style.cssText = 'max-width:42rem;margin:24px 0 0;color:#aeb8c2;font-size:14px;';
  region.appendChild(note);

  const locale = document.createElement('button');
  locale.type = 'button';
  locale.textContent = 'Switch headline to Deutsch';
  locale.style.cssText = 'margin-top:20px;padding:8px 12px;background:#18232d;color:#eef2f5;border:1px solid #405568;border-radius:4px;';
  locale.addEventListener('click', () => {
    headline.textContent = SAMPLE_HEADLINE_DE;
    headline.setAttribute('lang', 'de');
    headline.setAttribute('aria-label', SAMPLE_HEADLINE_DE);
    locale.disabled = true;
    locale.textContent = 'Deutsch headline active';
    mirror.refreshLayout();
  });
  region.appendChild(locale);

  const atlas = generateAtlas({ seed: 'shader-text-production-v1' });
  const atlasHash = stableAtlasHash(atlas);
  const rgba = new Uint8Array((atlas.pixels.length / 3) * 4);
  for (let i = 0, j = 0; i < atlas.pixels.length; i += 3, j += 4) {
    rgba[j] = atlas.pixels[i];
    rgba[j + 1] = atlas.pixels[i + 1];
    rgba[j + 2] = atlas.pixels[i + 2];
    rgba[j + 3] = 255;
  }
  const texture = new THREE.DataTexture(rgba, atlas.tileSize * atlas.columns, atlas.tileSize * atlas.rows, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: deterministic, premultipliedAlpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    premultipliedAlpha: true,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uAtlas: { value: texture },
      uIntensity: { value: 0 },
      uScramble: { value: 0 },
      uGlitch: { value: 0 },
      uDissolve: { value: 0 },
      uSeed: { value: 1 },
      uPointer: { value: new THREE.Vector2(.5, .5) },
      uReducedMotion: { value: false },
    },
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(mesh);

  const mirror = createDomMirror(headline, { clock });
  const motion = document.createElement('label');
  const motionInput = document.createElement('input');
  motionInput.type = 'checkbox';
  const motionText = document.createElement('span');
  motionText.textContent = ' reduced motion (freeze shader amplitudes)';
  motion.append(motionInput, motionText);
  controlsEl.appendChild(motion);

  function resize(): void {
    const rect = region.getBoundingClientRect();
    renderer.setSize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)), false);
  }
  resize();
  window.addEventListener('resize', resize);

  let frame = 0;
  function animate(): void {
    clock.tick();
    const state = updateEffectTime(mirror.state, clock.elapsed, { reducedMotion: motionInput.checked });
    const uniforms = {
      uScramble: computeScrambleUniforms(state),
      uGlitch: computeGlitchUniforms(state),
      uDissolve: computeDissolveUniforms(state),
    };
    const u = material.uniforms;
    u.uTime.value = state.time;
    u.uScramble.value = uniforms.uScramble.intensity;
    u.uGlitch.value = uniforms.uGlitch.intensity;
    u.uDissolve.value = uniforms.uDissolve.intensity;
    u.uIntensity.value = Math.max(u.uScramble.value, u.uGlitch.value, u.uDissolve.value);
    u.uSeed.value = uniforms.uScramble.seed >>> 0;
    u.uReducedMotion.value = state.reducedMotion;
    if (uniforms.uScramble.pointerUv) u.uPointer.value.set(uniforms.uScramble.pointerUv.u, uniforms.uScramble.pointerUv.v);
    renderer.render(scene, camera);
    frame += 1;
    if (deterministic && frame === 1) {
      document.documentElement.dataset.wduReady = 'true';
      headline.dataset.wduAtlasHash = atlasHash;
      headline.dataset.wduEffectUniforms = 'uScramble,uGlitch,uDissolve';
    }
    requestAnimationFrame(animate);
  }
  animate();

  window.addEventListener('beforeunload', () => {
    mirror.dispose();
    window.removeEventListener('resize', resize);
    mesh.geometry.dispose();
    material.dispose();
    texture.dispose();
    renderer.dispose();
  });
}

const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec3 position;
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uAtlas;
uniform float uTime;
uniform float uIntensity;
uniform float uScramble;
uniform float uGlitch;
uniform float uDissolve;
uniform float uSeed;
uniform vec2 uPointer;
uniform bool uReducedMotion;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float median3(vec3 value) { return max(min(value.r, value.g), min(max(value.r, value.g), value.b)); }
float msdfCoverage(vec2 uv) {
  float signedDistance = median3(texture(uAtlas, uv).rgb) - 0.5;
  return 1.0 - smoothstep(0.42, 0.58, signedDistance + 0.5);
}
void main() {
  float amp = uReducedMotion ? 0.0 : clamp(max(max(uScramble, uGlitch), uDissolve), 0.0, 1.0);
  float pointerDistance = length(vUv - uPointer);
  float scrambleOffset = (hash21(vec2(floor(vUv.y * 12.0), uSeed)) - 0.5) * 0.03 * uScramble * (1.0 - smoothstep(0.0, 0.7, pointerDistance));
  float channelOffset = 0.02 * uGlitch * (1.0 - smoothstep(0.0, 0.4, pointerDistance));
  vec2 effectUv = clamp(vUv + vec2(scrambleOffset, 0.0), 0.0, 1.0);
  float glyph = msdfCoverage(vec2(fract(effectUv.x * 0.12), fract(effectUv.y * 0.12)));
  float fringe = msdfCoverage(vec2(fract((effectUv.x + channelOffset) * 0.12), fract(effectUv.y * 0.12)));
  float scan = hash21(vec2(floor(effectUv.x * 32.0) + uSeed, floor(effectUv.y * 12.0)));
  float dissolve = step(uDissolve, scan) * uDissolve;
  float glitch = step(0.82, hash21(vec2(floor(vUv.y * 14.0), uSeed))) * uGlitch;
  vec3 color = vec3(glyph * 0.18 + scan * 0.08, glyph * 0.32 + glitch, fringe * 0.5 + glitch * 0.8);
  float alpha = clamp(amp * (0.2 + dissolve + glitch), 0.0, 0.72);
  fragColor = vec4(color * alpha, alpha);
}`;
