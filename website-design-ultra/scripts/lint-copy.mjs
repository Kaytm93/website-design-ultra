#!/usr/bin/env node

/**
 * Deterministic copy linter for the anti-slop skill.
 *
 * Tier 1 patterns always fail. Tier 2 vocabulary fails only as a cluster or
 * inside a heading, because a single flagged word is usually the correct word.
 * Tier 3 budgets are measured and reported as numbers.
 *
 * A pass proves the absence of catalogued patterns. It does not prove the copy
 * is true, specific, or worth reading. See skills/anti-slop/SKILL.md §7.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const pluginRoot = path.resolve(path.dirname(scriptPath), '..')

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.mdx',
  '.markdown',
  '.tsx',
  '.jsx',
  '.ts',
  '.js',
  '.html',
  '.htm',
  '.txt',
])

/** Tier 1 — structural forms that carry no information. */
export const TIER1 = {
  en: [
    ['negative-parallelism', /\bit(?:'|’)?s not (?:just |only |merely )?[^.!?\n]{1,60}?[,.—–-]\s*(?:it(?:'|’)?s|but)\b/i],
    ['negative-parallelism', /\bnot (?:just|only|merely) [^.!?\n]{2,60}?,?\s+but\b/i],
    ['more-than-just', /\bmore than just\b/i],
    ['triple-negation', /\bnot [\w\s]{1,24}\.\s*not [\w\s]{1,24}\./i],
    ['throat-clearing', /\b(?:here(?:'|’)?s the thing|let(?:'|’)?s be (?:honest|clear)|let me be clear|i(?:'|’)?ll be honest|make no mistake)\b/i],
    ['faux-insight', /\b(?:most (?:people|teams|companies|founders|developers) (?:get this wrong|don(?:'|’)?t realize|miss this)|what (?:most people|nobody) get(?:s)? wrong)\b/i],
    ['rhetorical-setup', /\b(?:what if (?:i|we) told you|imagine a world where|think about it for a|plot twist|here(?:'|’)?s why that matters)\b/i],
    ['superficial-analysis', /,\s(?:highlighting|underscoring|showcasing|emphasizing|reflecting|demonstrating|signaling|signalling|marking) (?:the|a|an|its|their|how)\b/i],
    ['importance-puffery', /\b(?:play(?:s|ing)? an? (?:pivotal|crucial|vital|key|integral|essential) role|is a testament to|stands as a testament|cannot be overstated)\b/i],
    ['vague-attribution', /\b(?:experts? (?:agree|say|note)|studies show|research shows|it(?:'|’)?s widely (?:known|believed)|many believe)\b/i],
    ['false-range', /\bfrom (?:solo|small|startups?|individuals?|freelancers?|hobbyists?|students?|indie)[\w\s-]{0,24} to (?:global|enterprises?|fortune|multinational|large|the world)[\w\s-]{0,24}/i],
    ['false-range', /\bwhether you(?:'|’)?re an? [^.!?\n]{3,40} or an? [^.!?\n]{3,40}/i],
    ['summary-recap', /^\s*(?:#{1,6}\s*)?(?:in (?:conclusion|summary)|to summari[sz]e|overall,|in short,|bottom line:)\b/im],
    ['audience-flattery', /\b(?:for (?:builders|makers|creators|teams|founders|people) (?:like you|who care)|you(?:'|’)?re not alone (?:here|in this))\b/i],
    ['unlock-potential', /\b(?:unlock|unleash|realize) (?:the|your|its) (?:full )?potential\b/i],
    ['next-level', /\b(?:to|reach) the next level\b/i],
    ['fast-paced-world', /\bin today(?:'|’)?s (?:fast[- ]paced|ever[- ]changing|digital) world\b/i],
  ],
  de: [
    ['negative-parallelism', /\bnicht nur\b[^.!?\n]{3,80}\bsondern auch\b/i],
    ['importance-puffery', /\bes ist wichtig zu beachten\b/i],
    ['rhetorical-setup', /\bwas wäre,? wenn\b/i],
    ['discovery-opener', /\bentdecke,? wie\b/i],
    ['metaphor-opener', /\btauche? ein in\b/i],
    ['ad-formula', /\bsag(?:e)? tschüss zu\b/i],
    ['next-level', /\bauf das nächste level\b/i],
    ['vague-attribution', /\bviele experten sind sich einig\b/i],
    ['staged-transition', /\bdoch (?:damit ist es nicht getan|das ist noch nicht alles)\b/i],
    ['summary-recap', /^\s*(?:#{1,6}\s*)?fazit\s*:/im],
    ['actorless-passive', /\bwird (?:sichergestellt|gewährleistet),? dass\b/i],
    ['unlock-potential', /\bdas (?:volle |gesamte )?potenzial (?:entfalten|ausschöpfen|freisetzen)\b/i],
    ['english-em-dash', /—/],
  ],
}

/** Tier 2 — vocabulary. Documented in skills/anti-slop/references/. */
export const TIER2 = {
  en: [
    'delve', 'leverage', 'utilize', 'facilitate', 'foster', 'empower',
    'streamline', 'harness', 'supercharge', 'elevate', 'revolutionize',
    'underscore', 'showcase', 'curate',
    'seamless', 'robust', 'cutting-edge', 'innovative', 'holistic',
    'bespoke', 'effortless', 'intuitive', 'transformative', 'unparalleled',
    'world-class', 'next-generation', 'crucial', 'vital', 'pivotal', 'intricate',
    'paradigm shift', 'game changer', 'game-changer', 'tapestry', 'synergy',
    'cornerstone', 'blueprint', 'testament', 'deep dive', 'treasure trove',
    "it's worth noting", 'at the end of the day', 'at its core', 'let’s dive in',
    'the key to success',
  ],
  de: [
    'revolutionieren', 'eintauchen', 'vertiefen', 'unterstreichen',
    'sicherstellen', 'gewährleisten', 'optimieren', 'transformieren',
    'adressieren', 'implementieren', 'priorisieren', 'erschließen',
    'entfesseln', 'befähigen', 'kultivieren', 'kuratieren',
    'nahtlos', 'ganzheitlich', 'maßgeschneidert', 'facettenreich',
    'zukunftsorientiert', 'essenziell', 'bahnbrechend', 'beispiellos',
    'bemerkenswert', 'nuanciert', 'skalierbar', 'unzählig',
    'paradigmenwechsel', 'synergie', 'mehrwert', 'fundgrube', 'leuchtturm',
    'dreh- und angelpunkt', 'grundstein', 'wegbereiter', 'blaupause',
    'zusammenspiel', 'zweifelsohne', 'letztendlich',
  ],
}

/**
 * Tier-3 sensitivity is register-dependent. A reference document legitimately
 * uses dense headings, bold term lists and dashes for definitions; a hero
 * headline does not. Tier 1 and Tier 2 vocabulary rules are unaffected, except
 * for the headline em-dash rule, which only applies where headlines are copy.
 */
export const PROFILES = {
  marketing: {
    emDashWordsPer: 300,
    tripletWordsPer: 200,
    sentenceVariationMin: 0.35,
    boldLeadRatioMax: 0.5,
    boldLeadMinItems: 4,
    headingWordsMin: 40,
    ornamentMax: 2,
    tier2ClusterMin: 3,
    emDashInHeading: true,
  },
  docs: {
    emDashWordsPer: 120,
    sentenceVariationMin: 0.22,
    tripletWordsPer: null,
    boldLeadRatioMax: null,
    boldLeadMinItems: 6,
    headingWordsMin: 12,
    ornamentMax: null,
    tier2ClusterMin: 5,
    emDashInHeading: false,
  },
  editorial: {
    emDashWordsPer: 400,
    sentenceVariationMin: 0.4,
    tripletWordsPer: null,
    boldLeadRatioMax: 0.4,
    boldLeadMinItems: 4,
    headingWordsMin: 80,
    ornamentMax: 1,
    tier2ClusterMin: 3,
    emDashInHeading: false,
  },
}

export const BUDGETS = {
  sentenceVariationMinCount: 5,
  tier2ClusterPer: 200,
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u
const ORNAMENT = /[→⇒▸✦✧★]/

function escapeTerm(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Tier-2 lists stay in base form so they bind 1:1 to the reference files.
 * Inflection is handled here instead of duplicating word forms.
 */
function termPattern(term, locale) {
  const escaped = escapeTerm(term)
  if (/[\s-]/.test(term)) return escaped
  if (locale === 'de') {
    if (term.length > 5 && term.endsWith('en')) {
      return `${escapeTerm(term.slice(0, -2))}(?:en|t|te|ten|tes|end|ende|enden)`
    }
    return `${escaped}(?:e|en|em|er|es|et|te|ten|tes|ter|end|ende|enden|ste|sten)?`
  }
  if (term.endsWith('e')) return `${escapeTerm(term.slice(0, -1))}(?:e|es|ed|ing|ely)`
  return `${escaped}(?:s|es|ed|ing|ly)?`
}

function usage() {
  console.log(`Usage:
  node scripts/lint-copy.mjs --path <file|dir> [--path ...] [options]
  node scripts/lint-copy.mjs --stdin [options]
  node scripts/lint-copy.mjs --self

Options:
  --locale <en|de>     rule set; repeat or comma-separate for both (default en)
  --profile <name>     marketing (default), docs, or editorial Tier-3 sensitivity
  --protect <file>     protect list JSON; entries need a reason to apply
  --json               machine-readable report
  --strict             also fail on Tier-2 clusters
  --help               this text

Exit codes: 0 pass, 1 Tier-1 hit or Tier-3 breach (or Tier-2 with --strict), 2 usage error.

A pass proves the absence of catalogued patterns, not that the copy is true or
specific. See skills/anti-slop/SKILL.md.`)
}

function die(message) {
  console.error(`lint-copy: ${message}`)
  process.exit(2)
}

function parseArguments(argv) {
  const options = {
    paths: [],
    locales: [],
    protect: null,
    json: false,
    strict: false,
    stdin: false,
    self: false,
    profile: 'marketing',
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--path') options.paths.push(argv[++index])
    else if (argument === '--locale') options.locales.push(...String(argv[++index]).split(','))
    else if (argument === '--protect') options.protect = argv[++index]
    else if (argument === '--json') options.json = true
    else if (argument === '--strict') options.strict = true
    else if (argument === '--stdin') options.stdin = true
    else if (argument === '--self') options.self = true
    else if (argument === '--profile') options.profile = argv[++index]
    else if (argument === '--help') {
      usage()
      process.exit(0)
    } else die(`unknown argument "${argument}"`)
  }
  if (options.paths.some((value) => !value)) die('--path needs a value')
  if (!options.locales.length) options.locales = ['en']
  for (const locale of options.locales) {
    if (!TIER1[locale]) die(`unsupported locale "${locale}"`)
  }
  if (!PROFILES[options.profile]) die(`unsupported profile "${options.profile}"`)
  if (options.self) {
    options.profile = 'docs'
    options.paths.push(path.join(pluginRoot, 'README.md'), path.join(pluginRoot, 'commands'), path.join(pluginRoot, 'skills'))
  }
  if (!options.paths.length && !options.stdin) die('pass --path, --stdin, or --self')
  return options
}

function loadProtect(file) {
  const applied = []
  const rejected = []
  if (!file) return { applied, rejected }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const entry of [...(parsed.terms ?? []), ...(parsed.patterns ?? [])]) {
    const isPattern = (parsed.patterns ?? []).includes(entry)
    if (!entry?.value) continue
    if (!entry.reason || !String(entry.reason).trim()) {
      rejected.push(entry.value)
      continue
    }
    try {
      applied.push(
        isPattern
          ? new RegExp(entry.value, 'i')
          : new RegExp(`\\b${escapeTerm(entry.value)}\\b`, 'i'),
      )
    } catch {
      rejected.push(entry.value)
    }
  }
  return { applied, rejected }
}

function collectFiles(targets) {
  const files = []
  for (const target of targets) {
    if (!fs.existsSync(target)) die(`no such path "${target}"`)
    const stats = fs.statSync(target)
    if (stats.isFile()) {
      files.push(target)
      continue
    }
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      const next = path.join(target, entry.name)
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', '.next', 'output'].includes(entry.name)) continue
        files.push(...collectFiles([next]))
      } else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(next)
      }
    }
  }
  return [...new Set(files)]
}

/**
 * Reduce a source file to the text a visitor actually reads. Best effort for
 * JSX and HTML: it favours missing a string over inventing a finding.
 */
function extract(content, extension) {
  const headings = []
  let body = content

  if (['.md', '.mdx', '.markdown'].includes(extension)) {
    body = body
      .replace(/^---\n[\s\S]*?\n---\n/, '')
      .replace(/```[\s\S]*?```/g, '\n')
      .replace(/~~~[\s\S]*?~~~/g, '\n')
      .replace(/`[^`\n]*`/g, ' ')
      .replace(/^>.*$/gm, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    for (const match of body.matchAll(/^#{1,4}\s+(.+)$/gm)) headings.push(match[1].trim())
    return {
      body,
      prose: body.replace(/^\s*\|.*\|\s*$/gm, ''),
      headings,
      listItems: [...content.matchAll(/^\s*[-*+]\s+(.*)$/gm)].map((match) => match[1]),
      labels: [],
    }
  }

  if (['.html', '.htm'].includes(extension)) {
    body = body
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
    for (const match of body.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)) {
      headings.push(match[1].replace(/<[^>]+>/g, ' ').trim())
    }
    return {
      body: body.replace(/<[^>]+>/g, ' '),
      headings,
      listItems: [],
      labels: [...body.matchAll(/>([^<>]{2,40})</g)].map((match) => match[1].trim()),
    }
  }

  // JSX / TS: visible text nodes plus copy-bearing props.
  const pieces = []
  const source = body
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*(?:import|export)\s.*$/gm, ' ')
    .replace(/className=(?:"[^"]*"|'[^']*'|\{`[^`]*`\})/g, ' ')
    .replace(/class="[^"]*"/g, ' ')
  for (const match of source.matchAll(/>([^<>{}]+)</g)) {
    const text = match[1].replace(/\s+/g, ' ').trim()
    if (text.length > 2 && /[a-zA-ZÀ-ɏ]{3}/.test(text)) pieces.push(text)
  }
  const propPattern =
    /\b(?:title|label|heading|subheading|subtitle|placeholder|alt|description|caption|tooltip|cta|message|helper|error|emptyState|ariaLabel|"aria-label")\s*[:=]\s*(?:\{?\s*)?["'`]([^"'`]{3,300})["'`]/g
  for (const match of source.matchAll(propPattern)) pieces.push(match[1].trim())
  for (const match of source.matchAll(/<h[1-3][^>]*>([^<]{3,200})</gi)) headings.push(match[1].trim())
  const labels = pieces.filter((piece) => piece.length <= 40)
  return { body: pieces.join('\n'), headings, listItems: [], labels }
}

function wordCount(text) {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length
}

function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter((value) => wordCount(value) >= 3)
}

function coefficientOfVariation(values) {
  if (values.length < 2) return null
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  if (!mean) return null
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance) / mean
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length
}

/**
 * Report line numbers against the original file, not the stripped body, so a
 * finding can be opened where it was written.
 */
function lineIn(original, text, fallbackIndex = 0) {
  const needle = String(text).replace(/\s+/g, ' ').trim().toLowerCase()
  if (needle) {
    const lines = original.split('\n')
    const probes = [needle.slice(0, 60), needle.split(' ').slice(0, 4).join(' ')]
    for (const probe of probes) {
      if (probe.length < 2) continue
      for (let index = 0; index < lines.length; index += 1) {
        const window = `${lines[index]} ${lines[index + 1] ?? ''}`
          .replace(/\s+/g, ' ')
          .toLowerCase()
        if (!window.includes(probe)) continue
        const single = lines[index].replace(/\s+/g, ' ').toLowerCase()
        if (single.includes(probe) || lines[index].trim()) return index + 1
        return index + 2
      }
    }
  }
  return lineOf(original, fallbackIndex)
}

function quote(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  return cleaned.length > 125 ? `${cleaned.slice(0, 122)}...` : cleaned
}

function protectedBy(text, protectList) {
  return protectList.some((pattern) => pattern.test(text))
}

function lintText({ file, content, extension, locales, protectList, profile }) {
  const budgets = { ...BUDGETS, ...PROFILES[profile] }
  const { body, prose = body, headings, listItems, labels } = extract(content, extension)
  const at = (text, fallbackIndex = 0) => lineIn(content, text, fallbackIndex)
  const findings = []
  const words = wordCount(body)
  const proseWords = wordCount(prose)

  for (const locale of locales) {
    for (const [name, pattern] of TIER1[locale]) {
      const scoped = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
      for (const match of body.matchAll(scoped)) {
        if (protectedBy(match[0], protectList)) continue
        findings.push({
          tier: 1,
          rule: `${locale}:${name}`,
          file,
          line: at(match[0], match.index ?? 0),
          quote: quote(match[0]),
        })
      }
    }
  }

  const tier2Hits = []
  for (const locale of locales) {
    for (const term of TIER2[locale]) {
      const pattern = new RegExp(`(?<![\\p{L}-])${termPattern(term, locale)}(?![\\p{L}])`, 'giu')
      const matches = [...body.matchAll(pattern)].filter((match) => !protectedBy(match[0], protectList))
      if (!matches.length) continue
      tier2Hits.push({ locale, term, count: matches.length, index: matches[0].index ?? 0 })
      for (const heading of headings) {
        if (new RegExp(pattern.source, 'iu').test(heading) && !protectedBy(heading, protectList)) {
          findings.push({
            tier: 2,
            rule: `${locale}:vocabulary-in-heading`,
            file,
            line: at(heading),
            quote: `${heading} / "${term}"`,
          })
        }
      }
    }
  }

  const clusterAllowance = Math.max(
    budgets.tier2ClusterMin,
    Math.ceil((words / BUDGETS.tier2ClusterPer) * budgets.tier2ClusterMin),
  )
  if (tier2Hits.length >= clusterAllowance && tier2Hits.length >= budgets.tier2ClusterMin) {
    findings.push({
      tier: 2,
      rule: 'vocabulary-cluster',
      file,
      line: at(tier2Hits[0].term, tier2Hits[0].index),
      quote: `${tier2Hits.length} distinct terms in ${words} words (allowance ${clusterAllowance}): ${tier2Hits
        .slice(0, 8)
        .map((hit) => hit.term)
        .join(', ')}`,
    })
  }

  const measurements = {}
  const rhythmText = prose
    .replace(/^#{1,6}\s.*$/gm, ' ')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+[^—\n]{0,48}—/gm, ' ')
  const emDashes = (rhythmText.match(/—/g) ?? []).length
  measurements.words = words
  measurements.proseWords = proseWords
  measurements.emDashes = emDashes
  measurements.emDashAllowance = Math.floor(proseWords / budgets.emDashWordsPer)
  if (emDashes >= 2 && emDashes > measurements.emDashAllowance) {
    findings.push({
      tier: 3,
      rule: 'em-dash-budget',
      file,
      line: at('—'),
      quote: `${emDashes} em dashes in ${proseWords} words (allowance ${measurements.emDashAllowance})`,
    })
  }
  for (const heading of headings) {
    if (budgets.emDashInHeading && /—/.test(heading)) {
      findings.push({
        tier: 1,
        rule: 'em-dash-in-heading',
        file,
        line: at(heading),
        quote: quote(heading),
      })
    }
    if (EMOJI.test(heading)) {
      findings.push({
        tier: 1,
        rule: 'emoji-in-heading',
        file,
        line: at(heading),
        quote: quote(heading),
      })
    }
  }

  for (const label of labels ?? []) {
    if (!EMOJI.test(label) || protectedBy(label, protectList)) continue
    findings.push({
      tier: 1,
      rule: 'emoji-in-ui-label',
      file,
      line: at(label),
      quote: quote(label),
    })
  }

  const triplets = [
    ...prose.matchAll(/\b[\p{L}-]+,\s+[\p{L}-]+,?\s+and\s+[\p{L}-]+\b/giu),
    ...prose.matchAll(/\b[\p{L}]+\.\s+[\p{L}]+\.\s+[\p{L}]+\.(?:\s|$)/gu),
  ]
  measurements.triplets = triplets.length
  measurements.tripletAllowance =
    budgets.tripletWordsPer === null
      ? null
      : Math.max(1, Math.floor(proseWords / budgets.tripletWordsPer))
  if (
    measurements.tripletAllowance !== null &&
    triplets.length > measurements.tripletAllowance
  ) {
    findings.push({
      tier: 3,
      rule: 'triplet-budget',
      file,
      line: at(triplets[0][0], triplets[0].index ?? 0),
      quote: `${triplets.length} triplets in ${proseWords} words (allowance ${measurements.tripletAllowance})`,
    })
  }

  const lengths = sentences(prose).map((sentence) => wordCount(sentence))
  measurements.sentences = lengths.length
  const variation = coefficientOfVariation(lengths)
  measurements.sentenceVariation = variation === null ? null : Number(variation.toFixed(3))
  if (
    lengths.length >= budgets.sentenceVariationMinCount &&
    variation !== null &&
    variation < budgets.sentenceVariationMin
  ) {
    findings.push({
      tier: 3,
      rule: 'sentence-variation',
      file,
      line: 1,
      quote: `coefficient of variation ${variation.toFixed(3)} over ${lengths.length} sentences (minimum ${budgets.sentenceVariationMin})`,
    })
  }

  if (budgets.boldLeadRatioMax !== null && listItems.length >= budgets.boldLeadMinItems) {
    const bold = listItems.filter((item) => /^\*\*[^*]+\*\*/.test(item.trim())).length
    const ratio = bold / listItems.length
    measurements.boldLeadRatio = Number(ratio.toFixed(2))
    if (ratio >= budgets.boldLeadRatioMax) {
      findings.push({
        tier: 3,
        rule: 'bold-lead-bullets',
        file,
        line: 1,
        quote: `${bold} of ${listItems.length} list items open with a bold lead-in`,
      })
    }
  }

  const fencedBytes = (content.match(/```[\s\S]*?```/g) ?? []).reduce(
    (total, block) => total + block.length,
    0,
  )
  measurements.fencedRatio = content.length
    ? Number((fencedBytes / content.length).toFixed(2))
    : 0
  if (
    measurements.fencedRatio < 0.5 &&
    headings.length >= 3 &&
    proseWords / headings.length < budgets.headingWordsMin
  ) {
    findings.push({
      tier: 3,
      rule: 'heading-density',
      file,
      line: 1,
      quote: `${headings.length} headings for ${proseWords} words (minimum ${budgets.headingWordsMin} words per heading)`,
    })
  }

  const ornaments = (prose.match(new RegExp(ORNAMENT.source, 'g')) ?? []).length
  measurements.ornaments = ornaments
  if (budgets.ornamentMax !== null && ornaments > budgets.ornamentMax) {
    findings.push({
      tier: 3,
      rule: 'ornament-density',
      file,
      line: at(prose.slice(prose.search(ORNAMENT), prose.search(ORNAMENT) + 20)),
      quote: `${ornaments} decorative arrow/sparkle characters`,
    })
  }

  return { findings, measurements }
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === scriptPath

if (!invokedDirectly) {
  // Imported for its rule tables (see scripts/validate-content.mjs).
} else {
  runCli()
}

function runCli() {
const options = parseArguments(process.argv.slice(2))
const protect = loadProtect(options.protect)

const inputs = []
if (options.stdin) {
  inputs.push({ file: '<stdin>', content: fs.readFileSync(0, 'utf8'), extension: '.md' })
}
for (const file of collectFiles(options.paths)) {
  const relative = path.relative(process.cwd(), file) || file
  if (options.self && /skills[\\/]anti-slop[\\/]references[\\/]/.test(file)) continue
  inputs.push({
    file: relative,
    content: fs.readFileSync(file, 'utf8'),
    extension: path.extname(file).toLowerCase(),
  })
}

const results = inputs.map((input) =>
  lintText({
    ...input,
    locales: options.locales,
    protectList: protect.applied,
    profile: options.profile,
  }),
)
const findings = results.flatMap((result) => result.findings)
const byTier = { 1: 0, 2: 0, 3: 0 }
for (const finding of findings) byTier[finding.tier] += 1

const failed = byTier[1] > 0 || byTier[3] > 0 || (options.strict && byTier[2] > 0)
const payload = {
  status: failed ? 'FAIL' : 'PASS',
  locales: options.locales,
  profile: options.profile,
  files: inputs.length,
  tier1: byTier[1],
  tier2: byTier[2],
  tier3: byTier[3],
  strict: options.strict,
  protectApplied: protect.applied.length,
  protectRejected: protect.rejected,
  findings,
  measurements: Object.fromEntries(
    inputs.map((input, index) => [input.file, results[index].measurements]),
  ),
  note: 'Absence of catalogued patterns only. Not a claim that the copy is true, specific, or worth reading.',
}

if (options.json) {
  console.log(JSON.stringify(payload, null, 2))
} else {
  for (const tier of [1, 2, 3]) {
    const tierFindings = findings.filter((finding) => finding.tier === tier)
    if (!tierFindings.length) continue
    console.log(`\nTier ${tier} (${tierFindings.length})`)
    for (const finding of tierFindings) {
      console.log(`  ${finding.file}:${finding.line}  ${finding.rule}`)
      console.log(`    ${finding.quote}`)
    }
  }
  if (protect.rejected.length) {
    console.log(`\nProtect entries ignored for missing a reason: ${protect.rejected.join(', ')}`)
  }
  console.log(
    `\nLINT: ${payload.status} — ${inputs.length} file(s), locale ${options.locales.join('+')}, profile ${options.profile}, tier1 ${byTier[1]}, tier2 ${byTier[2]}, tier3 ${byTier[3]}`,
  )
  console.log(payload.note)
}

process.exit(failed ? 1 : 0)
}
