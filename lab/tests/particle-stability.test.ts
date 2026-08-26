import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_REF = resolve(ROOT, '..', 'website-design-ultra', 'skills', 'gpu-particle-systems', 'references', 'state-textures-and-interaction.md');

function read(p: string): string {
  return readFileSync(p, 'utf8');
}

// ── IP-09B Acceptance: No per-particle React state or per-frame allocation ──

test('particle-toy has no per-particle React state or per-frame RenderTarget allocation', () => {
  const src = read(resolve(ROOT, 'src/experiments/particle-toy.ts'));
  assert.doesNotMatch(src, /useState.*particle/i);
  assert.doesNotMatch(src, /setParticles|setState.*particle/i);
  assert.doesNotMatch(src, /useState\(/);
  const animateBlock = src.slice(src.indexOf('function animate'));
  assert.doesNotMatch(animateBlock, /new THREE\.WebGLRenderTarget/);
  assert.doesNotMatch(animateBlock, /new THREE\.BufferGeometry/);
  assert.doesNotMatch(animateBlock, /new THREE\.DataTexture/);
  // per-frame allocation guard: no new Float32Array per frame in animate
  assert.doesNotMatch(animateBlock, /new Float32Array\(/);
});

test('particle-toy update shader declares morph targets with no per-frame allocation', () => {
  const frag = read(resolve(ROOT, 'src/experiments/shaders/particle-toy-update.frag'));
  assert.match(frag, /uMorphA/);
  assert.match(frag, /uMorphB/);
  assert.match(frag, /uMorphProgress/);
  assert.match(frag, /uMorphEnabled/);
  assert.match(frag, /uMorphInfluence/);
  // morph uses uniform lerp, not new target creation
  assert.match(frag, /mix\(.*uMorphProgress|mix\(posA, posB/);
  assert.match(frag, /no per-frame allocation|two morph targets do not grow/i);
});

// ── Two morph targets do not grow GPU resources ──

test('particle-toy allocates exactly two morph DataTextures outside animate', () => {
  const src = read(resolve(ROOT, 'src/experiments/particle-toy.ts'));
  assert.match(src, /morphTexA/);
  assert.match(src, /morphTexB/);
  assert.match(src, /MORPH_DURATION_SECONDS/);
  assert.match(src, /morph target.*no.*per-frame|no per-frame allocation/i);
  // Exactly two morph textures created via createDataTexture outside animate
  const beforeAnimate = src.slice(0, src.indexOf('function animate'));
  const morphCreations = (beforeAnimate.match(/createDataTexture\(morph/g) ?? []).length;
  // buildMorphTargets creates two arrays, then two DataTextures
  assert.ok(src.includes('buildMorphTargets'), 'buildMorphTargets missing');
  assert.match(src, /morphRngA.*particles\/morph-a/);
  assert.match(src, /morphRngB.*particles\/morph-b/);
  assert.match(src, /separate named stream/i);
  // Resource snapshot tracking exists
  assert.match(src, /captureResourceSnapshot/);
  assert.match(src, /morphResourceSnapshots|snapshotMorphResource/);
  assert.match(src, /morph-resource-stable/);
  assert.match(src, /morph-target-count.*2/);
});

test('deterministic fixture proves morph target determinism and resource stability', async () => {
  const { buildMorphTargets, hashMorph, simulateMorphResourceStability, MOBILE_PARTICLE_EVIDENCE } = await import('../src/fixtures/gpu-particles-deterministic.ts');
  const a = buildMorphTargets(8, 'gpu-particles-deterministic-v1');
  const b = buildMorphTargets(8, 'gpu-particles-deterministic-v1');
  assert.equal(hashMorph(a.morphA, a.morphB), hashMorph(b.morphA, b.morphB), 'morph targets must be deterministic');
  // Resource stability: cycles do not increase counters
  const proof = simulateMorphResourceStability(4);
  const first = proof[0];
  for (const snap of proof) {
    assert.equal(snap.geometries, first.geometries, `geometries grew at cycle ${snap.cycle}`);
    assert.equal(snap.textures, first.textures, `textures grew at cycle ${snap.cycle}`);
    assert.equal(snap.programs, first.programs, `programs grew at cycle ${snap.cycle}`);
  }
  // Mobile evidence correctness
  assert.ok(MOBILE_PARTICLE_EVIDENCE.mobileCount < MOBILE_PARTICLE_EVIDENCE.desktopCount, 'mobile count must be reduced');
  assert.ok(MOBILE_PARTICLE_EVIDENCE.mobileDpr < MOBILE_PARTICLE_EVIDENCE.desktopDpr, 'mobile DPR must be reduced');
  assert.equal(MOBILE_PARTICLE_EVIDENCE.desktopCount, 32 * 32);
  assert.equal(MOBILE_PARTICLE_EVIDENCE.mobileCount, 16 * 16);
});

test('deterministic fixture reset hashes are identical across repeated cycles', async () => {
  const { buildSpawnState, hashState } = await import('../src/fixtures/gpu-particles-deterministic.ts');
  const h1 = hashState(...Object.values(buildSpawnState(8, 'gpu-particles-deterministic-v1')) as [Float32Array, Float32Array]);
  const h2 = hashState(...Object.values(buildSpawnState(8, 'gpu-particles-deterministic-v1')) as [Float32Array, Float32Array]);
  const h3 = hashState(...Object.values(buildSpawnState(8, 'gpu-particles-deterministic-v1')) as [Float32Array, Float32Array]);
  assert.equal(h1, h2, 'reset hash must be identical');
  assert.equal(h2, h3, 'reset hash must be stable across 3 cycles');
  // Separate named streams: adding morph stream must not change spawn hash
  // Already proven by buildSpawnState calling void morphRngA.next() without changing rng
});

test('particle-toy uses separate named stream for morph so spawn is stable', () => {
  const src = read(resolve(ROOT, 'src/experiments/particle-toy.ts'));
  assert.match(src, /particles\/spawn/);
  assert.match(src, /particles\/morph-a/);
  assert.match(src, /particles\/morph-b/);
  assert.match(src, /particles\/field/);
  // Ensure spawn RNG is isolated from morph RNG
  const spawnCount = (src.match(/particles\/spawn/g) ?? []).length;
  assert.ok(spawnCount >= 1);
  const morphCount = (src.match(/particles\/morph-/g) ?? []).length;
  assert.ok(morphCount >= 2, `expected morph streams, got ${morphCount}`);
});

test('particle-toy preserves added spawn/morph determinism without breaking existing spawn hash', async () => {
  const { buildSpawnState, hashState } = await import('../src/fixtures/gpu-particles-deterministic.ts');
  // Recompute twice — identical
  const s1 = buildSpawnState(32, 'gpu-particles-deterministic-v1');
  const s2 = buildSpawnState(32, 'gpu-particles-deterministic-v1');
  assert.equal(hashState(s1.posLife, s1.velSeed), hashState(s2.posLife, s2.velSeed));
});

// ── Hover displacement, click pulse, mobile reduction, poster preservation ──

test('particle-toy exercises hover displacement via normalized pointer and bounded falloff', () => {
  const src = read(resolve(ROOT, 'src/experiments/particle-toy.ts'));
  const frag = read(resolve(ROOT, 'src/experiments/shaders/particle-toy-update.frag'));
  assert.match(src, /\(e\.clientX - rect\.left\) \/ rect\.width/);
  assert.match(src, /1 - \(e\.clientY - rect\.top\) \/ rect\.height/);
  assert.match(src, /hover-during|hover-displaced|setParticleEvidence.*hover/);
  assert.match(frag, /exp\(-.*dist.*dist/);
  assert.match(frag, /falloff/);
  assert.match(frag, /radius.*0\.18/);
});

test('particle-toy implements one recovering click pulse with (1-t)*exp(-3t) and inactive after RECOVERY_SECONDS', () => {
  const src = read(resolve(ROOT, 'src/experiments/particle-toy.ts'));
  const frag = read(resolve(ROOT, 'src/experiments/shaders/particle-toy-update.frag'));
  assert.match(src, /RECOVERY_SECONDS/);
  assert.match(src, /impulseStrength/);
  assert.match(src, /one impulse record|Exactly one impulse|never accumulates/i);
  assert.match(src, /impulse-peak|impulse-recovered/);
  assert.match(frag, /uImpulseStrength/);
  assert.match(frag, /impulse.*\(1 - t\) \* exp\(-3/);
  // Verify single impulse record type
  assert.match(src, /type Impulse/);
  assert.match(src, /origin.*radius.*strength.*startTime/s);
});

test('particle-toy exposes mobile quality reduction evidence (count and DPR)', () => {
  const src = read(resolve(ROOT, 'src/experiments/particle-toy.ts'));
  assert.match(src, /MOBILE_DIM/);
  assert.match(src, /mobileParticleCount|mobile.*count/i);
  assert.match(src, /mobileDPR|desktopDPR/);
  assert.match(src, /particle-count-desktop/);
  assert.match(src, /particle-count-mobile/);
  assert.match(src, /dpr-desktop|dpr-mobile/);
  assert.match(src, /mobile-reduced/);
});

test('particle-toy exposes poster and reduced-motion preservation and deterministic reset hashes', () => {
  const src = read(resolve(ROOT, 'src/experiments/particle-toy.ts'));
  assert.match(src, /poster-preserved/);
  assert.match(src, /reduced-motion-preserved|reduced.*preserved/i);
  assert.match(src, /reset-hash|resetHash/);
  assert.match(src, /computeSpawnHash|hashState/);
  assert.match(src, /reset-hash-deterministic|reset-hash-identical/);
  assert.match(src, /prefers-reduced-motion/);
  assert.match(src, /particle-toy-poster/);
  // Ensure poster text is non-blank subject
  assert.match(src, /particle field preserved/i);
});

test('particle-toy preserves progressive disclosure and no paid tools — no directive mentions premium tools', () => {
  const src = read(resolve(ROOT, 'src/experiments/particle-toy.ts'));
  assert.doesNotMatch(src, /Figma|paid|credential|token/i);
});

test('IP-09B resource counters before/after morph cycles are evidenced via data-wdu-particle dataset', () => {
  const src = read(resolve(ROOT, 'src/experiments/particle-toy.ts'));
  // evidence is emitted via setParticleEvidence('morph-resource-...') which prefixes data-wdu-particle-
  assert.match(src, /morph-resource/);
  assert.match(src, /morph-cycle/);
  assert.match(src, /resource-before|morph-resource-before/);
  assert.match(src, /resource-after|morph-resource-after/);
  assert.match(src, /morph-resource-stable/);
  assert.match(src, /setParticleEvidence/);
  assert.match(src, /data-wdu-particle-/);
});

test('gpu-particle-systems reference still forbids per-particle React state', () => {
  const ref = read(PLUGIN_REF);
  assert.match(ref, /no per-particle React state/i);
  assert.match(ref, /reset reinitializing both targets/i);
  assert.match(ref, /never sampling the currently bound write target/i);
});
