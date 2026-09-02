/**
 * The plugin ships copies, not imports.
 *
 * `website-design-ultra/templates/` exists because a marketplace installation
 * has no repository checkout: every runtime file a skill tells the reader to
 * copy has to live inside the installed tree. A copy that silently drifts from
 * its source is worse than no copy, so each pair is asserted byte for byte
 * here, and a twin without a source fails too.
 *
 * A pair may declare `rewrites`. That is the escape hatch for the one thing a
 * copy legitimately changes — an import specifier whose relative depth differs
 * between the two locations. Each rewrite is applied to the source before the
 * comparison and is written out in full, so a second divergence still fails.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const templatesRoot = path.join(repoRoot, 'website-design-ultra', 'templates')

/**
 * source: repository-root relative — the file the repository maintains.
 * target: templates-relative — the copy an installation actually reads.
 * binary: compare the bytes rather than the decoded text. A UTF-8 read folds
 *   every invalid sequence onto U+FFFD, so two binaries that differ can decode
 *   to the same string and pass a text comparison that means nothing.
 */
export const mirroredFiles = [
  { source: 'references/quality-controller.ts', target: 'runtime/quality-controller.ts' },
  { source: 'references/immersive-telemetry.ts', target: 'runtime/immersive-telemetry.ts' },
  { source: 'references/determinism-runtime.ts', target: 'runtime/determinism-runtime.ts' },
  { source: 'references/interaction-checkpoints.ts', target: 'runtime/interaction-checkpoints.ts' },
  { source: 'references/baseline-comparison.ts', target: 'runtime/baseline-comparison.ts' },
  { source: 'references/cinematic-timeline.ts', target: 'runtime/cinematic-timeline.ts' },
  { source: 'references/package.json', target: 'runtime/package.json' },
  {
    source: 'lab/src/modules/material-lookdev.ts',
    target: 'material-lookdev/material-lookdev.ts',
  },
  {
    source: 'lab/src/modules/canvas-only-prohibition.ts',
    target: 'runtime/canvas-only-prohibition.ts',
  },
  {
    source: 'tests/immersive/interaction-capture/compare-baselines.mjs',
    target: 'runtime/compare-baselines.mjs',
    // The root comparator reaches three levels up for the declaration
    // contract. Inside the plugin that contract is the sibling shipped next
    // to it, so the specifier is the one and only difference between the two
    // files — and any second difference still fails this test.
    rewrites: [
      ["from '../../../references/baseline-comparison.ts'", "from './baseline-comparison.ts'"],
    ],
  },
  { source: 'lab/src/experiments/shaders/foundational-shaders.frag', target: 'shaders/foundational-shaders.frag' },
  { source: 'lab/src/experiments/shaders/foundational-shaders.vert', target: 'shaders/foundational-shaders.vert' },
  { source: 'lab/src/experiments/shaders/media-post.frag', target: 'shaders/media-post.frag' },
  { source: 'lab/src/experiments/shaders/media-post.vert', target: 'shaders/media-post.vert' },
  { source: 'lab/src/experiments/shaders/transition-interaction.frag', target: 'shaders/transition-interaction.frag' },
  { source: 'lab/src/experiments/shaders/transition-interaction.vert', target: 'shaders/transition-interaction.vert' },
  { source: 'lab/src/experiments/shaders/sdf-text.frag', target: 'shaders/sdf-text.frag' },
  { source: 'lab/src/experiments/shaders/sdf-text.vert', target: 'shaders/sdf-text.vert' },
  { source: 'lab/src/experiments/shaders/particle-toy-render.frag', target: 'shaders/particle-toy-render.frag' },
  { source: 'lab/src/experiments/shaders/particle-toy-render.vert', target: 'shaders/particle-toy-render.vert' },
  { source: 'lab/src/experiments/shaders/particle-toy-update.frag', target: 'shaders/particle-toy-update.frag' },
  { source: 'lab/src/experiments/shader-fullscreen.frag', target: 'shaders/shader-fullscreen.frag' },
  { source: 'lab/src/experiments/shader-fullscreen.vert', target: 'shaders/shader-fullscreen.vert' },
  // The one asset under templates/. It is committed twice on purpose: the
  // plugin ships it so a marketplace installation has a licensed environment
  // without a checkout, and the starter ships it so `next build` and the
  // deterministic capture stay offline. Two commits of one asset is exactly
  // the drift risk this file exists to close, so the pair is declared and
  // asserted like any other. `J-D8` (automation/website-design-ultra-2.1-2.3/
  // QUEUE.md) replaces both commits with a hash-checked fetch; until then this
  // assertion is what keeps them one asset instead of two.
  {
    source: 'starters/next-r3f-cinematic/public/assets/studio_small_08_1k.hdr',
    target: 'assets/studio_small_08_1k.hdr',
    binary: true,
  },
]

/**
 * Files the plugin owns outright: they document the tree, they do not mirror
 * it. `assets/README.md` is the licence trail for the redistributed CC0 HDRI —
 * publisher, upstream URL and source hash — and has no counterpart to mirror.
 */
const pluginOwnedTemplates = new Set(['README.md', 'assets/README.md'])

function readSource(entry) {
  const absolute = path.join(repoRoot, entry.source)
  let text = fs.readFileSync(absolute, 'utf8')
  for (const [from, to] of entry.rewrites ?? []) {
    assert.ok(
      text.includes(from),
      `${entry.source}: declared rewrite source ${JSON.stringify(from)} is not in the file`,
    )
    text = text.split(from).join(to)
  }
  return text
}

