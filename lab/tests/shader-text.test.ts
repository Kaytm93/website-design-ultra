/**
 * Production shader-text contract tests (J-D5).
 *
 * These tests bind the installed plugin templates to the root-only lab route:
 * the atlas command is license-first, the DOM is the semantic owner, and the
 * three visual effects remain uniform-driven and individually selectable.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(LAB_ROOT, '..');
const PLUGIN_ROOT = join(REPO_ROOT, 'website-design-ultra');
const SKILL_ROOT = join(PLUGIN_ROOT, 'skills', 'shader-text');
const TEMPLATE_ROOT = join(PLUGIN_ROOT, 'templates', 'shader-text');

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

// ── Installed skill and production payload ───────────────────────────────────

test('shader-text is a negatively gated production skill within the size budget', () => {
  const skillPath = join(SKILL_ROOT, 'SKILL.md');
  assert.ok(existsSync(skillPath), 'shader-text/SKILL.md exists');
  const skill = readText(skillPath);
  assert.ok(statSync(skillPath).size <= 5_000, 'SKILL.md is at most 5 KB');
  assert.match(skill, /^name: shader-text/m);
  assert.match(skill, /Use only when/i);
  assert.match(skill, /does not activate this skill\.?$/m);
  for (const marker of [
    'msdf-atlas.mjs',
    'license-manifest.json',
    'troika-alternative.md',
    'dom-text-template.ts',
    'text-effects-uniforms.ts',
    'canvas-only-prohibition.ts',
  ]) {
    assert.match(skill, new RegExp(marker.replaceAll('.', '\\.'), 'i'), `skill names ${marker}`);
  }
});

test('MSDF atlas template is license-first and has a dependency-free check path', () => {
  const script = join(TEMPLATE_ROOT, 'msdf-atlas.mjs');
  const manifest = join(TEMPLATE_ROOT, 'license-manifest.json');
  assert.ok(existsSync(script));
  assert.ok(existsSync(manifest));
  const source = readText(script);
  assert.match(source, /msdf-atlas-gen/);
  assert.match(source, /licenseManifest|license-manifest/i);
  assert.match(source, /spawnSync/);
  assert.match(source, /--check/);
  const output = execFileSync(process.execPath, [script, '--check', manifest], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.match(output, /validated|valid/i);
});

test('invalid atlas licenses are rejected before a generator can run', () => {
  const script = join(TEMPLATE_ROOT, 'msdf-atlas.mjs');
  const temp = mkdtempSync(join(LAB_ROOT, '.tmp-shader-text-license-'));
  const invalid = join(temp, 'invalid.json');
  try {
    writeFileSync(invalid, JSON.stringify({ module: 'shader-text' }), 'utf8');
    assert.throws(
      () => execFileSync(process.execPath, [script, '--check', invalid], { encoding: 'utf8' }),
      /status|license|manifest/i,
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('production payload includes the Troika alternative and semantic DOM template', () => {
  const troika = readText(join(TEMPLATE_ROOT, 'troika-alternative.md'));
  const dom = readText(join(TEMPLATE_ROOT, 'dom-text-template.ts'));
  const uniforms = readText(join(TEMPLATE_ROOT, 'text-effects-uniforms.ts'));
  assert.match(troika, /troika-three-text/);
  assert.match(troika, /alternative/i);
  assert.match(troika, /not both|one path|choose/i);
  for (const marker of ['user-select', 'aria-hidden', 'lang', 'screen reader', 'translate']) {
    assert.match(dom, new RegExp(marker, 'i'), `DOM template documents ${marker}`);
  }
  for (const marker of ['scramble', 'glitch', 'dissolve', 'uScramble', 'uGlitch', 'uDissolve', 'reducedMotion']) {
    assert.match(uniforms, new RegExp(marker, 'i'), `uniform template documents ${marker}`);
  }
});

// ── Root-only lab routes and browser-facing fixture contracts ────────────────

test('shader-text lab routes and manifest entry are wired', () => {
  const main = readText(join(LAB_ROOT, 'src', 'main.ts'));
  const manifest = readText(join(LAB_ROOT, 'src', 'modules', 'manifest.ts'));
  const readme = readText(join(LAB_ROOT, 'README.md'));
  for (const route of ['shader-text', 'shader-text-deterministic', 'shader-text-screenreader']) {
    assert.match(main, new RegExp(`['"]${route}['"]`), `${route} route is registered`);
  }
  const start = manifest.indexOf("id: 'shader-text'");
  assert.ok(start >= 0, 'manifest contains shader-text');
  const block = manifest.slice(start, manifest.indexOf('  },', start) + 4);
  for (const marker of ['rendererSupport', 'costClass', 'reducedMotion', 'colorSpace', 'fixture', 'noCombine: true']) {
    assert.match(block, new RegExp(marker), `manifest declares ${marker}`);
  }
  assert.match(readme, /shader-text/);
});

test('lab headline keeps a selectable, translatable DOM twin and uniform-only effects', () => {
  const experiment = readText(join(LAB_ROOT, 'src', 'experiments', 'shaders', 'shader-text.ts'));
  assert.match(experiment, /SAMPLE_HEADLINE/);
  assert.match(experiment, /user-select:\s*text/);
  assert.match(experiment, /setAttribute\('lang'/);
  assert.match(experiment, /aria-hidden.*true|setAttribute\('aria-hidden',\s*'true'\)/);
  assert.match(experiment, /pointer-events:\s*none/);
  for (const marker of ['uScramble', 'uGlitch', 'uDissolve', 'computeScrambleUniforms', 'computeGlitchUniforms', 'computeDissolveUniforms', 'median3', 'scrambleOffset', 'effectUv']) {
    assert.match(experiment, new RegExp(marker), `experiment wires ${marker}`);
  }
  assert.doesNotMatch(experiment, /applyAll|apply_all/);
});

test('screenreader fixture is a DOM-only, translated heading fixture', () => {
  const fixture = readText(join(LAB_ROOT, 'src', 'fixtures', 'shader-text-screenreader.ts'));
  const fixtureManifest = JSON.parse(readText(join(LAB_ROOT, 'src', 'fixtures', 'shader-text-screenreader.json')));
  assert.equal(fixtureManifest.webglDependency, false);
  assert.equal(fixtureManifest.decorativeCanvas.ariaHidden, true);
  assert.match(fixture, /h1/);
  assert.match(fixture, /tabIndex\s*=\s*0/);
  assert.match(fixture, /user-select:\s*text/);
  assert.match(fixture, /lang/);
  assert.match(fixture, /textContent/);
  assert.match(fixture, /translate|local/i);
  assert.match(fixture, /aria-hidden/);
});

test('screenreader fixture inherits the production headline route', () => {
  const fixture = readText(join(LAB_ROOT, 'src', 'fixtures', 'shader-text-deterministic.ts'));
  assert.match(fixture, /mount as mountShaderText/);
  assert.match(fixture, /export function mount\(ctx: ExperimentContext\)/);
});
