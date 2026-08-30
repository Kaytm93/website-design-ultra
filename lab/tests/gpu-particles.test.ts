import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_ROOT = resolve(ROOT, '..', 'website-design-ultra');
const SKILL_MD = resolve(PLUGIN_ROOT, 'skills/gpu-particle-systems/SKILL.md');
const REF_MD = resolve(PLUGIN_ROOT, 'skills/gpu-particle-systems/references/state-textures-and-interaction.md');

function read(p: string): string {
  return readFileSync(p, 'utf8');
}

// ── Skill / reference existence and negative gate ──────────────────────────

test('skill and reference exist', () => {
  assert.ok(existsSync(SKILL_MD), 'SKILL.md missing');
  assert.ok(existsSync(REF_MD), 'reference missing');
});

test('skill description is negatively gated and mentions thousands + persistent + field/trail/morph and exclusions', () => {
  const src = read(SKILL_MD);
  const frontmatter = src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const desc = frontmatter.match(/description:\s*(.+)/)?.[1] ?? '';
  assert.match(desc, /Use only when/i);
  assert.match(desc, /does not activate this skill/i);
  assert.match(src, /thousands/i);
  assert.match(src, /persistent/i);
  // Exclusions must be explicit and point to r3f-patterns
  for (const term of ['Decorative dust', 'Sparkle', 'small instanced', 'short burst', 'single click shockwave']) {
    assert.match(src, new RegExp(term, 'i'), `missing exclusion ${term}`);
  }
  assert.match(src, /r3f-patterns/i);
});

test('particle counts not in skill or reference matrix — consumed from qualityProfile.particles', () => {
  const skill = read(SKILL_MD);
  const ref = read(REF_MD);
  // The phrase qualityProfile.particles must appear (production source)
  assert.match(skill, /qualityProfile\.particles/);
  assert.match(ref, /qualityProfile\.particles/);
  // No numeric particle tier values should be duplicated — check that reference does not claim 0–100 etc.
  // Allow fixture annotation numbers but not bare tier table
  assert.doesNotMatch(skill, /Particles.*0–100/);
  assert.doesNotMatch(ref, /Particles.*0–100/);
});

test('reference defines two RGBA16F/HalfFloat targets highp NearestFilter NoColorSpace no depth/stencil', () => {
  const src = read(REF_MD);
  assert.match(src, /RGBA16F/);
  assert.match(src, /HalfFloat/);
  assert.match(src, /highp/);
  assert.match(src, /NearestFilter/);
  assert.match(src, /NoColorSpace/);
  assert.match(src, /depthBuffer.*false/i);
  assert.match(src, /stencilBuffer.*false/i);
});

test('reference defines one owner read/write/swap and never sampling write target', () => {
  const src = read(REF_MD);
  assert.match(src, /one.*owner.*read.*write.*swap/i);
  assert.match(src, /never.*sampling.*write/i);
  assert.match(src, /never sample.*currently bound/i);
});

test('reference defines reset via reinitializing both targets, no per-frame reallocation', () => {
  const src = read(REF_MD);
  assert.match(src, /reset.*reinitializing both/i);
  assert.match(src, /no per-frame.*reallocation/i);
});

test('reference defines Position\/Life and Velocity\/Spawn or Seed channels and particles\/spawn stream', () => {
  const src = read(REF_MD);
  assert.match(src, /Position\/Life/);
  assert.match(src, /Velocity\/Spawn|Seed/);
  assert.match(src, /particles\/spawn/);
  assert.match(src, /separate named stream/i);
});

