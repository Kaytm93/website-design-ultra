#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const choices = { next: 'next-r3f-cinematic', vanilla: 'vite-three-canvas' }
export function createProject({ starter, out }) {
  if (!Object.hasOwn(choices, starter)) throw Error('Choose --starter next or --starter vanilla')
  if (typeof out !== 'string' || !out.trim()) throw Error('--out needs a new directory path')
  const target = path.resolve(out)
  if (target === root || target.startsWith(root + path.sep)) throw Error('Choose a destination outside this repository')
  if (fs.existsSync(target)) throw Error(`Destination already exists: ${target}`)
  // Resolve the parent too: a symlink must not put generated output in the source tree.
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const realParent = fs.realpathSync(path.dirname(target))
  const realRoot = fs.realpathSync(root)
  if (realParent === realRoot || realParent.startsWith(realRoot + path.sep)) throw Error('Destination resolves inside this repository')
  const source = path.join(root, 'starters', choices[starter])
  fs.mkdirSync(target)
  try {
    fs.cpSync(source, target, { recursive: true, filter(file) {
      const parts = path.relative(source, file).split(path.sep)
      return !parts.some(part => ['node_modules', '.next', 'dist', '.git', '.playwright-cli', 'output'].includes(part))
        && !file.endsWith('.tsbuildinfo') && !path.basename(file).startsWith('.env')
    } })
    fs.copyFileSync(path.join(root, 'LICENSE'), path.join(target, 'LICENSE'))
    for (const file of ['verify-browser.mjs', 'target-comparison.mjs']) {
      fs.copyFileSync(path.join(root, 'website-design-ultra/scripts', file), path.join(target, 'scripts', file))
    }
    fs.mkdirSync(path.join(target, 'templates/runtime'), { recursive: true })
    for (const file of ['compare-baselines.mjs', 'baseline-comparison.ts', 'package.json']) {
      fs.copyFileSync(path.join(root, 'website-design-ultra/templates/runtime', file), path.join(target, 'templates/runtime', file))
    }
    const pkgPath = path.join(target, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    // These commands run the repository's own fixture servers, not the copied site.
    delete pkg.scripts['verify:ip06a']; delete pkg.scripts['verify:ip06b']
    pkg.scripts['verify:browser'] = 'node scripts/verify-browser.mjs'
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
    const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })
    const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })
    fs.writeFileSync(path.join(target, 'wdu-source.json'), JSON.stringify({
      repository: 'https://github.com/Kaytm93/website-design-ultra',
      starter: choices[starter], commit: commit.status === 0 ? commit.stdout.trim() : null,
      modifiedSource: dirty.status === 0 ? dirty.stdout.trim().length > 0 : null,
      sourceVisualRole: 'technical-fixture',
    }, null, 2) + '\n')
    fs.renameSync(path.join(target, 'README.md'), path.join(target, 'STARTER.md'))
    fs.writeFileSync(path.join(target, 'README.md'), `# Mein Website-Projekt\n\nErstellt aus Website Design Ultra (${choices[starter]}). Node >=22.18.\n\n\`\`\`bash\nnpm ci\nnpm run verify\nnpm run dev\n\`\`\`\n\nDiese Ausgangsseite ist ein technisches Fixture; ihre visuelle Weiterentwicklung im Repository ist pausiert. Layout, Texte, Motiv, Materialien und Poster sind keine Designvorlage. Die neue Website wird aus deinem Briefing, deinen Inhalten und gewählten Referenzen gestaltet. Benötigte Runtime-Mechanismen und technische Prüfungen bleiben verwendbar. Die mitgelieferten Bilder und Lizenzangaben gehören zum Starter. Herkunft: wdu-source.json. Technische Referenz: STARTER.md. Dessen repo:-Pfade und IP06-Kommandos beziehen sich auf den ursprünglichen Repository-Checkout.\n\nBrowserprüfung bei laufendem Server in einem zweiten Terminal:\n\n\`\`\`bash\nnpm run verify:browser -- --url http://127.0.0.1:${starter === 'next' ? '3000' : '5173'} --out output/verify\n\`\`\`\n\nFür deklarierte Interaktionen zusätzlich --checkpoints lib/interaction-checkpoints.json übergeben (Next). Browser-/GPU-UNAVAILABLE bleibt ungeprüft. Der Kopiervorgang installiert keine Pakete und veröffentlicht keine Website.\n`)
    return target
  } catch (error) {
    fs.rmSync(target, { recursive: true, force: true })
    throw error
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    if (args.includes('--help')) { console.log('Usage: npm run create -- --starter next|vanilla --out ../my-site'); process.exit(0) }
    const options = {}
    for (let i = 0; i < args.length; i += 2) {
      if (!['--starter', '--out'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw Error('Expected --starter next|vanilla --out <new-directory>')
      options[args[i].slice(2)] = args[i + 1]
    }
    console.log(`Project created: ${createProject(options)}\nNext: cd into the project, then npm ci && npm run verify && npm run dev`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
