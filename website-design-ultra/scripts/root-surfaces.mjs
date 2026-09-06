/**
 * Root-surface path classification (ADR-011).
 *
 * Starters and the lab live outside the installed plugin tree, so
 * `validate-content.mjs` walks them from the repository root. This module owns
 * the one question that walk keeps asking — is this path the surface's own
 * source, or generated/vendor output? — and lives apart from the validator so
 * the walk can be run against a synthetic root in a test instead of only as a
 * side effect of the whole validation.
 */

import fs from 'node:fs'
import path from 'node:path'

/**
 * Generated and vendor output is declared, not discovered. Reading
 * `next-env.d.ts` or a lockfile reports a NO-COPY warning for text that was
 * never written as copy, and build output holds whole copies of the
 * repository. The linter's own walk already skips dot-directories and the
 * build-output directory set; this list is the explicit contract the
 * root-surface discovery asserts: none of these paths may ever appear in a
 * starter's lint report.
 */
export const GENERATED_VENDOR_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'output',
  'coverage',
  'vendor',
])
export const GENERATED_VENDOR_FILES = new Set([
  'next-env.d.ts',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
])

/**
 * Is `file` generated or vendor output *within the surface rooted at `root`*?
 *
 * The anchor is the whole point. Dot-directories are excluded because the
 * linter's own walk skips the ones it descends into — a statement about the
 * tree under the surface, never about where the checkout happens to sit on
 * disk. Testing every segment of an absolute path made that a statement about
 * the host: a repository under a dot-directory — which is exactly where agent
 * worktrees live, `.claude/worktrees/<name>/` — classified every one of its
 * own files as generated output, the lab counted zero source files, and the
 * validator blamed the fixture for a defect in the path walk.
 *
 * Segments above `root` therefore never classify. Basenames still do: a
 * lockfile is a lockfile wherever it sits.
 */
export function isGeneratedVendorPath(file, root) {
  const absolute = path.resolve(String(file))
  const base = path.basename(absolute)
  if (GENERATED_VENDOR_FILES.has(base) || base.endsWith('.tsbuildinfo')) return true
  const inside = path.relative(path.resolve(String(root)), absolute).replaceAll('\\', '/')
  // Outside the surface, or the surface root itself. `path.relative` has
  // already collapsed `.` and `..`, so a leading `..` is the only way out and
  // the remaining segments are all real directory names.
  if (!inside || inside === '..' || inside.startsWith('../')) return false
  return inside
    .split('/')
    .some((segment) => segment.startsWith('.') || GENERATED_VENDOR_DIRECTORIES.has(segment))
}

/** Count the lab's own source files without descending into generated output. */
export function countLabSources(labRoot) {
  const root = path.resolve(labRoot)
  let count = 0
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (isGeneratedVendorPath(target, root)) continue
        walk(target)
      } else if (entry.isFile() && !isGeneratedVendorPath(target, root)) {
        count += 1
      }
    }
  }
  walk(root)
  return count
}
