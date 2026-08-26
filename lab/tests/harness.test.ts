import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERIFY_SOURCE = readFileSync(resolve(LAB_ROOT, 'scripts/verify-lab.mjs'), 'utf8');

function functionBody(name: string): string {
  const start = VERIFY_SOURCE.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = VERIFY_SOURCE.indexOf('\nasync function ', start + 1);
  return VERIFY_SOURCE.slice(start, next === -1 ? undefined : next);
}

test('browser checks use real Playwright page operations', () => {
  const browserCheck = functionBody('labBrowserCheck');
  const screenshot = functionBody('labScreenshot');
  assert.match(browserCheck, /waitForSelector/);
  assert.match(browserCheck, /run-code/);
  assert.match(browserCheck, /evaluate/);
  assert.match(screenshot, /screenshot/);
  assert.doesNotMatch(browserCheck, /placeholder/i);
  assert.doesNotMatch(browserCheck, /return null/);
  assert.doesNotMatch(screenshot, /placeholder/i);
  assert.doesNotMatch(screenshot, /return null/);
});

test('the verifier starts one real dev server and checks both acceptance routes', () => {
  assert.match(VERIFY_SOURCE, /npm.*run.*dev/);
  assert.match(VERIFY_SOURCE, /compile-error/);
  assert.match(VERIFY_SOURCE, /deterministic-capture/);
  assert.match(VERIFY_SOURCE, /WDU_DETERMINISTIC=1/);
  assert.doesNotMatch(functionBody('findFreePort'), /return 5173/);
});

test('browser CLI discovery supports the explicit pinned executable', () => {
  assert.match(VERIFY_SOURCE, /WDU_PLAYWRIGHT_CLI/);
  assert.match(VERIFY_SOURCE, /hasBrowserCliError|### Error/);
});
