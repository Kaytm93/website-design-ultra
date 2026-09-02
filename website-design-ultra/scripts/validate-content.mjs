#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PROFILES, TIER1, TIER2, extract } from './lint-copy.mjs'
import { strictObjectSchemaFailures } from './forward-schema.mjs'

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = path.join(pluginRoot, 'skills')
const failures = []
const notes = []

function fail(message) {
  failures.push(message)
}

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

function relative(file) {
  return path.relative(pluginRoot, file)
}

function walkFiles(root) {
  const result = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name)
    if (entry.isDirectory()) result.push(...walkFiles(target))
    if (entry.isFile()) result.push(target)
  }
  return result
}

function parseFrontmatter(markdown, file) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) {
    fail(`${relative(file)}: missing YAML frontmatter`)
    return {}
  }

  const result = {}
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/)
    if (!field) {
      fail(`${relative(file)}: unsupported or nested frontmatter line "${line}"`)
      continue
    }
    const value = field[2]
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    if (!quoted && (/:\s/.test(value) || /\s#/.test(value))) {
      fail(
        `${relative(file)}: frontmatter value for "${field[1]}" must be quoted because it contains YAML syntax`,
      )
      continue
    }
    result[field[1]] = value
  }
  return result
}

function parseColor(value) {
  const hex = value.match(/^#([0-9a-fA-F]{6})$/)
  if (hex) {
    return [
      Number.parseInt(hex[1].slice(0, 2), 16),
      Number.parseInt(hex[1].slice(2, 4), 16),
      Number.parseInt(hex[1].slice(4, 6), 16),
      1,
    ]
  }

  const rgba = value.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/,
  )
  if (!rgba) return null

  const color = [
    Number.parseInt(rgba[1], 10),
    Number.parseInt(rgba[2], 10),
    Number.parseInt(rgba[3], 10),
    rgba[4] === undefined ? 1 : Number.parseFloat(rgba[4]),
  ]
  if (color.slice(0, 3).some((channel) => channel > 255)) return null
  return color
}

function composite(foreground, background) {
  const alpha = foreground[3]
  return [
    foreground[0] * alpha + background[0] * (1 - alpha),
    foreground[1] * alpha + background[1] * (1 - alpha),
    foreground[2] * alpha + background[2] * (1 - alpha),
    1,
  ]
}

function luminance(color) {
  const channels = color
    .slice(0, 3)
    .map((value) => value / 255)
    .map((value) =>
      value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4,
    )

  return (
    channels[0] * 0.2126 +
    channels[1] * 0.7152 +
    channels[2] * 0.0722
  )
}

function contrast(first, second) {
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const skillDirectories = fs
  .readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())

if (skillDirectories.length !== 25) {
  fail(`expected 25 skills, found ${skillDirectories.length}`)
}

