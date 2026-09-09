#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const action = process.argv[2]
const surfaces = ['starters/next-r3f-cinematic', 'starters/vite-three-canvas', 'lab']
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
function run(command, args, cwd = root) {
  console.log(`\n${path.relative(root, cwd) || '.'}: ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', timeout: 15 * 60_000,
    shell: process.platform === 'win32' && command === npm })
  if (result.error) console.error(result.error.message)
  if (result.status !== 0) process.exit(result.status ?? 1)
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'fixtures', 'product-hero', 'procedural-crystal', 'ci-evidence'].includes(entry.name)) return []
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(file) : entry.name.endsWith('.test.mjs') ? [file] : []
  })
}
if (action === 'setup') {
  for (const dir of surfaces) run(npm, ['ci'], path.join(root, dir))
} else if (action === 'test' || action === 'verify') {
  run(process.execPath, ['website-design-ultra/scripts/validate-content.mjs'])
  run(process.execPath, ['website-design-ultra/scripts/run-forward-tests.mjs', '--dry-run'])
  run(process.execPath, ['--test', ...walk(path.join(root, 'tests')).sort()])
  if (action === 'verify') for (const dir of surfaces) run(npm, ['run', 'verify'], path.join(root, dir))
} else if (action === 'audit') {
  for (const dir of ['.', ...surfaces, 'tests/immersive/product-hero', 'tests/immersive/procedural-crystal']) {
    run(npm, ['audit', '--package-lock-only', '--audit-level=moderate'], path.resolve(root, dir))
  }
} else {
  console.error('Usage: node scripts/project.mjs setup|test|verify|audit')
  process.exit(1)
}
