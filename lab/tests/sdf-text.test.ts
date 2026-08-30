/**
 * SDF / MSDF text foundation tests (IP-11A).
 *
 * Acceptance gates (from QUEUE.md and TODO.md):
 *   - Atlas generation is reproducible.
 *   - Unsupported glyphs fail visibly.
 *   - Color space and cost class are declared.
 *   - Primary semantics remain outside Canvas.
 *   - Atlas generation tests, line-break fixtures, license checks, and
 *     deterministic visual capture all run.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES_ROOT = resolve(ROOT, 'src/modules');
const FIXTURES_ROOT = resolve(ROOT, 'src/fixtures');
const SHADERS_ROOT = resolve(ROOT, 'src/experiments/shaders');

function readModule(name: string): string {
  return readFileSync(resolve(MODULES_ROOT, `${name}.ts`), 'utf8');
}

function readFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_ROOT, name), 'utf8');
}

// ── Module surface ──────────────────────────────────────────────────────────

test('sdf-text module exposes the IP-11A contract surface', async () => {
  const mod = await import('../src/modules/sdf-text.ts');
  assert.equal(typeof mod.SDF_TILE_SIZE, 'number', 'SDF_TILE_SIZE is exported');
  assert.equal(typeof mod.MISSING_GLYPH_INDEX, 'number', 'MISSING_GLYPH_INDEX is exported');
  assert.equal(mod.MISSING_GLYPH_INDEX, 0xffff, 'MISSING_GLYPH_INDEX is 0xFFFF sentinel');
  assert.equal(typeof mod.SDF_HALF_SPREAD, 'number', 'SDF_HALF_SPREAD is exported');
  assert.equal(typeof mod.SDF_MAX_TILES_PER_SIDE, 'number', 'renderer-assumption cap exported');
  assert.equal(typeof mod.ATLAS_PIXEL_FORMAT, 'string', 'ATLAS_PIXEL_FORMAT declared');
  assert.equal(typeof mod.ATLAS_COLOR_SPACE, 'string', 'ATLAS_COLOR_SPACE declared');
  assert.equal(typeof mod.SDF_CHANNEL_COUNT, 'number', 'SDF_CHANNEL_COUNT declared');
  assert.equal(mod.SDF_CHANNEL_COUNT, 3, 'three MSDF channels');
  assert.ok(Array.isArray(mod.MISSING_GLYPH_RGB), 'visible-failure RGB tuple exported');
  assert.equal(mod.MISSING_GLYPH_RGB.length, 3);
  assert.equal(typeof mod.classifyBreak, 'function', 'break classifier exported');
  assert.equal(typeof mod.breakLines, 'function', 'line breaker exported');
  assert.equal(typeof mod.generateAtlas, 'function', 'atlas generator exported');
  assert.equal(typeof mod.stableAtlasHash, 'function', 'atlas hash exported');
  assert.equal(typeof mod.sdfTextReducedMotion, 'function', 'reduced-motion variant exported');
});

test('sdf-text module declares the visible-failure contract', () => {
  const src = readModule('sdf-text');
  assert.match(src, /MISSING_GLYPH_INDEX\s*=\s*0xffff/);
  assert.match(src, /MISSING_GLYPH_RGB/);
  assert.match(src, /Magenta is the conventional debug color/);
  assert.match(src, /Visible failure/i);
});

// ── Atlas reproducibility ───────────────────────────────────────────────────

test('atlas generation is reproducible across runs', async () => {
  const { generateAtlas, stableAtlasHash } = await import('../src/modules/sdf-text.ts');

  const a = generateAtlas({ seed: 'repro-1' });
  const b = generateAtlas({ seed: 'repro-1' });
  assert.equal(a.pixels.length, b.pixels.length, 'pixel buffer length matches');
  for (let i = 0; i < a.pixels.length; i += 1) {
    assert.equal(a.pixels[i], b.pixels[i], `byte ${i} differs across runs`);
  }
  assert.equal(stableAtlasHash(a), stableAtlasHash(b), 'hash is identical');
});

test('atlas entries include ASCII, replacement, and a CJK sample', async () => {
  const { generateAtlas } = await import('../src/modules/sdf-text.ts');
  const atlas = generateAtlas();
  for (const cp of [0x41 /* A */, 0x30 /* 0 */, 0x2e /* . */, 0xfffd, 0x4e2d]) {
    assert.ok(atlas.entries.has(cp), `codepoint U+${cp.toString(16).toUpperCase()} must be in atlas`);
    const entry = atlas.entries.get(cp)!;
    assert.ok(entry.u1 > entry.u0, 'entry has positive width');
    assert.ok(entry.v1 > entry.v0, 'entry has positive height');
    assert.ok(entry.advance > 0, 'entry has positive advance');
  }
});

