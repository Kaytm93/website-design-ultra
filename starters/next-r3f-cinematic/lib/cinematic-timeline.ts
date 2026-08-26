/*
 * Copyable cinematic-timeline reference (IP-09C).
 *
 * This file has zero runtime dependencies and belongs outside the installed
 * website-design-ultra plugin payload (ADR-011). Copy it next to a timeline
 * manifest so the manifest, its validator, and the runtime read one versioned
 * shape. It validates declarations and evaluates them; it does not drive a
 * browser and it starts no second clock.
 *
 * Contract (T2.4 cinematic timeline + canvas-first-architecture §3):
 *   - One normalized timeline coordinating DOM, camera, scene, material, sound,
 *     and loading tracks without introducing a second clock.
 *   - Every track has exactly one owner and exactly one property; two writers
 *     for one property are rejected (one-owner-per-axis, made executable).
 *   - Separate portrait choreography is required when the manifest declares
 *     portrait-needed (art-direction contract). When present it is a full
 *     alternative choreography, not a scaled desktop path.
 *   - Declared deterministic checkpoint ids (pattern ^[a-z0-9][a-z0-9-]*$)
 *     feed PR-6 capture directly: the verifier captures <id>.png by
 *     scrolling/seeking to the declared normalized progress, without hardcoding
 *     any id. Deterministic files are derived from ids.
 *   - Time is injected: the runtime reads one canonical SceneClock (elapsed,
 *     delta, ratio, frame) supplied by the caller. The timeline never reads
 *     a wall-clock, a rAF timestamp, audio time, or a library ticker. Seeking
 *     is a pure function of normalized progress [0, 1] and the manifest, so
 *     two seeks to the same progress produce identical evaluation.
 *
 * Negative gate: this skill activates only for a normalized cinematic timeline
 * coordinating five or more owners (DOM + camera + scene + material + sound or
 * loading). A single rAF lerp, a CSS transition, a GSAP tween for one property,
 * or a pinned scroll section without the full owner set stays in r3f-patterns
 * or scroll-immersion and does not activate it.
 */

export const CINEMATIC_TIMELINE_SCHEMA_VERSION = 1 as const
export const CINEMATIC_TIMELINE_SURFACE_ID = 'wdu.cinematic-timeline' as const

export const TIMELINE_TRACK_KINDS = [
  'dom',
  'camera',
  'scene',
  'material',
  'sound',
  'loading',
] as const

export const TIMELINE_CHECKPOINT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/

export type TimelineTrackKind = (typeof TIMELINE_TRACK_KINDS)[number]

export interface TimelineKeyframe {
  /** Normalized progress in [0, 1]. Must be sorted ascending and cover 0 and 1 in the track. */
  readonly progress: number
  /** Numeric value at this keyframe. Only numbers are interpolated; strings are not lerped. */
  readonly value: number
}

export interface TimelineTrack {
  /** Unique per-timeline id, also the single owner for its property. */
  readonly id: string
  readonly kind: TimelineTrackKind
  /** The single property this track owns, e.g. "camera.position.z" or "dom.hero.opacity". */
  readonly property: string
  /** The owner field — must equal id so every track has exactly one declared owner. */
  readonly owner: string
  readonly keyframes: readonly TimelineKeyframe[]
}

export interface TimelineCheckpoint {
  /** Deterministic capture id; filenames derive as <id>.png and the verifier copies them verbatim. */
  readonly id: string
  /** Declared normalized progress in [0, 1] the verifier seeks to before capture. */
  readonly progress: number
}

export interface TimelinePortrait {
  /** Separate portrait choreography. Must be non-empty when declared. */
  readonly tracks: readonly TimelineTrack[]
  /** Optional portrait-specific checkpoints; when absent the base checkpoints are the capture set. */
  readonly checkpoints?: readonly TimelineCheckpoint[]
}

export interface CinematicTimelineManifest {
  readonly schemaVersion: typeof CINEMATIC_TIMELINE_SCHEMA_VERSION
  readonly surface: typeof CINEMATIC_TIMELINE_SURFACE_ID
  readonly project: string
  /** The requested deterministic mode input; only WDU_DETERMINISTIC=1 is a deterministic capture. */
  readonly modeInput: string
  /** The single clock source. Only "injected" is valid — no second clock is created. */
  readonly clock: 'injected'
  /** Normalized range is always [0, 1]; the duration is the clock's elapsed mapping, not a second timer. */
  readonly range: readonly [0, 1]
  readonly tracks: readonly TimelineTrack[]
  readonly checkpoints: readonly TimelineCheckpoint[]
  /** When present, separate portrait choreography required by the art-direction contract. */
  readonly portrait?: TimelinePortrait
  /** When true, portrait choreography is required and its absence is a contract failure. */
  readonly requiresPortrait?: boolean
}

