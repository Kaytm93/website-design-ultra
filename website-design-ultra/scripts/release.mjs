#!/usr/bin/env node

/**
 * Release provenance gate.
 *
 * The plugin demands that every claim carries evidence. Its own release history
 * has to meet that bar, so a version section is only valid when it points at a
 * git tag that actually resolves in this repository.
 *
 * A changelog cannot contain the SHA of the commit that introduces it. The
 * anchor is therefore the tag name, which is known before the commit, and the
 * SHA is resolved from the tag at verification time. Sections that predate
 * version control must say so explicitly instead of claiming an unavailable
 * SHA — an unverifiable claim is worse than a declared gap.
 *
 * Status contract mirrors ADR-010: PASS | FAIL | UNAVAILABLE.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pluginIdentity, pluginTreeDigest } from './forward-trace.mjs'

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The tag is the first token after the marker; anything after it is prose.
const releaseTagPattern = /^Release-Tag:\s*(\S+)(?:[\s—-].*)?$/m
const preVcsPattern = /^Release-Tag:\s*none\b/m
const bannedPhrases = [
  'Commit-SHA: nicht verfügbar',
  'Commit-SHA: not available',
  'Commit-SHA: unbekannt',
]

function parseArguments(argv) {
  const options = { strict: false, json: false }
  for (const argument of argv) {
    if (argument === '--strict') options.strict = true
    else if (argument === '--json') options.json = true
    else if (argument === '--help') {
      console.log(`Usage:
  node scripts/release.mjs [--strict] [--json]

Verifies that every changelog section carries a resolvable Release-Tag, that
the manifests agree, and that the version under release is tagged.

--strict additionally requires a clean working tree and HEAD exactly on the
release tag. Use it in the release job; omit it while preparing a release.`)
      process.exit(0)
    } else {
      console.error(`release: unknown argument "${argument}"`)
      process.exit(1)
    }
  }
  return options
}

function findRepositoryRoot(start) {
  let current = path.resolve(start)
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

function git(repositoryRoot, args) {
  const run = spawnSync('git', ['-C', repositoryRoot, ...args], { encoding: 'utf8' })
  return { ok: run.status === 0, out: (run.stdout ?? '').trim(), err: (run.stderr ?? '').trim() }
}

function changelogSections(markdown) {
  const sections = []
  const lines = markdown.split('\n')
  let current = null

  for (const line of lines) {
    const heading = line.match(/^##\s+(\d+\.\d+\.\d+)\b(.*)$/)
    if (heading) {
      if (current) sections.push(current)
      current = { version: heading[1], title: heading[2].trim(), body: [] }
      continue
    }
    if (/^##\s+/.test(line) && current) {
      sections.push(current)
      current = null
      continue
    }
    if (current) current.body.push(line)
  }
  if (current) sections.push(current)
  return sections.map((section) => ({ ...section, body: section.body.join('\n') }))
}

const options = parseArguments(process.argv.slice(2))
const failures = []
const notes = []

const identity = pluginIdentity(pluginRoot)
const codexManifestPath = path.join(pluginRoot, '.codex-plugin', 'plugin.json')
const codexVersion = fs.existsSync(codexManifestPath)
  ? JSON.parse(fs.readFileSync(codexManifestPath, 'utf8')).version
  : null
if (identity.version !== codexVersion) {
  failures.push(`manifest versions differ: claude ${identity.version}, codex ${codexVersion}`)
}

const repositoryRoot = findRepositoryRoot(pluginRoot)
if (!repositoryRoot) {
  const payload = {
    status: 'UNAVAILABLE',
    reason: 'no-git-repository',
    detail: `${pluginRoot} is not inside a git repository, so no release claim can be verified.`,
    plugin: identity,
    tree: pluginTreeDigest(pluginRoot),
  }
  if (options.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.error(`UNAVAILABLE: ${payload.detail}`)
    console.error('Release provenance is unverified. The release gate stays closed.')
  }
  process.exit(1)
}

const changelogPath = fs.existsSync(path.join(repositoryRoot, 'CHANGELOG.md'))
  ? path.join(repositoryRoot, 'CHANGELOG.md')
  : path.join(pluginRoot, 'CHANGELOG.md')
if (!fs.existsSync(changelogPath)) failures.push('no CHANGELOG.md found in the repository root')

const changelog = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : ''
for (const phrase of bannedPhrases) {
  if (changelog.includes(phrase)) {
    failures.push(
      `CHANGELOG still contains the unverifiable claim "${phrase}"; use "Release-Tag:" instead`,
    )
  }
}

const tags = new Set(git(repositoryRoot, ['tag', '--list']).out.split('\n').filter(Boolean))
const sections = changelogSections(changelog)
const resolved = []

for (const section of sections) {
  const tagMatch = section.body.match(releaseTagPattern)
  if (!tagMatch) {
    failures.push(`CHANGELOG ${section.version}: missing a Release-Tag line`)
    continue
  }
  if (preVcsPattern.test(section.body)) {
    resolved.push({ version: section.version, tag: null, commit: null, preVcs: true })
    continue
  }

  const tag = tagMatch[1]
  if (!tags.has(tag)) {
    failures.push(`CHANGELOG ${section.version}: Release-Tag "${tag}" does not exist in this repository`)
    continue
  }
  const commit = git(repositoryRoot, ['rev-list', '-n', '1', tag])
  if (!commit.ok || !commit.out) {
    failures.push(`CHANGELOG ${section.version}: tag "${tag}" does not resolve to a commit`)
    continue
  }
  resolved.push({ version: section.version, tag, commit: commit.out, preVcs: false })
}

const releaseVersion = identity.version
const releaseEntry = resolved.find((entry) => entry.version === releaseVersion)
if (!sections.some((section) => section.version === releaseVersion)) {
  failures.push(`CHANGELOG has no section for the manifest version ${releaseVersion}`)
} else if (!releaseEntry) {
  failures.push(`release version ${releaseVersion} has no resolvable Release-Tag`)
} else if (releaseEntry.preVcs) {
  failures.push(`release version ${releaseVersion} is marked as predating version control`)
}

const status = git(repositoryRoot, ['status', '--porcelain'])
const head = git(repositoryRoot, ['rev-parse', 'HEAD']).out
const clean = status.out === ''

if (options.strict) {
  if (!clean) failures.push('working tree is dirty; a release must describe a committed state')
  if (releaseEntry && !releaseEntry.preVcs && releaseEntry.commit !== head) {
    failures.push(
      `HEAD ${head.slice(0, 12)} is not the release commit ${releaseEntry.commit.slice(0, 12)} for ${releaseEntry.tag}`,
    )
  }
}

const tree = pluginTreeDigest(pluginRoot)
notes.push(`plugin ${identity.name} ${identity.version}`)
notes.push(`${resolved.length}/${sections.length} changelog sections anchored`)
notes.push(`tree ${tree.sha256.slice(0, 12)} (${tree.fileCount} files)`)
notes.push(clean ? 'working tree clean' : 'working tree dirty')

const payload = {
  status: failures.length ? 'FAIL' : 'PASS',
  plugin: identity,
  repositoryRoot,
  changelog: path.relative(repositoryRoot, changelogPath),
  head,
  clean,
  releases: resolved,
  tree,
  failures,
}

if (options.json) {
  console.log(JSON.stringify(payload, null, 2))
} else {
  for (const entry of resolved) {
    if (entry.preVcs) console.log(`  ${entry.version.padEnd(8)} predates version control`)
    else console.log(`  ${entry.version.padEnd(8)} ${entry.tag.padEnd(10)} ${entry.commit}`)
  }
  if (failures.length) {
    console.error(`Release gate FAIL (${failures.length})`)
    for (const failure of failures) console.error(`- ${failure}`)
  } else {
    console.log(`Release gate PASS: ${notes.join(', ')}`)
  }
}

process.exit(failures.length ? 1 : 0)
