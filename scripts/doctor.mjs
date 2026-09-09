#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const version = process.versions.node.split('.').map(Number)
const checks = [{ name: 'node', status: version[0] > 22 || (version[0] === 22 && version[1] >= 18) ? 'PASS' : 'FAIL', detail: process.version }]
for (const dir of ['starters/next-r3f-cinematic', 'starters/vite-three-canvas', 'lab']) {
  checks.push({ name: dir, status: fs.existsSync(path.join(root, dir, 'node_modules')) ? 'PASS' : 'UNAVAILABLE', detail: 'Dependencies only; use npm run verify to test execution' })
}
for (const cli of ['codex', 'claude']) {
  const result = spawnSync(cli, ['--version'], { encoding: 'utf8', timeout: 5000 })
  checks.push({ name: cli, status: result.status === 0 ? 'PASS' : 'UNAVAILABLE', detail: result.status === 0 ? result.stdout.trim() : 'Optional CLI not available on PATH; no authenticated model run performed' })
}
console.log(JSON.stringify({ scope: 'local prerequisites; no release or GPU verdict', checks }, null, 2))
process.exitCode = checks.some(check => check.status === 'FAIL') ? 1 : 0