// Minimal clock shape the runtime reads. Matches SceneClock but the timeline
// only needs elapsed to derive nothing else — progress is the external
// normalized input, never derived from a second timer here.
export interface TimelineClock {
  readonly elapsed: number
  readonly delta: number
  readonly ratio: number
  readonly frame: number
}

type JsonRecord = Record<string, unknown>

function isRecord(input: unknown): input is JsonRecord {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input)
}

function text(input: unknown, label: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return input
}

function optionalText(record: JsonRecord, key: string, label: string): string | undefined {
  if (!(key in record)) return undefined
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

function requireProgress(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be a normalized number in [0, 1]`)
  }
  return value
}

function requireCheckpointId(value: unknown, label: string): string {
  const id = text(value, label)
  if (!TIMELINE_CHECKPOINT_ID_PATTERN.test(id)) {
    throw new Error(`${label} must match ${String(TIMELINE_CHECKPOINT_ID_PATTERN)} (deterministic filenames are derived from ids)`)
  }
  return id
}

function requireTrackKind(value: unknown, label: string): TimelineTrackKind {
  return enumValue(value, TIMELINE_TRACK_KINDS, label) as TimelineTrackKind
}

function validateKeyframes(input: unknown, label: string): readonly TimelineKeyframe[] {
  if (!Array.isArray(input) || input.length < 2) {
    throw new Error(`${label} must be an array of at least 2 keyframes`)
  }
  const frames: TimelineKeyframe[] = []
  let lastProgress = -1
  for (let index = 0; index < input.length; index += 1) {
    const item = input[index]
    if (!isRecord(item)) throw new Error(`${label}[${index}] must be an object`)
    const allowed = ['progress', 'value']
    for (const key of Object.keys(item)) {
      if (!allowed.includes(key)) throw new Error(`${label}[${index}] has unknown property ${key}`)
    }
    if (!('progress' in item)) throw new Error(`${label}[${index}].progress is required`)
    if (!('value' in item)) throw new Error(`${label}[${index}].value is required`)
    const progress = requireProgress(item.progress, `${label}[${index}].progress`)
    if (progress <= lastProgress) {
      throw new Error(`${label} keyframes must be strictly sorted by ascending progress`)
    }
    lastProgress = progress
    const value = item.value
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${label}[${index}].value must be a finite number`)
    }
    frames.push({ progress, value })
  }
  // Must cover both ends so every progress in [0,1] interpolates without extrapolation.
  if (frames[0].progress !== 0) {
    throw new Error(`${label} must start at progress 0`)
  }
  if (frames[frames.length - 1].progress !== 1) {
    throw new Error(`${label} must end at progress 1`)
  }
  return frames
}

function validateTrack(input: unknown, label: string): TimelineTrack {
  if (!isRecord(input)) throw new Error(`${label} must be an object`)
  const allowed = ['id', 'kind', 'property', 'owner', 'keyframes']
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw new Error(`${label} has unknown property ${key}`)
  }
  const id = requireCheckpointId(input.id, `${label}.id`)
  const kind = requireTrackKind(input.kind, `${label}.kind`)
  const property = text(input.property, `${label}.property`)
  if (!/^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/.test(property)) {
    throw new Error(`${label}.property must be a dotted property path (e.g. camera.position.z or dom.hero.opacity)`)
  }
  const owner = text(input.owner, `${label}.owner`)
  if (owner !== id) {
    throw new Error(`${label}.owner must equal the track id "${id}" so every track has exactly one owner`)
  }
  if (!('keyframes' in input)) throw new Error(`${label}.keyframes is required`)
  const keyframes = validateKeyframes(input.keyframes, `${label}.keyframes`)
  return { id, kind, property, owner, keyframes }
}

function validateCheckpoint(input: unknown, label: string): TimelineCheckpoint {
  if (!isRecord(input)) throw new Error(`${label} must be an object`)
  const allowed = ['id', 'progress']
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw new Error(`${label} has unknown property ${key}`)
  }
  const id = requireCheckpointId(input.id, `${label}.id`)
  if (!('progress' in input)) throw new Error(`${label}.progress is required`)
  const progress = requireProgress(input.progress, `${label}.progress`)
  return { id, progress }
}

