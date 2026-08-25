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
  '.vue',
  '.svelte',
  '.astro',
  '.json',
])

/** Template languages whose visible text extracts like HTML. */
const MARKUP_EXTENSIONS = new Set(['.html', '.htm', '.vue', '.svelte', '.astro'])

/**
 * JSON is where localized copy usually lives, and also where every config file
 * lives. Linting the whole extension would bury real findings under
 * package.json and tsconfig.json, so only message catalogues are collected:
 * a locale-bearing directory, or a file named for a supported language.
 */
const CATALOGUE_DIRECTORY = /(?:^|\/)(?:locales?|i18n|lang|langs|messages|translations?)(?:\/|$)/i
const CATALOGUE_FILE = /(?:^|[./_-])(?:en|de)(?:[-_][a-z]{2})?\.json$/i

function isMessageCatalogue(file) {
  const normalized = String(file).replaceAll('\\', '/')
  return CATALOGUE_DIRECTORY.test(path.dirname(normalized)) || CATALOGUE_FILE.test(normalized)
}

/**
 * Build output, by name. The dot-directory rule below covers the rest and is
 * the one that matters: agent and editor scratch space — `.claude/worktrees`,
 * `.codex`, `.cursor` — holds whole copies of the repository. A walk that
 * enters it reports the same sentence once per copy, and the shipped copy
 * disappears under the duplicates. Measured on one real site: 3304 Tier-1
 * findings, of which 2292 came from `.claude` and 2 from `src`.
 *
 * This is a default, not an exclusion. A directory named as `--path` is always
 * walked, so `--path .claude/notes` still lints it.
 */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  'output',
  'out',
  'coverage',
  'vendor',
])

/**
 * Directories whose text is published: prose here is page content. Any ancestor
 * segment counts, because content sits at every depth. That reach is why the
 * segment names have to be conventions rather than ordinary words — a `copy`
 * entry matched this plugin's own `tests/copy/` and silently promoted every
 * fixture to the marketing register.
 */
const SHIPPED_COPY_PATH =
  /(?:^|\/)(?:src|app|pages|content|posts|articles|blog|_posts|locales?|i18n|lang|langs|messages|translations?|data)(?:\/|$)/i

/** Repo prose by name, whatever directory it sits in. */
const DOCUMENTATION_NAME =
  /^(?:readme|changelog|contributing|license|licence|code_of_conduct|security|support|agents|claude|codex|todo|notes|notizen|roadmap|architecture|adr)(?:[.-][a-z0-9-]+)*\.(?:md|mdx|markdown|txt)$/i

/**
 * Conventional page files, and the reason this rule is anchored to the scanned
 * root: `index.md` at the top of a site is the home page, while `INDEX.md` deep
 * inside a vault is a table of contents. Measured on one real site, the
 * unanchored version handed a session index the marketing register and produced
 * 14 of the 16 remaining findings.
 */
const PAGE_NAME = /^(?:index|page|home|start|landing)\.(?:md|mdx|markdown)$/i

const PROSE_EXTENSIONS = new Set(['.md', '.mdx', '.markdown', '.txt'])

/**
 * The register question is not "which words are in this file" but "will a
 * reader ever meet this text on a page". `CLAUDE.md`, an architecture note, and
 * a vault of internal Markdown are prose the marketing budgets were never
 * written for: they legitimately run em dashes, tick-box headings, and one
 * heading per paragraph. Judging them as marketing copy is what turned a real
 * site's two shipped findings into thousands.
 *
 * Only ever relaxes toward `docs`, and only when no `--profile` was given.
 */
function documentationRegister(file, scanRoots = new Set()) {
  const normalized = String(file).replaceAll('\\', '/')
  const base = path.basename(normalized)
  if (PAGE_NAME.test(base) && scanRoots.has(path.dirname(path.resolve(file)))) return false
  if (DOCUMENTATION_NAME.test(base)) return true
  if (!PROSE_EXTENSIONS.has(path.extname(normalized).toLowerCase())) return false
  return !SHIPPED_COPY_PATH.test(path.dirname(normalized))
}

const SUPPORTED_LOCALES = ['en', 'de']

/**
 * Zero-dependency locale detection deliberately uses high-frequency function
 * words rather than the slop vocabulary it is meant to judge. Metadata and
 * path hints win; content signals cover unlabelled files and stdin.
 */
const LOCALE_SIGNALS = {
  en: new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can',
    'do', 'does', 'each', 'every', 'for', 'from', 'has', 'have', 'if', 'into',
    'is', 'it', 'its', 'not', 'of', 'on', 'only', 'or', 'our', 'that', 'the',
    'their', 'then', 'there', 'they', 'this', 'to', 'was', 'we', 'when',
    'where', 'which', 'with', 'you', 'your',
  ]),
  de: new Set([
    'aber', 'als', 'auch', 'auf', 'aus', 'bei', 'bis', 'da', 'damit', 'dass',
    'dem', 'den', 'der', 'des', 'die', 'diese', 'dieser', 'durch', 'ein',
    'eine', 'einem', 'einen', 'einer', 'es', 'für', 'hat', 'haben', 'ihr',
    'ihre', 'im', 'ist', 'jetzt', 'kann', 'mit', 'nicht', 'noch', 'nur',
    'oder', 'sich', 'sie', 'sind', 'so', 'über', 'und', 'uns', 'unsere',
    'von', 'vor', 'wenn', 'werden', 'wie', 'wird', 'wir', 'zu', 'zum', 'zur',
  ]),
}