test('atlas pixel count matches tile layout', async () => {
  const { generateAtlas, SDF_TILE_SIZE } = await import('../src/modules/sdf-text.ts');
  const atlas = generateAtlas();
  const expected = atlas.columns * SDF_TILE_SIZE * atlas.rows * SDF_TILE_SIZE * 3;
  assert.equal(atlas.pixels.length, expected, 'pixel buffer has correct length');
});

test('atlas pixel format and color space are documented', () => {
  const src = readModule('sdf-text');
  assert.match(src, /ATLAS_PIXEL_FORMAT\s*=\s*'RGB8'/);
  assert.match(src, /ATLAS_COLOR_SPACE\s*=\s*'LINEAR_UNENCODED'/);
  assert.match(src, /SDF_HALF_SPREAD/);
});

// ── Unsupported glyphs fail visibly ─────────────────────────────────────────

test('a codepoint outside the registry still has a measurable advance for the breaker', async () => {
  const { breakLines } = await import('../src/modules/sdf-text.ts');
  // U+1F600 (emoji face) is not in the registry. The line breaker must
  // not throw — it must keep the line moving so the renderer can paint the
  // visible-failure tile.
  const result = breakLines('A\u{1F600}B', 1.0, () => 0.5);
  assert.ok(result.lines.length >= 1, 'breaker always returns at least one line');
  assert.ok(result.overflow, 'tight budget must produce overflow so the missing glyph stays visible');
});

test('MISSING_GLYPH_INDEX is larger than any real atlas index', async () => {
  const { generateAtlas, MISSING_GLYPH_INDEX } = await import('../src/modules/sdf-text.ts');
  const atlas = generateAtlas();
  let maxIndex = -1;
  for (const entry of atlas.entries.values()) {
    if (entry.index > maxIndex) maxIndex = entry.index;
  }
  assert.ok(maxIndex < MISSING_GLYPH_INDEX, 'no real glyph index may collide with the missing-glyph sentinel');
});

// ── Line-break fixtures ─────────────────────────────────────────────────────

test('breakLines respects space break opportunities', async () => {
  const { breakLines } = await import('../src/modules/sdf-text.ts');
  // Budget of 4.0 with a 1.0-unit advance; the breaker has to split at
  // the second space (after 'BB') to keep every line within budget.
  const result = breakLines('AA BB CC', 4.0, () => 1.0);
  assert.deepEqual(result.lines, ['AA', 'BB', 'CC']);
  assert.ok(result.breakOpportunities.length >= 2, 'breaker recorded two break opportunities');
});

test('breakLines treats newline as a mandatory break', async () => {
  const { breakLines } = await import('../src/modules/sdf-text.ts');
  const result = breakLines('AAA\nBBB', 100.0, () => 1.0);
  assert.deepEqual(result.lines, ['AAA', 'BBB']);
});

test('breakLines breaks at CJK script boundaries', async () => {
  const { breakLines } = await import('../src/modules/sdf-text.ts');
  // 中A文B: three CJK glyphs each 1.0 wide and one Latin 'A' 0.5 wide.
  // Budget 2.0 means the breaker must split at the CJK boundary between
  // '中' and 'A' (or after 'A') rather than letting two CJK glyphs share
  // a line.
  const result = breakLines('中A文B', 2.0, (cp) => (cp > 0x4dff ? 1.0 : 0.5));
  assert.ok(result.lines.length >= 2, 'CJK break opportunity must split the string');
});

test('breakLines overflow flag fires on overlong tokens', async () => {
  const { breakLines } = await import('../src/modules/sdf-text.ts');
  const result = breakLines('TOOLONG', 2.0, () => 1.0);
  assert.ok(result.overflow, 'overlong token sets overflow');
});

// ── Reduced motion and renderer assumptions ─────────────────────────────────

test('sdfTextReducedMotion returns the same line geometry as the live path', async () => {
  const { breakLines, sdfTextReducedMotion } = await import('../src/modules/sdf-text.ts');
  const live = breakLines('AAA BBB', 6.0, () => 0.5);
  const reduced = sdfTextReducedMotion('AAA BBB', 6.0);
  assert.deepEqual(reduced.lines, live.lines, 'reduced-motion variant has identical line layout');
  assert.equal(reduced.overflow, live.overflow);
});

test('manifest declares WebGL2 only and explicit reduced-motion behavior', () => {
  const manifest = readModule('manifest');
  // Pull out the sdf-text block.
  const start = manifest.indexOf("id: 'sdf-text'");
  const end = manifest.indexOf("];", start);
  const block = manifest.slice(start, end);
  assert.match(block, /rendererSupport:\s*\[\s*'webgl2'\s*\]/);
  assert.match(block, /costClass:\s*'low'/);
  assert.match(block, /reducedMotion:/);
  assert.match(block, /colorSpace:/);
  assert.match(block, /fixture:/);
  assert.match(block, /noCombine:\s*true/);
});

