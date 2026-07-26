#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function fail(message, exitCode = 1) {
  console.error(`VERIFY_RUNTIME: ${exitCode === 2 ? 'UNAVAILABLE' : 'FAIL'} ${message}`)
  process.exit(exitCode)
}

function parseArguments(argv) {
  const options = {
    url: null,
    out: null,
    probe: false,
    includeFallback: true,
    timeoutMs: 120000,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--url') {
      options.url = argv[index + 1]
      index += 1
    } else if (argument === '--out') {
      options.out = path.resolve(argv[index + 1])
      index += 1
    } else if (argument === '--probe') {
      options.probe = true
    } else if (argument === '--skip-fallback') {
      options.includeFallback = false
    } else if (argument === '--timeout-ms') {
      options.timeoutMs = Number.parseInt(argv[index + 1], 10)
      index += 1
    } else if (argument === '--help') {
      console.log(`Usage:
  node scripts/verify-browser.mjs --probe
  node scripts/verify-browser.mjs --url http://127.0.0.1:3000
                                  [--out /absolute/output/directory]
                                  [--skip-fallback]
                                  [--timeout-ms 120000]

Exit codes: 0 = capture complete, 1 = capture failed, 2 = compatible
browser automation unavailable. Set WDU_PLAYWRIGHT_CLI to an explicit executable
to override discovery.`)
      process.exit(0)
    } else {
      fail(`unknown argument "${argument}"`)
    }
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 10000) {
    fail('--timeout-ms must be an integer of at least 10000')
  }
  if (!options.probe && !options.url) fail('--url is required unless --probe is used')
  if (options.url && !/^https?:\/\//.test(options.url)) {
    fail('--url must start with http:// or https://')
  }
  return options
}

function commandOnPath(command) {
  const lookup = spawnSync('sh', ['-lc', `command -v "${command}"`], {
    encoding: 'utf8',
  })
  return lookup.status === 0 ? lookup.stdout.trim() : null
}

function candidates() {
  const result = []
  const explicit = process.env.WDU_PLAYWRIGHT_CLI
  if (explicit) result.push({ name: 'explicit', command: explicit, prefix: [] })

  const codexHome = process.env.CODEX_HOME
  if (codexHome) {
    result.push({
      name: 'codex-wrapper',
      command: path.join(codexHome, 'skills', 'playwright', 'scripts', 'playwright_cli.sh'),
      prefix: [],
    })
  }

  const pathCli = commandOnPath('playwright-cli')
  if (pathCli) result.push({ name: 'path-cli', command: pathCli, prefix: [] })

  const npx = commandOnPath('npx')
  if (npx) {
    result.push({
      name: 'npm-cli',
      command: npx,
      prefix: ['--yes', '--package', '@playwright/cli', 'playwright-cli'],
    })
  }
  return result
}

function run(candidate, args, timeoutMs) {
  return spawnSync(candidate.command, [...candidate.prefix, ...args], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: timeoutMs,
  })
}

function resolveBackend(timeoutMs) {
  const attempts = []
  for (const candidate of candidates()) {
    if (
      candidate.name !== 'npm-cli' &&
      (!fs.existsSync(candidate.command) || !(fs.statSync(candidate.command).mode & 0o111))
    ) {
      attempts.push(`${candidate.name}: executable missing`)
      continue
    }
    const probe = run(candidate, ['--help'], timeoutMs)
    const help = `${probe.stdout ?? ''}\n${probe.stderr ?? ''}`
    if (
      !probe.error &&
      probe.status === 0 &&
      help.includes('run-code') &&
      help.includes('-s=<session>') &&
      help.includes('screenshot')
    ) {
      return { candidate, attempts }
    }
    attempts.push(
      `${candidate.name}: incompatible or failed (${probe.error?.message ?? probe.status ?? 'unknown'})`,
    )
  }
  return { candidate: null, attempts }
}

function timestamp() {
  return new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z')
}

