import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  ENVIRONMENT_TIERS,
  MATERIAL_RECIPES,
  hasPhysicalFeature,
  materialClassFor,
  type MaterialRecipeName,
} from '../src/modules/material-lookdev.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN_SOURCE = readFileSync(resolve(ROOT, 'src/main.ts'), 'utf8');
const EXPERIMENT_SOURCE = readFileSync(resolve(ROOT, 'src/experiments/lookdev.ts'), 'utf8');

const RECIPE_NAMES: MaterialRecipeName[] = ['ice', 'frost', 'glass', 'metal', 'matte'];

test('lookdev exposes the five authored material recipes', () => {
  assert.deepEqual(Object.keys(MATERIAL_RECIPES), RECIPE_NAMES);
  for (const name of RECIPE_NAMES) {
    const recipe = MATERIAL_RECIPES[name];
    assert.ok(recipe.baseColor.startsWith('#'));
    assert.ok(recipe.roughness >= 0 && recipe.roughness <= 1);
    assert.ok(recipe.metalness >= 0 && recipe.metalness <= 1);
    assert.ok(recipe.ior >= 1 && recipe.ior <= 3);
    assert.ok(recipe.transmission >= 0 && recipe.transmission <= 1);
    assert.ok(recipe.thickness >= 0);
    assert.ok(recipe.attenuationDistance > 0);
    assert.ok(recipe.clearcoat >= 0 && recipe.clearcoat <= 1);
    assert.ok(recipe.iridescence >= 0 && recipe.iridescence <= 1);
  }
});

test('base color alone never promotes a material to a physical feature', () => {
  const colorOnly = { baseColor: '#ffffff' };
  assert.equal(hasPhysicalFeature(colorOnly), false);
  assert.equal(materialClassFor(colorOnly), 'MeshStandardMaterial');
  assert.equal(hasPhysicalFeature({ ...colorOnly, transmission: 0.5 }), true);
  assert.equal(materialClassFor({ ...colorOnly, transmission: 0.5 }), 'MeshPhysicalMaterial');
  assert.equal(materialClassFor(MATERIAL_RECIPES.metal), 'MeshStandardMaterial');
  assert.equal(materialClassFor(MATERIAL_RECIPES.ice), 'MeshPhysicalMaterial');
});

test('environment tiers are explicit, ordered, and budgeted', () => {
  assert.deepEqual(Object.keys(ENVIRONMENT_TIERS), ['poster', 'low', 'medium', 'high']);
  const budgets = Object.values(ENVIRONMENT_TIERS).map((tier) => tier.maxTextureSize);
  assert.deepEqual(budgets, [0, 256, 512, 1024]);
  assert.equal(ENVIRONMENT_TIERS.poster.dynamic, false);
  assert.equal(ENVIRONMENT_TIERS.low.dynamic, false);
  assert.equal(ENVIRONMENT_TIERS.medium.dynamic, true);
  assert.equal(ENVIRONMENT_TIERS.high.dynamic, true);
});

test('lookdev lab route is wired to a real experiment with no apply-all path', () => {
  assert.match(MAIN_SOURCE, /'lookdev': \(\) => import\('\.\/experiments\/lookdev\.js'\)/);
  assert.match(EXPERIMENT_SOURCE, /new THREE\.MeshPhysicalMaterial/);
  assert.match(EXPERIMENT_SOURCE, /new THREE\.MeshStandardMaterial/);
  assert.match(EXPERIMENT_SOURCE, /data-wdu-lookdev-ready/);
  assert.match(EXPERIMENT_SOURCE, /environment tiers/i);
  assert.match(EXPERIMENT_SOURCE, /reduced motion/i);
  assert.doesNotMatch(EXPERIMENT_SOURCE, /applyAll|apply_all|combineAll/i);
});
