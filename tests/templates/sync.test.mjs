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
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const templatesRoot = path.join(repoRoot, 'website-design-ultra', 'templates')

/**
 * source: repository-root relative — the file the repository maintains.
 * target: templates-relative — the copy an installation actually reads.
 */
export const mirroredFiles = [
  { source: 'references/quality-controller.ts', target: 'runtime/quality-controller.ts' },
  { source: 'references/immersive-telemetry.ts', target: 'runtime/immersive-telemetry.ts' },
  { source: 'references/determinism-runtime.ts', target: 'runtime/determinism-runtime.ts' },
  { source: 'references/interaction-checkpoints.ts', target: 'runtime/interaction-checkpoints.ts' },
  { source: 'references/baseline-comparison.ts', target: 'runtime/baseline-comparison.ts' },
  { source: 'references/cinematic-timeline.ts', target: 'runtime/cinematic-timeline.ts' },
  { source: 'references/package.json', target: 'runtime/package.json' },
]

/** Files the plugin owns outright: they document the tree, they do not mirror it. */
const pluginOwnedTemplates = new Set(['README.md'])

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