for (const directory of skillDirectories) {
  const skillFile = path.join(skillsRoot, directory.name, 'SKILL.md')
  if (!fs.existsSync(skillFile)) {
    fail(`skills/${directory.name}: missing SKILL.md`)
    continue
  }

  const markdown = read(skillFile)
  const frontmatter = parseFrontmatter(markdown, skillFile)
  const fields = Object.keys(frontmatter).sort()

  if (fields.join(',') !== 'description,name') {
    fail(`${relative(skillFile)}: frontmatter must contain only name and description`)
  }
  if (frontmatter.name !== directory.name) {
    fail(`${relative(skillFile)}: name must match folder`)
  }
  if ((frontmatter.description ?? '').length > 500) {
    fail(`${relative(skillFile)}: description exceeds 500 characters`)
  }
  if (markdown.split('\n').length > 500) {
    fail(`${relative(skillFile)}: SKILL.md exceeds 500 lines`)
  }

  const referenceLinks = markdown.matchAll(/\]\((references\/[^)#]+\.md)\)/g)
  for (const link of referenceLinks) {
    const target = path.join(skillsRoot, directory.name, link[1])
    if (!fs.existsSync(target)) {
      fail(`${relative(skillFile)}: missing reference ${link[1]}`)
    }
  }
}

const commandDirectories = fs
  .readdirSync(path.join(pluginRoot, 'commands'))
  .filter((name) => name.endsWith('.md'))
if (commandDirectories.length !== 6) {
  fail(`expected 6 commands, found ${commandDirectories.length}`)
}

/**
 * A command is a running order, not a second copy of the rules.
 *
 * Every kilobyte a command spends restating a skill is a kilobyte read twice
 * on every invocation, and a place the two copies can disagree. The cap is
 * what keeps a command pointing instead of repeating.
 *
 * `verify.md` and `audit.md` are named exceptions, not silent ones: they are
 * procedure documents that have not been cut yet. The exception is listed so
 * the debt is visible, and the cap holds for everything else.
 */
const commandSizeLimit = 4096
const uncutCommands = new Set(['verify.md', 'audit.md'])
for (const name of commandDirectories) {
  if (uncutCommands.has(name)) continue
  const size = fs.statSync(path.join(pluginRoot, 'commands', name)).size
  if (size > commandSizeLimit) {
    fail(`commands/${name}: ${size} bytes exceeds the ${commandSizeLimit}-byte command budget`)
  }
}

/**
 * A path a skill names has to be a path the reader can open.
 *
 * An installation is the plugin directory and nothing else: `references/*.ts`,
 * `lab/`, and the root test suites are not there. Naming one of them without
 * saying so hands the reader a dead path, which is the failure this rule
 * exists to catch. Every backtick span that looks like a file — it contains a
 * slash and ends in a known extension — must resolve inside the installed
 * tree, or carry the `repo:` prefix that marks it as source-repository-only.
 *
 * Spans holding `<` or `*` are templates for a name, not names.
 */
const documentedPathExtensions = [
  '.md', '.mjs', '.js', '.ts', '.tsx', '.json', '.yaml', '.yml',
  '.frag', '.vert', '.glsl', '.py', '.png', '.svg', '.glb', '.wduv',
]

function looksLikeDocumentedPath(span) {
  if (!span.includes('/')) return false
  if (/[\s<>*()`]/.test(span)) return false
  return documentedPathExtensions.some((extension) => span.endsWith(extension))
}

const repositoryRoot = path.resolve(pluginRoot, '..')
const repositoryRootPresent = fs.existsSync(path.join(repositoryRoot, '.git'))
let documentedPathCount = 0

for (const directory of ['skills', 'commands', 'docs']) {
  for (const file of walkFiles(path.join(pluginRoot, directory))) {
    if (!file.endsWith('.md')) continue
    const markdown = read(file)
    for (const match of markdown.matchAll(/`([^`\n]+)`/g)) {
      const span = match[1].trim()
      if (!looksLikeDocumentedPath(span)) continue
      documentedPathCount += 1

      if (span.startsWith('repo:')) {
        const target = span.slice('repo:'.length)
        if (target.startsWith('/') || target.startsWith('.')) {
          fail(`${relative(file)}: repo: path "${target}" must be repository-root relative`)
        } else if (repositoryRootPresent && !fs.existsSync(path.join(repositoryRoot, target))) {
          fail(`${relative(file)}: repo: path "${target}" does not exist in this repository`)
        }
        continue
      }

      const candidates = [
        path.join(pluginRoot, span),
        path.join(skillsRoot, span),
        path.join(path.dirname(file), span),
      ]
      if (!candidates.some((candidate) => fs.existsSync(candidate))) {
        fail(
          `${relative(file)}: documented path "${span}" is missing from the installed plugin; ` +
            'point it at a plugin file or mark it `repo:` when it only exists in the source repository',
        )
      }
    }
  }
}

/**
 * A skill no router names is a skill nobody reaches.
 *
 * Routing here is deliberate and negative: a skill loads because a gate fired,
 * never because it looked topical. That only works while every skill has a
 * gate somewhere. `gpu-particle-systems` and `procedural-3d` shipped without
 * one and were reachable only by guessing, which is the failure mode the
 * routing model exists to prevent.
 *
 * Being named is not being loaded. A forward case may still forbid a skill
 * whose gate is written down here.
 */
const routerFiles = ['skills/core-rules/SKILL.md', 'skills/immersive-3d/SKILL.md']
const routerText = routerFiles
  .map((file) => read(path.join(pluginRoot, file)))
  .join('\n')

for (const directory of skillDirectories) {
  if (routerFiles.some((file) => file === `skills/${directory.name}/SKILL.md`)) continue
  if (!routerText.includes(directory.name)) {
    fail(
      `skills/${directory.name}: named by neither ${routerFiles.join(' nor ')}; ` +
        'a skill no router names cannot be reached by a gate',
    )
  }
}

const priorityOneContracts = [
  [
    'skills/3d-art-direction/SKILL.md',
    ['fov', 'lighting', 'material-order', 'tone-mapping', 'mobile-reframe', 'spatial-type'],
  ],
  [
    'skills/3d-runtime-quality/SKILL.md',
    ['poster', 'low', 'medium', 'high', 'cooldown-ms', 'offscreen'],
  ],
  [
    'skills/r3f-interaction/references/touch-and-gestures.md',
    ['setPointerCapture', 'pointercancel', 'lostpointercapture', 'touch-action', 'Pinch'],
  ],
  [
    'skills/shaders-tsl/references/webgpu-feature-matrix.md',
    ['WebGPU', 'WebGL2 fallback', 'TSL postprocessing', 'Compute dependency', 'Known limitations'],
  ],
  // A module list without the five fields is the prose list T2.2 forbids.
  [
    'skills/shaders-tsl/references/module-index.md',
    [
      '| Renderer support |',
      '| Cost class |',
      '| Reduced motion |',
      '| Colour space |',
      '| Fixture |',
      '| Copy from |',
      'templates/shaders/',
      'noCombine',
    ],
  ],
  [
    'skills/shaders-tsl/SKILL.md',
    ['references/module-index.md'],
  ],
  [
    'commands/verify.md',
    ['desktop-full.png', 'mobile-full.png', 'reduced-motion-a.png', 'fallback-full.png', 'visual'],
  ],
]

for (const [file, markers] of priorityOneContracts) {
  const fullPath = path.join(pluginRoot, file)
  if (!fs.existsSync(fullPath)) {
    fail(`${file}: missing Priority-1 artifact`)
    continue
  }
  const content = read(fullPath).toLowerCase()
  for (const marker of markers) {
    if (!content.includes(marker.toLowerCase())) {
      fail(`${file}: missing Priority-1 marker "${marker}"`)
    }
  }
}

const priorityTwoContracts = [
  [
    'skills/typography/SKILL.md',
    [
      'pairings-and-roles.md',
      'hierarchy-and-loading.md',
      'licensing-and-alternatives.md',
    ],
  ],
  [
    'skills/typography/references/licensing-and-alternatives.md',
    ['OFL-1.1', 'Commercial', 'OS-bundled/restricted', 'Open-source alternative'],
  ],
  [
    'skills/content-design/SKILL.md',
    ['claims-and-proof.md', 'microcopy.md', 'localization.md', 'claim/proof ledger'],
  ],
  [
    'skills/core-rules/references/responsive-recomposition.md',
    ['Wide', 'Portrait', 'Narrow', 'Reframe', 'source order'],
  ],
  [
    'tests/forward/cases.json',
    ['saas', 'editorial', 'dashboard', '3d-hero', 'configurator'],
  ],
]

for (const [file, markers] of priorityTwoContracts) {
  const fullPath = path.join(pluginRoot, file)
  if (!fs.existsSync(fullPath)) {
    fail(`${file}: missing Priority-2 artifact`)
    continue
  }
  const content = read(fullPath).toLowerCase()
  for (const marker of markers) {
    if (!content.includes(marker.toLowerCase())) {
      fail(`${file}: missing Priority-2 marker "${marker}"`)
    }
  }
}

const hardeningContracts = [
  [
    'skills/core-rules/SKILL.md',
    ['Routing protocol', 'not recursive', 'access traces', 'Generic content/layout hierarchy'],
  ],
  [
    'scripts/forward-trace.mjs',
    [
      'auditCodexTrace',
      'auditClaudeTrace',
      'broadReads',
      'estimatedPluginTokens',
      'offRootReads',
      'foreignSkills',
      'replayRecordedTraces',
      'pluginTreeDigest',
    ],
  ],
  [
    'scripts/run-forward-tests.mjs',
    [
      'probeProvider',
      'providerErrorMessage',
      'UNAVAILABLE',
      '--provider-cli',
      '--trace-dir',
      '--require-live',
      'setting-sources',
    ],
  ],
  [
    'scripts/forward-schema.mjs',
    ['strictObjectSchemaFailures', 'additionalProperties', 'required'],
  ],
  [
    'scripts/release.mjs',
    ['Release-Tag', 'UNAVAILABLE', 'pluginTreeDigest', 'rev-list', 'bannedPhrases'],
  ],
  [
    'tests/forward/traces/claude-dashboard.expected.json',
    ['claude', 'accessedFiles', 'forbiddenFiles', 'treeSha256'],
  ],
  [
    'scripts/verify-browser.mjs',
    ['--probe', 'WDU_PLAYWRIGHT_CLI', 'run-code', 'UNAVAILABLE'],
  ],
  [
    'commands/verify.md',
    ['PASS | FAIL | UNAVAILABLE', 'scripts/verify-browser.mjs', 'host browser'],
  ],
  [
    'skills/3d-runtime-quality/SKILL.md',
    ['PASS', 'FAIL', 'UNAVAILABLE', 'NOT_APPLICABLE', 'launch gate', 'unverified'],
  ],
]

for (const [file, markers] of hardeningContracts) {
  const fullPath = path.join(pluginRoot, file)
  if (!fs.existsSync(fullPath)) {
    fail(`${file}: missing routing/verify hardening artifact`)
    continue
  }
  const content = read(fullPath).toLowerCase()
  for (const marker of markers) {
    if (!content.includes(marker.toLowerCase())) {
      fail(`${file}: missing routing/verify marker "${marker}"`)
    }
  }
}

/**
 * Comparable scene captures require one contract to bind time, random streams,
 * camera position, and readiness. Keep its activation narrow: normal design and
 * 3D planning do not need this leaf unless reproducible runtime evidence is in
 * scope.
 */
const determinismContracts = [
  [
    'skills/core-rules/references/determinism.md',
    [
      'WDU_DETERMINISTIC=1',
      'performance.now()',
      'Math.random()',
      'seed-name',
      'camera-stations',
      'data-wdu-ready="true"',
      'first stable frame',
      'interaction checkpoints',
      'interaction-checkpoints.schema.json',
      'baseline comparison',
      'baseline-comparison.schema.json',
    ],
  ],
  [
    'skills/core-rules/references/interaction-checkpoints.schema.json',
    [
      'wdu://interaction-checkpoints/v1',
      'WDU_DETERMINISTIC=1',
      'lose-webgl-context',
      'readyMarker',
    ],
  ],
  [
    'skills/core-rules/references/baseline-comparison.schema.json',
    [
      'wdu://baseline-comparison/v1',
      'structural-regression',
      'perceptual-difference',
      'expected-dynamic-variation',
      'nondeterministic-content',
      'never an aesthetic verdict',
    ],
  ],
  [
    'skills/core-rules/SKILL.md',
    ['determinism.md', 'reproducible dynamic capture'],
  ],
  [
    'skills/canvas-first-architecture/references/scene-state-and-clock.md',
    ['core-rules/references/determinism.md'],
  ],
  [
    'commands/verify.md',
    [
      'WDU_DETERMINISTIC=1',
      'data-wdu-ready="true"',
      'first stable frame',
      '--checkpoints',
      'compare-baselines.mjs',
    ],
  ],
  [
    'README.md',
    [
      'core-rules/references/determinism.md',
      'reproducible dynamic capture',
      'interaction-checkpoints.schema.json',
      'baseline-comparison.schema.json',
    ],
  ],
]

for (const [file, markers] of determinismContracts) {
  const fullPath = path.join(pluginRoot, file)
  if (!fs.existsSync(fullPath)) {
    fail(`${file}: missing determinism contract artifact`)
    continue
  }
  const content = read(fullPath).toLowerCase()
  for (const marker of markers) {
    if (!content.includes(marker.toLowerCase())) {
      fail(`${file}: missing determinism marker "${marker}"`)
    }
  }
}

/**
 * Reference material is useful only when its influence remains inspectable.
 * Bind the complete input gate, every leaf in the downstream art-direction
 * contract, the concrete poster target, and the predecessor routing edge.
 */
const referenceIntakeContracts = [
  [
    'skills/reference-intake/SKILL.md',
    [
      'six to ten',
      'PNG',
      'SVG',
      'written token block',
      'traceable-extraction.md',
      'templates/reference-intake.md',
      'poster target',
      'before scene code',
      'before `3d-art-direction`',
      'does not activate this skill',
    ],
  ],
  [
    'skills/reference-intake/references/traceable-extraction.md',
    ['source-frame', '`unknown`', 'contradiction', 'poster target', 'before scene code'],
  ],
  [
    'skills/reference-intake/templates/reference-intake.md',
    ['written-token-block', 'poster-target', 'scene-code-status: blocked'],
  ],
  [
    'skills/immersive-3d/SKILL.md',
    ['reference-intake', 'six to ten', 'written token block', 'before `3d-art-direction`'],
  ],
  [
    'skills/3d-art-direction/SKILL.md',
    ['reference-intake', 'source-frame', 'unknown', 'poster target'],
  ],
  [
    'skills/core-rules/SKILL.md',
    ['reference-intake', 'six to ten', 'written token block'],
  ],
  [
    'commands/immersive.md',
    ['reference-intake', 'six to ten', 'written token block', 'before scene code'],
  ],
  [
    'README.md',
    ['reference-intake', 'six to ten', 'written token block', 'before `3d-art-direction`'],
  ],
]

for (const [file, markers] of referenceIntakeContracts) {
  const fullPath = path.join(pluginRoot, file)
  if (!fs.existsSync(fullPath)) {
    fail(`${file}: missing reference-intake artifact`)
    continue
  }
  const content = read(fullPath).toLowerCase()
  for (const marker of markers) {
    if (!content.includes(marker.toLowerCase())) {
      fail(`${file}: missing reference-intake marker "${marker}"`)
    }
  }
}

/**
 * Procedural generation owns geometry before the asset pipeline owns
 * validation. Bind the exact five-method catalogue, the reversible
 * deterministic Blender contract, the justified-only Houdini interchange,
 * and the explicit handoff without a second pipeline.
 */
const proceduralContracts = [
  [
    'skills/procedural-3d/SKILL.md',
    [
      'procedural-3d',
      'crystal growth',
      'Voronoi',
      'marching cubes',
      'curl noise',
      'L-system',
      '3d-asset-pipeline',
      'inspect',
      'validate',
      'optimize',
      'reversible',
      'deterministic seed',
      'named collection',
      'Geometry Nodes',
      'versions',
      'geometry statistics',
      'material statistics',
      'separate `.blend`',
      'web output',
      'rerun',
      'rollback',
      'automated GLB export',
      'handoff',
      'no second',
      'Houdini',
      'interchange',
      'justified',
      'volume',
      'simulation',
      'never a dependency',
      'generic VDB',
      'SDF',
      'npm',
      'does not activate this skill',
      'use only when',
    ],
  ],
  [
    'skills/procedural-3d/references/catalogue.md',
    [
      'crystal growth',
      'Voronoi',
      'marching cubes',
      'curl noise',
      'L-system',
      'resolution',
      'iterations',
      'sample',
      'symbol growth',
      'CPU',
      'memory',
      'geometry',
      'determinism',
    ],
  ],
  [
    'skills/procedural-3d/references/blender-contract.md',
    [
      'reversible',
      'named collection',
      'deterministic seed',
      'Blender version',
      'geometry statistics',
      'material statistics',
      'separate',
      '.blend',
      'web output',
      'rerun',
      'rollback',
      'automated GLB',
      'inspect',
      'validate',
      'optimize',
    ],
  ],
  [
    'skills/procedural-3d/references/houdini-interchange.md',
    [
      'Houdini',
      'interchange',
      'justified',
      'volume',
      'simulation',
      'never a dependency',
      'generic VDB',
      'paid',
      'credential',
    ],
  ],
  [
    'README.md',
    [
      'procedural-3d',
      '3d-asset-pipeline',
      'before `3d-asset-pipeline`',
    ],
  ],
]

for (const [file, markers] of proceduralContracts) {
  const fullPath = path.join(pluginRoot, file)
  if (!fs.existsSync(fullPath)) {
    fail(`${file}: missing procedural-3d artifact`)
    continue
  }
  const content = read(fullPath).toLowerCase()
  for (const marker of markers) {
    if (!content.includes(marker.toLowerCase())) {
      fail(`${file}: missing procedural-3d marker "${marker}"`)
    }
  }
}

const materialLookdevContracts = [
  [
    'skills/material-lookdev/SKILL.md',
    [
      'material-lookdev',
      'ice',
      'frost',
      'glass',
      'metal',
      'matte',
      'physical fields',
      'environment tiers',
      'material-recipes.md',
      'physical-fields.md',
      'environment-tiers.md',
      'standard-material color alone',
      'does not activate this skill',
      '?e=lookdev',
      'reduced motion',
      'poster',
    ],
  ],
  [
    'skills/material-lookdev/references/material-recipes.md',
    ['Ice', 'Frost', 'Glass', 'Metal', 'Matte', 'baseColor', 'roughness', 'metalness', 'transmission', 'IOR', 'thickness', 'MeshStandardMaterial'],
  ],
  [
    'skills/material-lookdev/references/physical-fields.md',
    ['baseColor', 'roughness', 'metalness', 'transmission', 'ior', 'thickness', 'attenuationColor', 'attenuationDistance', 'clearcoat', 'iridescence', 'MeshStandardMaterial', 'MeshPhysicalMaterial', 'sRGB', 'linear RGB'],
  ],
  [
    'skills/material-lookdev/references/environment-tiers.md',
    ['Poster', 'Low', 'Medium', 'High', 'maxTextureSize', 'maxSpecularSamples', 'dynamic', 'procedural', 'HDRI', 'dispose', 'reduced-cost'],
  ],
]

for (const [file, markers] of materialLookdevContracts) {
  const fullPath = path.join(pluginRoot, file)
  if (!fs.existsSync(fullPath)) {
    fail(`${file}: missing material-lookdev artifact`)
    continue
  }
  const content = read(fullPath).toLowerCase()
  for (const marker of markers) {
    if (!content.includes(marker.toLowerCase())) {
      fail(`${file}: missing material-lookdev marker "${marker}"`)
    }
  }
}

const artDirectionTraceFields = [
  'visual-thesis',
  'hero-subject',
  'camera.framing',
  'camera.fov',
  'camera.position',
  'camera.target',
  'camera.near-far',
  'composition.subject-anchor',
  'composition.dom-safe-area',
  'lighting',
  'material-order',
  'color-output',
  'tone-mapping',
  'mobile-reframe',
  'spatial-type',
  'poster-frame',
]
const referenceIntakeTemplatePath = path.join(
  skillsRoot,
  'reference-intake',
  'templates',
  'reference-intake.md',
)
if (fs.existsSync(referenceIntakeTemplatePath)) {
  const template = read(referenceIntakeTemplatePath)
  const observedFields = [...template.matchAll(/^\s*- field:\s+([a-z.-]+)\s*$/gm)].map(
    (match) => match[1],
  )
  if (JSON.stringify(observedFields) !== JSON.stringify(artDirectionTraceFields)) {
    fail(
      `skills/reference-intake/templates/reference-intake.md: traced fields must be exactly ${artDirectionTraceFields.join(', ')}`,
    )
  }
  const sourceSlots = [...template.matchAll(/^\s+source-frame:\s+(?:unknown|frame-\d{2})\s*$/gm)]
  if (sourceSlots.length !== artDirectionTraceFields.length) {
    fail(
      `skills/reference-intake/templates/reference-intake.md: expected ${artDirectionTraceFields.length} source-frame slots, found ${sourceSlots.length}`,
    )
  }
}

const antiSlopContracts = [
  [
    'skills/anti-slop/SKILL.md',
    [
      'prose-tells.md',
      'design-tells.md',
      'locale-de.md',
      'tier2-vocabulary.md',
      'operations.md',
      'Tier 1',
      'Tier 2',
      'Tier 3',
      'protect list',
      'specificity floor',
      'lint-copy.mjs',
      'NO-COPY',
      'detect',
      'rewrite',
    ],
  ],
  [
    'skills/anti-slop/references/prose-tells.md',
    ['negative parallelism', 'vague attribution', 'swap test', 'Tier 1', 'Tier 2'],
  ],
  [
    'skills/anti-slop/references/tier2-vocabulary.md',
    ['seamless', 'delve', 'paradigm shift', 'not a ban'],
  ],
  [
    'skills/anti-slop/references/operations.md',
    ['.anti-slop-protect.json', 'NO-COPY', '--self', 'blind spots', 'style-directions'],
  ],
  [
    'skills/anti-slop/references/design-tells.md',
    ['badge above the h1', 'edge strip', 'squint test', '8', 'uniformity'],
  ],
  [
    'skills/anti-slop/references/locale-de.md',
    ['nicht nur', 'nahtlos', 'du', 'sie', 'umlaut'],
  ],
  [
    'skills/core-rules/SKILL.md',
    ['anti-slop'],
  ],
  [
    'skills/content-design/SKILL.md',
    ['anti-slop'],
  ],
  [
    'commands/audit.md',
    ['lint-copy.mjs', 'anti-slop'],
  ],
  [
    'commands/design.md',
    ['anti-slop'],
  ],
  [
    'commands/tweak.md',
    ['anti-slop', 'lint-copy.mjs', 'NO-COPY'],
  ],
  [
    'scripts/lint-copy.mjs',
    ['--profile', '--protect', '--locale', 'marketing', 'docs', 'editorial'],
  ],
]

for (const [file, markers] of antiSlopContracts) {
  const fullPath = path.join(pluginRoot, file)
  if (!fs.existsSync(fullPath)) {
    fail(`${file}: missing anti-slop artifact`)
    continue
  }
  const content = read(fullPath).toLowerCase()
  for (const marker of markers) {
    if (!content.includes(marker.toLowerCase())) {
      fail(`${file}: missing anti-slop marker "${marker}"`)
    }
  }
}

const compositionContracts = [
  [
    'skills/core-rules/references/composition-contract.md',
    [
      'visual-thesis',
      'focal-element',
      'first-screen-occupancy',
      'asymmetry',
      'dominant-contrast',
      'quiet-zones',
      'signature-move',
    ],
  ],
  [
    'skills/style-directions/references/signature-moves.md',
    ['Overprint', 'Density inversion', 'Invariant it must not break', 'per viewport'],
  ],
  [
    'skills/core-rules/SKILL.md',
    ['composition-contract.md', 'DESIGN_VARIANCE', 'MOTION_INTENSITY', 'VISUAL_DENSITY'],
  ],
  [
    'skills/style-directions/SKILL.md',
    ['signature-moves.md', 'Divergence before commitment', 'Token block'],
  ],
  [
    'skills/component-patterns/SKILL.md',
    ['signature-moves.md', 'composition-contract'],
  ],
]

for (const [file, markers] of compositionContracts) {
  const fullPath = path.join(pluginRoot, file)
  if (!fs.existsSync(fullPath)) {
    fail(`${file}: missing composition artifact`)
    continue
  }
  const content = read(fullPath).toLowerCase()
  for (const marker of markers) {
    if (!content.includes(marker.toLowerCase())) {
      fail(`${file}: missing composition marker "${marker}"`)
    }
  }
}

/**
 * The canvas-first layer inverts the plugin's default assumption: the document
 * stops owning the page. Bind the fields that keep the invariants reachable
 * under that inversion, because a contract nothing validates decays into a
 * heading.
 */
const canvasFirstContracts = [
  [
    'skills/canvas-first-architecture/SKILL.md',
    [
      'dom-parallel-layer',
      'focus-model',
      'section-contract',
      'deep-link-model',
      'motion-opt-out',
      'audio-opt-out',
      'poster-route',
      'input-parity',
    ],
  ],
  [
    'skills/canvas-first-architecture/references/parallel-dom-layer.md',
    ['skip', 'focus', 'forced-colors', 'live region', 'static twin'],
  ],
  [
    'skills/render-graph/SKILL.md',
    ['scale', 'ping-pong', 'tone map', 'unencoded', 'budget-full-res-passes'],
  ],
  [
    'skills/render-graph/references/buffers-and-precision.md',
    ['half float', 'resize', 'dispose', 'depth'],
  ],
  [
    'skills/loading-choreography/SKILL.md',
    ['progress-source', 'critical-bucket', 'warm-up', 'skip-path', 'failure-path'],
  ],
  [
    'skills/loading-choreography/references/warmup-and-first-frame.md',
    ['compil', 'upload', 'first meaningful frame', 'reveal'],
  ],
  [
    'skills/spatial-audio/SKILL.md',
    ['unlock-gesture', 'default-state', 'ducking', 'opt-out', '1.4.2'],
  ],
  [
    'skills/motion-system/references/frame-rate-independence.md',
    ['exp(', 'lambda', 'clamp', 'sub-step'],
  ],
  // The add-ons only stay optional while their owners point at them by name.
  [
    'skills/immersive-3d/SKILL.md',
    [
      'canvas-first-architecture',
      'render-graph',
      'loading-choreography',
      'spatial-audio',
      'gpu-particle-systems',
      'procedural-3d',
      'Budget class',
    ],
  ],
  [
    'skills/core-rules/SKILL.md',
    ['canvas-first-architecture', 'not an exemption'],
  ],
]

for (const [file, markers] of canvasFirstContracts) {
  const fullPath = path.join(pluginRoot, file)
  if (!fs.existsSync(fullPath)) {
    fail(`${file}: missing canvas-first artifact`)
    continue
  }
  const content = read(fullPath).toLowerCase()
  for (const marker of markers) {
    if (!content.includes(marker.toLowerCase())) {
      fail(`${file}: missing canvas-first marker "${marker}"`)
    }
  }
}

/**
 * A description that only says when a skill applies competes for every
 * neighbouring task. Each expensive or evidence-specific skill states its
 * activating condition and, explicitly, what does not activate it. Without the
 * negative sentence a router pulls it into ordinary 2D and 3D work, which is the
 * cost this plugin's routing model exists to avoid.
 */
const negativeGatedSkills = [
  'canvas-first-architecture',
  'gpu-particle-systems',
  'loading-choreography',
  'material-lookdev',
  'procedural-3d',
  'reference-intake',
  'render-graph',
  'spatial-audio',
]

for (const name of negativeGatedSkills) {
  const file = path.join(skillsRoot, name, 'SKILL.md')
  if (!fs.existsSync(file)) {
    fail(`skills/${name}: missing negative-gated skill`)
    continue
  }
  const description = (parseFrontmatter(read(file), file).description ?? '').trim()
  if (!/\bdoes not activate this skill\.?$/i.test(description)) {
    fail(
      `skills/${name}: description must close with the sentence naming what does not activate it`,
    )
  }
  if (!/\buse only when\b/i.test(description)) {
    fail(`skills/${name}: description must state the single condition that activates it`)
  }
  if (name === 'reference-intake') {
    for (const marker of [
      'six to ten',
      'written token block',
      'named direction',
      'without reference material',
    ]) {
      if (!description.toLowerCase().includes(marker)) {
        fail(`skills/reference-intake: description must contain "${marker}"`)
      }
    }
  }
  if (name === 'gpu-particle-systems') {
    for (const marker of [
      'thousands',
      'persistent',
      'spatial field',
      'trails',
      'volume morphing',
      'decorative dust',
      'sparkle',
      'small instanced',
      'short burst',
      'single click shockwave',
    ]) {
      if (!description.toLowerCase().includes(marker)) {
        fail(`skills/gpu-particle-systems: description must contain "${marker}"`)
      }
    }
  }
  if (name === 'procedural-3d') {
    for (const marker of [
      'procedural',
      'crystal growth',
      'voronoi',
      'marching cubes',
      'curl noise',
      'l-system',
      'imported glb',
      'inspection',
    ]) {
      if (!description.toLowerCase().includes(marker)) {
        fail(`skills/procedural-3d: description must contain "${marker}"`)
      }
    }
  }
  if (name === 'material-lookdev') {
    for (const marker of [
      'physical',
      'transmission',
      'refraction',
      'clearcoat',
      'iridescence',
      'attenuation',
      'environment',
      'standard-material color alone',
    ]) {
      if (!description.toLowerCase().includes(marker)) {
        fail(`skills/material-lookdev: description must contain "${marker}"`)
      }
    }
  }
}

/**
 * A direction without a token block is measured against a generic default, which
 * is the failure the block exists to remove. Bind every direction to one, and
 * bind its motion profile to a profile `motion-system` actually defines.
 */
const directionFamilies = ['product.md', 'editorial.md', 'expressive.md']
const directionTokenKeys = [
  'grid',
  'type-ratio',
  'space-scale',
  'section-padding',
  'radius',
  'dominant-contrast',
  'motion-profile',
]
const motionProfiles = new Set(['emil', 'jakub', 'jhey'])
let directionCount = 0

for (const name of directionFamilies) {
  const file = path.join(skillsRoot, 'style-directions', 'references', name)
  if (!fs.existsSync(file)) {
    fail(`skills/style-directions/references/${name}: missing direction family`)
    continue
  }
  const markdown = read(file)
  const headings = [...markdown.matchAll(/^## .+$/gm)]
  const blocks = [...markdown.matchAll(/```yaml\n([\s\S]*?)```/g)]
  if (headings.length !== blocks.length) {
    fail(
      `style-directions/${name}: ${headings.length} direction(s) but ${blocks.length} token block(s)`,
    )
  }
  for (const block of blocks) {
    directionCount += 1
    const values = {}
    for (const line of block[1].split('\n')) {
      const field = line.match(/^([a-z-]+):\s+(.+)$/)
      if (field) values[field[1]] = field[2].trim()
    }
    const label = `style-directions/${name} token block ${directionCount}`
    for (const key of directionTokenKeys) {
      if (!values[key]) fail(`${label}: missing ${key}`)
    }
    const profile = values['motion-profile']
    if (profile && !motionProfiles.has(profile)) {
      fail(`${label}: unknown motion-profile "${profile}"`)
    }
  }
}

if (directionCount !== 12) {
  fail(`expected 12 direction token blocks, found ${directionCount}`)
}

/**
 * The linter is the executable form of the catalogue; the references are the
 * human form. Bind them so a rule cannot enter the script undocumented.
 *
 * The English side spans two files since 1.7.0: the structural tells stayed in
 * prose-tells.md, which every copy task reads, while the Tier-2 word list moved
 * to a leaf that only a hand-judged cluster needs. Both are part of the binding
 * surface — splitting the reference must not let a term go undocumented.
 */
const proseTells = [
  read(path.join(skillsRoot, 'anti-slop', 'references', 'prose-tells.md')),
  read(path.join(skillsRoot, 'anti-slop', 'references', 'tier2-vocabulary.md')),
].join('\n')
const localeDeTells = read(path.join(skillsRoot, 'anti-slop', 'references', 'locale-de.md'))

function normalizeTerm(value) {
  return value
    .toLowerCase()
    .replace(/[’‘']/g, "'")
    .replace(/[-\u2013\u2014]/g, ' ')
    .replace(/\s+/g, ' ')
}

function documented(reference, term) {
  const haystack = normalizeTerm(reference)
  const value = normalizeTerm(term)
  if (haystack.includes(value)) return true
  const stem = value.slice(0, Math.max(5, value.length - 3))
  return stem.length >= 4 && haystack.includes(stem)
}

let boundTerms = 0
for (const [locale, reference] of [
  ['en', proseTells],
  ['de', localeDeTells],
]) {
  for (const term of TIER2[locale]) {
    boundTerms += 1
    if (!documented(reference, term)) {
      fail(`skills/anti-slop: Tier-2 term "${term}" (${locale}) is not documented in its reference`)
    }
  }
  for (const [rule] of TIER1[locale]) {
    const tokens = rule.split('-').filter((token) => token.length > 3)
    if (!tokens.every((token) => documented(reference, token))) {
      fail(`skills/anti-slop: Tier-1 rule "${rule}" (${locale}) is not documented in its reference`)
    }
  }
}

for (const profile of ['marketing', 'docs', 'editorial']) {
  if (!PROFILES[profile]) fail(`scripts/lint-copy.mjs: missing "${profile}" register profile`)
}

const copyExpectations = JSON.parse(
  read(path.join(pluginRoot, 'tests/copy/expected.json')),
)
let copyCases = 0

function runLinter(args) {
  const result = spawnSync(
    process.execPath,
    [path.join(pluginRoot, 'scripts', 'lint-copy.mjs'), ...args, '--json'],
    { encoding: 'utf8' },
  )
  if (!result.stdout) return null
  try {
    return JSON.parse(result.stdout)
  } catch {
    return null
  }
}

for (const testCase of copyExpectations.cases) {
  copyCases += 1
  const fixture = path.join(pluginRoot, 'tests/copy/fixtures', testCase.fixture)
  if (!fs.existsSync(fixture)) {
    fail(`tests/copy: missing fixture ${testCase.fixture}`)
    continue
  }
  const localeArguments = testCase.locales
    ? ['--locale', testCase.locales.join(',')]
    : []
  // A case with profileMode "auto" passes no --profile, because the thing under
  // test is the register the linter picks per file. Passing one would silence
  // exactly the decision the case exists to check.
  const profileArguments =
    testCase.profileMode === 'auto' ? [] : ['--profile', testCase.profile]
  const report = runLinter(['--path', fixture, ...profileArguments, ...localeArguments])
  if (!report) {
    fail(`tests/copy: linter produced no report for ${testCase.fixture}`)
    continue
  }
  const localeLabel = testCase.locales?.join('+') ?? 'auto'
  const label = `tests/copy ${testCase.fixture} (${testCase.profile}/${localeLabel})`
  if (report.status !== testCase.status) {
    fail(`${label}: expected ${testCase.status}, got ${report.status}`)
  }
  if (testCase.localeMode && report.localeMode !== testCase.localeMode) {
    fail(`${label}: expected localeMode ${testCase.localeMode}, got ${report.localeMode}`)
  }
  if (testCase.detectedLocales) {
    const detected = [
      ...new Set(
        Object.values(report.localeDetection ?? {}).flatMap(
          (detection) => detection.locales ?? [],
        ),
      ),
    ].sort()
    const expected = [...testCase.detectedLocales].sort()
    if (JSON.stringify(detected) !== JSON.stringify(expected)) {
      fail(`${label}: detected locales ${detected.join('+')}, expected ${expected.join('+')}`)
    }
  }
  for (const [key, tier] of [
    ['minTier1', 'tier1'],
    ['minTier2', 'tier2'],
    ['minTier3', 'tier3'],
  ]) {
    if (testCase[key] !== undefined && report[tier] < testCase[key]) {
      fail(`${label}: ${tier} was ${report[tier]}, expected at least ${testCase[key]}`)
    }
  }
  // Proves the extractor's boundary, not just its reach: a rule that fires on
  // a message id, a class attribute, or an identifier is a false positive the
  // tier counts alone cannot distinguish from a real hit.
  for (const rule of testCase.forbiddenRules ?? []) {
    const hit = (report.findings ?? []).find((finding) => finding.rule === rule)
    if (hit) {
      fail(`${label}: rule ${rule} must not fire here, matched "${hit.quote}"`)
    }
  }
  // The mirror of forbiddenRules, and the guard the German set was missing: a
  // minimum tier count says a fixture is dirty, never which tell it covers. A
  // rule written to fit the fixture instead of the language keeps that count
  // green forever. Naming the rules the text must trigger is what makes the
  // fixture a claim about the language rather than about the regex.
  for (const rule of testCase.requiredRules ?? []) {
    if (!(report.findings ?? []).some((finding) => finding.rule === rule)) {
      fail(`${label}: rule ${rule} must fire here, but did not`)
    }
  }
  // The line is part of the finding. A report that names the right rule at the
  // wrong line sends a reader to a line they did not write, and every count and
  // rule-name assertion above stays green while it does. Each entry names a rule
  // and every source line it must be reported at, so a missing hit and a
  // misplaced one fail differently.
  for (const [rule, expected] of Object.entries(testCase.lines ?? {})) {
    const observed = (report.findings ?? [])
      .filter((finding) => finding.rule === rule)
      .map((finding) => finding.line)
      .sort((left, right) => left - right)
    const wanted = [expected].flat().sort((left, right) => left - right)
    if (JSON.stringify(observed) !== JSON.stringify(wanted)) {
      fail(
        `${label}: rule ${rule} reported at line(s) ${observed.join(', ') || 'none'}, expected ${wanted.join(', ')}`,
      )
    }
  }
  if (testCase.filesWithoutCopy !== undefined) {
    const observed = (report.filesWithoutCopy ?? []).length
    if (observed !== testCase.filesWithoutCopy) {
      fail(`${label}: ${observed} file(s) without copy, expected ${testCase.filesWithoutCopy}`)
    }
  }
  // Coverage is part of the verdict. A directory fixture that silently loses a
  // file reports the same PASS as one that read everything, so the file count,
  // the register split, and the number of skipped directories are all asserted.
  if (testCase.files !== undefined && report.files !== testCase.files) {
    fail(`${label}: read ${report.files} file(s), expected ${testCase.files}`)
  }
  if (testCase.registers) {
    const observed = JSON.stringify(
      Object.fromEntries(Object.entries(report.registers ?? {}).sort()),
    )
    const expected = JSON.stringify(
      Object.fromEntries(Object.entries(testCase.registers).sort()),
    )
    if (observed !== expected) {
      fail(`${label}: registers ${observed}, expected ${expected}`)
    }
  }
  if (testCase.skippedDirectories !== undefined) {
    const observed = (report.skippedDirectories ?? []).length
    if (observed !== testCase.skippedDirectories) {
      fail(
        `${label}: skipped ${observed} director(y|ies), expected ${testCase.skippedDirectories}`,
      )
    }
  }
}

const selfLint = runLinter(['--self'])
if (!selfLint) {
  fail('scripts/lint-copy.mjs --self produced no report')
} else if (selfLint.status !== 'PASS') {
  fail(
    `scripts/lint-copy.mjs --self reports ${selfLint.status} on the plugin's own prose (tier1 ${selfLint.tier1}, tier3 ${selfLint.tier3})`,
  )
}

/**
 * IP-05D — executable root surfaces. ADR-011 keeps starters, the lab, and
 * implementation fixtures outside the installed plugin tree, so the plugin's
 * self-lint never saw them. A plugin whose central claim is a deterministic
 * copy linter cannot ship starters whose copy was never linted. This block
 * discovers the root surfaces from the repository root, lints each starter's
 * declared copy surfaces with the real linter, rejects placeholder copy that
 * the linter is not built to judge, and declares the lab copy-free by design
 * instead of hiding it behind exit code 2.
 */
const repoRoot = path.resolve(pluginRoot, '..')

/**
 * Generated and vendor output is declared, not discovered. Reading
 * `next-env.d.ts` or a lockfile reports a NO-COPY warning for text that was
 * never written as copy, and build output holds whole copies of the
 * repository. The linter's own walk already skips dot-directories and the
 * build-output directory set; this list is the explicit contract the
 * root-surface discovery asserts: none of these paths may ever appear in a
 * starter's lint report.
 */
const GENERATED_VENDOR_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'output',
  'coverage',
  'vendor',
])
const GENERATED_VENDOR_FILES = new Set([
  'next-env.d.ts',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
])

function isGeneratedVendorPath(file) {
  const normalized = String(file).replaceAll('\\', '/')
  const segments = normalized.split('/')
  const base = segments[segments.length - 1]
  if (GENERATED_VENDOR_FILES.has(base) || base.endsWith('.tsbuildinfo')) return true
  // Dot-directories are skipped by the linter's own walk. `.` and `..` are
  // cwd-relative path artifacts, not walked directories, so they never count.
  return segments.some(
    (segment) =>
      (segment.startsWith('.') && segment !== '.' && segment !== '..') ||
      GENERATED_VENDOR_DIRECTORIES.has(segment),
  )
}

/**
 * The copy a visitor reads, reduced to the same extracted surface the linter
 * judges. The markers are deliberately narrow: `content-design` permits
 * explicit placeholders where a fact is unknown, so this gate must name the
 * starter failure mode — shipped page copy that was never written — not the
 * word "placeholder" itself.
 */
const PLACEHOLDER_COPY_PATTERNS = [
  /\blorem\s+ipsum\b/gi,
  /\byour\s+(?:headline|title|subtitle|hero|brand|company|business|name|logo|text|copy|content|tagline|slogan|message|product|service|project|image|photo|picture)\s+(?:goes\s+)?here\b/gi,
  /\[(?:your|insert|add)\s+[^\]]{2,80}\]/gi,
  /\b(?:insert|add)\s+your\s+(?:text|copy|headline|content|title)\s+(?:here|below)\b/gi,
]

function discoverRootSurfaces(root) {
  const surfaces = []
  const startersDirectory = path.join(root, 'starters')
  if (fs.existsSync(startersDirectory)) {
    for (const entry of fs.readdirSync(startersDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      surfaces.push({
        kind: 'starter',
        name: entry.name,
        root: path.join(startersDirectory, entry.name),
      })
    }
  }
  const labDirectory = path.join(root, 'lab')
  if (fs.existsSync(labDirectory)) {
    surfaces.push({ kind: 'lab', name: 'lab', root: labDirectory })
  }
  return surfaces
}

/**
 * Conventional shipped-copy surfaces inside a starter. Everything else in the
 * tree — lib/, tests/, public/, lockfiles, generated files — is excluded by
 * construction: it is source or output, not copy. A starter with none of
 * these surfaces is structurally broken and fails before a lint runs.
 */
function starterCopySurfacePaths(starterRoot) {
  const candidates = [
    'app',
    'components',
    'pages',
    'content',
    'src/app',
    'src/components',
  ]
  const surfaces = candidates
    .map((name) => path.join(starterRoot, name))
    .filter((candidate) => fs.existsSync(candidate))
  const readme = path.join(starterRoot, 'README.md')
  if (fs.existsSync(readme)) surfaces.push(readme)
  return surfaces
}

function lintStarterCopy(surface) {
  const surfacePaths = starterCopySurfacePaths(surface.root)
  if (!surfacePaths.length) return { surfacePaths, report: null, placeholders: [], excludedSeen: [] }
  const report = runLinter(surfacePaths.flatMap((surfacePath) => ['--path', surfacePath]))
  const placeholders = []
  const excludedSeen = []
  if (!report) return { surfacePaths, report: null, placeholders, excludedSeen }
  for (const file of new Set([
    ...Object.keys(report.measurements ?? {}),
    ...(report.filesWithoutCopy ?? []),
  ])) {
    if (isGeneratedVendorPath(file)) excludedSeen.push(file)
  }
  for (const file of Object.keys(report.measurements ?? {})) {
    const absolute = path.resolve(file)
    if (!fs.existsSync(absolute)) continue
    const body = extract(read(absolute), path.extname(absolute).toLowerCase()).body
    for (const pattern of PLACEHOLDER_COPY_PATTERNS) {
      for (const match of body.matchAll(pattern)) {
        placeholders.push({
          file,
          quote: match[0].replace(/\s+/g, ' ').trim().slice(0, 120),
        })
      }
    }
  }
  return { surfacePaths, report, placeholders, excludedSeen }
}

function checkStarterSurface(surface, options = {}) {
  const { surfacePaths, report, placeholders, excludedSeen } = lintStarterCopy(surface)
  const label = `starters/${surface.name}`
  if (!surfacePaths.length) {
    fail(
      `${label}: no copy surface (app/, components/, pages/, content/, src/app/, src/components/, README.md)`,
    )
    return { surfacePaths, report, placeholders, excludedSeen }
  }
  if (!report) {
    fail(`${label}: linter produced no report`)
    return { surfacePaths, report, placeholders, excludedSeen }
  }
  if (report.status !== 'PASS') {
    fail(
      `${label}: copy lint reports ${report.status} (tier1 ${report.tier1}, tier3 ${report.tier3}); NO-COPY is not a pass on an executable surface`,
    )
  }
  for (const file of excludedSeen) {
    fail(`${label}: generated/vendor output ${file} entered the copy lint; it must stay excluded`)
  }
  if (options.expectPlaceholders) {
    if (!placeholders.length) {
      fail(`${label}: fixture must fail the placeholder gate, but no placeholder copy was found`)
    }
  } else {
    for (const placeholder of placeholders) {
      fail(`${label}: placeholder copy in ${placeholder.file}: "${placeholder.quote}"`)
    }
  }
  return { surfacePaths, report, placeholders, excludedSeen }
}

/** Count the lab's own source files without descending into generated output. */
function countLabSources(labRoot) {
  let count = 0
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (isGeneratedVendorPath(target)) continue
        walk(target)
      } else if (entry.isFile() && !isGeneratedVendorPath(target)) {
        count += 1
      }
    }
  }
  walk(labRoot)
  return count
}

const starterSurfaceSummaries = []
const labSurfaceSummaries = []
for (const surface of discoverRootSurfaces(repoRoot)) {
  if (surface.kind === 'lab') {
    labSurfaceSummaries.push(`lab (${countLabSources(surface.root)} source file(s))`)
    continue
  }
  const result = checkStarterSurface(surface)
  starterSurfaceSummaries.push(
    `${surface.name} (${result.surfacePaths.length} surface(s), ${result.report?.files ?? 0} file(s))`,
  )
}

/**
 * The regression fixture proves the discovery semantics, not just the linter
 * rules. The polished starter must pass exactly like a live starter. The
 * placeholder starter must fail the placeholder gate while the linter alone
 * still passes it, so the gate is the mechanism under test; if the linter
 * ever grows a placeholder rule, this fixture expectation moves to FAIL. The
 * lab fixture must be declared structurally with its routes, never linted
 * into a NO-COPY verdict. The polished fixture's `dist/` and `next-env.d.ts`
 * carry bait copy: reading them would flip the verdict, so the exclusions
 * stay proven.
 */
const rootSurfaceFixture = path.join(
  pluginRoot,
  'tests/copy/fixtures/root-surfaces',
)
if (fs.existsSync(rootSurfaceFixture)) {
  let fixtureStarterCount = 0
  let fixtureLabCount = 0
  for (const surface of discoverRootSurfaces(rootSurfaceFixture)) {
    if (surface.kind === 'lab') {
      fixtureLabCount += 1
      if (countLabSources(surface.root) === 0) {
        fail('tests/copy/fixtures/root-surfaces: lab fixture must carry routes with deliberately no copy')
      }
      continue
    }
    fixtureStarterCount += 1
    checkStarterSurface(surface, {
      expectPlaceholders: surface.name === 'placeholder',
    })
  }
  if (fixtureStarterCount !== 2) {
    fail('tests/copy/fixtures/root-surfaces: expected the polished and placeholder starter fixtures')
  }
  if (fixtureLabCount !== 1) {
    fail('tests/copy/fixtures/root-surfaces: expected one lab fixture surface')
  }
} else {
  fail('tests/copy/fixtures/root-surfaces: missing root-surface regression fixture')
}

if (starterSurfaceSummaries.length) {
  notes.push(`root starter copy: ${starterSurfaceSummaries.join(', ')}`)
} else {
  notes.push('root starter copy: no starters discovered outside the plugin tree')
}
if (labSurfaceSummaries.length) {
  notes.push(`root lab surfaces declared copy-free: ${labSurfaceSummaries.join(', ')}`)
}

const forwardCases = JSON.parse(read(path.join(pluginRoot, 'tests/forward/cases.json')))
const responseSchema = JSON.parse(
  read(path.join(pluginRoot, 'tests/forward/response.schema.json')),
)
for (const failure of strictObjectSchemaFailures(responseSchema)) {
  fail(`tests/forward/response.schema.json: ${failure}`)
}
for (const testCase of forwardCases) {
  if (
    !testCase.trace?.allowedSkills?.length ||
    !Array.isArray(testCase.trace.allowedReferences) ||
    !Array.isArray(testCase.trace.requiredFiles) ||
    !Array.isArray(testCase.trace.forbiddenFiles) ||
    !Number.isInteger(testCase.trace.maxReferenceFiles) ||
    !Number.isInteger(testCase.trace.maxEstimatedPluginTokens)
  ) {
    fail(`tests/forward/cases.json: ${testCase.id} missing complete trace budget`)
  }
}

const determinismReference = 'skills/core-rules/references/determinism.md'
for (const testCase of forwardCases) {
  if (!testCase.trace?.forbiddenFiles?.includes(determinismReference)) {
    fail(
      `tests/forward/cases.json: ${testCase.id} must forbid determinism.md when reproducible runtime evidence is not requested`,
    )
  }
}

const referenceIntakeSkill = 'skills/reference-intake/SKILL.md'
for (const testCase of forwardCases) {
  if (!testCase.trace?.forbiddenFiles?.includes(referenceIntakeSkill)) {
    fail(
      `tests/forward/cases.json: ${testCase.id} must forbid reference-intake without a six-to-ten-frame set and written token block`,
    )
  }
}

const proceduralSkill = 'skills/procedural-3d/SKILL.md'
for (const testCase of forwardCases) {
  if (!testCase.trace?.forbiddenFiles?.includes(proceduralSkill)) {
    fail(
      `tests/forward/cases.json: ${testCase.id} must forbid procedural-3d without explicit procedural geometry generation`,
    )
  }
}

const materialLookdevSkill = 'skills/material-lookdev/SKILL.md'
for (const testCase of forwardCases) {
  if (!testCase.trace?.forbiddenFiles?.includes(materialLookdevSkill)) {
    fail(
      `tests/forward/cases.json: ${testCase.id} must forbid material-lookdev without an explicit physical material or environment-tier requirement`,
    )
  }
}

const referenceIntakeNegativeCase = forwardCases.find(
  (testCase) => testCase.id === 'named-direction-no-references',
)
if (!referenceIntakeNegativeCase) {
  fail('tests/forward/cases.json: missing text-only named-direction negative case')
} else {
  const prompt = referenceIntakeNegativeCase.prompt ?? ''
  for (const marker of ['text-only', 'named', 'no reference', 'token block']) {
    if (!prompt.toLowerCase().includes(marker)) {
      fail(`tests/forward/cases.json: named-direction-no-references prompt must contain "${marker}"`)
    }
  }
  for (const skill of ['immersive-3d', '3d-art-direction', '3d-runtime-quality']) {
    if (!referenceIntakeNegativeCase.requiredSkills?.includes(skill)) {
      fail(`tests/forward/cases.json: named-direction-no-references must require ${skill}`)
    }
  }
  if (
    referenceIntakeNegativeCase.requiredSkills?.includes('reference-intake') ||
    referenceIntakeNegativeCase.trace?.allowedSkills?.includes('reference-intake') ||
    !referenceIntakeNegativeCase.trace?.forbiddenFiles?.includes(referenceIntakeSkill)
  ) {
    fail('tests/forward/cases.json: text-only named direction must forbid reference-intake')
  }
}

for (const testCase of forwardCases) {
  if (testCase.forbiddenTerms === undefined) continue
  const { paths, patterns } = testCase.forbiddenTerms
  if (!Array.isArray(paths) || !paths.length || !Array.isArray(patterns) || !patterns.length) {
    fail(`tests/forward/cases.json: ${testCase.id} forbiddenTerms needs paths and patterns`)
    continue
  }
  for (const pattern of patterns) {
    try {
      new RegExp(pattern, 'i')
    } catch {
      fail(`tests/forward/cases.json: ${testCase.id} invalid forbiddenTerms regex "${pattern}"`)
    }
  }
  for (const scope of paths) {
    if (!scope.includes('.')) {
      fail(
        `tests/forward/cases.json: ${testCase.id} forbiddenTerms path "${scope}" is a whole subtree and would match the model's own commentary`,
      )
    }
  }
}

const slopCase = forwardCases.find((testCase) => testCase.id === 'slop')
if (!slopCase) {
  fail('tests/forward/cases.json: missing the anti-slop forward case')
} else {
  if (!slopCase.requiredSkills?.includes('anti-slop')) {
    fail('tests/forward/cases.json: slop case must require the anti-slop route')
  }
  if (!slopCase.lintCopy?.path) {
    fail('tests/forward/cases.json: slop case must lint the generated copy with the real linter')
  }
  if (!slopCase.forbiddenTerms?.patterns?.length) {
    fail('tests/forward/cases.json: slop case must forbid the extras the linter does not gate')
  }
  for (const pattern of slopCase.forbiddenTerms?.patterns ?? []) {
    for (const [locale, rules] of Object.entries(TIER1)) {
      if (rules.some(([, rule]) => rule.source === pattern)) {
        fail(
          `tests/forward/cases.json: slop case restates linter rule ${locale} pattern "${pattern}"; let lintCopy enforce the catalogue`,
        )
      }
    }
  }
  if (
    !slopCase.trace?.requiredFiles?.includes('skills/anti-slop/references/prose-tells.md')
  ) {
    fail('tests/forward/cases.json: slop case must require prose-tells.md read evidence')
  }
  if (
    !slopCase.trace?.forbiddenFiles?.includes('skills/anti-slop/references/design-tells.md')
  ) {
    fail('tests/forward/cases.json: slop case must forbid design-tells.md for a copy-only task')
  }
}

const dashboardCase = forwardCases.find((testCase) => testCase.id === 'dashboard')
for (const file of [
  'skills/color-palettes/references/editorial-natural.md',
  'skills/color-palettes/references/expressive.md',
]) {
  if (!dashboardCase?.trace?.forbiddenFiles?.includes(file)) {
    fail(`tests/forward/cases.json: dashboard must forbid ${file}`)
  }
}
if (
  !dashboardCase?.trace?.requiredFiles?.includes(
    'skills/color-palettes/references/neutral-product.md',
  )
) {
  fail('tests/forward/cases.json: dashboard must require neutral-product.md read evidence')
}

const claudeManifest = JSON.parse(
  read(path.join(pluginRoot, '.claude-plugin', 'plugin.json')),
)
const codexManifest = JSON.parse(
  read(path.join(pluginRoot, '.codex-plugin', 'plugin.json')),
)

if (claudeManifest.version !== codexManifest.version) {
  fail('Claude and Codex manifest versions differ')
}
const marketplacePath = path.resolve(pluginRoot, '..', '.claude-plugin', 'marketplace.json')
let marketplaceEntry = null
if (fs.existsSync(marketplacePath)) {
  const marketplace = JSON.parse(read(marketplacePath))
  marketplaceEntry = marketplace.plugins?.find(
    (plugin) => plugin.name === claudeManifest.name,
  )
  if (!marketplaceEntry) {
    fail(`../.claude-plugin/marketplace.json: missing ${claudeManifest.name} entry`)
  } else if (marketplaceEntry.version !== undefined) {
    fail(
      '../.claude-plugin/marketplace.json: omit the duplicate plugin version; plugin.json is the update source of truth',
    )
  }
}
if ((codexManifest.interface?.defaultPrompt?.length ?? 0) > 3) {
  fail('Codex defaultPrompt contains more than three entries')
}

const readmePath = path.join(pluginRoot, 'README.md')
const readme = read(readmePath)
const readmeVersion = readme.match(/^Version\s+(\d+\.\d+\.\d+)\b/m)?.[1] ?? null
if (readmeVersion !== claudeManifest.version) {
  fail(
    `README.md: lead version ${readmeVersion ?? 'missing'} differs from manifest ${claudeManifest.version}`,
  )
}

/**
 * The README is the first thing an installation reads, and it was 52 KB: a
 * changelog copy, the full file tree, and every contract in longhand. Detail
 * belongs in docs/, where nobody pays for it before they want it.
 */
const readmeSizeLimit = 12 * 1024
const readmeSize = fs.statSync(readmePath).size
if (readmeSize > readmeSizeLimit) {
  fail(`README.md: ${readmeSize} bytes exceeds the ${readmeSizeLimit}-byte budget; move detail into docs/`)
}
if (/\n## Version\n/.test(readme)) {
  fail('README.md: version history belongs in CHANGELOG.md, not in a second copy here')
}

const readmeIntroduction = readme.split('\n## Structure')[0]
const readmeCurrentDocumentation = readme.split('\n## Version')[0]
const progressiveSection =
  readme.match(/## Progressive disclosure\n([\s\S]*?)(?=\n## )/)?.[1] ?? ''
const currentRoutingClaimSurfaces = [
  ['../.claude-plugin/marketplace.json description', marketplaceEntry?.description],
  ['.claude-plugin/plugin.json description', claudeManifest.description],
  ['.claude-plugin/plugin.json keywords', claudeManifest.keywords?.join(' ')],
  ['.codex-plugin/plugin.json description', codexManifest.description],
  ['.codex-plugin/plugin.json keywords', codexManifest.keywords?.join(' ')],
  ['.codex-plugin/plugin.json interface', JSON.stringify(codexManifest.interface ?? {})],
  ['README.md introduction', readmeIntroduction],
  ['README.md current documentation', readmeCurrentDocumentation],
]
for (const [label, content] of currentRoutingClaimSurfaces) {
  if (/\btrace[- ](?:proven|validated)\b/i.test(content ?? '')) {
    fail(`${label}: outcome claim exceeds committed routing evidence; describe the trace-audit capability`)
  }
}
if (/\b(?:suite|dashboard case)[^.]*\bproves?\b/i.test(progressiveSection)) {
  fail('README.md progressive-disclosure section: a current routing sample is described as proof')
}
if (!progressiveSection.includes('Intended routing contracts')) {
  fail('README.md progressive-disclosure section: routing examples are not labeled as contracts')
}

const evidenceSection =
  readme.match(/### Committed evidence scope\n([\s\S]*?)(?=\n### |\n## )/)?.[1] ?? ''
for (const marker of [
  'two historical Claude traces',
  '`dashboard`',
  '`slop`',
  'other five cases',
  'Codex behavior',
]) {
  if (!evidenceSection.includes(marker)) {
    fail(`README.md committed-evidence scope is missing "${marker}"`)
  }
}

const stalePatterns = [
  ["from 'framer-motion'", 'legacy framer-motion import'],
  ['from "framer-motion"', 'legacy framer-motion import'],
  ['React 18/19', 'ambiguous R3F compatibility claim'],
  // A ruleset that requires evidence for every claim may not ship an
  // unverifiable provenance claim of its own. Release sections anchor on a
  // resolvable Release-Tag; scripts/release.mjs verifies it.
  ['Commit-SHA: nicht verfügbar', 'unverifiable release provenance claim'],
  ['Commit-SHA: not available', 'unverifiable release provenance claim'],
]

for (const fullPath of walkFiles(pluginRoot)) {
  const file = relative(fullPath)
  if (file.startsWith('tests/forward/traces/')) continue
  if (!/\.(md|json)$/.test(file)) continue
  const content = read(fullPath)
  for (const [pattern, label] of stalePatterns) {
    if (content.includes(pattern)) {
      fail(`${file}: ${label}`)
    }
  }
}

const paletteDirectory = path.join(skillsRoot, 'color-palettes', 'references')
let paletteCount = 0
let contrastCheckCount = 0
let compositedPaletteCount = 0

function requireContrast(label, foreground, background, minimum) {
  contrastCheckCount += 1
  const ratio = contrast(foreground, background)
  if (ratio < minimum) {
    fail(`${label} contrast ${ratio.toFixed(2)} (minimum ${minimum.toFixed(1)})`)
  }
}

for (const name of fs.readdirSync(paletteDirectory)) {
  if (!name.endsWith('.md')) continue
  const markdown = read(path.join(paletteDirectory, name))
  const blocks = markdown.matchAll(/```yaml\n([\s\S]*?)```/g)

  for (const block of blocks) {
    paletteCount += 1
    const values = {}
    for (const line of block[1].split('\n')) {
      const field = line.match(/^([a-z-]+):\s+"([^"]+)"/)
      if (field) values[field[1]] = field[2]
    }

    const requiredColors = [
      'bg',
      'surface',
      'border',
      'divider',
      'text',
      'muted',
      'action',
      'on-action',
      'focus',
      'danger',
      'on-danger',
      'disabled',
    ]
    for (const key of requiredColors) {
      if (!values[key]) fail(`${name} palette ${paletteCount}: missing ${key}`)
    }
    if (requiredColors.some((key) => !values[key])) continue

    const colors = {}
    let invalidColor = false
    for (const key of requiredColors) {
      colors[key] = parseColor(values[key])
      if (!colors[key]) {
        fail(`${name} palette ${paletteCount}: invalid ${key} color "${values[key]}"`)
        invalidColor = true
      }
    }
    if (invalidColor) continue
    if (colors.bg[3] !== 1) {
      fail(`${name} palette ${paletteCount}: bg must be opaque`)
      continue
    }

    const label = `${name} palette ${paletteCount}`
    const background = colors.bg
    const surface = composite(colors.surface, background)
    if (colors.surface[3] < 1 || colors.border[3] < 1) {
      compositedPaletteCount += 1
    }

    requireContrast(`${label}: text/bg`, colors.text, background, 4.5)
    requireContrast(`${label}: muted/bg`, colors.muted, background, 4.5)
    requireContrast(`${label}: on-action/action`, colors['on-action'], colors.action, 4.5)

    for (const [surfaceName, backdrop] of [
      ['bg', background],
      ['surface', surface],
    ]) {
      requireContrast(
        `${label}: focus/${surfaceName}`,
        composite(colors.focus, backdrop),
        backdrop,
        3,
      )
      requireContrast(
        `${label}: border/${surfaceName}`,
        composite(colors.border, backdrop),
        backdrop,
        3,
      )
      // A divider carries no information, so WCAG sets no minimum for it. Its
      // contract is the opposite one: it must be visible at all, and it must
      // be quieter than the border — otherwise the palette ships two loud
      // lines and the 3:1 border rule silently becomes the house style.
      const dividerRatio = contrast(composite(colors.divider, backdrop), backdrop)
      const borderRatio = contrast(composite(colors.border, backdrop), backdrop)
      contrastCheckCount += 1
      if (dividerRatio < 1.1) {
        fail(
          `${label}: divider/${surfaceName} contrast ${dividerRatio.toFixed(2)} is invisible (minimum 1.1)`,
        )
      } else if (dividerRatio >= borderRatio) {
        fail(
          `${label}: divider/${surfaceName} contrast ${dividerRatio.toFixed(2)} is not quieter than border ${borderRatio.toFixed(2)}`,
        )
      }
      requireContrast(
        `${label}: danger/${surfaceName}`,
        composite(colors.danger, backdrop),
        backdrop,
        4.5,
      )
      requireContrast(
        `${label}: disabled/${surfaceName}`,
        composite(colors.disabled, backdrop),
        backdrop,
        3,
      )
    }

    requireContrast(
      `${label}: on-danger/danger`,
      colors['on-danger'],
      colors.danger,
      4.5,
    )

    if (colors.surface[3] < 1) {
      requireContrast(`${label}: text/composited-surface`, colors.text, surface, 4.5)
      requireContrast(`${label}: muted/composited-surface`, colors.muted, surface, 4.5)
    }
  }
}

if (paletteCount !== 20) {
  fail(`expected 20 palettes, found ${paletteCount}`)
}

notes.push(`${skillDirectories.length} skills`)
notes.push(`${documentedPathCount} documented paths resolved`)
notes.push(`${negativeGatedSkills.length} negative-gated skills`)
notes.push(`${commandDirectories.length} commands`)
notes.push(`${paletteCount} palettes / ${contrastCheckCount} state contrast checks`)
notes.push(`${directionCount} direction token blocks`)
notes.push(`${compositedPaletteCount} composited glass palette`)
notes.push(`${boundTerms} bound anti-slop terms`)
notes.push(`${copyCases} copy-lint regression cases`)
notes.push(`manifest version ${codexManifest.version}`)

if (failures.length) {
  console.error(`Validation failed (${failures.length})`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Validation passed: ${notes.join(', ')}`)
