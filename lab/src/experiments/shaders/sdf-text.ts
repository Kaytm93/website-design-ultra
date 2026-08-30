/**
 * SDF / MSDF text foundation visual fixture (IP-11A).
 *
 * [module:sdf-text]
 * Generates the atlas in memory, uploads it as a single `DataTexture`,
 * and renders one fullscreen quad that draws a single representative
 * glyph tile. The fixture is deliberately minimal: it proves the
 * atlas pipeline end-to-end, the missing-glyph path, and the
 * reduced-motion freeze without depending on a real font file.
 *
 * The primary text semantics remain outside the canvas — this fixture
 * only paints a decorative glyph. The lab UI labels the experiment
 * and the caption is plain DOM copy so a screen reader sees it.
 *
 * @module
 */

import * as THREE from 'three';
import type { ExperimentContext } from '../../main.js';
import { compileShader, linkProgram, displayError, clearError } from '../../compile-error.js';
import vertSrc from './sdf-text.vert?raw';
import fragSrc from './sdf-text.frag?raw';
import {
  SDF_TILE_SIZE,
  MISSING_GLYPH_INDEX,
  generateAtlas,
  stableAtlasHash,
} from '../../modules/sdf-text.js';

export function mount(ctx: ExperimentContext): void {
  const { root, deterministic, errorEl, controlsEl } = ctx;

  // ── DOM caption: primary semantics stay outside the canvas ───────────
  // The visible heading and summary text live as real DOM nodes. The
  // canvas only renders the decorative glyph tile; selecting or copying
  // the caption works without touching WebGL.
  const caption = document.createElement('div');
  caption.setAttribute('role', 'region');
  caption.setAttribute('aria-label', 'SDF / MSDF text foundation');
  caption.style.position = 'absolute';
  caption.style.left = '16px';
  caption.style.top = '16px';
  caption.style.color = '#e5e7ea';
  caption.style.fontFamily =
    'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
  caption.style.fontSize = '14px';
  caption.style.lineHeight = '1.4';
  caption.style.maxWidth = '320px';
  caption.style.pointerEvents = 'none';

  const title = document.createElement('h2');
  title.textContent = 'SDF / MSDF text foundation (IP-11A)';
  title.style.fontSize = '16px';
  title.style.marginBottom = '4px';
  caption.appendChild(title);

  const body = document.createElement('p');
  body.textContent =
    'Generates a deterministic atlas in memory, uploads it to a DataTexture, and renders one glyph tile. ' +
    'Press the missing-glyph button to render the visible-failure path.';
  caption.appendChild(body);

  root.appendChild(caption);

  // ── Renderer ────────────────────────────────────────────────────────
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

  // ── Build the atlas ─────────────────────────────────────────────────
  const atlas = generateAtlas();
  const atlasHash = stableAtlasHash(atlas);

  const hashRow = document.createElement('p');
  hashRow.textContent = `atlas hash: ${atlasHash}`;
  hashRow.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  hashRow.style.fontSize = '12px';
  hashRow.style.opacity = '0.7';
  caption.appendChild(hashRow);

  // Three.js wants RGBA; the shader only samples RGB. We pad with 255.
  const rgba = new Uint8Array(atlas.pixels.length / 3 * 4);
  for (let i = 0, j = 0; i < atlas.pixels.length; i += 3, j += 4) {
    rgba[j] = atlas.pixels[i];
    rgba[j + 1] = atlas.pixels[i + 1];
    rgba[j + 2] = atlas.pixels[i + 2];
    rgba[j + 3] = 255;
  }

  const texture = new THREE.DataTexture(
    rgba,
    atlas.tileSize * atlas.columns,
    atlas.tileSize * atlas.rows,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;

  // ── Scene / camera ──────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060608);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ── Uniforms ────────────────────────────────────────────────────────
  const uniforms = {
    uTime: { value: 0 },
    uResolution: {
      value: new THREE.Vector2(root.clientWidth, root.clientHeight),
    },
    uAtlas: { value: texture },
    uAtlasColumnsRows: {
      value: new THREE.Vector2(atlas.columns, atlas.rows),
    },
    uAtlasIndex: { value: atlas.entries.get(0x41)?.index ?? 0 }, // 'A' if available
    uDissolve: { value: 0.0 },
    uSeed: { value: 1.0 },
    uReducedMotion: { value: false },
    uShowMissingGlyph: { value: false },
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

  // ── Controls ────────────────────────────────────────────────────────
  const buttons = document.createElement('div');
  buttons.style.marginTop = '12px';
  buttons.style.display = 'flex';
  buttons.style.gap = '8px';
  buttons.style.pointerEvents = 'auto';
  caption.appendChild(buttons);

  const toggleMissing = document.createElement('button');
  toggleMissing.textContent = 'render missing glyph';
  toggleMissing.style.padding = '4px 10px';
  toggleMissing.style.fontSize = '12px';
  toggleMissing.style.background = '#2a1014';
  toggleMissing.style.color = '#fde2e2';
  toggleMissing.style.border = '1px solid #7a1a1a';
  toggleMissing.style.borderRadius = '4px';
  toggleMissing.style.cursor = 'pointer';
  toggleMissing.addEventListener('click', () => {
    uniforms.uAtlasIndex.value = MISSING_GLYPH_INDEX;
    uniforms.uShowMissingGlyph.value = true;
    toggleMissing.disabled = true;
    renderAShape.disabled = false;
  });
  buttons.appendChild(toggleMissing);

  const renderAShape = document.createElement('button');
  renderAShape.textContent = 'render supported glyph';
  renderAShape.style.padding = '4px 10px';
  renderAShape.style.fontSize = '12px';
  renderAShape.style.background = '#10202a';
  renderAShape.style.color = '#e2eefd';
  renderAShape.style.border = '1px solid #1a4a7a';
  renderAShape.style.borderRadius = '4px';
  renderAShape.style.cursor = 'pointer';
  const aIndex = atlas.entries.get(0x41)?.index ?? 0;
  renderAShape.addEventListener('click', () => {
    uniforms.uAtlasIndex.value = aIndex;
    uniforms.uShowMissingGlyph.value = false;
    toggleMissing.disabled = false;
    renderAShape.disabled = true;
  });
  buttons.appendChild(renderAShape);
  renderAShape.disabled = true;

  // The reduced-motion toggle lives in the main controls panel so the
  // lab harness can drive it deterministically.
  const motionLabel = document.createElement('label');
  motionLabel.style.display = 'flex';
  motionLabel.style.alignItems = 'center';
  motionLabel.style.gap = '0.5rem';
  motionLabel.style.fontSize = '0.75rem';
  motionLabel.style.marginTop = '8px';
  const motionInput = document.createElement('input');
  motionInput.type = 'checkbox';
  motionInput.checked = false;
  const motionText = document.createElement('span');
  motionText.textContent = 'reduced motion (freeze dissolve)';
  motionLabel.appendChild(motionInput);
  motionLabel.appendChild(motionText);
  controlsEl.appendChild(motionLabel);
  motionInput.addEventListener('change', () => {
    uniforms.uReducedMotion.value = motionInput.checked;
  });

  // ── HMR ─────────────────────────────────────────────────────────────
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
    import.meta.hot.accept('./sdf-text.vert?raw', (mod) => {
      if (mod) recompileShader(mod.default, material.fragmentShader);
    });
    import.meta.hot.accept('./sdf-text.frag?raw', (mod) => {
      if (mod) recompileShader(material.vertexShader, mod.default);
    });
  }

  // ── Render loop ─────────────────────────────────────────────────────
  // Determinism: when WDU_DETERMINISTIC is set we mark `data-wdu-ready`
  // after one frame so the lab harness can take a byte-identical capture.
  let frame = 0;
  function animate(): void {
    renderer.render(scene, camera);
    frame += 1;

    if (deterministic && frame === 1) {
      document.documentElement.dataset.wduReady = '1';
      if (typeof window !== 'undefined') {
        (window as unknown as Record<string, unknown>).WDU_SDF_ATLAS_HASH = atlasHash;
      }
    }

    requestAnimationFrame(animate);
  }
  animate();

  // ── Resize ──────────────────────────────────────────────────────────
  function onResize(): void {
    const w = root.clientWidth;
    const h = root.clientHeight;
    renderer.setSize(w, h);
    uniforms.uResolution.value.set(w, h);
  }
  window.addEventListener('resize', onResize);

  // Expose the atlas hash on the canvas so the deterministic-capture
  // fixture can read it from the page.
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).WDU_SDF_TILE_SIZE = SDF_TILE_SIZE;
    (window as unknown as Record<string, unknown>).WDU_SDF_ATLAS_COLUMNS = atlas.columns;
    (window as unknown as Record<string, unknown>).WDU_SDF_ATLAS_ROWS = atlas.rows;
  }
}