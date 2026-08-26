import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES_ROOT = resolve(ROOT, 'src/modules');
const MAIN_SOURCE = readFileSync(resolve(ROOT, 'src/main.ts'), 'utf8');

function readModule(name: string): string {
  return readFileSync(resolve(MODULES_ROOT, `${name}.ts`), 'utf8');
}

test('foundational shader modules expose the required manifest fields', () => {
  const manifest = readModule('manifest');
  assert.match(manifest, /rendererSupport.*webgl2/);
  assert.match(manifest, /rendererSupport.*webgpu/);
  assert.match(manifest, /costClass.*low/);
  assert.match(manifest, /costClass.*medium/);
  assert.match(manifest, /reducedMotion/);
  assert.match(manifest, /colorSpace/);
  assert.match(manifest, /fixture/);
  assert.match(manifest, /noCombine/);
});

test('foundational shader module files export the required functions', () => {
  const noise = readModule('noise');
  assert.match(noise, /export const simplex3D = /);
  assert.match(noise, /export const value2D = /);
  assert.match(noise, /export const curl3D = /);

  const fresnel = readModule('fresnel-iridescence');
  assert.match(fresnel, /export const fresnelSchlick = /);
  assert.match(fresnel, /export const iridescenceThinFilm = /);

  const dissolve = readModule('dissolve');
  assert.match(dissolve, /export const dissolveStable = /);
});

test('transition/interaction shader modules export the required functions', () => {
  const transition = readModule('transition-interaction');
  assert.match(transition, /export const frostedTransitionMask = /);
  assert.match(transition, /export const chromaticOffset = /);
  assert.match(transition, /export const clickShockwave = /);
  assert.match(transition, /export const flowFieldDeformation = /);
});

test('the lab router exposes the new shader module experiment routes', () => {
  assert.match(MAIN_SOURCE, /'foundational-shaders'/);
  assert.match(MAIN_SOURCE, /'foundational-shaders-deterministic'/);
  assert.match(MAIN_SOURCE, /'transition-interaction'/);
  assert.match(MAIN_SOURCE, /'transition-interaction-deterministic'/);
});

test('the iridescence manifest limits spectral samples to a bounded count', () => {
  const fresnel = readModule('fresnel-iridescence');
  assert.match(fresnel, /wavelengths = vec3\(680\.0, 550\.0, 440\.0\)/);
  assert.doesNotMatch(fresnel, /for\s*\(/);
});

test('dissolve edge width is bounded by a seed-derived clamp', () => {
  const dissolve = readModule('dissolve');
  assert.match(dissolve, /clamp\(0\.02 \+ seed \* 0\.001, 0\.01, 0\.06\)/);
});

test('frosted transition strength is hard-capped', () => {
  const transition = readModule('transition-interaction');
  assert.match(transition, /float cappedStrength = clamp\(strength, 0\.0, 0\.25\)/);
});

test('chromatic offset amplitude is hard-capped', () => {
  const transition = readModule('transition-interaction');
  assert.match(transition, /float cappedAmplitude = clamp\(amplitude, 0\.0, 0\.08\)/);
});

test('click shockwave radius and strength are hard-capped', () => {
  const transition = readModule('transition-interaction');
  assert.match(transition, /float cappedMaxRadius = clamp\(maxRadius, 0\.0, 1\.0\)/);
  assert.match(transition, /float cappedStrength = clamp\(strength, 0\.0, 0\.5\)/);
});

test('flow-field deformation strength is hard-capped', () => {
  const transition = readModule('transition-interaction');
  assert.match(transition, /float cappedStrength = clamp\(strength, 0\.0, 0\.3\)/);
});

test('transition/interaction fragment preserves a deterministic capture fixture', () => {
  const fixture = readFileSync(resolve(ROOT, 'src/fixtures/transition-interaction-deterministic.ts'), 'utf8');
  assert.match(fixture, /transition-interaction/);
  assert.match(fixture, /export function mount\(ctx: ExperimentContext\)/);
});

test('the WebGL2 visual fixture uses raw shaders so #version remains first', () => {
  const visualFixture = readFileSync(
    resolve(ROOT, 'src/experiments/shaders/foundational-shaders.ts'),
    'utf8',
  );
  assert.match(visualFixture, /new THREE\.RawShaderMaterial/);
  assert.match(visualFixture, /glslVersion:\s*THREE\.GLSL3/);
  assert.doesNotMatch(visualFixture, /new THREE\.ShaderMaterial/);
});