function quoted(value) {
  return JSON.stringify(value)
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  const resolved = resolveBackend(options.timeoutMs)
  if (!resolved.candidate) {
    fail(`no compatible CLI; ${resolved.attempts.join('; ')}`, 2)
  }

  const backend = resolved.candidate
  if (options.probe) {
    console.log(`VERIFY_RUNTIME: READY backend=${backend.name}`)
    return
  }

  const outputDirectory =
    options.out ??
    path.resolve(process.cwd(), 'output', 'playwright', 'verify', timestamp())
  fs.mkdirSync(outputDirectory, { recursive: true })
  const sessions = new Set()
  const commands = []

  function invoke(session, action, ...args) {
    sessions.add(session)
    const result = run(backend, [`-s=${session}`, action, ...args], options.timeoutMs)
    commands.push({
      session,
      action,
      status: result.status,
      stdout: result.stdout?.trim(),
      stderr: result.stderr?.trim(),
    })
    if (result.error || result.status !== 0) {
      throw new Error(
        `${session}/${action}: ${result.error?.message ?? result.stderr ?? result.stdout ?? result.status}`,
      )
    }
    return result
  }

  const settle = `async (page) => {
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready
      await Promise.all([...document.images].filter((image) => !image.complete).map(
        (image) => new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true })
          image.addEventListener('error', resolve, { once: true })
        }),
      ))
    })
    await page.waitForTimeout(150)
  }`

  function captureHero(session, filename) {
    const target = path.join(outputDirectory, filename)
    invoke(
      session,
      'run-code',
      `async (page) => {
        const target = page.locator('[data-verify-3d], [data-verify-hero], canvas').first()
        if (await target.count()) await target.screenshot({ path: ${quoted(target)} })
      }`,
    )
  }

  try {
    invoke('wdu-desktop', 'open', options.url)
    invoke('wdu-desktop', 'resize', '1440', '1000')
    invoke('wdu-desktop', 'run-code', settle)
    const snapshot = invoke('wdu-desktop', 'snapshot')
    fs.writeFileSync(path.join(outputDirectory, 'desktop-snapshot.txt'), snapshot.stdout)
    invoke(
      'wdu-desktop',
      'screenshot',
      '--filename',
      path.join(outputDirectory, 'desktop-full.png'),
      '--full-page',
    )
    captureHero('wdu-desktop', 'desktop-hero.png')

    invoke('wdu-mobile', 'open', options.url)
    invoke('wdu-mobile', 'resize', '390', '844')
    invoke('wdu-mobile', 'run-code', settle)
    invoke(
      'wdu-mobile',
      'screenshot',
      '--filename',
      path.join(outputDirectory, 'mobile-full.png'),
      '--full-page',
    )
    captureHero('wdu-mobile', 'mobile-hero.png')

    invoke('wdu-reduce', 'open', options.url)
    invoke(
      'wdu-reduce',
      'run-code',
      `async (page) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.reload({ waitUntil: 'domcontentloaded' })
        ${settle.replace(/^async \(page\) => \{|\}$/g, '')}
      }`,
    )
    invoke(
      'wdu-reduce',
      'screenshot',
      '--filename',
      path.join(outputDirectory, 'reduced-motion-a.png'),
      '--full-page',
    )
    invoke('wdu-reduce', 'run-code', 'async (page) => { await page.waitForTimeout(750) }')
    invoke(
      'wdu-reduce',
      'screenshot',
      '--filename',
      path.join(outputDirectory, 'reduced-motion-b.png'),
      '--full-page',
    )

    if (options.includeFallback) {
      invoke('wdu-fallback', 'open', options.url)
      invoke(
        'wdu-fallback',
        'run-code',
        `async (page) => {
          await page.addInitScript(() => {
            try {
              Object.defineProperty(navigator, 'gpu', {
                configurable: true,
                get: () => undefined,
              })
            } catch {}
            const original = HTMLCanvasElement.prototype.getContext
            HTMLCanvasElement.prototype.getContext = function(type, ...args) {
              return ['webgpu', 'webgl', 'webgl2', 'experimental-webgl'].includes(type)
                ? null
                : original.call(this, type, ...args)
            }
          })
          await page.reload({ waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(150)
        }`,
      )
      invoke(
        'wdu-fallback',
        'screenshot',
        '--filename',
        path.join(outputDirectory, 'fallback-full.png'),
        '--full-page',
      )
      captureHero('wdu-fallback', 'fallback-hero.png')
    }

    const consoleErrors = invoke('wdu-desktop', 'console', 'error')
    fs.writeFileSync(path.join(outputDirectory, 'console-errors.txt'), consoleErrors.stdout)
    const requests = invoke('wdu-desktop', 'requests')
    fs.writeFileSync(path.join(outputDirectory, 'requests.txt'), requests.stdout)
    fs.writeFileSync(
      path.join(outputDirectory, 'capture.json'),
      `${JSON.stringify(
        {
          status: 'captured-not-yet-inspected',
          generatedAt: new Date().toISOString(),
          url: options.url,
          backend: backend.name,
          fallbackIncluded: options.includeFallback,
          outputDirectory,
          commands,
        },
        null,
        2,
      )}\n`,
    )
  } catch (error) {
    fs.writeFileSync(
      path.join(outputDirectory, 'capture-error.json'),
      `${JSON.stringify({ status: 'failed', error: error.message, commands }, null, 2)}\n`,
    )
    fail(`${error.message}; partial artifacts: ${outputDirectory}`)
  } finally {
    for (const session of sessions) {
      run(backend, [`-s=${session}`, 'close'], Math.min(options.timeoutMs, 30000))
    }
  }

  console.log(
    `VERIFY_RUNTIME: CAPTURED backend=${backend.name} artifacts=${outputDirectory}`,
  )
}

main()
