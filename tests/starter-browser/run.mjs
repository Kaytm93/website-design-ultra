#!/usr/bin/env node
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function browserExitCode(code, status, errors, timedOut = false) {
  if (timedOut) return 2
  if (code === 0 && status === 'passed' && errors.length === 0) return 0
  if (errors.length && errors.every(error => error.unavailable)) return 2
  return 1
}

export async function runBrowserTests(args = process.argv.slice(2)) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-browser-status-'))
  const statusFile = path.join(temp, 'status.json')
  const errorsFile = path.join(temp, 'errors.jsonl')
  const child = spawn(process.execPath, [path.join(root, 'node_modules/@playwright/test/cli.js'),
    'test', '--config', 'tests/starter-browser/playwright.config.mjs', ...args], {
    cwd: root, stdio: 'inherit', detached: process.platform !== 'win32',
    env: { ...process.env, WDU_BROWSER_STATUS_FILE: statusFile, WDU_BROWSER_ERRORS_FILE: errorsFile },
  })
  let timedOut = false
  // Also bound runner/browser teardown if Chromium's transport never closes.
  const timer = setTimeout(() => {
    timedOut = true
    if (process.platform === 'win32') child.kill('SIGKILL')
    else { try { process.kill(-child.pid, 'SIGKILL') } catch {} }
  }, 10 * 60_000)
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', resolve)
    })
    const status = fs.existsSync(statusFile) ? JSON.parse(fs.readFileSync(statusFile)).status : null
    const errors = fs.existsSync(errorsFile)
      ? fs.readFileSync(errorsFile, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []
    const exitCode = browserExitCode(code, status, errors, timedOut)
    console.log(`STARTER_BROWSER: ${exitCode === 0 ? 'PASS' : exitCode === 2 ? 'UNAVAILABLE' : 'FAIL'}${timedOut ? ' runner exceeded 10 minutes' : ''}`)
    return exitCode
  } finally {
    clearTimeout(timer)
    fs.rmSync(temp, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runBrowserTests().then(code => { process.exitCode = code }).catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
