/*
 * Copyable interaction-checkpoint manifest reference (IP-06A, extended IP-06B).
 *
 * This file has zero runtime dependencies and stays outside the installed
 * website-design-ultra plugin payload. A project copies it next to its
 * checkpoint declaration so the manifest, its tests, and the verifier read one
 * versioned shape. It validates declarations; it does not drive a browser.
 * Driving belongs to the verifier workstream.
 *
 * Contract: every checkpoint is declared by the project, never hardcoded in
 * the verifier. Hover declares before/during/after, click declares
 * before/peak/recovered, scroll declares normalized progress in [0, 1], and
 * loading, ready, and failure declare their own state conditions. IP-06B adds
 * the input and audio kinds: focus declares before/during/after (focus-visible
 * is the during state), keyboard and touch declare before/peak/recovered and
 * must reach the same product outcome as the pointer click group, and audio
 * declares one of locked/enabled/muted/returning — a silent deliverable
 * declares no audio checkpoints at all, so audio tests never run for it.
 * Deterministic filenames are derived from checkpoint ids.
 */

export const CHECKPOINT_SCHEMA_VERSION = 1 as const
export const CHECKPOINT_SURFACE_ID = 'wdu.interaction-checkpoints' as const

export const CHECKPOINT_KINDS = [
  'hover',
  'click',
  'scroll',
  'loading',
  'ready',
  'failure',
  'focus',
  'keyboard',
  'touch',
  'audio',
] as const

export const HOVER_PHASES = ['before', 'during', 'after'] as const
export const CLICK_PHASES = ['before', 'peak', 'recovered'] as const
export const FOCUS_PHASES = ['before', 'during', 'after'] as const
export const KEYBOARD_PHASES = ['before', 'peak', 'recovered'] as const
export const TOUCH_PHASES = ['before', 'peak', 'recovered'] as const
export const AUDIO_STATES = ['locked', 'enabled', 'muted', 'returning'] as const

export const CHECKPOINT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/

export type CheckpointKind = (typeof CHECKPOINT_KINDS)[number]
export type HoverPhase = (typeof HOVER_PHASES)[number]
export type ClickPhase = (typeof CLICK_PHASES)[number]
export type FocusPhase = (typeof FOCUS_PHASES)[number]
export type KeyboardPhase = (typeof KEYBOARD_PHASES)[number]
export type TouchPhase = (typeof TOUCH_PHASES)[number]
export type AudioState = (typeof AUDIO_STATES)[number]

export interface PointerCheckpoint {
  readonly interaction: 'hover' | 'click'
  readonly phase: HoverPhase | ClickPhase
}

export interface CheckpointEntryBase {
  readonly id: string
  /** Optional project-declared capture-state URL suffix (for example a loading hold). */
  readonly url?: string
  /** Final state condition before the capture, as a CSS selector. */
  readonly waitFor?: string
  /**
   * Optional selector scrolled into the viewport center before the capture
   * (the capture region must be visible; scroll entries define their own
   * scroll position and never declare this).
   */
  readonly scrollIntoView?: string
}

export interface HoverCheckpoint extends CheckpointEntryBase, PointerCheckpoint {
  readonly interaction: 'hover'
  readonly phase: HoverPhase
  /** Group id shared by the before/during/after triple of one hover interaction. */
  readonly group: string
  /** CSS selector whose bounding-box center receives the pointer. */
  readonly target: string
}

export interface ClickCheckpoint extends CheckpointEntryBase, PointerCheckpoint {
  readonly interaction: 'click'
  readonly phase: ClickPhase
  /** Group id shared by the before/peak/recovered triple of one click interaction. */
  readonly group: string
  /** CSS selector whose bounding-box center receives the pointer. */
  readonly target: string
}

export interface ScrollCheckpoint extends CheckpointEntryBase {
  readonly interaction: 'scroll'
  /** Declared normalized scroll progress in [0, 1]; the verifier converts it. */
  readonly progress: number
}

export interface LoadingCheckpoint extends CheckpointEntryBase {
  readonly interaction: 'loading'
  /** The composed loading surface (for example a poster that covers the frame). */
  readonly waitFor: string
}

export interface ReadyCheckpoint extends CheckpointEntryBase {
  readonly interaction: 'ready'
}

