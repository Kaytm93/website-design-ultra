#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PROFILES, TIER1, TIER2 } from './lint-copy.mjs'
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

if (skillDirectories.length !== 17) {
  fail(`expected 17 skills, found ${skillDirectories.length}`)
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
if (commandDirectories.length !== 5) {
  fail(`expected 5 commands, found ${commandDirectories.length}`)
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

const antiSlopContracts = [
  [
    'skills/anti-slop/SKILL.md',
    [
      'prose-tells.md',
      'design-tells.md',
      'locale-de.md',
      'Tier 1',
      'Tier 2',
      'Tier 3',
      'protect list',
      'specificity floor',
      'lint-copy.mjs',
      'detect',
      'rewrite',
    ],
  ],
  [
    'skills/anti-slop/references/prose-tells.md',
    ['negative parallelism', 'vague attribution', 'swap test', 'Tier 1', 'Tier 2'],
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

/**
 * The linter is the executable form of the catalogue; the references are the
 * human form. Bind them so a rule cannot enter the script undocumented.
 */
const proseTells = read(path.join(skillsRoot, 'anti-slop', 'references', 'prose-tells.md'))
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
  const report = runLinter([
    '--path',
    fixture,
    '--profile',
    testCase.profile,
    ...localeArguments,
  ])
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
  if (testCase.filesWithoutCopy !== undefined) {
    const observed = (report.filesWithoutCopy ?? []).length
    if (observed !== testCase.filesWithoutCopy) {
      fail(`${label}: ${observed} file(s) without copy, expected ${testCase.filesWithoutCopy}`)
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
  'other four cases',
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
notes.push(`${commandDirectories.length} commands`)
notes.push(`${paletteCount} palettes / ${contrastCheckCount} state contrast checks`)
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
