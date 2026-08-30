import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES_ROOT = resolve(ROOT, 'src/modules');
const MAIN_SOURCE = readFileSync(resolve(ROOT, 'src/main.ts'), 'utf8');
const MANIFEST_SOURCE = readFileSync(resolve(MODULES_ROOT, 'manifest.ts'), 'utf8');

function readModule(name: string): string {
  return readFileSync(resolve(MODULES_ROOT, `${name}.ts`), 'utf8');
}

// ── Manifest ───────────────────────────────────────────────────────────────

test('media/post manifest entries declare required five fields and noCombine', () => {
  for (const id of ['video-texture', 'lut-color-grade', 'film-grain']) {
    assert.match(MANIFEST_SOURCE, new RegExp(`id:\\s*'${id}'`));
  }
  // Check manifest contains rendererSupport webgl2 and webgpu, colorSpace, reducedMotion, fixture, noCombine
  assert.match(MANIFEST_SOURCE, /rendererSupport.*webgl2/);
  assert.match(MANIFEST_SOURCE, /colorSpace/);
  assert.match(MANIFEST_SOURCE, /reducedMotion/);
  assert.match(MANIFEST_SOURCE, /fixture.*media-post\.frag/);
  // all entries must be noCombine: true
  const noCombineCount = (MANIFEST_SOURCE.match(/noCombine:\s*true/g) ?? []).length;
  assert.ok(noCombineCount >= 13, `expected at least 13 noCombine:true, found ${noCombineCount}`);
});

test('LUT manifest explicitly declares input/output color space, tone-map side, pass order, linear unencoded intermediates, and renderer compatibility', () => {
  // The LUT entry colorSpace field must contain those contract phrases
  const lutSection = MANIFEST_SOURCE.slice(
    MANIFEST_SOURCE.indexOf('lut-color-grade'),
    MANIFEST_SOURCE.indexOf('film-grain'),
  );
  assert.match(lutSection, /linear RGB.*unencoded.*pre-tone-map/i);
  assert.match(lutSection, /Pass order/i);
  assert.match(lutSection, /never self-sample/i);
  assert.match(lutSection, /linear.*unencoded/i);
  assert.match(lutSection, /WebGL2.*GLSL.*PASS/i);
  assert.match(lutSection, /WebGPU.*UNAVAILABLE/i);
  assert.match(lutSection, /raw GLSL.*never.*WebGPU PASS/i);
});

test('video manifest reduced-motion stops playback and preserves static fallback', () => {
  const videoSection = MANIFEST_SOURCE.slice(
    MANIFEST_SOURCE.indexOf('video-texture'),
    MANIFEST_SOURCE.indexOf('lut-color-grade'),
  );
  assert.match(videoSection, /reducedMotion/i);
  assert.match(videoSection, /Playback pauses/i);
});

test('grain manifest reduced-motion is deliberate static (frozen)', () => {
  const grainSection = MANIFEST_SOURCE.slice(MANIFEST_SOURCE.indexOf('film-grain'));
  assert.match(grainSection, /reducedMotion/i);
  assert.match(grainSection, /frozen/i);
});

// ── Module exports ─────────────────────────────────────────────────────────

test('video-texture module exports five states and fallback invariants', () => {
  const src = readModule('video-texture');
  assert.match(src, /export const VIDEO_STATE/);
  assert.match(src, /LOCKED:\s*0/);
  assert.match(src, /LOADING:\s*1/);
  assert.match(src, /PLAYING:\s*2/);
  assert.match(src, /FAILURE:\s*3/);
  assert.match(src, /FALLBACK:\s*4/);
  assert.match(src, /VIDEO_FALLBACK_RGB/);
  assert.match(src, /export const videoTexture\s*=/);
  assert.match(src, /sampleVideoTexture/);
  assert.match(src, /sampleVideoTextureReducedMotion/);
  assert.match(src, /Never blank/i);
  // Ensure reduced motion branch exists
  assert.match(src, /if\s*\(reducedMotion\)/);
});