export interface FailureCheckpoint extends CheckpointEntryBase {
  readonly interaction: 'failure'
  /** The failure surface (for example the context-loss panel). */
  readonly waitFor: string
  /** Optional declared failure action the verifier can perform. */
  readonly action?: 'lose-webgl-context'
}

export interface FocusCheckpoint extends CheckpointEntryBase {
  readonly interaction: 'focus'
  readonly phase: FocusPhase
  /** Group id shared by the before/during/after triple of one focus interaction. */
  readonly group: string
  /** CSS selector of the focusable control the driver reaches by Tab. */
  readonly target: string
}

export interface KeyboardCheckpoint extends CheckpointEntryBase {
  readonly interaction: 'keyboard'
  readonly phase: KeyboardPhase
  /** Group id shared by the before/peak/recovered triple of one keyboard activation. */
  readonly group: string
  /** CSS selector of the focusable control the driver activates with Enter or Space. */
  readonly target: string
}

export interface TouchCheckpoint extends CheckpointEntryBase {
  readonly interaction: 'touch'
  readonly phase: TouchPhase
  /** Group id shared by the before/peak/recovered triple of one touch activation. */
  readonly group: string
  /** CSS selector of the control the driver taps with touch input. */
  readonly target: string
}

export interface AudioCheckpoint extends CheckpointEntryBase {
  readonly interaction: 'audio'
  /** The declared audio state: locked until the unlock gesture, enabled after it, muted by the opt-out control, or returning after a reload with stored consent. */
  readonly state: AudioState
  /** The surface that proves the state (for example html[data-wdu-audio="enabled"]). */
  readonly waitFor: string
  /** Declared unlock-gesture control; required for the enabled state. */
  readonly unlock?: string
  /** Declared mute (opt-out) control; required for muted and returning. */
  readonly target?: string
  /** Declared persistence storage key; required for muted and returning. */
  readonly persist?: string
  /** Declared concurrent-voice limit; observable evidence, enabled state only. */
  readonly voiceLimit?: number
  /** Declared rapid-activation source for the voice-limit observation; required with voiceLimit. */
  readonly trigger?: string
  /** Declared activation count for the voice-limit observation (default 6); only with voiceLimit. */
  readonly repeats?: number
}

export type CheckpointEntry =
  | HoverCheckpoint
  | ClickCheckpoint
  | ScrollCheckpoint
  | LoadingCheckpoint
  | ReadyCheckpoint
  | FailureCheckpoint
  | FocusCheckpoint
  | KeyboardCheckpoint
  | TouchCheckpoint
  | AudioCheckpoint

export interface CheckpointManifest {
  readonly schemaVersion: typeof CHECKPOINT_SCHEMA_VERSION
  readonly surface: typeof CHECKPOINT_SURFACE_ID
  readonly project: string
  /** The requested deterministic mode input; only WDU_DETERMINISTIC=1 is a deterministic capture. */
  readonly modeInput: string
  /** The project's deterministic ready marker selector (determinism contract, section 6). */
  readonly readyMarker: string
  readonly checkpoints: readonly CheckpointEntry[]
}

type JsonRecord = Record<string, unknown>

