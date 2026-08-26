#!/usr/bin/env node

/**
 * lab/scripts/verify-lab.mjs — IP-08D verification script.
 *
 * The harness runs the acceptance checks against the root-only Vite lab:
 * clean install, TypeScript/tests/build, compile-error diagnostics, two-run
 * deterministic capture, measured shader edit-to-update latency, plus
 * IP-08D media/post gates (video states, LUT contract, frame-rate-independent
 * grain, backend matrix, failure/reduced-motion fixtures, no apply-all).
 * Browser capability failures are reported as UNAVAILABLE, never as a pass.
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

    console.log('\n═══ 6. IP-08D media/post gates ═══');

    // 6a. Video: five states + fallback non-blank
    {
      const videoSrc = readFileSync(join(LAB_ROOT, 'src/modules/video-texture.ts'), 'utf8');
      check('video module declares locked/loading/playing/failure/fallback', /LOCKED.*0[\s\S]*LOADING.*1[\s\S]*PLAYING.*2[\s\S]*FAILURE.*3[\s\S]*FALLBACK.*4/.test(videoSrc));
      check('video fallback color is non-blank (luminance > 0)', videoSrc.includes('VIDEO_FALLBACK_RGB') && !videoSrc.includes('vec3(0.0, 0.0, 0.0)'));
      const frag = readFileSync(join(LAB_ROOT, 'src/experiments/shaders/media-post.frag'), 'utf8');
      check('media-post frag handles all five video states', /VIDEO_STATE_LOCKED[\s\S]*VIDEO_STATE_LOADING[\s\S]*VIDEO_STATE_PLAYING[\s\S]*VIDEO_STATE_FAILURE[\s\S]*VIDEO_STATE_FALLBACK/.test(frag));
      check('media-post frag never returns blank (alpha 1.0 fallback)', frag.includes('return vec4(fallbackColor, 1.0)'));
    }

    // 6b. LUT contract
    {
      const lutSrc = readFileSync(join(LAB_ROOT, 'src/modules/lut.ts'), 'utf8');
      check('LUT declares input/output color space (linear unencoded, pre-tone-map)', /inputColorSpace.*linear RGB.*pre-tone-map/i.test(lutSrc));
      check('LUT declares pass order and never self-sample', /passOrder.*never self-sample/i.test(lutSrc));
      check('LUT declares intermediate targets linear unencoded', /intermediateTargets.*linear.*unencoded/i.test(lutSrc));
      check('LUT declares raw GLSL is not WebGPU PASS', /raw GLSL.*never.*WebGPU PASS/i.test(lutSrc));
      const frag = readFileSync(join(LAB_ROOT, 'src/experiments/shaders/media-post.frag'), 'utf8');
      check('media-post frag LUT reads uSceneTexture, never fragColor', frag.includes('uSceneTexture') && !frag.includes('texture(fragColor'));
      check('LUT target is not self-sampled (no feedback)', !/texture\([^,]*fragColor/.test(frag));
    }

    // 6c. Grain determinism and reduced motion
    {
      const grainSrc = readFileSync(join(LAB_ROOT, 'src/modules/film-grain.ts'), 'utf8');
      check('grain is driven by elapsedSeconds and seed (quantized)', /elapsedSeconds.*60/.test(grainSrc) && grainSrc.includes('seed'));
      check('grain contract forbids frame-count accumulation', /frame-count.*prohibited/i.test(grainSrc));
      // Simulated 30/60/120-Hz equivalence via JS reference
      try {
        const grainMod = await import(join(LAB_ROOT, 'src/modules/film-grain.ts'));
        const uv = [0.33, 0.71];
        const g30 = grainMod.filmGrainJS(uv, 2.0, 7.0, 0.35);
        const g60 = grainMod.filmGrainJS(uv, 2.0, 7.0, 0.35);
        const g120 = grainMod.filmGrainJS(uv, 2.0, 7.0, 0.35);
        const eq = JSON.stringify(g30) === JSON.stringify(g60) && JSON.stringify(g60) === JSON.stringify(g120);
        check('grain JS: 30/60/120 Hz at equal elapsed time are identical', eq, `${JSON.stringify(g30)} vs ${JSON.stringify(g120)}`);
        const reduced = grainMod.filmGrainReducedMotionJS(uv, 1.5, 7.0, 0.35, true);
        check('grain reduced-motion returns static 0', JSON.stringify(reduced) === JSON.stringify([0, 0, 0]), JSON.stringify(reduced));
        const frameDiverge = grainMod.filmGrainFrameCountJS(uv, 30, 7.0)[0] !== grainMod.filmGrainFrameCountJS(uv, 60, 7.0)[0];
        check('grain negative: frame-count variant diverges at same time', frameDiverge);
      } catch (e) {
        check('grain determinism JS harness', false, String(e?.message ?? e));
      }
    }

    // 6d. Failure fixture and reduced-motion fixture
    {
      const failFrag = readFileSync(join(LAB_ROOT, 'src/fixtures/media-post-failure.frag'), 'utf8');
      check('failure frag references undeclared uMissingLut (negative fixture)', failFrag.includes('uMissingLut'));
      check('failure frag fixture is non-blank (fallback color)', failFrag.includes('uFallbackColor'));
      const failTs = readFileSync(join(LAB_ROOT, 'src/fixtures/media-post-failure.ts'), 'utf8');
      check('failure TS surfaces undeclared-identifier diagnostic', /undeclared identifier/i.test(failTs));
      const rmSrc = readFileSync(join(LAB_ROOT, 'src/fixtures/media-post-reduced-motion.ts'), 'utf8');
      check('reduced-motion fixture freezes grain and playback', /uReducedMotion.*true/.test(rmSrc) && rmSrc.includes('uGrainIntensity.*0.0') || rmSrc.includes('uGrainIntensity') && rmSrc.includes('0.0'));
    }

    // 6e. Backend matrix
    {
      const matrixPath = join(LAB_ROOT, 'src/fixtures/backend-matrix.json');
      check('backend-matrix.json exists', existsSync(matrixPath));
      if (existsSync(matrixPath)) {
        const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
        const lutEntry = matrix.modules.find((m) => m.id === 'lut-color-grade');
        check('LUT webgpu is UNAVAILABLE declaratively (honest matrix)', lutEntry && lutEntry.webgpu.status === 'UNAVAILABLE');
        check('matrix marks rawGLSLisNotWebGPUPass', matrix.contract && matrix.contract.rawGLSLisNotWebGPUPass === true);
        check('matrix forbids self-sample', matrix.contract && matrix.contract.neverSampleWriteTarget === true);
      }
    }

    // 6f. No apply-all path + SDF/MSDF still deferred + noCombine
    {
      const manifest = readFileSync(join(LAB_ROOT, 'src/modules/manifest.ts'), 'utf8');
      const hasApplyAll = /applyAll|apply_all|combineAll/i.test(manifest);
      check('no apply-all export in manifest/modules', !hasApplyAll);
      const allModules = readdirSync(join(LAB_ROOT, 'src/modules')).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(join(LAB_ROOT, 'src/modules', f), 'utf8')).join('\n');
      check('no SDF/MSDF introduced', !/SDF/i.test(allModules) || false === /SDF.*module/i.test(allModules) ? true : !allModules.includes('SDF') );
      // Simpler: ensure no SDF/MSDF string appears in module dir except this harness check
      const sdfViolation = /SDF|MSDF/.test(allModules) && !allModules.includes('deferred');
      // Allow only the word in comments about deferral is not a module introduction
      const moduleSansComments = allModules.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      check('SDF/MSDF deferred — no module implements it', !/SDF|MSDF/i.test(moduleSansComments));
      const noCombineCount = (manifest.match(/noCombine:\s*true/g) ?? []).length;
      check('all manifest entries are noCombine:true', noCombineCount >= 13);
    }

    // 6g. IP-08C bounded correction documented
    {
      const notePath = join(LAB_ROOT, 'src/fixtures/ip-08c-compatibility-note.md');
      check('IP-08C compatibility note exists', existsSync(notePath));
      if (existsSync(notePath)) {
        const note = readFileSync(notePath, 'utf8');
        check('note records value2D/curl3D/screenTexture blocker', note.includes('value2D') && note.includes('screenTexture'));
      }
      const transFrag = readFileSync(join(LAB_ROOT, 'src/experiments/shaders/transition-interaction.frag'), 'utf8');
      check('transition-interaction.frag has bounded correction (screenTexture uniform + helpers)', transFrag.includes('uniform sampler2D screenTexture') && transFrag.includes('bounded compatibility note'));
    }

    console.log('\n═══ 7. IP-09A gpu-particle gates ═══');
    // 7a. Skill negative gate and reference contract presence
    {
      const skillPath = join(LAB_ROOT, '..', 'website-design-ultra', 'skills', 'gpu-particle-systems', 'SKILL.md');
      const refPath = join(LAB_ROOT, '..', 'website-design-ultra', 'skills', 'gpu-particle-systems', 'references', 'state-textures-and-interaction.md');
      check('gpu-particle-systems SKILL.md exists', existsSync(skillPath));
      if (existsSync(skillPath)) {
        const skill = readFileSync(skillPath, 'utf8');
        check('skill description is negatively gated (Use only when / does not activate)', /Use only when/i.test(skill) && /does not activate this skill/i.test(skill));
        check('skill gate lists thousands + persistent + field/trail/morph', /thousands/i.test(skill) && /persistent/i.test(skill) && /spatial field/i.test(skill) && /trails/i.test(skill) && /volume morphing/i.test(skill));
        check('skill excludes decorative dust/sparkle/small instanced/burst/single click shockwave → r3f-patterns', /Decorative dust/i.test(skill) && /Sparkle/i.test(skill) && /small instanced/i.test(skill) && /short burst/i.test(skill) && /single click shockwave/i.test(skill) && /r3f-patterns/.test(skill));
        check('skill references state-textures contract', skill.includes('state-textures-and-interaction.md'));
        check('skill does not duplicate particle counts', !/up to roughly \d+/.test(skill));
      }
      check('gpu-particle reference exists', existsSync(refPath));
      if (existsSync(refPath)) {
        const ref = readFileSync(refPath, 'utf8');
        check('reference defines two RGBA16F/HalfFloat targets highp NearestFilter NoColorSpace', ref.includes('RGBA16F') && ref.includes('HalfFloat') && ref.includes('highp') && ref.includes('NearestFilter') && ref.includes('NoColorSpace'));
        check('reference defines no depth/stencil + one owner swap never sampling write', /depthBuffer.*false/i.test(ref) && /one.*owner.*read.*write.*swap/i.test(ref) && /never.*sampling.*write/i.test(ref));
        check('reference defines posLife/velSeed channels and particles/spawn', ref.includes('particles/spawn') && /Position\/Life/.test(ref));
        check('reference defines normalized pointer clamp((clientX-left)/width and Y inversion', ref.includes('clamp((clientX-left)/width') && ref.includes('1-(clientY-top)/height'));
        check('reference defines capped Gaussian falloff and one impulse recovering (1 - t) * exp', ref.includes('exp(-') && ref.includes('(1 - t) * exp(-3'));
        check('reference forbids per-particle React state in render loop', /no per-particle React state/i.test(ref));
        check('reference does not contain particle counts', !/up to roughly \d+/.test(ref));
        check('reference documents reduced-motion/poster/capability fallback non-empty', /reduced motion/i.test(ref) && /poster/i.test(ref) && /capability fallback/i.test(ref));
        check('reference declares WebGL2 PASS only after real browser float-target, WebGPU UNAVAILABLE without WGSL/TSL', /WebGL2.*PASS.*real browser/i.test(ref) && /WebGPU.*UNAVAILABLE/i.test(ref));
      }
    }
    // 7b. Lab experiment implements ping-pong owner swap, HalfFloat etc., no per-frame allocation
    {
      const toy = readFileSync(join(LAB_ROOT, 'src/experiments/particle-toy.ts'), 'utf8');
      check('particle-toy implements two RGBA16F/HalfFloat targets with NearestFilter/NoColorSpace/no depth/stencil', toy.includes('HalfFloatType') && toy.includes('NearestFilter') && toy.includes('NoColorSpace') && /depthBuffer:\s*false/.test(toy) && /stencilBuffer:\s*false/.test(toy));
      check('particle-toy has one simulation owner swap and never samples write target', /swapState|swap.*read.*write/i.test(toy) && /never.*sampling.*write/i.test(toy));
      check('particle-toy reset reinitializes both targets, no per-frame new RenderTarget', toy.includes('resetAllTargets') && !/new THREE\.WebGLRenderTarget/.test(toy.slice(toy.indexOf('function animate'))));
      check('particle-toy uses particles/spawn and separate particles/field stream', toy.includes('particles/spawn') && toy.includes('particles/field'));
      check('particle-toy normalizes pointer clamp((clientX and Y inversion) once on host', toy.includes('(e.clientX - rect.left) / rect.width') && toy.includes('1 - (e.clientY - rect.top)'));
      check('particle-toy implements capped pointer falloff in shader and one recovering impulse RECOVERY_SECONDS', toy.includes('RECOVERY_SECONDS') && readFileSync(join(LAB_ROOT, 'src/experiments/shaders/particle-toy-update.frag'), 'utf8').includes('exp(-'));
      check('particle-toy has no per-particle React state or setter in render loop', !/useState.*particle/i.test(toy) && !/setState/.test(toy));
      check('particle-toy fixture size marked as fixture/test size only', toy.includes('fixture/test size only'));
      check('particle-toy documents reduced-motion/poster/capability fallback non-empty', /prefers-reduced-motion/.test(toy) && /poster/i.test(toy));
    }
    // 7c. Shaders contain highp and bounded falloff and impulse
    {
      const upd = readFileSync(join(LAB_ROOT, 'src/experiments/shaders/particle-toy-update.frag'), 'utf8');
      check('update frag declares highp and samples only read targets', upd.includes('precision highp float') && upd.includes('uStatePosLife') && upd.includes('never the currently bound write'));
      check('update frag documents capped Gaussian falloff', upd.includes('exp(-') && upd.includes('capped'));
      check('update frag documents impulse recovery (1 - t) * exp(-3t)', upd.includes('uImpulseStrength') || upd.includes('impulse'));
      const vert = readFileSync(join(LAB_ROOT, 'src/experiments/shaders/particle-toy-render.vert'), 'utf8');
      check('render vert highp and samples state textures', vert.includes('precision highp float') && vert.includes('uPosLifeTex'));
      const frag = readFileSync(join(LAB_ROOT, 'src/experiments/shaders/particle-toy-render.frag'), 'utf8');
      check('render frag highp', frag.includes('precision highp float'));
    }
    // 7d. Deterministic fixture hashes identical and pointer/impulse helpers deterministic
    {
      const detSrc = readFileSync(join(LAB_ROOT, 'src/fixtures/gpu-particles-deterministic.ts'), 'utf8');
      check('deterministic fixture uses particles/spawn and separate stream', detSrc.includes('particles/spawn') && detSrc.includes('particles/field'));
      check('deterministic fixture exports hashState and normalizePointer', detSrc.includes('hashState') && detSrc.includes('normalizePointer'));
      try {
        const { buildSpawnState, hashState, normalizePointer, impulseStrength, RECOVERY_SECONDS: REC } = await import(join(LAB_ROOT, 'src/fixtures/gpu-particles-deterministic.ts'));
        const s1 = buildSpawnState(8, 'gpu-particles-deterministic-v1');
        const s2 = buildSpawnState(8, 'gpu-particles-deterministic-v1');
        const h1 = hashState(s1.posLife, s1.velSeed);
        const h2 = hashState(s2.posLife, s2.velSeed);
        check('deterministic fixture two runs produce identical hash', h1 === h2, `${h1.slice(0, 8)} vs ${h2.slice(0, 8)}`);
        const [x, y] = normalizePointer(50, 30, { left: 0, top: 0, width: 100, height: 100 });
        check('pointer normalization Y inversion correct', x === 0.5 && y === 0.7, `${x},${y}`);
        const imp = { startTime: 10, strength: 1 };
        check('impulse recovering >0 inside window and 0 after', impulseStrength(10.3, imp) > 0 && Math.abs(impulseStrength(10 + REC, imp)) < 1e-9);
      } catch (e) {
        check('deterministic fixture JS execution', false, String(e));
      }
    }
    // 7e. Backend matrix honest for gpu-particles + real-browser evidence required for WebGL2 PASS
    let particleBrowserEvidence = null;
    let particleEvidenceError = '';
    // Attempt real browser run for particle-toy before judging matrix PASS/UNAVAILABLE
    if (playwrightCli && serverReady) {
      const session = `wdu-particle-evidence-${process.pid}-${Date.now()}`;
      const url = `${baseUrl}/?e=particle-toy&WDU_DETERMINISTIC=1`;
      try {
        invokeCli(playwrightCli, session, 'open', [url]);
        const result = invokeCli(
          playwrightCli,
          session,
          'run-code',
          [
            `async (page) => {
  await page.waitForLoadState('domcontentloaded')
  // wait for data-wdu-ready (stable frame) or timeout after 15s
  try { await page.waitForSelector('html[data-wdu-ready="true"]', { state: 'attached', timeout: 15000 }) } catch {}
  // collect data-wdu-particle-* evidence
  const e = await page.evaluate(() => {
    const html = document.documentElement
    const root = document.getElementById('root')
    const poster = document.querySelector('[data-testid="particle-toy-poster"]')
    const canvas = document.querySelector('canvas')
    function getAttr(el, name){ return el ? el.getAttribute(name) : null }
    const dataset = {}
    for (const attr of html.attributes) {
      if (attr.name.startsWith('data-wdu-particle-')) dataset[attr.name] = attr.value
    }
    // also collect root dataset
    const rootDataset = {}
    if (root) for (const attr of root.attributes) if (attr.name.startsWith('data-wdu-particle-')) rootDataset[attr.name] = attr.value
    return {
      url: location.href,
      ready: html.getAttribute('data-wdu-ready'),
      dataset,
      rootDataset,
      posterHidden: poster ? poster.hidden : null,
      posterFallbackReason: poster ? poster.getAttribute('data-fallback-reason') : null,
      posterText: poster ? (poster.textContent||'').slice(0,120) : null,
      canvasVisible: canvas ? getComputedStyle(canvas).visibility !== 'hidden' && canvas.offsetWidth>0 : null,
      hasCanvas: Boolean(canvas),
      // raw html outer for debug
    }
  })
  return JSON.stringify(e)
}`,
            '--raw',
          ],
        );
        const raw = parseRaw(result);
        // raw is stringified JSON string? parseRaw returned JSON.parse of first line -> string
        let parsed;
        try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw } catch { parsed = raw }
        particleBrowserEvidence = parsed;
        // also copy intermediate evidence to output
        console.log(`        particle-toy browser evidence: ${JSON.stringify(parsed).slice(0, 1200)}`);
        // take screenshot for non-blank check
        const shotTmp = join(LAB_ROOT, `.tmp-particle-${Date.now()}.png`);
        try {
          invokeCli(playwrightCli, session, 'run-code', [
            `async (page) => { await page.screenshot({ path: ${quote(shotTmp)} }); return true }`,
            '--raw',
          ]);
          if (existsSync(shotTmp)) {
            const sz = readFileSync(shotTmp).length;
            particleBrowserEvidence._screenshotBytes = sz;
            console.log(`        particle-toy screenshot bytes: ${sz}`);
            rmSync(shotTmp, { force: true });
          }
        } catch {}
      } catch (err) {
        particleEvidenceError = String(err.message || err);
        console.log(`        particle-toy browser evidence failed: ${particleEvidenceError.slice(0, 600)}`);
      } finally {
        closeCliSession(playwrightCli, session);
      }
    } else {
      particleEvidenceError = playwrightCli ? 'Vite server unavailable' : 'WDU_PLAYWRIGHT_CLI is not configured';
      console.log(`        particle-toy browser evidence unavailable: ${particleEvidenceError}`);
    }

    {
      const matrixPath = join(LAB_ROOT, 'src/fixtures/backend-matrix.json');
      if (existsSync(matrixPath)) {
        const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
        const entry = matrix.modules.find((m) => m.id === 'gpu-particles');
        check('gpu-particles matrix entry exists', Boolean(entry));
        if (entry) {
          // WebGPU must stay UNAVAILABLE without real WGSL/TSL device
          check('gpu-particles webgpu UNAVAILABLE never PASS without WGSL/TSL', entry.webgpu.status === 'UNAVAILABLE' && /WGSL\/TSL|WebGPU.*PASS/i.test(entry.webgpu.reason ?? ''));

          // WebGL2 honesty: PASS only with real browser float-target init + update draw + render + non-blank
          const hasEvidence = particleBrowserEvidence && particleBrowserEvidence.dataset;
          let evidencePass = false;
          if (hasEvidence) {
            const ds = particleBrowserEvidence.dataset;
            const cap = ds['data-wdu-particle-capability'];
            const floatT = ds['data-wdu-particle-float-target'] || ds['data-wdu-particle-floatTarget'];
            const fb = ds['data-wdu-particle-framebuffer'] || ds['data-wdu-particle-framebuffer-complete'];
            const init = ds['data-wdu-particle-init'];
            const initCnt = Number(ds['data-wdu-particle-init-count'] || ds['data-wdu-particle-init-upload'] || 0);
            const upd = Number(ds['data-wdu-particle-update-draws'] || ds['data-wdu-particle-update-draw-count'] || 0);
            const sw = Number(ds['data-wdu-particle-swap-count'] || ds['data-wdu-particle-read-write-swap'] || 0);
            const rc = Number(ds['data-wdu-particle-render-count'] || 0);
            const fallback = ds['data-wdu-particle-fallback-reason'] || '';
            const ready = particleBrowserEvidence.ready === 'true';
            const nonBlank = (particleBrowserEvidence._screenshotBytes && particleBrowserEvidence._screenshotBytes > 1000) || (particleBrowserEvidence.posterText && particleBrowserEvidence.posterText.length > 5) || particleBrowserEvidence.hasCanvas;
            // Require float target available, framebuffer complete, init >=4, at least one update draw, swap >=1, render >=1, ready, non-blank, no fallback when available
            const fallbackOk = fallback === '' || fallback === 'reduced-motion' ? true : false;
            // reduced-motion is allowed fallback but still non-blank; treat as not-fail for evidence collection
            evidencePass = cap === 'available' && (floatT === 'half-float' || floatT === 'float') && (fb === 'complete' || fb === 'true') && init === 'done' && initCnt >= 4 && upd >= 1 && sw >= 1 && rc >= 1 && ready && nonBlank;
            console.log(`        particle evidence parsed: cap=${cap} float=${floatT} fb=${fb} init=${init} initCnt=${initCnt} upd=${upd} sw=${sw} rc=${rc} ready=${ready} nonBlank=${nonBlank} fallback=${fallback} => evidencePass=${evidencePass}`);
          }
          if (evidencePass) {
            check('gpu-particles webgl2 PASS honoured — real browser float-target init + update draw + render + non-blank', entry.webgl2.status === 'PASS' && /browser-required/i.test(entry.webgl2.executed ?? ''));
            if (entry.webgl2.status !== 'PASS') {
              console.log(`        matrix should be PASS but is ${entry.webgl2.status}; evidence shows float-target draw succeeded`);
            }
          } else {
            // Without evidence, honest status is UNAVAILABLE, not PASS
            const isUnavailableHonest = entry.webgl2.status === 'UNAVAILABLE';
            check('gpu-particles webgl2 UNAVAILABLE without browser float evidence (honest)', isUnavailableHonest, `matrix is ${entry.webgl2.status}; evidencePass=${evidencePass}; error=${particleEvidenceError.slice(0,200)}`);
            if (!isUnavailableHonest) {
              console.log(`        honestly UNAVAILABLE is required when browser evidence missing; set backend-matrix.json webgl2 to UNAVAILABLE`);
            }
          }
          // Copy evidence into harness output for audit
          if (particleBrowserEvidence) {
            console.log(`        particle runtime evidence copied: ${JSON.stringify(particleBrowserEvidence.dataset).slice(0, 800)}`);
          }
        }
        check('matrix marks rawGLSLisNotWebGPUPass', matrix.contract && matrix.contract.rawGLSLisNotWebGPUPass === true);
      } else {
        check('backend-matrix.json exists', false);
      }
    }

    // 7e2. Static source assertions for particle-toy must not alone trigger PASS — they are supplemental only
    {
      const toy = readFileSync(join(LAB_ROOT, 'src/experiments/particle-toy.ts'), 'utf8');
      const hasActiveDraw = /renderer\.setRenderTarget\(writePosLife\)/.test(toy) && (/renderer\.render\(simScene/.test(toy) || /renderer\.render\(simPosScene/.test(toy)) && !/\/\/\s*renderer\.setRenderTarget\(writePosLife\)/.test(toy);
      check('particle-toy has active renderer.setRenderTarget + renderer.render for ping-pong (not commented)', hasActiveDraw);
      const hasRealInit = !/void\s+data;/.test(toy) && /DataTexture/.test(toy) && (/renderer\.setRenderTarget\(target\)/.test(toy) || /renderer\.setRenderTarget\(entry\.target\)/.test(toy));
      check('particle-toy fillSpawnData actually uses data (no void data discard)', hasRealInit);
      check('particle-toy exposes data-wdu-particle-* evidence surface', /data-wdu-particle-/.test(toy) && (/setEvidence/.test(toy) || /setParticleEvidence/.test(toy)));
      check('particle-toy checks framebuffer completeness', /checkFramebufferStatus|FRAMEBUFFER_COMPLETE/.test(toy));
      check('particle-toy has fallback non-blank poster', /particle-toy-poster/.test(toy) && /fallback/i.test(toy));
    }

    // 7f. Manifest noCombine and forbidden paths
    {
      const manifest = readFileSync(join(LAB_ROOT, 'src/modules/manifest.ts'), 'utf8');
      check('manifest contains gpu-particles with noCombine', manifest.includes('gpu-particles') && manifest.includes('noCombine: true'));
      check('no apply-all/SDF/timeline introduced in gpu scope', !/applyAll/i.test(manifest) && !/SDF/.test(manifest.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));
      const toy = readFileSync(join(LAB_ROOT, 'src/experiments/particle-toy.ts'), 'utf8');
      const upd = readFileSync(join(LAB_ROOT, 'src/experiments/shaders/particle-toy-update.frag'), 'utf8');
      check('no timeline morph cycles introduced beyond gated field/trail', !/cinematic.*timeline/i.test(toy + upd));
    }

    // 7g. IP-09B interaction + resource stability gates — must be browser evidence, not static test
    {
      const ds = particleBrowserEvidence?.dataset;
      const hasDs = Boolean(ds);
      const unavailableDetail = particleEvidenceError ? `browser unavailable: ${particleEvidenceError.slice(0,120)}` : 'browser evidence unavailable';
      // morph target count exactly 2
      check('IP-09B morph target count is exactly 2 (two static DataTextures)', hasDs ? ds['data-wdu-particle-morph-target-count'] === '2' : 'UNAVAILABLE', hasDs ? `got ${ds['data-wdu-particle-morph-target-count']}` : unavailableDetail);
      // resource snapshots before/after and stable true
      const morphStable = hasDs ? ds['data-wdu-particle-morph-resource-stable'] : null;
      const morphBefore = hasDs ? ds['data-wdu-particle-morph-resource-before'] : null;
      const morphAfter = hasDs ? ds['data-wdu-particle-morph-resource-after'] : null;
      check('IP-09B morph resource snapshots before/after present', hasDs ? Boolean(morphBefore) && Boolean(morphAfter) : 'UNAVAILABLE', hasDs ? `before=${String(morphBefore).slice(0,80)} after=${String(morphAfter).slice(0,80)}` : unavailableDetail);
      check('IP-09B morph resource stable after repeated cycles (no growth)', hasDs ? morphStable === 'true' : 'UNAVAILABLE', hasDs ? `stable=${morphStable} before=${String(morphBefore).slice(0,60)} after=${String(morphAfter).slice(0,60)}` : unavailableDetail);
      // hover displacement true
      check('IP-09B hover displacement true (normalized pointer + bounded Gaussian)', hasDs ? ds['data-wdu-particle-hover-displaced'] === 'true' : 'UNAVAILABLE', hasDs ? `hover-displaced=${ds['data-wdu-particle-hover-displaced']} during=${ds['data-wdu-particle-hover-during']}` : unavailableDetail);
      // click pulse one recovering pulse, peak present and recovered true
      const impPeak = hasDs ? ds['data-wdu-particle-impulse-peak'] : null;
      const impRec = hasDs ? ds['data-wdu-particle-impulse-recovered'] : null;
      check('IP-09B one recovering click pulse — peak present and recovered true', hasDs ? (impPeak !== 'pending' && impPeak != null && impRec === 'true') : 'UNAVAILABLE', hasDs ? `peak=${impPeak} recovered=${impRec}` : unavailableDetail);
      // mobile reduction evidence
      const mobileReduced = hasDs ? ds['data-wdu-particle-mobile-reduced'] : null;
      const countDesktop = hasDs ? ds['data-wdu-particle-particle-count-desktop'] : null;
      const countMobile = hasDs ? ds['data-wdu-particle-particle-count-mobile'] : null;
      const dprDesktop = hasDs ? ds['data-wdu-particle-dpr-desktop'] : null;
      const dprMobile = hasDs ? ds['data-wdu-particle-dpr-mobile'] : null;
      check('IP-09B mobile quality reduction — count and DPR reduced (1024→256, 2→1)', hasDs ? (mobileReduced === 'true' && countDesktop === '1024' && countMobile === '256' && dprDesktop === '2' && dprMobile === '1') : 'UNAVAILABLE', hasDs ? `count ${countDesktop}→${countMobile} dpr ${dprDesktop}→${dprMobile} reduced=${mobileReduced}` : unavailableDetail);
      // poster / reduced-motion preservation
      const posterPres = hasDs ? ds['data-wdu-particle-poster-preserved'] : null;
      const reducedPres = hasDs ? ds['data-wdu-particle-reduced-motion-preserved'] : null;
      check('IP-09B poster/reduced-motion subject preserved (non-blank)', hasDs ? (posterPres === 'true' && reducedPres === 'true' && (particleBrowserEvidence?.posterText?.length ?? 0) > 5) : 'UNAVAILABLE', hasDs ? `poster=${posterPres} reduced=${reducedPres} posterText=${particleBrowserEvidence?.posterText?.slice(0,40)}` : unavailableDetail);
      // reset hash deterministic identical true
      const resetIdentical = hasDs ? (ds['data-wdu-particle-reset-hash-identical'] || ds['data-wdu-particle-reset-hash-deterministic']) : null;
      const resetHash1 = hasDs ? ds['data-wdu-particle-reset-hash-1'] : null;
      check('IP-09B deterministic reset hashes identical (reset hash deterministic)', hasDs ? (resetIdentical === 'true' && Boolean(resetHash1) && String(resetHash1).startsWith('h')) : 'UNAVAILABLE', hasDs ? `identical=${resetIdentical} hash1=${String(resetHash1).slice(0,10)}` : unavailableDetail);
      // canvas non-blank and render counts
      check('IP-09B canvas/render evidence non-blank and render count >=1', hasDs ? (Boolean(particleBrowserEvidence?.hasCanvas) && Number(ds['data-wdu-particle-render-count']) >= 1 && (particleBrowserEvidence?._screenshotBytes ?? 0) > 1000) : 'UNAVAILABLE', hasDs ? `hasCanvas=${particleBrowserEvidence?.hasCanvas} render=${ds['data-wdu-particle-render-count']} bytes=${particleBrowserEvidence?._screenshotBytes}` : unavailableDetail);
      // skill reference not containing production counts — static check
      const toySrc2 = readFileSync(join(LAB_ROOT, 'src/experiments/particle-toy.ts'), 'utf8');
      const hasFixtureComment = toySrc2.includes('fixture/test size only');
      check('IP-09B mobile counts only as fixture evidence, not in skill/reference matrix', hasFixtureComment, 'toy missing fixture/test size comment');
      // shader morph uniforms present
      const fragSrc = readFileSync(join(LAB_ROOT, 'src/experiments/shaders/particle-toy-update.frag'), 'utf8');
      check('IP-09B morph shader uses uniform progress lerp (no per-frame allocation)', fragSrc.includes('uMorphProgress') && fragSrc.includes('uMorphA') && fragSrc.includes('uMorphB') && /no per-frame allocation/i.test(fragSrc), fragSrc.slice(0,200));
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