function walk(directory) {
  const found = []
  if (!fs.existsSync(directory)) return found
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) found.push(...walk(absolute))
    if (entry.isFile()) found.push(path.relative(templatesRoot, absolute))
  }
  return found
}

test('every mirrored template matches its repository source', () => {
  for (const entry of mirroredFiles) {
    const target = path.join(templatesRoot, entry.target)
    assert.ok(fs.existsSync(target), `templates/${entry.target}: missing copy of ${entry.source}`)

    if (entry.binary) {
      assert.ok(!entry.rewrites, `${entry.source}: a binary pair cannot declare rewrites`)
      const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
      assert.equal(
        digest(target),
        digest(path.join(repoRoot, entry.source)),
        `templates/${entry.target} is not byte-identical to ${entry.source}`,
      )
      continue
    }

    const expected = readSource(entry)
    const actual = fs.readFileSync(target, 'utf8')
    const label = entry.rewrites
      ? `templates/${entry.target} differs from ${entry.source} beyond its ${entry.rewrites.length} declared rewrite(s)`
      : `templates/${entry.target} is not byte-identical to ${entry.source}`
    assert.equal(actual, expected, label)
  }
})

test('every template file has a declared source', () => {
  const declared = new Set(mirroredFiles.map((entry) => entry.target))
  const orphans = walk(templatesRoot).filter(
    (file) => !declared.has(file) && !pluginOwnedTemplates.has(file),
  )
  assert.deepEqual(
    orphans,
    [],
    `templates/ holds file(s) with no entry in mirroredFiles: ${orphans.join(', ')}`,
  )
})

test('no mirrored source has gone missing from the repository', () => {
  for (const entry of mirroredFiles) {
    const absolute = path.join(repoRoot, entry.source)
    assert.ok(fs.existsSync(absolute), `${entry.source}: source removed while templates/${entry.target} still ships it`)
  }
})

test('the documented runtime paths work from an isolated plugin installation', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'wdu-plugin-install-'))
  // Real Codex installations live below a dot-directory. Ancestor names must
  // not make the explicitly selected plugin's own files look like vendor output.
  const installed = path.join(parent, '.codex/plugins/cache/vendor/website-design-ultra')
  try {
    fs.cpSync(path.join(repoRoot, 'website-design-ultra'), installed, {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}.DS_Store`),
    })

    const validation = spawnSync(process.execPath, [path.join(installed, 'scripts/validate-content.mjs')], {
      encoding: 'utf8',
    })
    assert.equal(validation.status, 0, validation.stderr || validation.stdout)

    const comparator = path.join(installed, 'templates/runtime/compare-baselines.mjs')
    const result = spawnSync(process.execPath, [
      '--experimental-strip-types', comparator, '--help',
    ], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /Usage:\s+node compare-baselines\.mjs/)

    const moduleProbe = spawnSync(process.execPath, [
      '--experimental-strip-types', '--input-type=module', '-e',
      `import ${JSON.stringify(path.join(installed, 'templates/runtime/quality-controller.ts'))}`,
    ], { encoding: 'utf8' })
    assert.equal(moduleProbe.status, 0, moduleProbe.stderr || moduleProbe.stdout)
  } finally {
    fs.rmSync(parent, { recursive: true, force: true })
  }
})

/**
 * The module index is a view of `lab/src/modules/manifest.ts`, not a second
 * opinion about it. Prose drifting away from the manifest is exactly the
 * failure the index was written to end, so every id, cost class and fixture
 * path is asserted against the source here. The manifest is parsed from text
 * rather than imported: a `.ts` import would put a Node type-stripping
 * requirement on the whole test file.
 */
test('the shader module index matches the lab manifest', () => {
  const manifest = fs.readFileSync(
    path.join(repoRoot, 'lab', 'src', 'modules', 'manifest.ts'),
    'utf8',
  )
  const index = fs.readFileSync(
    path.join(
      repoRoot,
      'website-design-ultra/skills/shaders-tsl/references/module-index.md',
    ),
    'utf8',
  )

  const blocks = manifest
    .split('export const foundationalShaderManifest')[1]
    .split(/\n  \},/)
    .filter((block) => block.includes('id:'))

  assert.equal(blocks.length, 17, 'manifest entry count changed; regenerate the index')

  for (const block of blocks) {
    const id = block.match(/id: '([^']+)'/)[1]
    const costClass = block.match(/costClass: '([^']+)'/)[1]
    const fixture = block.match(/fixture: '([^']+)'/)[1]
    const renderers = block.match(/rendererSupport: \[([^\]]*)\]/)[1]

    assert.ok(index.includes(`\`${id}\``), `module-index.md: no entry for ${id}`)
    const entry = index.split(`\`${id}\``)[1].split('\n####')[0]
    assert.ok(
      entry.includes(`| Cost class | ${costClass} |`),
      `module-index.md: ${id} does not carry cost class ${costClass}`,
    )
    assert.ok(
      entry.includes(`\`repo:${fixture}\``),
      `module-index.md: ${id} does not name fixture ${fixture}`,
    )
    const expected = renderers.includes('webgpu') ? 'WebGL2, WebGPU' : 'WebGL2'
    assert.ok(
      entry.includes(`| Renderer support | ${expected} |`),
      `module-index.md: ${id} does not carry renderer support ${expected}`,
    )
  }
})
