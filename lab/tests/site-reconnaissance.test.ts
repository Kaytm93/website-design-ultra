import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN_SOURCE = readFileSync(resolve(LAB_ROOT, 'src/main.ts'), 'utf8');
const EXPERIMENT_PATH = resolve(LAB_ROOT, 'src/experiments/site-reconnaissance.ts');
const DETERMINISTIC_FIXTURE_PATH = resolve(
  LAB_ROOT,
  'src/fixtures/site-reconnaissance-deterministic.ts',
);

function readIfPresent(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

test('site reconnaissance has interactive and deterministic lab routes', () => {
  assert.match(MAIN_SOURCE, /'site-reconnaissance':\s*\(\) => import\('\.\/experiments\/site-reconnaissance\.js'\)/);
  assert.match(MAIN_SOURCE, /'site-reconnaissance-deterministic':\s*\(\) => import\('\.\/fixtures\/site-reconnaissance-deterministic\.js'\)/);
  assert.match(readIfPresent(resolve(LAB_ROOT, 'README.md')), /site-reconnaissance/);
});

test('offline experiment publishes a deterministic, non-live evidence snapshot', async () => {
  const experiment = await import('../src/experiments/site-reconnaissance.ts');
  const deterministicFixture = await import('../src/fixtures/site-reconnaissance-deterministic.ts');
  const first = experiment.createOfflineCaptureSignature();
  const second = deterministicFixture.createOfflineCaptureSignature();

  assert.equal(first, second, 'the offline capture fixture must inherit the stable snapshot');
  assert.equal(experiment.OFFLINE_RECONNAISSANCE_CAPTURE.status, 'OFFLINE_FIXTURE');
  assert.equal(experiment.OFFLINE_RECONNAISSANCE_CAPTURE.sourceUrl, undefined);
  assert.equal(experiment.OFFLINE_RECONNAISSANCE_CAPTURE.fieldCount, 13);
  assert.deepEqual(experiment.OFFLINE_RECONNAISSANCE_CAPTURE.evidenceFamilies, [
    'bundle',
    'network',
    'renderer-info',
    'inspector',
    'shader',
  ]);
});

test('offline experiment cannot accidentally become live reconnaissance', () => {
  const source = readIfPresent(EXPERIMENT_PATH);
  assert.notEqual(source, '', 'site reconnaissance experiment must exist');
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bXMLHttpRequest\b/);
  assert.doesNotMatch(source, /https?:\/\//i);
  assert.match(source, /offline-fixture/);
  assert.match(source, /No live URL/i);
});

test('site reconnaissance experiment and fixture use the stable-frame capture contract', () => {
  const experiment = readIfPresent(EXPERIMENT_PATH);
  const fixture = readIfPresent(DETERMINISTIC_FIXTURE_PATH);
  assert.match(experiment, /createStableFrameMarker/);
  assert.match(experiment, /data-wdu-recon-source/);
  assert.match(experiment, /data-wdu-ready/);
  assert.match(experiment, /afterVisibleRender/);
  assert.match(fixture, /mount as mountSiteReconnaissance/);
  assert.match(fixture, /export function mount\(ctx: ExperimentContext\)/);
});
