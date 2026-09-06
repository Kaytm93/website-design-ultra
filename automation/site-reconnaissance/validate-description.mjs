#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export class SiteReconnaissanceDescriptionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SiteReconnaissanceDescriptionError'
  }
}

function invalid(message) {
  throw new SiteReconnaissanceDescriptionError(message)
}

function parseDescription(markdown, label) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) invalid(`${label}: missing YAML frontmatter`)
  const name = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim()
  if (name !== 'site-reconnaissance') invalid(`${label}: frontmatter name must be site-reconnaissance`)
  const description = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim()
  if (!description) invalid(`${label}: missing description`)
  const unquoted = description.replace(/^['"]|['"]$/g, '')
  return unquoted
}

export function validateSiteReconnaissanceDescription(markdown, label = 'site-reconnaissance') {
  const description = parseDescription(markdown, label)
  const required = [
    ['use only when', /\buse only when\b/i],
    ['public URL', /\bpublic(?: live)? 3d reference url\b|\bpublic url\b/i],
    ['bundle', /\bbundle\b/i],
    ['network', /\bnetwork\b/i],
    ['renderer.info', /\brenderer\.info\b/i],
    ['Inspector', /\binspector\b/i],
    ['shader', /\bshader\b/i],
    ['screenshot alone', /\bscreenshot alone\b/i],
  ]
  for (const [name, pattern] of required) {
    if (!pattern.test(description)) invalid(`${label}: description is missing ${name}`)
  }
  if (!/\bdoes not activate this skill\.?$/i.test(description)) {
    invalid(`${label}: description must close with what does not activate this skill`)
  }
  return { status: 'PASS', description }
}

function runCli(argv) {
  const skillPath = path.resolve(
    argv[0] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../../website-design-ultra/skills/site-reconnaissance/SKILL.md'),
  )
  if (argv.length > 1 || argv[0] === '--help') {
    console.log('Usage: node automation/site-reconnaissance/validate-description.mjs [site-reconnaissance/SKILL.md]')
    return argv[0] === '--help' ? 0 : 2
  }
  try {
    console.log(JSON.stringify(validateSiteReconnaissanceDescription(fs.readFileSync(skillPath, 'utf8'), skillPath), null, 2))
    return 0
  } catch (error) {
    console.error(`Site reconnaissance description validation failed: ${error.message}`)
    return 1
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) process.exitCode = runCli(process.argv.slice(2))
