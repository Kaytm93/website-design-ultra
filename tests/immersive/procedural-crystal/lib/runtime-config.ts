// runtime-config.ts — Process-environment boundary for the procedural-crystal
// fixture (IP-10C companion to product-hero/lib/runtime-config.ts). WDU_DETERMINISTIC,
// WDU_STATION, and WDU_REDUCED_MOTION are read only here and never in scene code.

export type RuntimeMode = 'live' | 'deterministic'
export type MotionPreference = 'full' | 'reduced'

export interface ResolvedRuntimeMode {
  mode: RuntimeMode
  stationId: string
  motion: MotionPreference
}

export const DEFAULT_STATION_ID = 'crystal-wide'

export function resolveMode(raw: string | undefined): RuntimeMode {
  if (raw === '1' || raw === 'true') return 'deterministic'
  return 'live'
}

export function resolveStationId(raw: string | undefined): string {
  if (typeof raw !== 'string') return DEFAULT_STATION_ID
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : DEFAULT_STATION_ID
}

export function resolveMotionPreference(raw: string | undefined): MotionPreference {
  if (raw === '1' || raw === 'true') return 'reduced'
  return 'full'
}

// The server-side resolver used by app/page.tsx. Reads the env exactly once
// per request, in one place; no other source file may call process.env.
export function resolveRuntimeMode(env: Record<string, string | undefined> = process.env): ResolvedRuntimeMode {
  return {
    mode: resolveMode(env.WDU_DETERMINISTIC),
    stationId: resolveStationId(env.WDU_STATION),
    motion: resolveMotionPreference(env.WDU_REDUCED_MOTION),
  }
}