test('reference defines pointer normalization clamp((clientX-left)/width and Y inversion, capped falloff', () => {
  const src = read(REF_MD);
  assert.match(src, /clamp\(\(clientX-left\)\/width/);
  assert.match(src, /1-\(clientY-top\)\/height/);
  assert.match(src, /normalized.*pointer/i);
  assert.match(src, /falloff/i);
  assert.match(src, /exp\(-.*dist.*dist/);
  assert.match(src, /capped.*radius/i);
});

test('reference defines one impulse record with origin radius strength startTime/age recovering via clock', () => {
  const src = read(REF_MD);
  assert.match(src, /one.*impulse.*record/i);
  assert.match(src, /origin/);
  assert.match(src, /radius/);
  assert.match(src, /strength/);
  assert.match(src, /startTime|age/);
  assert.match(src, /RECOVERY|recovery/i);
  assert.match(src, /\(1 - t\) \* exp\(-3/);
  assert.match(src, /inactive/i);
});

test('reference forbids per-particle React state and setter in render loop', () => {
  const src = read(REF_MD);
  assert.match(src, /no per-particle React state/i);
  assert.match(src, /no.*React.*state.*setter.*render loop/i);
});

// ── Lab implementation ─────────────────────────────────────────────────────

test('particle-toy.ts exists and implements ping-pong owner swap, HalfFloat Nearest NoColorSpace no depth/stencil, no per-frame allocation', () => {
  const src = read(resolve(ROOT, 'src/experiments/particle-toy.ts'));
  assert.match(src, /HalfFloatType/);
  assert.match(src, /NearestFilter/);
  assert.match(src, /NoColorSpace/);
  assert.match(src, /depthBuffer:\s*false/);
  assert.match(src, /stencilBuffer:\s*false/);
  assert.match(src, /readPosLife|read.*write.*swap/i);
  assert.match(src, /swapState|swap/);
  // never sampling write target — comment marker
  assert.match(src, /never.*sampling.*write/i);
  // reset reinitializes both
  assert.match(src, /resetAllTargets|reinitializing both/i);
  // no per-frame reallocation: ensure new WebGLRenderTarget not inside animate
  const animateBlock = src.slice(src.indexOf('function animate'));
  assert.doesNotMatch(animateBlock, /new THREE\.WebGLRenderTarget/);
  // channels
  assert.match(src, /posLife|Position\/Life/i);
  assert.match(src, /velSeed|Velocity/i);
  // deterministic seed
  assert.match(src, /particles\/spawn/);
  assert.match(src, /particles\/field/);
  // pointer normalization once on host
  assert.match(src, /\(e\.clientX - rect\.left\) \/ rect\.width/);
  assert.match(src, /1 - \(e\.clientY - rect\.top\) \/ rect\.height/);
  // one impulse record
  assert.match(src, /Impulse/);
  assert.match(src, /origin/);
  assert.match(src, /radius/);
  assert.match(src, /strength/);
  assert.match(src, /startTime/);
  assert.match(src, /RECOVERY_SECONDS/);
  // no React state in render loop
  assert.doesNotMatch(src, /useState.*particle/i);
  assert.doesNotMatch(src, /setState/);
  // reduced motion / poster / capability fallback non-empty
  assert.match(src, /prefers-reduced-motion/);
  assert.match(src, /poster/i);
  // fixture/test size annotation
  assert.match(src, /fixture\/test size only/);
  // executable ping-pong: real setRenderTarget/write draw + swap after both, no void data, no commented fake core draw
  assert.match(src, /renderer\.setRenderTarget\(writePosLife\)/);
  assert.match(src, /renderer\.setRenderTarget\(writeVelSeed\)/);
  assert.match(src, /renderer\.render\(simScene, simCamera\)/);
  assert.match(src, /renderer\.setRenderTarget\(null\)/);
  assert.doesNotMatch(src, /void\s+data;/);
  assert.doesNotMatch(src, /\/\/\s*renderer\.setRenderTarget\(writePosLife\)/);
  // float probe requires real WebGL2 + extension + FRAMEBUFFER_COMPLETE
  assert.match(src, /isWebGL2\s*===\s*true/);
  assert.match(src, /EXT_color_buffer_float/);
  assert.match(src, /FRAMEBUFFER_COMPLETE/);
  // capability evidence exposed at DOM
  assert.match(src, /particle-toy-capability/);
  assert.match(src, /data-wdu-particle-/);
  // no Math.random / performance.now direct
  assert.doesNotMatch(src, /Math\.random\(\)/);
  assert.doesNotMatch(src, /performance\.now\(\)/);
});

test('shaders exist and contain highp, capped radius, Gaussian falloff, impulse recovery, point rendering', () => {
  const upd = read(resolve(ROOT, 'src/experiments/shaders/particle-toy-update.frag'));
  const vert = read(resolve(ROOT, 'src/experiments/shaders/particle-toy-render.vert'));
  const frag = read(resolve(ROOT, 'src/experiments/shaders/particle-toy-render.frag'));
  assert.match(upd, /precision highp float/);
  assert.match(upd, /uPointer/);
  assert.match(upd, /uImpulse/);
  assert.match(upd, /exp\(-.*dist.*dist/);
  assert.match(upd, /capped.*0\.35|radius.*0\.18/);
  assert.match(upd, /never.*sampled|read.*never.*write/i);
  assert.match(upd, /uOutMode/);
  assert.match(upd, /uInit/);
  assert.match(upd, /in vec2 vUv/);
  assert.doesNotMatch(upd, /varying vec2 vUv/);
  assert.match(vert, /precision highp float/);
  assert.match(vert, /uPosLifeTex/);
  assert.match(vert, /reference/);
  assert.match(vert, /in vec2 reference/);
  assert.match(vert, /out float vLife/);
  assert.doesNotMatch(vert, /attribute/);
  assert.doesNotMatch(vert, /varying.*vLife/);
  assert.match(frag, /precision highp float/);
  assert.match(frag, /in float vLife/);
  assert.match(frag, /out vec4 fragColor/);
  assert.doesNotMatch(frag, /varying.*vLife/);
  assert.match(frag, /fragColor/);
});

test('deterministic fixture uses named streams, produces identical hashes, defines recovery helpers', async () => {
  const { buildSpawnState, hashState, normalizePointer, impulseStrength, RECOVERY_SECONDS } = await import('../src/fixtures/gpu-particles-deterministic.ts');
  const a = buildSpawnState(8, 'gpu-particles-deterministic-v1');
  const b = buildSpawnState(8, 'gpu-particles-deterministic-v1');
  assert.equal(hashState(a.posLife, a.velSeed), hashState(b.posLife, b.velSeed));
  // pointer normalization Y inversion
  const [x, y] = normalizePointer(50, 30, { left: 0, top: 0, width: 100, height: 100 });
  assert.equal(x, 0.5);
  assert.equal(y, 0.7); // 1 - 30/100
  // capped falloff: strength after recovery is 0 (allow tiny epsilon due to FP 1.2)
  const impulse = { startTime: 10, strength: 1.0 };
  assert.ok(impulseStrength(10.3, impulse) > 0);
  assert.ok(Math.abs(impulseStrength(10 + RECOVERY_SECONDS, impulse)) < 1e-9, `expected ~0 at recovery boundary`);
  assert.equal(impulseStrength(13, impulse), 0);
});

test('backend matrix has gpu-particles WebGL2 honest (PASS only with browser float evidence, otherwise UNAVAILABLE) and WebGPU UNAVAILABLE never PASS', () => {
  const matrix = JSON.parse(read(resolve(ROOT, 'src/fixtures/backend-matrix.json')));
  const entry = matrix.modules.find((m: { id: string }) => m.id === 'gpu-particles');
  assert.ok(entry, 'gpu-particles entry missing');
  // WebGL2 is PASS only with real browser float-target evidence; otherwise honest UNAVAILABLE
  if (entry.webgl2.status === 'PASS') {
    assert.match(entry.webgl2.source ?? entry.webgl2.executed ?? '', /browser-(required|verified)/i);
    assert.match(`${entry.webgl2.source ?? ''} ${entry.webgl2.executed ?? ''} ${entry.webgl2.reason ?? ''}`, /float.*render.*target|float-target/i);
  } else {
    assert.equal(entry.webgl2.status, 'UNAVAILABLE');
    assert.match(entry.webgl2.reason ?? '', /browser.*float.*evidence|float.*render.*target|No browser.*float/i);
  }
  assert.equal(entry.webgpu.status, 'UNAVAILABLE');
  assert.match(entry.webgpu.reason ?? '', /WGSL\/TSL|WebGPU.*PASS/i);
  // ensure contract marks raw GLSL never webgpu pass
  assert.equal(matrix.contract.rawGLSLisNotWebGPUPass, true);
});

test('manifest contains gpu particle entry and noCombine, no apply-all, no SDF inside particle scope', () => {
  const src = read(resolve(ROOT, 'src/modules/manifest.ts'));
  assert.match(src, /gpu-particles/);
  const entries = (src.match(/noCombine:\s*true/g) ?? []).length;
  assert.ok(entries >= 15, `expected >=15 noCombine (sdf-text added by IP-11A), got ${entries}`);
  assert.doesNotMatch(src, /applyAll|apply_all/i);
  // SDF/MSDF is owned by IP-11A (the dedicated sdf-text module). The
  // gpu-particle scope must remain free of it; comments that name IP-11A
  // are allowed.
  const particleScope = src.slice(src.indexOf('gpu-particles'), src.indexOf('sdf-text') > 0 ? src.indexOf('sdf-text') : src.length);
  const particleWithoutComments = particleScope.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(particleWithoutComments, /SDF|MSDF/i, 'SDF/MSDF must remain outside the gpu-particles scope');
});

test('main.ts still routes particle-toy', () => {
  const src = read(resolve(ROOT, 'src/main.ts'));
  assert.match(src, /'particle-toy'/);
});

test('no particle count in skill/reference matrix beyond fixture annotation is claimed', () => {
  const skill = read(SKILL_MD);
  const ref = read(REF_MD);
  // Ensure no bare numeric tier table appears
  assert.doesNotMatch(skill, /\bup to roughly \d+/);
  assert.doesNotMatch(ref, /\bup to roughly \d+/);
});

test('lab router exposes gpu-particles deterministic fixture route', () => {
  // The deterministic fixture is not an experiment route but a fixture import; ensure experiment still present
  assert.ok(existsSync(resolve(ROOT, 'src/fixtures/gpu-particles-deterministic.ts')));
});

test('no timeline / SDF / apply-all introduced in gpu particles scope', () => {
  const manifest = read(resolve(ROOT, 'src/modules/manifest.ts'));
  const toy = read(resolve(ROOT, 'src/experiments/particle-toy.ts'));
  const upd = read(resolve(ROOT, 'src/experiments/shaders/particle-toy-update.frag'));
  // Limit the manifest scope to the gpu-particles section so the IP-11A
  // SDF/MSDF module (added later in the manifest) does not fail this gate.
  const particleManifest = manifest.slice(manifest.indexOf('gpu-particles'), manifest.indexOf('sdf-text') > 0 ? manifest.indexOf('sdf-text') : manifest.length);
  const combined = `${particleManifest}\n${toy}\n${upd}`;
  assert.doesNotMatch(combined, /applyAll/i);
  assert.doesNotMatch(combined.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''), /SDF/i);
  // Timeline is not introduced — ensure no timeline word in gpu scope beyond allowed mention in docs
  // This check is lenient: the file may mention timeline as not-done; but should not implement it
  assert.doesNotMatch(toy, /cinematic.*timeline/i);
});