/**
 * Validates and normalizes a cinematic timeline manifest. Throws on the first
 * contract violation. Enforces one owner per property: two writers for one
 * property are rejected (the one-owner-per-axis rule, made executable).
 */
export function validateTimelineManifest(input: unknown): CinematicTimelineManifest {
  if (!isRecord(input)) throw new Error('timeline manifest must be an object')
  const allowedTop = ['schemaVersion', 'surface', 'project', 'modeInput', 'clock', 'range', 'tracks', 'checkpoints', 'portrait', 'requiresPortrait']
  for (const key of Object.keys(input)) {
    if (!allowedTop.includes(key)) throw new Error(`timeline manifest has unknown property ${key}`)
  }
  if (input.schemaVersion !== CINEMATIC_TIMELINE_SCHEMA_VERSION) {
    throw new Error(`timeline manifest schemaVersion must be ${CINEMATIC_TIMELINE_SCHEMA_VERSION}`)
  }
  if (input.surface !== CINEMATIC_TIMELINE_SURFACE_ID) {
    throw new Error(`timeline manifest surface must be ${CINEMATIC_TIMELINE_SURFACE_ID}`)
  }
  const project = text(input.project, 'timeline manifest.project')
  const modeInput = text(input.modeInput, 'timeline manifest.modeInput')
  if (modeInput !== 'WDU_DETERMINISTIC=1') {
    throw new Error('timeline manifest modeInput must be WDU_DETERMINISTIC=1; timeline capture is only deterministic evidence in deterministic mode')
  }
  const clock = input.clock
  if (clock !== 'injected') {
    throw new Error('timeline manifest clock must be "injected"; a second clock is not allowed')
  }
  const range = input.range
  if (!Array.isArray(range) || range.length !== 2 || range[0] !== 0 || range[1] !== 1) {
    throw new Error('timeline manifest range must be [0, 1]')
  }
  const tracksInput = input.tracks
  if (!Array.isArray(tracksInput) || tracksInput.length === 0) {
    throw new Error('timeline manifest tracks must be a non-empty array')
  }
  const tracks: TimelineTrack[] = []
  const ids = new Set<string>()
  const properties = new Map<string, string>()
  const kindsPresent = new Set<TimelineTrackKind>()
  for (let index = 0; index < tracksInput.length; index += 1) {
    const track = validateTrack(tracksInput[index], `tracks[${index}]`)
    if (ids.has(track.id)) throw new Error(`timeline track id ${track.id} is declared more than once`)
    ids.add(track.id)
    if (properties.has(track.property)) {
      throw new Error(`Two writers for one property are rejected: property "${track.property}" is owned by both "${properties.get(track.property)}" and "${track.id}"`)
    }
    properties.set(track.property, track.id)
    kindsPresent.add(track.kind)
    tracks.push(track)
  }
  // Must coordinate at least the six owner kinds without a second clock. A
  // timeline that omits one is not the T2.4 cinematic timeline and would be a
  // single-property lerp misclassified as the cinematic layer.
  const requiredKinds: TimelineTrackKind[] = ['dom', 'camera', 'scene', 'material', 'sound', 'loading']
  for (const kind of requiredKinds) {
    if (!kindsPresent.has(kind)) {
      throw new Error(`timeline manifest must declare at least one ${kind} track so DOM, camera, scene, material, sound, and loading are coordinated without a second clock`)
    }
  }
  // Every track has one owner is already enforced by owner === id, but also
  // ensure the map size equals tracks length (no owner sharing).
  if (ids.size !== tracks.length) {
    throw new Error('timeline manifest every track must have exactly one owner')
  }

  const checkpointsInput = input.checkpoints
  if (!Array.isArray(checkpointsInput) || checkpointsInput.length < 2) {
    throw new Error('timeline manifest checkpoints must be an array of at least 2 entries')
  }
  const checkpoints: TimelineCheckpoint[] = []
  const checkpointIds = new Set<string>()
  for (let index = 0; index < checkpointsInput.length; index += 1) {
    const entry = validateCheckpoint(checkpointsInput[index], `checkpoints[${index}]`)
    if (checkpointIds.has(entry.id)) throw new Error(`timeline checkpoint id ${entry.id} is declared more than once`)
    checkpointIds.add(entry.id)
    checkpoints.push(entry)
  }
  // Checkpoints must be sorted by progress and include both ends so capture
  // is deterministic and complete.
  const sorted = [...checkpoints].sort((a, b) => a.progress - b.progress)
  for (let i = 0; i < checkpoints.length; i += 1) {
    if (checkpoints[i].id !== sorted[i].id || checkpoints[i].progress !== sorted[i].progress) {
      throw new Error('timeline manifest checkpoints must be sorted by ascending progress')
    }
  }
  if (checkpoints[0].progress !== 0) {
    throw new Error('timeline manifest checkpoints must include progress 0')
  }
  if (checkpoints[checkpoints.length - 1].progress !== 1) {
    throw new Error('timeline manifest checkpoints must include progress 1')
  }

  const requiresPortrait = input.requiresPortrait === true ? true : input.requiresPortrait === undefined ? undefined : (() => { throw new Error('timeline manifest requiresPortrait must be true when present') })()

  let portrait: TimelinePortrait | undefined
  if ('portrait' in input) {
    const portraitInput = input.portrait
    if (!isRecord(portraitInput)) throw new Error('timeline manifest portrait must be an object')
    const allowedPortrait = ['tracks', 'checkpoints']
    for (const key of Object.keys(portraitInput)) {
      if (!allowedPortrait.includes(key)) throw new Error(`timeline manifest portrait has unknown property ${key}`)
    }
    if (!Array.isArray(portraitInput.tracks) || portraitInput.tracks.length === 0) {
      throw new Error('timeline manifest portrait.tracks must be a non-empty array when portrait choreography is declared')
    }
    const portraitTracks: TimelineTrack[] = []
    const portraitIds = new Set<string>()
    const portraitProperties = new Map<string, string>()
    for (let index = 0; index < portraitInput.tracks.length; index += 1) {
      const track = validateTrack((portraitInput.tracks as unknown[])[index], `portrait.tracks[${index}]`)
      if (portraitIds.has(track.id)) throw new Error(`portrait track id ${track.id} is declared more than once`)
      portraitIds.add(track.id)
      if (portraitProperties.has(track.property)) {
        throw new Error(`Two writers for one property are rejected in portrait: property "${track.property}" is owned by both "${portraitProperties.get(track.property)}" and "${track.id}"`)
      }
      portraitProperties.set(track.property, track.id)
      portraitTracks.push(track)
    }
    // Portrait must also coordinate the same owner set — a portrait that omits
    // a kind is not choreography, it is a scaled desktop fallback which the
    // contract forbids.
    const portraitKinds = new Set(portraitTracks.map((t) => t.kind))
    for (const kind of requiredKinds) {
      if (!portraitKinds.has(kind)) {
        throw new Error(`portrait choreography must declare at least one ${kind} track`)
      }
    }
    let portraitCheckpoints: readonly TimelineCheckpoint[] | undefined
    if ('checkpoints' in portraitInput) {
      const raw = portraitInput.checkpoints
      if (!Array.isArray(raw)) throw new Error('portrait.checkpoints must be an array')
      const pcs: TimelineCheckpoint[] = []
      const pcIds = new Set<string>()
      for (let i = 0; i < (raw as unknown[]).length; i += 1) {
        const entry = validateCheckpoint((raw as unknown[])[i], `portrait.checkpoints[${i}]`)
        if (pcIds.has(entry.id)) throw new Error(`portrait checkpoint id ${entry.id} is declared more than once`)
        pcIds.add(entry.id)
        pcs.push(entry)
      }
      portraitCheckpoints = pcs
    }
    portrait = { tracks: portraitTracks, ...(portraitCheckpoints ? { checkpoints: portraitCheckpoints } : {}) }
  }

  if (requiresPortrait === true && portrait === undefined) {
    throw new Error('timeline manifest requiresPortrait is true but no portrait choreography is declared; a separate portrait choreography is required when the art-direction contract declares portrait')
  }

  return {
    schemaVersion: CINEMATIC_TIMELINE_SCHEMA_VERSION,
    surface: CINEMATIC_TIMELINE_SURFACE_ID,
    project: project,
    modeInput: modeInput,
    clock: 'injected',
    range: [0, 1],
    tracks,
    checkpoints,
    ...(portrait ? { portrait } : {}),
    ...(requiresPortrait ? { requiresPortrait: true } : {}),
  }
}

