#!/usr/bin/env node

/**
 * lab/scripts/verify-lab.mjs — IP-08A verification script.
 *
 * The harness runs the acceptance checks against the root-only Vite lab:
 * clean install, TypeScript/tests/build, compile-error diagnostics, two-run
 * deterministic capture, and measured shader edit-to-update latency. Browser
 * capability failures are reported as UNAVAILABLE, never as a pass.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const CLI_VERSION = '0.1.17';
const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const UNAVAIL = '\x1b[33mUNAVAILABLE\x1b[0m';

let failures = 0;
let unavailable = 0;

function check(label, result, detail = '') {
  if (result === 'UNAVAILABLE') {
    console.log(`  ${UNAVAIL}  ${label}`);
    if (detail) console.log(`        ${detail}`);
    unavailable += 1;
    return;
  }
  if (result) {
    console.log(`  ${PASS}  ${label}`);
    return;
  }
  console.log(`  ${FAIL}  ${label}`);
  if (detail) console.log(`        ${detail}`);
  failures += 1;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: LAB_ROOT,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  return {
    status: result.status,
    output,
    error: result.error,
  };
}

function hasBrowserCliError(output) {
  return /(?:^|\n)### Error\b/.test(String(output ?? ''));
}

function findPlaywrightCli() {
  const explicit = process.env.WDU_PLAYWRIGHT_CLI;
  if (explicit) {
    const result = spawnSync(explicit, ['--version'], { encoding: 'utf8' });
    return result.status === 0 ? { command: explicit, prefix: [] } : undefined;
  }

  const pathLookup = spawnSync('sh', ['-lc', 'command -v playwright-cli'], {
    encoding: 'utf8',
  });
  if (pathLookup.status === 0 && pathLookup.stdout.trim()) {
    return { command: pathLookup.stdout.trim(), prefix: [] };
  }

  const npxLookup = spawnSync('sh', ['-lc', 'command -v npx'], {
    encoding: 'utf8',
  });
  if (npxLookup.status === 0 && npxLookup.stdout.trim()) {
    return {
      command: npxLookup.stdout.trim(),
      prefix: ['--yes', '--package', `@playwright/cli@${CLI_VERSION}`, 'playwright-cli'],
    };
  }
  return undefined;
}

function quote(value) {
  return JSON.stringify(value);
}

function invokeCli(playwrightCli, session, action, args = [], timeout = 45_000) {
  const result = run(
    playwrightCli.command,
    [...playwrightCli.prefix, `-s=${session}`, action, ...args],
    { timeout },
  );
  if (result.error || result.status !== 0 || hasBrowserCliError(result.output)) {
    throw new Error(
      `${session}/${action}: ${result.error?.message ?? (result.output || result.status)}`,
    );
  }
  return result;
}

function closeCliSession(playwrightCli, session) {
  try {
    run(
      playwrightCli.command,
      [...playwrightCli.prefix, `-s=${session}`, 'close'],
      { timeout: 30_000 },
    );
  } catch {
    // Cleanup must not hide the original browser assertion.
  }
}

function parseRaw(result) {
  const raw = result.output.split('\n').filter(Boolean).at(0) ?? '';
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Playwright raw JSON was invalid: ${error.message}; output=${result.output}`);
  }
}

async function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

async function waitForServer(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The Vite process is still starting.
    }
    await sleep(200);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function fetchModule(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (response.ok) return response.text();
  } catch {
    // The caller records a missing module as unavailable.
  }
  return undefined;
}

async function labBrowserCheck(playwrightCli, baseUrl, experiment, selector, expression) {
  const session = `wdu-lab-check-${experiment}-${process.pid}-${Date.now()}`;
  const url = `${baseUrl}/?e=${encodeURIComponent(experiment)}`;
  try {
    invokeCli(playwrightCli, session, 'open', [url]);
    const result = invokeCli(
      playwrightCli,
      session,
      'run-code',
      [
        `async (page) => {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector(${quote(selector)}, { state: 'visible', timeout: 15000 })
  return await page.evaluate(() => Boolean(${expression}))
}`,
        '--raw',
      ],
    );
    return parseRaw(result) === true;
  } catch (error) {
    console.log(`        browser assertion failed: ${error.message}`);
    return false;
  } finally {
    closeCliSession(playwrightCli, session);
  }
}

async function labScreenshot(playwrightCli, baseUrl, experiment, outputPath, extra = '') {
  const session = `wdu-lab-shot-${experiment}-${process.pid}-${Date.now()}`;
  const query = `?e=${encodeURIComponent(experiment)}${extra ? `&${extra}` : ''}`;
  try {
    invokeCli(playwrightCli, session, 'open', [`${baseUrl}/${query}`]);
    invokeCli(
      playwrightCli,
      session,
      'run-code',
      [
        `async (page) => {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector('html[data-wdu-ready="true"]', { state: 'attached', timeout: 15000 })
  await page.screenshot({ path: ${quote(outputPath)} })
  return true
}`,
        '--raw',
      ],
    );
    return existsSync(outputPath) ? outputPath : undefined;
  } catch (error) {
    console.log(`        screenshot failed: ${error.message}`);
    return undefined;
  } finally {
    closeCliSession(playwrightCli, session);
  }
}

async function stopServer(serverProcess) {
  if (serverProcess.exitCode === null && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
    await sleep(300);
    if (serverProcess.exitCode === null) serverProcess.kill('SIGKILL');
  }
}

async function main() {
  console.log('\n═══ 1. Clean install ═══');
  const ci = run(NPM, ['ci'], { timeout: 180_000 });
  check('npm ci', ci.status === 0, ci.output.slice(0, 1200));

  console.log('\n═══ 2. Clean build ═══');
  const typecheck = run(NPM, ['run', 'typecheck'], { timeout: 120_000 });
  check('tsc --noEmit', typecheck.status === 0, typecheck.output.slice(0, 800));
  const tests = run(NPM, ['test'], { timeout: 120_000 });
  check('unit tests', tests.status === 0, tests.output.slice(0, 1000));
  const buildStarted = Date.now();
  const build = run(NPM, ['run', 'build'], { timeout: 120_000 });
  const buildMs = Date.now() - buildStarted;
  check('vite build', build.status === 0, `${build.output.slice(0, 600)}\nbuildMs=${buildMs}`);
  check('build time < 120s', build.status === 0 && buildMs < 120_000, `measured ${buildMs}ms`);

  const playwrightCli = findPlaywrightCli();
  const serverPort = await findFreePort();
  // The server runs with `npm run dev`; browser checks and HMR use this same process.
  const serverProcess = spawn(
    NPM,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(serverPort), '--strictPort'],
    { cwd: LAB_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const baseUrl = `http://127.0.0.1:${serverPort}`;
  let serverReady = false;
  try {
    try {
      await waitForServer(baseUrl, 15_000);
      serverReady = true;
      console.log(`  dev server ready on port ${serverPort}`);
    } catch (error) {
      console.log(`  dev server unavailable: ${error.message}`);
    }

    console.log('\n═══ 3. Compile-error fixture ═══');
    const fixtureFrag = join(LAB_ROOT, 'src/fixtures/compile-error.frag');
    check('compile-error.frag exists', existsSync(fixtureFrag));
    if (existsSync(fixtureFrag)) {
      const source = readFileSync(fixtureFrag, 'utf8');
      check('fixture references undeclared uResolution', source.includes('uResolution'));
      check('fixture omits uResolution declaration', !source.includes('uniform vec2 uResolution'));
    }
    if (playwrightCli && serverReady) {
      const compileBrowser = await labBrowserCheck(
        playwrightCli,
        baseUrl,
        'compile-error',
        '#lab-error.visible',
        "document.getElementById('lab-error')?.textContent?.includes('uResolution') && document.getElementById('lab-error')?.textContent?.includes('line 13')",
      );
      check('compile-error browser shows line-level diagnostic', compileBrowser);
    } else {
      check(
        'compile-error browser shows line-level diagnostic',
        'UNAVAILABLE',
        playwrightCli ? 'Vite server unavailable' : 'WDU_PLAYWRIGHT_CLI is not configured',
      );
    }

    console.log('\n═══ 4. Deterministic capture ═══');
    const deterministicSource = readFileSync(
      join(LAB_ROOT, 'src/fixtures/deterministic-capture.ts'),
      'utf8',
    );
    check('deterministic fixture uses named random streams', deterministicSource.includes('createRandomStreams'));
    check('deterministic fixture uses stable frame marker', deterministicSource.includes('createStableFrameMarker'));
    check('deterministic fixture preserves the drawing buffer', deterministicSource.includes('preserveDrawingBuffer'));
    if (playwrightCli && serverReady) {
      const outputDirectory = mkdtempSync(join(LAB_ROOT, '.tmp-deterministic-'));
      try {
        const screenshots = [];
        for (let index = 0; index < 2; index += 1) {
          const outputPath = join(outputDirectory, `run-${index + 1}.png`);
          const screenshot = await labScreenshot(
            playwrightCli,
            baseUrl,
            'deterministic-capture',
            outputPath,
            'WDU_DETERMINISTIC=1',
          );
          if (screenshot) screenshots.push(screenshot);
        }
        if (screenshots.length === 2) {
          const hashes = screenshots.map((file) => createHash('sha256').update(readFileSync(file)).digest('hex'));
          check('two deterministic browser captures have identical PNG hashes', hashes[0] === hashes[1], hashes.join(' vs '));
        } else {
          check('two deterministic browser captures have identical PNG hashes', 'UNAVAILABLE', 'one or more screenshots could not be captured');
        }
      } finally {
        rmSync(outputDirectory, { force: true, recursive: true });
      }
    } else {
      check('two deterministic browser captures have identical PNG hashes', 'UNAVAILABLE', playwrightCli ? 'Vite server unavailable' : 'WDU_PLAYWRIGHT_CLI is not configured');
    }

    console.log('\n═══ 5. Edit-to-update latency ═══');
    if (!serverReady) {
      check('shader edit-to-update completes under 1s', 'UNAVAILABLE', 'Vite server unavailable');
    } else {
      const shaderPath = join(LAB_ROOT, 'src/experiments/shader-fullscreen.frag');
      const shaderUrl = `${baseUrl}/src/experiments/shader-fullscreen.frag?raw`;
      const baseline = await fetchModule(shaderUrl);
      if (!baseline) {
        check('shader edit-to-update completes under 1s', 'UNAVAILABLE', 'baseline shader module could not be fetched');
      } else {
        const original = readFileSync(shaderPath, 'utf8');
        const marker = `// edit-to-update-${randomBytes(4).readUInt32LE(0)}\n`;
        let updated = false;
        let elapsedMs = 0;
        try {
          writeFileSync(shaderPath, `${original}${marker}`, 'utf8');
          const started = Date.now();
          for (let attempt = 0; attempt < 50; attempt += 1) {
            const body = await fetchModule(shaderUrl);
            if (body?.includes(marker)) {
              elapsedMs = Date.now() - started;
              updated = true;
              break;
            }
            await sleep(50);
          }
        } finally {
          writeFileSync(shaderPath, original, 'utf8');
        }
        check('shader edit-to-update completes under 1s', updated && elapsedMs < 1_000, `measured ${elapsedMs}ms`);
      }
    }
  } finally {
    await stopServer(serverProcess);
  }

  console.log('\n═══ Summary ═══');
  console.log(`  failures: ${failures}`);
  console.log(`  unavailable: ${unavailable}`);
  for (const entry of readdirSync(LAB_ROOT)) {
    if (entry.startsWith('.tmp-deterministic-')) {
      rmSync(join(LAB_ROOT, entry), { force: true, recursive: true });
    }
  }
  if (failures > 0) {
    console.log(`\n  ${FAIL}  Some checks failed.`);
    process.exitCode = 1;
  } else if (unavailable > 0) {
    console.log(`\n  ${UNAVAIL}  Required browser evidence is unavailable.`);
    process.exitCode = 2;
  } else {
    console.log(`\n  ${PASS}  All checks pass.`);
  }
}

main().catch((error) => {
  console.error(`\n${FAIL}  verify-lab crashed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