function hasOwn(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function asRecord(input: unknown, label: string): JsonRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${label} must be an object`)
  }
  return input as JsonRecord
}

function assertKnownKeys(record: JsonRecord, allowed: readonly string[], label: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new Error(`${label} has unknown property ${key}`)
    }
  }
}

function required(record: JsonRecord, key: string, label: string): unknown {
  if (!hasOwn(record, key)) {
    throw new Error(`${label}.${key} is required`)
  }
  return record[key]
}

function text(input: unknown, label: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return input
}

function optionalText(record: JsonRecord, key: string, label: string): string | undefined {
  if (!hasOwn(record, key)) return undefined
  return text(record[key], `${label}.${key}`)
}

function enumValue<const Values extends readonly string[]>(
  input: unknown,
  values: Values,
  label: string,
): Values[number] {
  if (typeof input !== 'string' || !values.includes(input)) {
    throw new Error(`${label} must be one of ${values.join(', ')}`)
  }
  return input as Values[number]
}

function checkpointId(input: unknown, label: string): string {
  const id = text(input, label)
  if (!CHECKPOINT_ID_PATTERN.test(id)) {
    throw new Error(
      `${label} must match ${String(CHECKPOINT_ID_PATTERN)} (deterministic filenames are derived from ids)`,
    )
  }
  return id
}

function positiveInteger(input: unknown, label: string): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < 1) {
    throw new Error(`${label} must be a positive integer`)
  }
  return input
}

function optionalPositiveInteger(record: JsonRecord, key: string, label: string): number | undefined {
  if (!hasOwn(record, key)) return undefined
  return positiveInteger(record[key], `${label}.${key}`)
}

function validateHoverEntry(record: JsonRecord): HoverCheckpoint {
  assertKnownKeys(
    record,
    ['id', 'interaction', 'phase', 'group', 'target', 'waitFor', 'url', 'scrollIntoView'],
    'checkpoints[]',
  )
  const waitFor = optionalText(record, 'waitFor', 'checkpoints[]')
  const url = optionalText(record, 'url', 'checkpoints[]')
  const scrollIntoView = optionalText(record, 'scrollIntoView', 'checkpoints[]')
  const entry: HoverCheckpoint = {
    id: checkpointId(required(record, 'id', 'checkpoints[]'), 'checkpoints[].id'),
    interaction: 'hover',
    phase: enumValue(
      required(record, 'phase', 'checkpoints[]'),
      HOVER_PHASES,
      'checkpoints[].phase',
    ),
    group: text(required(record, 'group', 'checkpoints[]'), 'checkpoints[].group'),
    target: text(required(record, 'target', 'checkpoints[]'), 'checkpoints[].target'),
    ...(waitFor !== undefined ? { waitFor } : {}),
    ...(url !== undefined ? { url } : {}),
    ...(scrollIntoView !== undefined ? { scrollIntoView } : {}),
  }
  return entry
}

function validateClickEntry(record: JsonRecord): ClickCheckpoint {
  assertKnownKeys(
    record,
    ['id', 'interaction', 'phase', 'group', 'target', 'waitFor', 'url', 'scrollIntoView'],
    'checkpoints[]',
  )
  const waitFor = optionalText(record, 'waitFor', 'checkpoints[]')
  const url = optionalText(record, 'url', 'checkpoints[]')
  const scrollIntoView = optionalText(record, 'scrollIntoView', 'checkpoints[]')
  return {
    id: checkpointId(required(record, 'id', 'checkpoints[]'), 'checkpoints[].id'),
    interaction: 'click',
    phase: enumValue(
      required(record, 'phase', 'checkpoints[]'),
      CLICK_PHASES,
      'checkpoints[].phase',
    ),
    group: text(required(record, 'group', 'checkpoints[]'), 'checkpoints[].group'),
    target: text(required(record, 'target', 'checkpoints[]'), 'checkpoints[].target'),
    ...(waitFor !== undefined ? { waitFor } : {}),
    ...(url !== undefined ? { url } : {}),
    ...(scrollIntoView !== undefined ? { scrollIntoView } : {}),
  }
}

function validateScrollEntry(record: JsonRecord): ScrollCheckpoint {
  assertKnownKeys(record, ['id', 'interaction', 'progress', 'url'], 'checkpoints[]')
  const progress = required(record, 'progress', 'checkpoints[]')
  if (typeof progress !== 'number' || !Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new Error('checkpoints[].progress must be a normalized number in [0, 1]')
  }
  const url = optionalText(record, 'url', 'checkpoints[]')
  return {
    id: checkpointId(required(record, 'id', 'checkpoints[]'), 'checkpoints[].id'),
    interaction: 'scroll',
    progress,
    ...(url !== undefined ? { url } : {}),
  }
}

function validateLoadingEntry(record: JsonRecord): LoadingCheckpoint {
  assertKnownKeys(record, ['id', 'interaction', 'waitFor', 'url', 'scrollIntoView'], 'checkpoints[]')
  const url = optionalText(record, 'url', 'checkpoints[]')
  const scrollIntoView = optionalText(record, 'scrollIntoView', 'checkpoints[]')
  return {
    id: checkpointId(required(record, 'id', 'checkpoints[]'), 'checkpoints[].id'),
    interaction: 'loading',
    waitFor: text(required(record, 'waitFor', 'checkpoints[]'), 'checkpoints[].waitFor'),
    ...(url !== undefined ? { url } : {}),
    ...(scrollIntoView !== undefined ? { scrollIntoView } : {}),
  }
}

function validateReadyEntry(record: JsonRecord): ReadyCheckpoint {
  assertKnownKeys(record, ['id', 'interaction', 'url', 'scrollIntoView'], 'checkpoints[]')
  const url = optionalText(record, 'url', 'checkpoints[]')
  const scrollIntoView = optionalText(record, 'scrollIntoView', 'checkpoints[]')
  return {
    id: checkpointId(required(record, 'id', 'checkpoints[]'), 'checkpoints[].id'),
    interaction: 'ready',
    ...(url !== undefined ? { url } : {}),
    ...(scrollIntoView !== undefined ? { scrollIntoView } : {}),
  }
}

function validateFailureEntry(record: JsonRecord): FailureCheckpoint {
  assertKnownKeys(
    record,
    ['id', 'interaction', 'waitFor', 'action', 'url', 'scrollIntoView'],
    'checkpoints[]',
  )
  const action = hasOwn(record, 'action') ? enumValue(record.action, ['lose-webgl-context'], 'checkpoints[].action') : undefined
  const url = optionalText(record, 'url', 'checkpoints[]')
  const scrollIntoView = optionalText(record, 'scrollIntoView', 'checkpoints[]')
  const entry: FailureCheckpoint = {
    id: checkpointId(required(record, 'id', 'checkpoints[]'), 'checkpoints[].id'),
    interaction: 'failure',
    waitFor: text(required(record, 'waitFor', 'checkpoints[]'), 'checkpoints[].waitFor'),
    ...(action !== undefined ? { action } : {}),
    ...(url !== undefined ? { url } : {}),
    ...(scrollIntoView !== undefined ? { scrollIntoView } : {}),
  }
  return entry
}

function validateFocusEntry(record: JsonRecord): FocusCheckpoint {
  assertKnownKeys(
    record,
    ['id', 'interaction', 'phase', 'group', 'target', 'waitFor', 'url', 'scrollIntoView'],
    'checkpoints[]',
  )
  const waitFor = optionalText(record, 'waitFor', 'checkpoints[]')
  const url = optionalText(record, 'url', 'checkpoints[]')
  const scrollIntoView = optionalText(record, 'scrollIntoView', 'checkpoints[]')
  return {
    id: checkpointId(required(record, 'id', 'checkpoints[]'), 'checkpoints[].id'),
    interaction: 'focus',
    phase: enumValue(
      required(record, 'phase', 'checkpoints[]'),
      FOCUS_PHASES,
      'checkpoints[].phase',
    ),
    group: text(required(record, 'group', 'checkpoints[]'), 'checkpoints[].group'),
    target: text(required(record, 'target', 'checkpoints[]'), 'checkpoints[].target'),
    ...(waitFor !== undefined ? { waitFor } : {}),
    ...(url !== undefined ? { url } : {}),
    ...(scrollIntoView !== undefined ? { scrollIntoView } : {}),
  }
}

function validateKeyboardEntry(record: JsonRecord): KeyboardCheckpoint {
  assertKnownKeys(
    record,
    ['id', 'interaction', 'phase', 'group', 'target', 'waitFor', 'url', 'scrollIntoView'],
    'checkpoints[]',
  )
  const waitFor = optionalText(record, 'waitFor', 'checkpoints[]')
  const url = optionalText(record, 'url', 'checkpoints[]')
  const scrollIntoView = optionalText(record, 'scrollIntoView', 'checkpoints[]')
  return {
    id: checkpointId(required(record, 'id', 'checkpoints[]'), 'checkpoints[].id'),
    interaction: 'keyboard',
    phase: enumValue(
      required(record, 'phase', 'checkpoints[]'),
      KEYBOARD_PHASES,
      'checkpoints[].phase',
    ),
    group: text(required(record, 'group', 'checkpoints[]'), 'checkpoints[].group'),
    target: text(required(record, 'target', 'checkpoints[]'), 'checkpoints[].target'),
    ...(waitFor !== undefined ? { waitFor } : {}),
    ...(url !== undefined ? { url } : {}),
    ...(scrollIntoView !== undefined ? { scrollIntoView } : {}),
  }
}

function validateTouchEntry(record: JsonRecord): TouchCheckpoint {
  assertKnownKeys(
    record,
    ['id', 'interaction', 'phase', 'group', 'target', 'waitFor', 'url', 'scrollIntoView'],
    'checkpoints[]',
  )
  const waitFor = optionalText(record, 'waitFor', 'checkpoints[]')
  const url = optionalText(record, 'url', 'checkpoints[]')
  const scrollIntoView = optionalText(record, 'scrollIntoView', 'checkpoints[]')
  return {
    id: checkpointId(required(record, 'id', 'checkpoints[]'), 'checkpoints[].id'),
    interaction: 'touch',
    phase: enumValue(
      required(record, 'phase', 'checkpoints[]'),
      TOUCH_PHASES,
      'checkpoints[].phase',
    ),
    group: text(required(record, 'group', 'checkpoints[]'), 'checkpoints[].group'),
    target: text(required(record, 'target', 'checkpoints[]'), 'checkpoints[].target'),
    ...(waitFor !== undefined ? { waitFor } : {}),
    ...(url !== undefined ? { url } : {}),
    ...(scrollIntoView !== undefined ? { scrollIntoView } : {}),
  }
}

function validateAudioEntry(record: JsonRecord): AudioCheckpoint {
  assertKnownKeys(
    record,
    [
      'id',
      'interaction',
      'state',
      'waitFor',
      'unlock',
      'target',
      'persist',
      'voiceLimit',
      'trigger',
      'repeats',
      'url',
      'scrollIntoView',
    ],
    'checkpoints[]',
  )
  const state = enumValue(
    required(record, 'state', 'checkpoints[]'),
    AUDIO_STATES,
    'checkpoints[].state',
  )
  const unlock = optionalText(record, 'unlock', 'checkpoints[]')
  const target = optionalText(record, 'target', 'checkpoints[]')
  const persist = optionalText(record, 'persist', 'checkpoints[]')
  const voiceLimit = optionalPositiveInteger(record, 'voiceLimit', 'checkpoints[]')
  const trigger = optionalText(record, 'trigger', 'checkpoints[]')
  const repeats = optionalPositiveInteger(record, 'repeats', 'checkpoints[]')
  const url = optionalText(record, 'url', 'checkpoints[]')
  const scrollIntoView = optionalText(record, 'scrollIntoView', 'checkpoints[]')
  const entry: AudioCheckpoint = {
    id: checkpointId(required(record, 'id', 'checkpoints[]'), 'checkpoints[].id'),
    interaction: 'audio',
    state,
    waitFor: text(required(record, 'waitFor', 'checkpoints[]'), 'checkpoints[].waitFor'),
    ...(unlock !== undefined ? { unlock } : {}),
    ...(target !== undefined ? { target } : {}),
    ...(persist !== undefined ? { persist } : {}),
    ...(voiceLimit !== undefined ? { voiceLimit } : {}),
    ...(trigger !== undefined ? { trigger } : {}),
    ...(repeats !== undefined ? { repeats } : {}),
    ...(url !== undefined ? { url } : {}),
    ...(scrollIntoView !== undefined ? { scrollIntoView } : {}),
  }
  if (state === 'enabled' && entry.unlock === undefined) {
    throw new Error('audio checkpoint state "enabled" requires the declared unlock gesture selector (unlock)')
  }
  if ((state === 'muted' || state === 'returning') && entry.target === undefined) {
    throw new Error(`audio checkpoint state "${state}" requires the declared mute control selector (target)`)
  }
  if ((state === 'muted' || state === 'returning') && entry.persist === undefined) {
    throw new Error(`audio checkpoint state "${state}" requires the declared persistence storage key (persist)`)
  }
  if (entry.voiceLimit !== undefined && entry.trigger === undefined) {
    throw new Error('audio checkpoint voiceLimit requires the declared rapid-activation source (trigger)')
  }
  if (entry.repeats !== undefined && entry.voiceLimit === undefined) {
    throw new Error('audio checkpoint repeats is only valid with a declared voiceLimit')
  }
  if (entry.trigger !== undefined && entry.voiceLimit === undefined) {
    throw new Error('audio checkpoint trigger is only valid with a declared voiceLimit')
  }
  if (entry.voiceLimit !== undefined && state !== 'enabled') {
    throw new Error('audio checkpoint voiceLimit is observable only on the enabled state')
  }
  return entry
}

/**
 * Validates and normalizes a checkpoint manifest. Throws with a descriptive
 * message on the first contract violation, including the phase-completeness
 * rules: every hover group declares exactly before/during/after, every click
 * group exactly before/peak/recovered, and the IP-06B focus, keyboard, and
 * touch groups follow the same completeness rules, all targeting one selector.
 */
export function validateCheckpointManifest(input: unknown): CheckpointManifest {
  const record = asRecord(input, 'checkpoint manifest')
  assertKnownKeys(
    record,
    ['schemaVersion', 'surface', 'project', 'modeInput', 'readyMarker', 'checkpoints'],
    'checkpoint manifest',
  )

  const schemaVersion = required(record, 'schemaVersion', 'checkpoint manifest')
  if (schemaVersion !== CHECKPOINT_SCHEMA_VERSION) {
    throw new Error(`checkpoint manifest schemaVersion must be ${CHECKPOINT_SCHEMA_VERSION}`)
  }
  const surface = required(record, 'surface', 'checkpoint manifest')
  if (surface !== CHECKPOINT_SURFACE_ID) {
    throw new Error(`checkpoint manifest surface must be ${CHECKPOINT_SURFACE_ID}`)
  }
  const modeInput = text(required(record, 'modeInput', 'checkpoint manifest'), 'checkpoint manifest.modeInput')
  if (modeInput !== 'WDU_DETERMINISTIC=1') {
    throw new Error(
      'checkpoint manifest modeInput must be WDU_DETERMINISTIC=1; interaction captures are only deterministic evidence in deterministic mode',
    )
  }
  const readyMarker = text(
    required(record, 'readyMarker', 'checkpoint manifest'),
    'checkpoint manifest.readyMarker',
  )

  const checkpointsInput = required(record, 'checkpoints', 'checkpoint manifest')
  if (!Array.isArray(checkpointsInput) || checkpointsInput.length === 0) {
    throw new Error('checkpoint manifest checkpoints must be a non-empty array')
  }

  const checkpoints: CheckpointEntry[] = []
  const ids = new Set<string>()
  const hoverGroups = new Map<string, HoverCheckpoint[]>()
  const clickGroups = new Map<string, ClickCheckpoint[]>()
  const focusGroups = new Map<string, FocusCheckpoint[]>()
  const keyboardGroups = new Map<string, KeyboardCheckpoint[]>()
  const touchGroups = new Map<string, TouchCheckpoint[]>()
  const targets = new Map<string, string>()

  for (const item of checkpointsInput) {
    const entryRecord = asRecord(item, 'checkpoints[]')
    const interaction = enumValue(
      required(entryRecord, 'interaction', 'checkpoints[]'),
      CHECKPOINT_KINDS,
      'checkpoints[].interaction',
    )
    if (ids.has(String(entryRecord.id))) {
      throw new Error(`checkpoint id ${String(entryRecord.id)} is declared more than once`)
    }
    ids.add(String(entryRecord.id))

    let entry: CheckpointEntry
    if (interaction === 'hover') {
      entry = validateHoverEntry(entryRecord)
      const group = hoverGroups.get(entry.group) ?? []
      group.push(entry)
      hoverGroups.set(entry.group, group)
      const existingTarget = targets.get(entry.group)
      if (existingTarget !== undefined && existingTarget !== entry.target) {
        throw new Error(
          `hover group ${entry.group} must target one selector across all phases`,
        )
      }
      targets.set(entry.group, entry.target)
    } else if (interaction === 'click') {
      entry = validateClickEntry(entryRecord)
      const group = clickGroups.get(entry.group) ?? []
      group.push(entry)
      clickGroups.set(entry.group, group)
      const existingTarget = targets.get(entry.group)
      if (existingTarget !== undefined && existingTarget !== entry.target) {
        throw new Error(
          `click group ${entry.group} must target one selector across all phases`,
        )
      }
      targets.set(entry.group, entry.target)
    } else if (interaction === 'scroll') {
      entry = validateScrollEntry(entryRecord)
    } else if (interaction === 'loading') {
      entry = validateLoadingEntry(entryRecord)
    } else if (interaction === 'ready') {
      entry = validateReadyEntry(entryRecord)
    } else if (interaction === 'failure') {
      entry = validateFailureEntry(entryRecord)
    } else if (interaction === 'focus') {
      entry = validateFocusEntry(entryRecord)
      const group = focusGroups.get(entry.group) ?? []
      group.push(entry)
      focusGroups.set(entry.group, group)
      const existingTarget = targets.get(entry.group)
      if (existingTarget !== undefined && existingTarget !== entry.target) {
        throw new Error(
          `focus group ${entry.group} must target one selector across all phases`,
        )
      }
      targets.set(entry.group, entry.target)
    } else if (interaction === 'keyboard') {
      entry = validateKeyboardEntry(entryRecord)
      const group = keyboardGroups.get(entry.group) ?? []
      group.push(entry)
      keyboardGroups.set(entry.group, group)
      const existingTarget = targets.get(entry.group)
      if (existingTarget !== undefined && existingTarget !== entry.target) {
        throw new Error(
          `keyboard group ${entry.group} must target one selector across all phases`,
        )
      }
      targets.set(entry.group, entry.target)
    } else if (interaction === 'touch') {
      entry = validateTouchEntry(entryRecord)
      const group = touchGroups.get(entry.group) ?? []
      group.push(entry)
      touchGroups.set(entry.group, group)
      const existingTarget = targets.get(entry.group)
      if (existingTarget !== undefined && existingTarget !== entry.target) {
        throw new Error(
          `touch group ${entry.group} must target one selector across all phases`,
        )
      }
      targets.set(entry.group, entry.target)
    } else {
      entry = validateAudioEntry(entryRecord)
    }
    checkpoints.push(entry)
  }

  for (const [group, entries] of hoverGroups) {
    const phases = new Set(entries.map((entry) => entry.phase))
    if (
      phases.size !== HOVER_PHASES.length ||
      HOVER_PHASES.some((phase) => !phases.has(phase))
    ) {
      throw new Error(
        `hover group ${group} must declare exactly the phases ${HOVER_PHASES.join(', ')}`,
      )
    }
  }
  for (const [group, entries] of clickGroups) {
    const phases = new Set(entries.map((entry) => entry.phase))
    if (
      phases.size !== CLICK_PHASES.length ||
      CLICK_PHASES.some((phase) => !phases.has(phase))
    ) {
      throw new Error(
        `click group ${group} must declare exactly the phases ${CLICK_PHASES.join(', ')}`,
      )
    }
  }
  for (const [group, entries] of focusGroups) {
    const phases = new Set(entries.map((entry) => entry.phase))
    if (
      phases.size !== FOCUS_PHASES.length ||
      FOCUS_PHASES.some((phase) => !phases.has(phase))
    ) {
      throw new Error(
        `focus group ${group} must declare exactly the phases ${FOCUS_PHASES.join(', ')}`,
      )
    }
  }
  for (const [group, entries] of keyboardGroups) {
    const phases = new Set(entries.map((entry) => entry.phase))
    if (
      phases.size !== KEYBOARD_PHASES.length ||
      KEYBOARD_PHASES.some((phase) => !phases.has(phase))
    ) {
      throw new Error(
        `keyboard group ${group} must declare exactly the phases ${KEYBOARD_PHASES.join(', ')}`,
      )
    }
  }
  for (const [group, entries] of touchGroups) {
    const phases = new Set(entries.map((entry) => entry.phase))
    if (
      phases.size !== TOUCH_PHASES.length ||
      TOUCH_PHASES.some((phase) => !phases.has(phase))
    ) {
      throw new Error(
        `touch group ${group} must declare exactly the phases ${TOUCH_PHASES.join(', ')}`,
      )
    }
  }

  return {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    surface: CHECKPOINT_SURFACE_ID,
    project: text(required(record, 'project', 'checkpoint manifest'), 'checkpoint manifest.project'),
    modeInput,
    readyMarker,
    checkpoints,
  }
}

/** Deterministic capture filename for a checkpoint id (IP-06A deliverable). */
export function checkpointFileName(id: string): string {
  if (!CHECKPOINT_ID_PATTERN.test(id)) {
    throw new Error(`checkpoint id ${id} cannot name a deterministic file`)
  }
  return `${id}.png`
}