/** Deterministic capture filename for a timeline checkpoint id. */
export function timelineCheckpointFileName(id: string): string {
  if (!TIMELINE_CHECKPOINT_ID_PATTERN.test(id)) {
    throw new Error(`timeline checkpoint id ${id} cannot name a deterministic file`)
  }
  return `${id}.png`
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Pure deterministic evaluation: the same manifest and progress always return
 * the identical property map, regardless of prior seeks. No clock is read here
 * — the caller passes the normalized progress explicitly, which may itself have
 * been derived from the one injected clock elsewhere (e.g. clock.elapsed).
 */
export function evaluateTimeline(
  manifest: CinematicTimelineManifest,
  progress: number,
  options?: { readonly portrait?: boolean },
): Record<string, number> {
  const clamped = Math.max(0, Math.min(1, progress))
  const tracks = options?.portrait && manifest.portrait ? manifest.portrait.tracks : manifest.tracks
  const result: Record<string, number> = {}
  for (const track of tracks) {
    const frames = track.keyframes
    // Boundary cases are exact so 0 and 1 evaluate to the declared keyframe
    // value without floating-point interpolation error.
    if (clamped <= frames[0].progress) {
      result[track.property] = frames[0].value
      continue
    }
    if (clamped >= frames[frames.length - 1].progress) {
      result[track.property] = frames[frames.length - 1].value
      continue
    }
    // Linear interpolation between the bracketing keyframes. The timeline is
    // deliberately minimal — no cubic, no easing map — so every value is
    // traceable from two declared numbers. A project that needs easing adds it
    // as an explicit keyframe density; it does not hide a curve in the
    // runtime.
    let lower = frames[0]
    let upper = frames[frames.length - 1]
    for (let i = 0; i < frames.length - 1; i += 1) {
      if (clamped >= frames[i].progress && clamped <= frames[i + 1].progress) {
        lower = frames[i]
        upper = frames[i + 1]
        break
      }
    }
    const span = upper.progress - lower.progress
    const t = span === 0 ? 0 : (clamped - lower.progress) / span
    result[track.property] = lerp(lower.value, upper.value, t)
  }
  return result
}

/**
 * Create a controller that evaluates the timeline from the one injected clock
 * without starting a second timer. The controller reads clock.elapsed only to
 * map it to the normalized range when the timeline is time-driven; when
 * scroll-driven the caller passes the normalized scroll offset as progress
 * directly to evaluateTimeline. Either way no second clock is created.
 *
 * Duration mapping: when provided, elapsed is divided by durationSeconds and
 * clamped to [0,1] to derive progress. When absent, progress must be supplied
 * explicitly via seek().
 */
export function createTimelineController(
  manifest: CinematicTimelineManifest,
  clock: TimelineClock,
  options?: { readonly durationSeconds?: number; readonly portrait?: boolean },
): {
  readonly manifest: CinematicTimelineManifest
  seek(progress: number): Record<string, number>
  sample(): Record<string, number>
  checkpoint(checkpointId: string): Record<string, number>
} {
  if (options?.durationSeconds !== undefined) {
    if (!Number.isFinite(options.durationSeconds) || options.durationSeconds <= 0) {
      throw new Error('durationSeconds must be a positive finite number when provided')
    }
  }
  // Defensive: ensure no wall-clock path leaked in — the controller receives
  // the injected clock and never reads a wall clock itself.
  const duration = options?.durationSeconds ?? null
  const portrait = options?.portrait === true

  function seek(progress: number): Record<string, number> {
    if (typeof progress !== 'number' || !Number.isFinite(progress) || progress < 0 || progress > 1) {
      throw new Error('seek progress must be a normalized number in [0, 1]')
    }
    return evaluateTimeline(manifest, progress, { portrait })
  }

  function sample(): Record<string, number> {
    if (duration === null) {
      throw new Error('sample() requires durationSeconds; use seek(progress) when timeline is scroll-driven')
    }
    const progress = Math.max(0, Math.min(1, clock.elapsed / duration))
    return evaluateTimeline(manifest, progress, { portrait })
  }

  function checkpoint(checkpointId: string): Record<string, number> {
    const list = portrait && manifest.portrait?.checkpoints ? manifest.portrait.checkpoints : manifest.checkpoints
    const entry = list.find((c) => c.id === checkpointId)
    if (!entry) {
      const available = list.map((c) => c.id).sort().join(', ') || '(none)'
      throw new Error(`Unknown timeline checkpoint "${checkpointId}". Available: ${available}`)
    }
    return seek(entry.progress)
  }

  return { manifest, seek, sample, checkpoint }
}