/** Tier 1 — structural forms that carry no information. */
export const TIER1 = {
  // Every literal space is `\s+` and every bounded span tolerates a single
  // newline, because copy is stored wrapped. The tells below fired only when a
  // whole phrase landed on one source line: a hard wrap between "experts" and
  // "agree" hid the finding entirely, which is the silent pass this linter
  // exists to refuse. Paragraph breaks stay excluded so a span cannot reach
  // across two blocks. No tell was added, removed, or otherwise widened.
  en: [
    ['negative-parallelism', /\bit(?:'|’)?s\s+not\s+(?:just\s+|only\s+|merely\s+)?(?:(?!\n\s*\n)[^.!?]){1,60}?[,.—–-]\s*(?:it(?:'|’)?s|but)\b/i],
    ['negative-parallelism', /\bnot\s+(?:just|only|merely)\s+(?:(?!\n\s*\n)[^.!?]){2,60}?,?\s+but\b/i],
    ['more-than-just', /\bmore\s+than\s+just\b/i],
    ['triple-negation', /\bnot\s+[\w\s]{1,24}\.\s*not\s+[\w\s]{1,24}\./i],
    ['throat-clearing', /\b(?:here(?:'|’)?s\s+the\s+thing|let(?:'|’)?s\s+be\s+(?:honest|clear)|let\s+me\s+be\s+clear|i(?:'|’)?ll\s+be\s+honest|make\s+no\s+mistake)\b/i],
    ['faux-insight', /\b(?:most\s+(?:people|teams|companies|founders|developers)\s+(?:get\s+this\s+wrong|don(?:'|’)?t\s+realize|miss\s+this)|what\s+(?:most\s+people|nobody)\s+get(?:s)?\s+wrong)\b/i],
    ['rhetorical-setup', /\b(?:what\s+if\s+(?:i|we)\s+told\s+you|imagine\s+a\s+world\s+where|think\s+about\s+it\s+for\s+a|plot\s+twist|here(?:'|’)?s\s+why\s+that\s+matters)\b/i],
    ['superficial-analysis', /,\s+(?:highlighting|underscoring|showcasing|emphasizing|reflecting|demonstrating|signaling|signalling|marking)\s+(?:the|a|an|its|their|how)\b/i],
    ['importance-puffery', /\b(?:play(?:s|ing)?\s+an?\s+(?:pivotal|crucial|vital|key|integral|essential)\s+role|is\s+a\s+testament\s+to|stands\s+as\s+a\s+testament|cannot\s+be\s+overstated)\b/i],
    ['vague-attribution', /\b(?:experts?\s+(?:agree|say|note)|studies\s+show|research\s+shows|it(?:'|’)?s\s+widely\s+(?:known|believed)|many\s+believe)\b/i],
    ['false-range', /\bfrom\s+(?:solo|small|startups?|individuals?|freelancers?|hobbyists?|students?|indie)[\w\s-]{0,24}\s+to\s+(?:global|enterprises?|fortune|multinational|large|the\s+world)[\w\s-]{0,24}/i],
    ['false-range', /\bwhether\s+you(?:'|’)?re\s+an?\s+(?:(?!\n\s*\n)[^.!?]){3,40}\s+or\s+an?\s+(?:(?!\n\s*\n)[^.!?]){3,40}/i],
    ['summary-recap', /^\s*(?:#{1,6}\s*)?(?:in\s+(?:conclusion|summary)|to\s+summari[sz]e|overall,|in\s+short,|bottom\s+line:)\b/im],
    ['audience-flattery', /\b(?:for\s+(?:builders|makers|creators|teams|founders|people)\s+(?:like\s+you|who\s+care)|you(?:'|’)?re\s+not\s+alone\s+(?:here|in\s+this))\b/i],
    ['unlock-potential', /\b(?:unlock|unleash|realize)\s+(?:the|your|its)\s+(?:full\s+)?potential\b/i],
    ['next-level', /\b(?:to|reach)\s+the\s+next\s+level\b/i],
    ['fast-paced-world', /\bin\s+today(?:'|’)?s\s+(?:fast[-\s]paced|ever[-\s]changing|digital)\s+world\b/i],
  ],
  de: [
    // The tell is the doubled copula of the English calque "it's not X, it's Y",
    // not the correlative conjunction. `nicht nur … sondern auch` is ordinary,
    // informative German and is tempered out of the span on purpose: gating it
    // as Tier 1 forced a rewrite that made correct copy worse.
    ['negative-parallelism', /\b(?:es|das|dies|er|sie|wir)\s+(?:ist|sind)\s+(?:nicht|kein|keine|keinerlei)\b(?:(?!\bsondern\b)(?!\n\s*\n)[^.!?]){1,60}[,.;:–—-]\s*(?:es|das|dies|er|sie|wir)\s+(?:ist|sind)\b/i],
    ['more-than-just', /\bmehr\s+als\s+(?:nur|bloß|lediglich|einfach)\b/i],
    ['importance-puffery', /\bes\s+ist\s+wichtig\s+zu\s+beachten\b/i],
    ['importance-puffery', /\bspiel(?:t|en)\s+(?:dabei\s+|hier(?:bei)?\s+|damit\s+)?eine\s+(?:entscheidende|zentrale|wichtige|wesentliche|tragende|maßgebliche|schlüssel\w*)\s*rolle\b/i],
    ['rhetorical-setup', /\bwas\s+wäre,?\s+wenn\b/i],
    ['discovery-opener', /\bentdecke,?\s+wie\b/i],
    ['metaphor-opener', /\btauche?\s+ein\s+in\b/i],
    ['ad-formula', /\bsag(?:e)?\s+tschüss\s+zu\b/i],
    // The documented shape includes the lift verb, and requiring it is what
    // keeps a game page ("der Spieler steigt auf ein neues Level auf") out of
    // the report. German brackets the verb, so both orders need a pattern.
    ['next-level', /\b(?:heb|bring|katapultier|hiev|führ)\w*\s+(?:(?!\n\s*\n)[^.!?]){0,50}?\bauf\s+(?:das|die|ein|eine)\s+(?:(?:völlig|ganz|komplett|gänzlich)\s+)?(?:nächste|neue|höhere)[sn]?\s+(?:level|stufe|niveau)\b/i],
    ['next-level', /\bauf\s+(?:das|die|ein|eine)\s+(?:(?:völlig|ganz|komplett|gänzlich)\s+)?(?:nächste|neue|höhere)[sn]?\s+(?:level|stufe|niveau)\b(?:(?!\n\s*\n)[^.!?]){0,40}?\b(?:heb|bring|katapultier|hiev|führ)(?:en|t|st)\b/i],
    ['fast-paced-world', /\bin\s+(?:der|einer|unserer)\s+(?:heutigen|zunehmend|immer)\s+(?:\w+\s+){0,2}(?:schnelllebigen|digitalen|vernetzten|globalisierten|dynamischen|modernen)\s+(?:welt|arbeitswelt|geschäftswelt|zeit)\b/i],
    // Two shapes, as in English: the scale poles named lexically, and the
    // "whether you are X or Y" frame. The second is anchored to a sentence start
    // because German `ob` is also an ordinary subordinator ("prüfen Sie, ob …").
    ['false-range', /\b(?:ob|vom|von)\s+(?:kleinen?\s+)?(?:startups?|start-ups?|freelancer\w*|einzelkämpfer\w*|solo\w*|gründer\w*|einsteiger\w*|anfänger\w*|hobby\w*|student\w*|kleinunternehm\w*|einzelunternehmer\w*|kmu)\b[\w\s,-]{0,24}?\b(?:oder|bis\s+(?:zu[mr]?|hin\s+zu[m]?))\s+[\w\s-]{0,24}?\b(?:konzern\w*|gro(?:ß|ss)konzern\w*|gro(?:ß|ss)unternehmen\w*|gro(?:ß|ss)kund\w*|weltkonzern\w*|weltmarktführer\w*|enterprise\w*|profi\w*|dax)\b/i],
    ['false-range', /(?:^|[.!?]\s+)ob\s+(?:du|sie|ihr)\s+(?:nun\s+|gerade\s+|bereits\s+)?(?:(?!\n\s*\n)[^.!?]){3,40}?\boder\b(?:(?!\n\s*\n)[^.!?]){3,40}?\b(?:bist|sind|seid)\b/im],
    ['revolutionize-the-way', /\b(?:revolutionier|transformier|veränder|ändern?|neu\s+definier)\w*\s+(?:die|unsere|eure|deine|ihre)\s+art(?:\s+und\s+weise)?\s*,?\s*wie\b/i],
    ['vague-attribution', /\bviele\s+experten\s+sind\s+sich\s+einig\b/i],
    ['staged-transition', /\bdoch\s+(?:damit\s+ist\s+es\s+nicht\s+getan|das\s+ist\s+noch\s+nicht\s+alles)\b/i],
    ['summary-recap', /^\s*(?:#{1,6}\s*)?fazit\s*:/im],
    ['actorless-passive', /\bwird\s+(?:sichergestellt|gewährleistet),?\s+dass\b/i],
    ['unlock-potential', /\bdas\s+(?:volle\s+|gesamte\s+)?potenzial\s+(?:entfalten|ausschöpfen|freisetzen)\b/i],
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
    emojiInHeading: true,
    localeTypography: true,
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
    emojiInHeading: false,
    localeTypography: false,
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
    // Editorial is published prose, so published typography still applies: the
    // em dash is allowed to carry the rhythm, an emoji heading is not, and
    // German still sets the en dash.
    emojiInHeading: true,
    localeTypography: true,
  },
}

/**
 * Tier-1 rules that judge published typography rather than a slop
 * construction. `em-dash-in-heading` is already profile-gated for the same
 * reason; these are the locale-specific members of that family.
 */
export const TYPOGRAPHY_RULES = new Set(['english-em-dash'])

export const BUDGETS = {
  sentenceVariationMinCount: 10,
  tier2ClusterPer: 200,
}

/**
 * Reported with its measured number, never fail-gating.
 *
 * Sentence-length variation is the one Tier-3 budget with no defensible
 * threshold. Short, factual copy — a price paragraph, a retry policy — is
 * legitimately uniform, and the rule failed exactly the specific, evidence-led
 * writing the rest of this plugin demands. Tier 3 says "measure, then decide";
 * for this rule the deciding is a reader's job, so the number is printed and
 * the exit code stays out of it.
 */
export const ADVISORY_RULES = new Set(['sentence-variation'])

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
  --locale <en|de>     explicit rule-set override; repeat or comma-separate
                       for both (default: auto-detect each file)
  --profile <name>     marketing, docs, or editorial register for the whole run;
                       without it, each file gets its own (default: marketing
                       for shipped copy, docs for repo prose)
  --protect <file>     protect list JSON; entries need a reason to apply
  --json               machine-readable report
  --strict             also fail on Tier-2 clusters
  --help               this text

Reads Markdown, JSX/TSX, HTML, Vue, Svelte, Astro, and JSON message
catalogues (a locales/i18n/lang/messages path, or en.json / de.json).

Walking a directory skips dot-directories and build output, because agent
scratch space holds whole copies of the repository. Every skip is printed. Name
such a directory as --path to lint it anyway.

Repo prose — README, CHANGELOG, AGENTS.md, CLAUDE.md, and Markdown outside a
shipped-copy path — is judged with the docs register: em dashes, tick-box
headings, and one heading per paragraph are normal there. --profile overrides
this for every file.

Exit codes: 0 pass, 1 Tier-1 hit or Tier-3 breach (or Tier-2 with --strict),
2 usage error or nothing checked — no file matched, or no visible copy could
be extracted from any input.

sentence-variation is advisory: it is measured and printed, never fail-gating.

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
    profileMode: 'auto',
    localeMode: 'auto',
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--path') options.paths.push(argv[++index])
    else if (argument === '--locale') {
      options.localeMode = 'explicit'
      options.locales.push(...String(argv[++index]).split(','))
    }
    else if (argument === '--protect') options.protect = argv[++index]
    else if (argument === '--json') options.json = true
    else if (argument === '--strict') options.strict = true
    else if (argument === '--stdin') options.stdin = true
    else if (argument === '--self') options.self = true
    else if (argument === '--profile') {
      options.profileMode = 'explicit'
      options.profile = argv[++index]
    }
    else if (argument === '--help') {
      usage()
      process.exit(0)
    } else die(`unknown argument "${argument}"`)
  }
  if (options.paths.some((value) => !value)) die('--path needs a value')
  if (options.localeMode === 'explicit' && !options.locales.length) die('--locale needs a value')
  for (const locale of options.locales) {
    if (!TIER1[locale]) die(`unsupported locale "${locale}"`)
  }
  if (!PROFILES[options.profile]) die(`unsupported profile "${options.profile}"`)
  if (options.self) {
    options.profileMode = 'explicit'
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

const skippedDirectories = []

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
        if (entry.name.startsWith('.') || SKIPPED_DIRECTORIES.has(entry.name)) {
          skippedDirectories.push(next)
          continue
        }
        files.push(...collectFiles([next]))
      } else {
        const extension = path.extname(entry.name).toLowerCase()
        if (!TEXT_EXTENSIONS.has(extension)) continue
        if (extension === '.json' && !isMessageCatalogue(next)) continue
        files.push(next)
      }
    }
  }
  return [...new Set(files)]
}

function localeHints(file, content) {
  const hints = new Set()
  const normalizedFile = String(file).replaceAll('\\', '/')
  for (const match of normalizedFile.matchAll(/(?:^|[./_-])(en|de)(?=$|[./_-])/gi)) {
    hints.add(match[1].toLowerCase())
  }
  for (const pattern of [
    /^---[\s\S]*?^(?:lang|language|locale):\s*["']?(en|de)(?:[-_][a-z]{2})?["']?\s*$/gim,
    /<html\b[^>]*\blang\s*=\s*["'](en|de)(?:[-_][a-z]{2})?["']/gi,
    /\blang\s*=\s*["'](en|de)(?:[-_][a-z]{2})?["']/gi,
  ]) {
    for (const match of content.matchAll(pattern)) hints.add(match[1].toLowerCase())
  }
  return [...hints]
}

function localeScores(text) {
  const tokens = text.toLowerCase().match(/\p{L}+/gu) ?? []
  const scores = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [
      locale,
      tokens.reduce(
        (score, token) => score + (LOCALE_SIGNALS[locale].has(token) ? 1 : 0),
        0,
      ),
    ]),
  )
  if (/[äöüß]/iu.test(text)) scores.de += 2
  return scores
}

function detectLocales({ file, content, extension }) {
  const hints = localeHints(file, content)
  const scores = localeScores(extract(content, extension).body)
  if (hints.length) {
    return {
      locales: SUPPORTED_LOCALES.filter((locale) => hints.includes(locale)),
      source: 'hint',
      scores,
      warning: null,
    }
  }

  const ranked = SUPPORTED_LOCALES
    .map((locale) => [locale, scores[locale]])
    .sort((left, right) => right[1] - left[1])
  const [[firstLocale, firstScore], [secondLocale, secondScore]] = ranked
  const bothStrong = firstScore >= 4 && secondScore >= 4 && secondScore / firstScore >= 0.4
  if (bothStrong) {
    return {
      locales: SUPPORTED_LOCALES,
      source: 'content-mixed',
      scores,
      warning: null,
    }
  }
  if (firstScore >= 3 && (secondScore === 0 || firstScore / secondScore >= 1.5)) {
    return {
      locales: [firstLocale],
      source: 'content',
      scores,
      warning: null,
    }
  }

  return {
    locales: SUPPORTED_LOCALES,
    source: 'fallback',
    scores,
    warning:
      `${file}: locale auto-detection was inconclusive ` +
      `(en ${scores.en}, de ${scores.de}); applied both rule sets. ` +
      'Use --locale en or --locale de to override.',
  }
}

/**
 * Blank a span without moving what follows it: every character becomes a space,
 * every newline survives. Stripping by deletion is what made a finding's line
 * unrecoverable — offsets in the extracted text no longer matched the file the
 * reader has to open. Masking keeps the two in the same coordinate system.
 */
function blank(text) {
  return text.replace(/[^\n]/g, ' ')
}

function mask(content, patterns) {
  let masked = content
  for (const pattern of patterns) masked = masked.replace(pattern, blank)
  return masked
}

/** A masked extraction maps one-to-one onto the file it came from. */
function sameShape(content) {
  return [{ body: 0, source: 0, length: content.length }]
}

/**
 * Body offset → source offset. Extractors that mask keep the file's layout, so
 * the map is the identity; extractors that collect pieces — JSX props, JSON
 * values — record where each piece was found, because their body is a rewrite
 * of the file rather than a copy of it. An offset that lands between two pieces
 * resolves to the start of the next one.
 */
function sourceOffset(segments, bodyIndex) {
  for (const segment of segments) {
    if (bodyIndex < segment.body) return segment.source
    if (bodyIndex < segment.body + segment.length) {
      return segment.source + (bodyIndex - segment.body)
    }
  }
  const last = segments[segments.length - 1]
  return last ? last.source + last.length : 0
}

/** Join collected pieces into a body and keep the map back to the source. */
function joinPieces(pieces) {
  const segments = []
  let offset = 0
  for (const piece of pieces) {
    segments.push({ body: offset, source: piece.index, length: piece.text.length })
    offset += piece.text.length + 1
  }
  return { body: pieces.map((piece) => piece.text).join('\n'), segments }
}

/**
 * Reduce a source file to the text a visitor actually reads. Best effort for
 * JSX and HTML: it favours missing a string over inventing a finding.
 *
 * Exported so the root-surface self-lint in validate-content.mjs can scan the
 * same extracted surface for placeholder markers instead of reading raw
 * source, where code fences, JSX props, and comments would be judged as copy.
 *
 * Headings, list items and labels carry their source offset for the same reason
 * the body does: they are reported as findings, and a finding without a line is
 * a finding nobody can open.
 */
export function extract(content, extension) {
  const headings = []
  let body = content

  if (['.md', '.mdx', '.markdown'].includes(extension)) {
    body = mask(body, [
      /^---\n[\s\S]*?\n---\n/,
      /```[\s\S]*?```/g,
      /~~~[\s\S]*?~~~/g,
      /`[^`\n]*`/g,
      /^>.*$/gm,
      /<!--[\s\S]*?-->/g,
      /!\[[^\]]*\]\([^)]*\)/g,
    ])
    // Link text is copy; the brackets and the URL are not. Keeping the text
    // where it stands is what a masked replacement buys over a shortening one.
    body = body.replace(
      /\[([^\]]*)\]\([^)]*\)/g,
      (match, text) => ` ${text}${blank(match.slice(1 + text.length))}`,
    )
    for (const match of body.matchAll(/^#{1,4}\s+(.+)$/gm)) {
      headings.push({ text: match[1].trim(), index: match.index })
    }
    return {
      body,
      prose: mask(body, [/^\s*\|.*\|\s*$/gm]),
      headings,
      listItems: [...content.matchAll(/^\s*[-*+]\s+(.*)$/gm)].map((match) => ({
        text: match[1],
        index: match.index,
      })),
      labels: [],
      segments: sameShape(body),
    }
  }

  if (extension === '.json') {
    // Values only. A message id is not copy, and linting it would flag the
    // developer's naming instead of what a visitor reads.
    const strings = []
    const walk = (node) => {
      if (typeof node === 'string') strings.push(node)
      else if (Array.isArray(node)) node.forEach(walk)
      else if (node && typeof node === 'object') Object.values(node).forEach(walk)
    }
    try {
      walk(JSON.parse(content))
    } catch {
      return { body: '', prose: '', headings: [], listItems: [], labels: [], segments: [] }
    }
    // Parsing discards positions, so each value is located again in document
    // order. A cursor that only moves forward keeps a value from matching an
    // earlier key, and a value written with different escapes than
    // JSON.stringify produces simply keeps the cursor's line rather than
    // inventing one.
    let cursor = 0
    const pieces = strings.map((value) => {
      const literal = JSON.stringify(value)
      const found = content.indexOf(literal, cursor)
      if (found < 0) return { text: value, index: cursor }
      cursor = found + literal.length
      return { text: value, index: found + 1 }
    })
    const { body: joined, segments } = joinPieces(pieces)
    return {
      body: joined,
      prose: joined,
      headings: [],
      listItems: [],
      labels: pieces.filter((piece) => piece.text.length <= 40),
      segments,
    }
  }

  if (MARKUP_EXTENSIONS.has(extension)) {
    const masked = mask(body, [
      // Astro component script; Vue and Svelte carry theirs in <script>.
      /^---\n[\s\S]*?\n---\n/,
      /<(script|style)[\s\S]*?<\/\1>/gi,
      /<!--[\s\S]*?-->/g,
      /\sclass(?:Name)?=(?:"[^"]*"|'[^']*'|\{[^}]*\})/g,
    ])
    for (const match of masked.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)) {
      headings.push({ text: match[1].replace(/<[^>]+>/g, ' ').trim(), index: match.index })
    }
    return {
      body: mask(masked, [/<[^>]+>/g]),
      headings,
      listItems: [],
      labels: [...masked.matchAll(/>([^<>]{2,40})</g)].map((match) => ({
        text: match[1].trim(),
        index: match.index + 1,
      })),
      segments: sameShape(body),
    }
  }

  // JSX / TS: visible text nodes plus copy-bearing props.
  const pieces = []
  const source = mask(body, [
    /\/\*[\s\S]*?\*\//g,
    /^\s*(?:import|export)\s.*$/gm,
    /className=(?:"[^"]*"|'[^']*'|\{`[^`]*`\})/g,
    /class="[^"]*"/g,
  ])
  // Each capture ends one character before its match — the closing `<` or the
  // closing quote — which is what makes the group's offset exact rather than a
  // search for its text.
  const captureIndex = (match) => match.index + match[0].length - 1 - match[1].length
  const leadingSpace = (raw) => raw.length - raw.trimStart().length
  for (const match of source.matchAll(/>([^<>{}]+)</g)) {
    const text = match[1].replace(/\s+/g, ' ').trim()
    if (text.length > 2 && /[a-zA-ZÀ-ɏ]{3}/.test(text)) {
      pieces.push({ text, index: captureIndex(match) + leadingSpace(match[1]) })
    }
  }
  const propPattern =
    /\b(?:title|label|heading|subheading|subtitle|placeholder|alt|description|caption|tooltip|cta|message|helper|error|emptyState|ariaLabel|"aria-label")\s*[:=]\s*(?:\{?\s*)?["'`]([^"'`]{3,300})["'`]/g
  for (const match of source.matchAll(propPattern)) {
    pieces.push({
      text: match[1].trim(),
      index: captureIndex(match) + leadingSpace(match[1]),
    })
  }
  for (const match of source.matchAll(/<h[1-3][^>]*>([^<]{3,200})</gi)) {
    headings.push({
      text: match[1].trim(),
      index: captureIndex(match) + leadingSpace(match[1]),
    })
  }
  const { body: joined, segments } = joinPieces(pieces)
  return {
    body: joined,
    headings,
    listItems: [],
    labels: pieces.filter((piece) => piece.text.length <= 40),
    segments,
  }
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

/**
 * Line numbers are reported against the original file, so a finding can be
 * opened where it was written. The offset is carried out of the extractor
 * rather than recovered by searching the file for the matched text: a one-
 * character match like an em dash has no distinguishing text to search for, and
 * a search found the first occurrence anywhere — a comment, a URL, line 1 —
 * instead of the occurrence that was flagged.
 */
function lineOf(content, index) {
  return content.slice(0, index).split('\n').length
}

/**
 * Where a match's text begins, not where its regex did. `summary-recap` and the
 * other `^\s*` rules start at the paragraph break, so the raw match index points
 * at the blank line above the sentence — a line the writer did not write.
 */
function matchOffset(match) {
  const index = match.index ?? 0
  return index + (match[0].length - match[0].trimStart().length)
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
  const { body, prose = body, headings, listItems, labels, segments } = extract(content, extension)
  // `at` takes an offset into the extracted body; `atSource` one into the file.
  const atSource = (index) => lineOf(content, index)
  const at = (index) => atSource(sourceOffset(segments, index))
  const findings = []
  const words = wordCount(body)
  const proseWords = wordCount(prose)

  for (const locale of locales) {
    for (const [name, pattern] of TIER1[locale]) {
      if (TYPOGRAPHY_RULES.has(name) && !budgets.localeTypography) continue
      const scoped = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
      for (const match of body.matchAll(scoped)) {
        if (protectedBy(match[0], protectList)) continue
        findings.push({
          tier: 1,
          rule: `${locale}:${name}`,
          file,
          line: at(matchOffset(match)),
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
        if (
          new RegExp(pattern.source, 'iu').test(heading.text) &&
          !protectedBy(heading.text, protectList)
        ) {
          findings.push({
            tier: 2,
            rule: `${locale}:vocabulary-in-heading`,
            file,
            line: atSource(heading.index),
            quote: `${heading.text} / "${term}"`,
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
      line: at(tier2Hits[0].index),
      quote: `${tier2Hits.length} distinct terms in ${words} words (allowance ${clusterAllowance}): ${tier2Hits
        .slice(0, 8)
        .map((hit) => hit.term)
        .join(', ')}`,
    })
  }

  const measurements = {}
  const rhythmText = mask(prose, [
    /^#{1,6}\s.*$/gm,
    /^\s*(?:[-*+]|\d+\.)\s+[^—\n]{0,48}—/gm,
  ])
  const emDashes = (rhythmText.match(/—/g) ?? []).length
  const firstEmDash = rhythmText.indexOf('—')
  measurements.words = words
  measurements.proseWords = proseWords
  measurements.emDashes = emDashes
  measurements.emDashAllowance = Math.floor(proseWords / budgets.emDashWordsPer)
  if (emDashes >= 2 && emDashes > measurements.emDashAllowance) {
    findings.push({
      tier: 3,
      rule: 'em-dash-budget',
      file,
      line: firstEmDash >= 0 ? at(firstEmDash) : 1,
      quote: `${emDashes} em dashes in ${proseWords} words (allowance ${measurements.emDashAllowance})`,
    })
  }
  for (const heading of headings) {
    if (budgets.emDashInHeading && /—/.test(heading.text)) {
      findings.push({
        tier: 1,
        rule: 'em-dash-in-heading',
        file,
        line: atSource(heading.index),
        quote: quote(heading.text),
      })
    }
    if (budgets.emojiInHeading && EMOJI.test(heading.text)) {
      findings.push({
        tier: 1,
        rule: 'emoji-in-heading',
        file,
        line: atSource(heading.index),
        quote: quote(heading.text),
      })
    }
  }

  for (const label of labels ?? []) {
    if (!EMOJI.test(label.text) || protectedBy(label.text, protectList)) continue
    findings.push({
      tier: 1,
      rule: 'emoji-in-ui-label',
      file,
      line: atSource(label.index),
      quote: quote(label.text),
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
      line: at(matchOffset(triplets[0])),
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
    const bold = listItems.filter((item) => /^\*\*[^*]+\*\*/.test(item.text.trim())).length
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
  const firstOrnament = prose.search(ORNAMENT)
  measurements.ornaments = ornaments
  if (budgets.ornamentMax !== null && ornaments > budgets.ornamentMax) {
    findings.push({
      tier: 3,
      rule: 'ornament-density',
      file,
      line: firstOrnament >= 0 ? at(firstOrnament) : 1,
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

const localeDetection = Object.fromEntries(
  inputs.map((input) => [
    input.file,
    options.localeMode === 'explicit'
      ? {
          locales: options.locales,
          source: 'explicit',
          scores: null,
          warning: null,
        }
      : detectLocales(input),
  ]),
)
/**
 * One register per file, so a repo can be linted in one pass. `--profile` is an
 * override for the whole run; without it, repo prose is judged as documentation
 * and everything else keeps the base register.
 */
const scanRoots = new Set(
  options.paths.map((target) => {
    const resolved = path.resolve(target)
    return fs.statSync(resolved).isDirectory() ? resolved : path.dirname(resolved)
  }),
)
const registerByFile = Object.fromEntries(
  inputs.map((input) => [
    input.file,
    options.profileMode === 'explicit'
      ? options.profile
      : documentationRegister(input.file, scanRoots)
        ? 'docs'
        : options.profile,
  ]),
)
const registerCounts = {}
for (const register of Object.values(registerByFile)) {
  registerCounts[register] = (registerCounts[register] ?? 0) + 1
}

const results = inputs.map((input) =>
  lintText({
    ...input,
    locales: localeDetection[input.file].locales,
    protectList: protect.applied,
    profile: registerByFile[input.file],
  }),
)
const findings = results.flatMap((result) => result.findings)
const byTier = { 1: 0, 2: 0, 3: 0 }
for (const finding of findings) byTier[finding.tier] += 1

const failingFindings = findings.filter((finding) => !ADVISORY_RULES.has(finding.rule))
const failingByTier = { 1: 0, 2: 0, 3: 0 }
for (const finding of failingFindings) failingByTier[finding.tier] += 1
const failed =
  failingByTier[1] > 0 || failingByTier[3] > 0 || (options.strict && failingByTier[2] > 0)

/**
 * A file the extractor could not read produces zero findings, which used to
 * render as a pass. A linter that reports the absence of patterns in text it
 * never saw is exactly the self-report this plugin refuses everywhere else.
 */
const filesWithoutCopy = inputs
  .filter((_, index) => (results[index].measurements.words ?? 0) === 0)
  .map((input) => input.file)
const noCopy = inputs.length === 0 || filesWithoutCopy.length === inputs.length

const resolvedLocales = SUPPORTED_LOCALES.filter((locale) =>
  Object.values(localeDetection).some((detection) => detection.locales.includes(locale)),
)
const localeWarnings = Object.values(localeDetection)
  .map((detection) => detection.warning)
  .filter(Boolean)
const payload = {
  status: noCopy ? 'NO-COPY' : failed ? 'FAIL' : 'PASS',
  localeMode: options.localeMode,
  locales: options.localeMode === 'explicit' ? options.locales : resolvedLocales,
  localeDetection,
  localeWarnings,
  profile: options.profile,
  profileMode: options.profileMode,
  registers: registerCounts,
  registerByFile,
  skippedDirectories: skippedDirectories.map(
    (directory) => path.relative(process.cwd(), directory) || directory,
  ),
  files: inputs.length,
  filesWithoutCopy,
  tier1: byTier[1],
  tier2: byTier[2],
  tier3: byTier[3],
  advisory: findings.length - failingFindings.length,
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
      const advisory = ADVISORY_RULES.has(finding.rule) ? '  [advisory]' : ''
      console.log(`  ${finding.file}:${finding.line}  ${finding.rule}${advisory}`)
      console.log(`    ${finding.quote}`)
    }
  }
  if (protect.rejected.length) {
    console.log(`\nProtect entries ignored for missing a reason: ${protect.rejected.join(', ')}`)
  }
  for (const warning of localeWarnings) console.log(`\nAUTO-LOCALE WARNING: ${warning}`)
  if (filesWithoutCopy.length) {
    console.log(
      `\nNO-COPY WARNING: no visible text was extracted from ${filesWithoutCopy.length} file(s); ` +
        'they were not checked. ' +
        `${filesWithoutCopy.slice(0, 10).join(', ')}` +
        (filesWithoutCopy.length > 10 ? `, +${filesWithoutCopy.length - 10} more` : ''),
    )
  }
  /**
   * A skipped directory is a coverage decision, so it is printed. A linter that
   * silently walks past two thirds of a repository reports a pass it did not
   * earn — the same failure as counting a file it could not read.
   */
  if (payload.skippedDirectories.length) {
    console.log(
      `\nSKIPPED ${payload.skippedDirectories.length} director(y|ies) — build output and dot-directories ` +
        'hold copies, not shipped copy. Name one as --path to lint it anyway. ' +
        `${payload.skippedDirectories.slice(0, 10).join(', ')}` +
        (payload.skippedDirectories.length > 10
          ? `, +${payload.skippedDirectories.length - 10} more`
          : ''),
    )
  }
  const localeSummary =
    options.localeMode === 'explicit'
      ? options.locales.join('+')
      : `auto → ${resolvedLocales.join('+') || 'none'}`
  const profileSummary =
    options.profileMode === 'explicit'
      ? options.profile
      : `auto → ${
          Object.entries(registerCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([register, count]) => `${register} ${count}`)
            .join(' / ') || options.profile
        }`
  console.log(
    `\nLINT: ${payload.status} — ${inputs.length} file(s), locale ${localeSummary}, profile ${profileSummary}, tier1 ${byTier[1]}, tier2 ${byTier[2]}, tier3 ${byTier[3]}` +
      (payload.advisory ? ` (${payload.advisory} advisory)` : ''),
  )
  if (noCopy) {
    console.log(
      inputs.length === 0
        ? 'No lintable file matched the given path. Nothing was checked.'
        : 'No visible copy was extracted from any input. Nothing was checked.',
    )
  }
  console.log(payload.note)
}

// 2 is the "could not check" code, shared with usage errors: an unread tree is
// not a clean tree, and a caller that treats 0 as green must not receive one.
process.exitCode = noCopy ? 2 : failed ? 1 : 0
}
