#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const FIGMA_EXPORT_SCHEMA_VERSION = 'wdu-figma-export/v1'
const API_ORIGIN = 'https://api.figma.com'

function fail(message) {
  throw new Error(message)
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label}: expected a non-empty string`)
  return value
}

function readJson(file, label) {
  let source
  try {
    source = fs.readFileSync(file, 'utf8')
  } catch (error) {
    fail(`${label}: cannot read ${file}: ${error.message}`)
  }
  try {
    return JSON.parse(source)
  } catch (error) {
    fail(`${label}: invalid JSON: ${error.message}`)
  }
}

function resolveInside(root, candidate, label, mustExist = false) {
  nonEmptyString(candidate, label)
  if (path.isAbsolute(candidate)) fail(`${label}: absolute paths are not allowed`)
  const resolved = path.resolve(root, candidate)
  const relative = path.relative(root, resolved)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(`${label}: path escapes its root`)
  }
  if (mustExist && !fs.existsSync(resolved)) fail(`${label}: file does not exist (${candidate})`)
  return resolved
}

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function inspectBytes(bytes, format, label) {
  if (format === 'png') {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) {
      fail(`${label}: Figma returned bytes without a PNG signature and IHDR`)
    }
    if (bytes.toString('ascii', 12, 16) !== 'IHDR') fail(`${label}: PNG is missing IHDR`)
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    if (width < 1 || height < 1) fail(`${label}: PNG dimensions must be positive`)
    return `${width}x${height}`
  }
  const source = bytes.toString('utf8')
  if (!/<svg\b/i.test(source)) fail(`${label}: Figma returned bytes without an SVG root`)
  const viewBox = source.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1]
  if (!viewBox) fail(`${label}: SVG export must declare a viewBox`)
  const normalized = viewBox.trim().split(/[\s,]+/).join(' ')
  const values = normalized.split(' ').map(Number)
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    fail(`${label}: SVG viewBox must contain four finite numbers`)
  }
  return normalized
}

function credentialIssue(value) {
  if (typeof value === 'string') {
    return /\bfigd_[A-Za-z0-9_-]{20,}\b/.test(value) ? 'credential-shaped value' : null
  }
  if (!value || typeof value !== 'object') return null
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[-_]/g, '').toLowerCase()
    if (
      [
        'accesstoken',
        'personalaccesstoken',
        'figmaaccesstoken',
        'figmatoken',
        'authorization',
        'apikey',
        'password',
        'secret',
      ].includes(normalized)
    ) return `credential key ${key}`
    const nested = credentialIssue(child)
    if (nested) return `${key}.${nested}`
  }
  return null
}

function validateConfig(config, configDirectory) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) fail('config: expected an object')
  nonEmptyString(config.fileKey, 'config.fileKey')
  const tokenBlockPath = resolveInside(
    configDirectory,
    config.tokenBlock,
    'config.tokenBlock',
    true,
  )
  const tokenBlock = readJson(tokenBlockPath, 'config.tokenBlock')
  const authIssue = credentialIssue(tokenBlock)
  if (authIssue) fail(`config.tokenBlock: authentication credential is forbidden (${authIssue})`)
  if (!Array.isArray(config.frames) || config.frames.length < 6 || config.frames.length > 10) {
    fail('config.frames: expected six to ten exports')
  }
  const formats = new Set()
  const nodeIds = new Set()
  const files = new Set()
  for (const [index, frame] of config.frames.entries()) {
    const expectedId = `frame-${String(index + 1).padStart(2, '0')}`
    if (frame?.id !== expectedId) fail(`config.frames[${index}].id: expected ${expectedId}`)
    nonEmptyString(frame.nodeId, `${frame.id}.nodeId`)
    if (nodeIds.has(frame.nodeId)) fail(`${frame.id}.nodeId: duplicate ${frame.nodeId}`)
    nodeIds.add(frame.nodeId)
    if (!['png', 'svg'].includes(frame.format)) fail(`${frame.id}.format: expected png or svg`)
    formats.add(frame.format)
    resolveInside(configDirectory, frame.file, `${frame.id}.file`)
    if (path.extname(frame.file).slice(1).toLowerCase() !== frame.format) {
      fail(`${frame.id}.file: extension must match ${frame.format}`)
    }
    if (files.has(frame.file)) fail(`${frame.id}.file: duplicate output path`)
    files.add(frame.file)
    if (!['wide', 'portrait', 'square', 'component'].includes(frame.viewport)) {
      fail(`${frame.id}.viewport: expected wide, portrait, square, or component`)
    }
    for (const key of ['role', 'provenance']) nonEmptyString(frame[key], `${frame.id}.${key}`)
  }
  if (!formats.has('png') || !formats.has('svg')) {
    fail('config.frames: include at least one PNG and one SVG export')
  }
  return { tokenBlockPath, tokenBlock }
}

function redact(message, token) {
  return String(message).split(token).join('[REDACTED]')
}

async function responseJson(response, label, token) {
  if (!response?.ok) {
    const body = await response?.text?.().catch(() => '')
    fail(`${label}: HTTP ${response?.status ?? 'unknown'} ${redact(body ?? '', token)}`.trim())
  }
  try {
    return await response.json()
  } catch (error) {
    fail(`${label}: invalid JSON response: ${redact(error.message, token)}`)
  }
}

async function figmaJson(fetchImpl, url, token, label) {
  let response
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'X-Figma-Token': token,
      },
    })
  } catch (error) {
    fail(`${label}: request failed: ${redact(error.message, token)}`)
  }
  return responseJson(response, label, token)
}

async function downloadBytes(fetchImpl, url, token, label) {
  let response
  try {
    // Deliberately omit X-Figma-Token: image URLs are signed download URLs and
    // the personal token must never be forwarded to their host.
    response = await fetchImpl(url)
  } catch (error) {
    fail(`${label}: download failed: ${redact(error.message, token)}`)
  }
  if (!response?.ok) fail(`${label}: download returned HTTP ${response?.status ?? 'unknown'}`)
  return Buffer.from(await response.arrayBuffer())
}

export async function exportFigmaArtifacts({
  configPath,
  outputDirectory,
  token,
  fetchImpl = globalThis.fetch,
}) {
  const absoluteConfig = path.resolve(nonEmptyString(configPath, 'configPath'))
  const absoluteOutput = path.resolve(nonEmptyString(outputDirectory, 'outputDirectory'))
  nonEmptyString(token, 'FIGMA_ACCESS_TOKEN')
  if (typeof fetchImpl !== 'function') fail('fetch is unavailable; Node.js 22 or a fetch implementation is required')
  const config = readJson(absoluteConfig, 'config')
  const configDirectory = path.dirname(absoluteConfig)
  const { tokenBlockPath, tokenBlock } = validateConfig(config, configDirectory)

  fs.mkdirSync(absoluteOutput, { recursive: true })
  if (fs.readdirSync(absoluteOutput).length) fail('outputDirectory: expected an empty directory')

  const nodeIds = config.frames.map((frame) => frame.nodeId)
  const nodesUrl = new URL(`/v1/files/${encodeURIComponent(config.fileKey)}/nodes`, API_ORIGIN)
  nodesUrl.searchParams.set('ids', nodeIds.join(','))
  const nodesResponse = await figmaJson(fetchImpl, nodesUrl, token, 'Figma nodes')
  const nodes = nodesResponse.nodes ?? {}
  for (const frame of config.frames) {
    if (!nodes[frame.nodeId]?.document) fail(`${frame.id}: Figma nodes response omitted ${frame.nodeId}`)
  }

  const imageUrls = new Map()
  for (const format of ['png', 'svg']) {
    const group = config.frames.filter((frame) => frame.format === format)
    if (!group.length) continue
    const imagesUrl = new URL(`/v1/images/${encodeURIComponent(config.fileKey)}`, API_ORIGIN)
    imagesUrl.searchParams.set('ids', group.map((frame) => frame.nodeId).join(','))
    imagesUrl.searchParams.set('format', format)
    if (format === 'png') imagesUrl.searchParams.set('scale', '1')
    if (format === 'svg') imagesUrl.searchParams.set('svg_include_id', 'true')
    const imageResponse = await figmaJson(fetchImpl, imagesUrl, token, `Figma ${format} images`)
    for (const frame of group) {
      const imageUrl = imageResponse.images?.[frame.nodeId]
      if (!imageUrl) fail(`${frame.id}: Figma images response omitted ${frame.nodeId}`)
      imageUrls.set(frame.id, imageUrl)
    }
  }

  const manifestFrames = []
  for (const frame of config.frames) {
    const bytes = await downloadBytes(fetchImpl, imageUrls.get(frame.id), token, frame.id)
    const geometry = inspectBytes(bytes, frame.format, frame.id)
    const destination = resolveInside(absoluteOutput, frame.file, `${frame.id}.file`)
    if (fs.existsSync(destination)) fail(`${frame.id}.file: refusing to overwrite ${frame.file}`)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, bytes)
    const node = nodes[frame.nodeId].document
    manifestFrames.push({
      id: frame.id,
      file: frame.file,
      format: frame.format,
      sha256: digest(bytes),
      dimensionsOrViewBox: geometry,
      viewport: frame.viewport,
      role: frame.role,
      provenance: frame.provenance,
      figmaNode: {
        id: frame.nodeId,
        name: node.name ?? null,
        type: node.type ?? null,
      },
    })
  }

  const tokenBytes = fs.readFileSync(tokenBlockPath)
  const outputTokenPath = path.join(absoluteOutput, 'tokens.json')
  fs.writeFileSync(outputTokenPath, tokenBytes)
  const manifest = {
    schemaVersion: FIGMA_EXPORT_SCHEMA_VERSION,
    source: {
      kind: 'figma-rest-optional',
      fileKey: config.fileKey,
      scopes: ['file_content:read'],
      endpoints: ['GET /v1/files/:key/nodes', 'GET /v1/images/:key'],
    },
    frames: manifestFrames,
    writtenTokenBlock: {
      file: 'tokens.json',
      sha256: digest(tokenBytes),
    },
  }
  if (credentialIssue(manifest) || JSON.stringify(manifest).includes(token)) {
    fail('internal safety check: manifest would contain authentication material')
  }
  const manifestName = 'figma-export-manifest.json'
  fs.writeFileSync(
    path.join(absoluteOutput, manifestName),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )

  return {
    status: 'PASS',
    frameCount: manifestFrames.length,
    formats: [...new Set(manifestFrames.map((frame) => frame.format))].sort(),
    manifest: manifestName,
    tokenBlock: 'tokens.json',
  }
}

function parseCli(argv) {
  if (argv.includes('--help')) return { help: true }
  const options = { configPath: null, outputDirectory: null }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--config') options.configPath = argv[++index]
    else if (argument === '--out') options.outputDirectory = argv[++index]
    else fail(`unknown argument ${argument}`)
  }
  if (!options.configPath || !options.outputDirectory) fail('--config and --out are required')
  return options
}

async function runCli(argv) {
  let options
  try {
    options = parseCli(argv)
  } catch (error) {
    console.error(`Figma export failed: ${error.message}`)
    return 2
  }
  if (options.help) {
    console.log(`Usage: FIGMA_ACCESS_TOKEN=... node automation/reference-intake/export-figma-rest.mjs \\
  --config figma-export.config.json --out reference-artifacts

The token is accepted only through FIGMA_ACCESS_TOKEN; no command-line token flag exists.`)
    return 0
  }
  const token = process.env.FIGMA_ACCESS_TOKEN
  if (!token) {
    console.error('Figma export failed: FIGMA_ACCESS_TOKEN is not set')
    return 2
  }
  try {
    const report = await exportFigmaArtifacts({ ...options, token })
    console.log(JSON.stringify(report, null, 2))
    return 0
  } catch (error) {
    console.error(`Figma export failed: ${redact(error.message, token)}`)
    return 1
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) process.exitCode = await runCli(process.argv.slice(2))