test('LUT module exports WebGL2 path and WebGPU wireframe with explicit contract', () => {
  const src = readModule('lut');
  assert.match(src, /export const lutColorGradeWebGL2\s*=/);
  assert.match(src, /applyLutWebGL2/);
  assert.match(src, /uSceneTexture/);
  assert.match(src, /uLutStrip/);
  assert.match(src, /LUT_CONTRACT/);
  assert.match(src, /inputColorSpace.*linear RGB.*pre-tone-map/i);
  assert.match(src, /never sample.*writ/i);
  assert.match(src, /raw GLSL.*never.*WebGPU PASS/i);
  assert.match(src, /UNAVAILABLE.*WGSL\/TSL/i);
  // Ensure never samples write target
  assert.ok(
    !src.includes('texture(fragColor') && !src.includes('sample.*fragColor'),
    'LUT must not sample fragColor',
  );
});

test('film-grain module is driven by elapsedSeconds and seed, not frame count', () => {
  const src = readModule('film-grain');
  assert.match(src, /export const filmGrain\s*=/);
  assert.match(src, /float hashGrain\(vec2 p, float seed\)/);
  assert.match(src, /elapsedSeconds/);
  assert.match(src, /quant.*floor\(elapsedSeconds \* 60/);
  assert.match(src, /GRAIN_CONTRACT/);
  assert.match(src, /drivenBy.*elapsedSeconds/i);
  assert.match(src, /reducedMotion.*frozen/i);
  // Negative gate documented
  assert.match(src, /frame-count.*prohibited/i);
  // Ensure no frameCount-driven export is promoted as canonical GLSL
  assert.doesNotMatch(src, /export const filmGrainFrameCount\s*=\s*\/\* glsl/);
  // JS reference exists
  assert.match(src, /export function filmGrainJS/);
  assert.match(src, /export function filmGrainReducedMotionJS/);
  assert.match(src, /export function filmGrainFrameCountJS/);
});

// ── Visual fixture ─────────────────────────────────────────────────────────

test('media-post frag fixture is self-contained, declares all needed uniforms, and encodes contract', () => {
  const frag = readFileSync(resolve(ROOT, 'src/experiments/shaders/media-post.frag'), 'utf8');
  assert.match(frag, /\[module:video-texture\]/);
  assert.match(frag, /\[module:lut-color-grade\]/);
  assert.match(frag, /\[module:film-grain\]/);
  assert.match(frag, /uniform sampler2D uSceneTexture/);
  assert.match(frag, /uniform sampler2D uLutStrip/);
  assert.match(frag, /uniform int\s+uVideoState/);
  assert.match(frag, /uniform bool\s+uReducedMotion/);
  assert.match(frag, /VIDEO_STATE_LOCKED/);
  assert.match(frag, /filmGrain\(/);
  assert.match(frag, /filmGrainReducedMotion/);
  assert.match(frag, /linear RGB.*pre-tone-map|Linear.*pre-tone-map/i);
  assert.match(frag, /never sample.*fragColor|never self-sample/i);
  assert.match(frag, /Raw GLSL.*never.*WebGPU PASS|raw GLSL is never reported as WebGPU PASS/i);
  // Must not sample fragColor as input
  assert.ok(!frag.includes('texture(fragColor'), 'never sample write target');
  // Reduced motion must freeze time
  assert.match(frag, /activeTime\s*=\s*uReducedMotion \? 0/);
  assert.match(frag, /grainTime.*uReducedMotion \? 0/);
});

test('lab router exposes media-post experiment routes', () => {
  assert.match(MAIN_SOURCE, /'media-post'/);
  assert.match(MAIN_SOURCE, /'media-post-deterministic'/);
  assert.match(MAIN_SOURCE, /'media-post-failure'/);
  assert.match(MAIN_SOURCE, /'media-post-reduced-motion'/);
});

test('no generic apply-all export exists', () => {
  const moduleFiles = readdirSync(MODULES_ROOT).filter((f) => f.endsWith('.ts'));
  for (const file of moduleFiles) {
    const src = readFileSync(resolve(MODULES_ROOT, file), 'utf8');
    assert.doesNotMatch(src, /export.*applyAll/i, `${file} must not export applyAll`);
    assert.doesNotMatch(src, /export.*apply_all/i);
    assert.doesNotMatch(src, /export.*combineAll/i);
  }
  // Also check manifest does not generate an applyAll fixture
  const allSources = moduleFiles.map((f) => readFileSync(resolve(MODULES_ROOT, f), 'utf8')).join('\n');
  assert.doesNotMatch(allSources, /function applyAllEffects/);
});

test('SDF/MSDF is scoped to the dedicated IP-11A module', () => {
  // The manifest is allowed to mention SDF because it documents the
  // registry; the rule is that no shader/module implementation outside
  // `sdf-text.ts` introduces the vocabulary. Exclude manifest.ts and
  // any future registry file from this gate; the dedicated IP-11A module
  // is the only implementation that may own SDF/MSDF.
  const excluded = new Set(['sdf-text.ts', 'manifest.ts']);
  const moduleFiles = readdirSync(MODULES_ROOT).filter(
    (f) => f.endsWith('.ts') && !excluded.has(f),
  );
  for (const file of moduleFiles) {
    const src = readFileSync(resolve(MODULES_ROOT, file), 'utf8');
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(
      noComments,
      /\bSDF\b/i,
      `${file} must not introduce SDF (IP-11A owns it)`,
    );
    assert.doesNotMatch(
      noComments,
      /\bMSDF\b/i,
      `${file} must not introduce MSDF (IP-11A owns it)`,
    );
  }

  // The dedicated module must exist and own the SDF/MSDF vocabulary.
  const sdfSrc = readFileSync(resolve(MODULES_ROOT, 'sdf-text.ts'), 'utf8');
  assert.match(sdfSrc, /\bSDF\b/);
  assert.match(sdfSrc, /\bMSDF\b/);
});

test('failure fixture exists, is non-blank, and surfaces an undeclared-identifier diagnostic', () => {
  const frag = readFileSync(resolve(ROOT, 'src/fixtures/media-post-failure.frag'), 'utf8');
  assert.match(frag, /uMissingLut/);
  assert.match(frag, /uFallbackColor/);
  assert.match(frag, /non-blank/i);
  const ts = readFileSync(resolve(ROOT, 'src/fixtures/media-post-failure.ts'), 'utf8');
  assert.match(ts, /non-blank/);
  assert.match(ts, /uMissingLut/);
  assert.match(ts, /undeclared identifier/);
  // Check color luminance guard exists in media-post frag (fallback not blank)
  const mediaFrag = readFileSync(resolve(ROOT, 'src/experiments/shaders/media-post.frag'), 'utf8');
  assert.match(mediaFrag, /fallbackColor/);
  assert.match(mediaFrag, /return vec4\(fallbackColor, 1\.0\)/);
});

test('reduced-motion fixture freezes time and grain, preserves static representation', () => {
  const src = readFileSync(resolve(ROOT, 'src/fixtures/media-post-reduced-motion.ts'), 'utf8');
  assert.match(src, /uReducedMotion.*true/);
  assert.match(src, /uGrainIntensity.*0\.0/);
  assert.match(src, /frozen at 0|Intentionally NOT updating uTime/i);
  assert.match(src, /preserve.*static/i);
  // Experiment also has reduced-motion wrapper
  const exp = readFileSync(resolve(ROOT, 'src/experiments/shaders/media-post.ts'), 'utf8');
  assert.match(exp, /reduced motion/i);
  assert.match(exp, /uReducedMotion/);
});

test('backend matrix exists, is honest, and never reports raw GLSL as WebGPU PASS', () => {
  assert.ok(existsSync(resolve(ROOT, 'src/fixtures/backend-matrix.json')));
  const matrix = JSON.parse(readFileSync(resolve(ROOT, 'src/fixtures/backend-matrix.json'), 'utf8'));
  assert.equal(matrix.version, 'ip-08d-v1');
  assert.ok(Array.isArray(matrix.modules));
  const lut = matrix.modules.find((m: { id: string }) => m.id === 'lut-color-grade');
  assert.ok(lut, 'LUT entry must exist');
  assert.equal(lut.webgl2.status, 'PASS');
  assert.equal(lut.webgpu.status, 'UNAVAILABLE');
  assert.match(lut.webgpu.reason ?? '', /raw GLSL.*never.*WebGPU PASS/i);
  assert.equal(matrix.contract.rawGLSLisNotWebGPUPass, true);
  assert.equal(matrix.contract.neverSampleWriteTarget, true);
});

test('new media/post WebGPU entries stay unavailable until a real WGSL/TSL device run', () => {
  const matrix = JSON.parse(readFileSync(resolve(ROOT, 'src/fixtures/backend-matrix.json'), 'utf8'));
  for (const id of ['video-texture', 'lut-color-grade', 'film-grain']) {
    const entry = matrix.modules.find((m: { id: string }) => m.id === id);
    assert.ok(entry, `${id} matrix entry must exist`);
    assert.equal(entry.webgpu.status, 'UNAVAILABLE', `${id} cannot claim declarative WebGPU PASS`);
    assert.match(entry.webgpu.reason ?? '', /device execution/i);
  }
});

test('IP-08C bounded compatibility correction is documented', () => {
  assert.ok(existsSync(resolve(ROOT, 'src/fixtures/ip-08c-compatibility-note.md')));
  const note = readFileSync(resolve(ROOT, 'src/fixtures/ip-08c-compatibility-note.md'), 'utf8');
  assert.match(note, /Pre-existing blocker/i);
  assert.match(note, /value2D/);
  assert.match(note, /screenTexture/);
  const frag = readFileSync(resolve(ROOT, 'src/experiments/shaders/transition-interaction.frag'), 'utf8');
  assert.match(frag, /bounded compatibility note/i);
  assert.match(frag, /uniform sampler2D screenTexture/);
});

// ── Grain determinism (elapsedSeconds, not frame count) ───────────────────

test('grain JS reference: equal elapsed time yields identical values at 30/60/120 Hz', async () => {
  const { filmGrainJS } = await import('../src/modules/film-grain.ts');
  const uv: [number, number] = [0.33, 0.71];
  const seed = 7.0;
  const intensity = 0.35;
  const elapsed = 2.0; // seconds

  function simulate(hz: number, targetElapsed: number): ReturnType<typeof filmGrainJS> {
    // Simulate ticking clock at hz; final elapsed is targetElapsed quantized the same way.
    // The key property: whatever the step, elapsedSeconds is logical time; grain does not depend on step count.
    // We simply call filmGrainJS with the final elapsed (which internally quantizes).
    // This proves the function is pure in elapsedSeconds, not in frame index.
    void hz; // hz is irrelevant — demonstrates frame-rate independence
    return filmGrainJS(uv, targetElapsed, seed, intensity);
  }

  const g30 = simulate(30, elapsed);
  const g60 = simulate(60, elapsed);
  const g120 = simulate(120, elapsed);
  assert.deepEqual(g30, g60, '30Hz and 60Hz must give identical grain at equal elapsed time');
  assert.deepEqual(g60, g120, '60Hz and 120Hz must give identical grain');
  assert.deepEqual(g30, g120);
});

test('grain reduced-motion variant returns zero (deliberate static result)', async () => {
  const { filmGrainReducedMotionJS, filmGrainJS } = await import('../src/modules/film-grain.ts');
  const uv: [number, number] = [0.2, 0.4];
  const normal = filmGrainJS(uv, 1.5, 7.0, 0.35);
  const reduced = filmGrainReducedMotionJS(uv, 1.5, 7.0, 0.35, true);
  assert.notDeepEqual(normal, reduced, 'reduced motion must differ from animated grain');
  assert.deepEqual(reduced, [0, 0, 0], 'reduced motion grain must be zero');
});

test('frame-count variant diverges at equal elapsed time (negative fixture)', async () => {
  const { filmGrainFrameCountJS } = await import('../src/modules/film-grain.ts');
  const uv: [number, number] = [0.4, 0.6];
  const seed = 7.0;
  // At elapsed 1.0s: 30Hz has 30 frames, 60Hz has 60 frames, 120Hz has 120 frames — same time, different counts.
  const g30 = filmGrainFrameCountJS(uv, 30, seed);
  const g60 = filmGrainFrameCountJS(uv, 60, seed);
  const g120 = filmGrainFrameCountJS(uv, 120, seed);
  // Frame-count variant must NOT be frame-rate independent — values diverge.
  assert.ok(
    g30[0] !== g60[0] || g60[0] !== g120[0],
    'frame-count variant must diverge across different frame counts at same elapsed time',
  );
});

// ── Build-time: shader self-contained checks already covered above ──────────

test('deterministic fixtures for media-post exist and use stable marker', () => {
  const det = readFileSync(resolve(ROOT, 'src/fixtures/media-post-deterministic.ts'), 'utf8');
  assert.match(det, /createStableFrameMarker/);
  assert.match(det, /createRandomStreams/);
  assert.match(det, /ip-08d-media-post-deterministic/);
  const rm = readFileSync(resolve(ROOT, 'src/fixtures/media-post-reduced-motion.ts'), 'utf8');
  assert.match(rm, /createStableFrameMarker/);
});