// ── Visual fixture and DOM caption ──────────────────────────────────────────

test('visual fixture declares the module, the missing-glyph path, and uses RawShaderMaterial', () => {
  const ts = readFileSync(resolve(SHADERS_ROOT, 'sdf-text.ts'), 'utf8');
  const frag = readFileSync(resolve(SHADERS_ROOT, 'sdf-text.frag'), 'utf8');

  assert.match(ts, /\[module:sdf-text\]/);
  assert.match(ts, /generateAtlas/);
  assert.match(ts, /MISSING_GLYPH_INDEX/);
  assert.match(ts, /new THREE\.RawShaderMaterial/);
  assert.match(ts, /glslVersion:\s*THREE\.GLSL3/);
  assert.match(frag, /MISSING_GLYPH_INDEX/);
  assert.match(frag, /median3/);
  assert.match(frag, /sampleSignedDistance/);
});

test('primary text semantics remain outside the canvas (DOM caption present)', () => {
  const ts = readFileSync(resolve(SHADERS_ROOT, 'sdf-text.ts'), 'utf8');
  // The experiment must create a DOM caption so a screen reader sees the
  // experiment name; the canvas only renders the decorative glyph.
  assert.match(ts, /caption\s*=\s*document\.createElement/);
  assert.match(ts, /setAttribute\('role',\s*'region'\)/);
  assert.match(ts, /setAttribute\('aria-label'/);
  assert.match(ts, /appendChild\(title\)/);
  // The visible caption is real DOM, not canvas-rendered copy.
  assert.match(ts, /title\.textContent =/);
  assert.match(ts, /body\.textContent =/);
});

// ── Deterministic visual capture ────────────────────────────────────────────

test('deterministic fixture exists and inherits the same experiment', () => {
  const det = readFixture('sdf-text-deterministic.ts');
  assert.match(det, /mount as mountSdfText/);
  assert.match(det, /export function mount\(ctx: ExperimentContext\)/);
});

test('experiment writes the atlas hash for the deterministic-capture comparator', () => {
  const ts = readFileSync(resolve(SHADERS_ROOT, 'sdf-text.ts'), 'utf8');
  assert.match(ts, /WDU_SDF_ATLAS_HASH/);
  assert.match(ts, /data-wdu-ready/);
});

// ── License metadata ────────────────────────────────────────────────────────

test('license metadata fixture exists and names only permissively-licensed fonts', () => {
  const license = JSON.parse(readFixture('sdf-text-license.json'));
  assert.equal(license.module, 'sdf-text');
  assert.match(license.version, /^ip-11a-v\d+$/);
  assert.equal(license.noPaidFonts, true, 'no paid fonts allowed');
  assert.equal(license.noCommittedCredentials, true, 'no credentials committed');
  assert.equal(license.upstreamAtlasGenerator.license, 'MIT');
  for (const option of license.productionFontOptions) {
    assert.ok(
      ['OFL-1.1', 'Apache-2.0', 'MIT', 'CC0-1.0'].includes(option.license),
      `production font ${option.family} must be permissively licensed (got ${option.license})`,
    );
  }
});

test('license metadata fixture validates against its own schema (required fields)', () => {
  const license = JSON.parse(readFixture('sdf-text-license.json'));
  for (const field of [
    'module',
    'version',
    'license',
    'upstreamAtlasGenerator',
    'productionFontOptions',
    'fixtureFont',
    'noPaidFonts',
    'noCommittedCredentials',
  ]) {
    assert.ok(field in license, `license metadata must declare ${field}`);
  }
});

test('license schema is committed alongside the metadata', () => {
  assert.ok(
    existsSync(resolve(FIXTURES_ROOT, 'sdf-text-license.schema.json')),
    'schema file is required for license metadata validation',
  );
});

// ── Unicode coverage metadata ───────────────────────────────────────────────

test('unicode coverage metadata names covered blocks and the missing-glyph sentinel', () => {
  const coverage = JSON.parse(readFixture('sdf-text-unicode.json'));
  assert.equal(coverage.module, 'sdf-text');
  assert.ok(Array.isArray(coverage.unicodeCoverage));
  assert.ok(coverage.unicodeCoverage.length >= 3, 'at least three blocks documented');
  assert.equal(coverage.visibleFailure.tile, 'MISSING_GLYPH_INDEX = 0xffff');
  assert.match(coverage.visibleFailure.marker, /65535/);
  assert.ok(Array.isArray(coverage.breakClasses));
});

// ── Lab router ──────────────────────────────────────────────────────────────

test('lab router exposes sdf-text experiment routes', () => {
  const main = readFileSync(resolve(ROOT, 'src/main.ts'), 'utf8');
  assert.match(main, /'sdf-text'/);
  assert.match(main, /'sdf-text-deterministic'/);
});

test('lab README documents the IP-11A routes', () => {
  const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
  assert.match(readme, /sdf-text/);
});