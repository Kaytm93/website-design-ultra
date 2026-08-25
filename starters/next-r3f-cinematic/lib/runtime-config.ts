/**
 * Application-boundary environment resolution for the deterministic runtime.
 *
 * WDU_DETERMINISTIC=1 is the only value that enables deterministic mode; an
 * unset variable and every other value select live mode (determinism contract,
 * section 1). WDU_STATION names the camera station applied before the first
 * stable frame. WDU_REDUCED_MOTION=1 selects the reduced-motion capture state
 * (IP-05C); unset and every other value select full motion. The server page
 * and layout resolve these values per request; scene systems never read
 * process environment and receive the resolved mode, station, and motion as
 * props instead.
 */

import {
  resolveMotionPreference,
  type MotionPreference,
} from './motion-preference.ts'

export type { MotionPreference } from './motion-preference.ts'

export type RuntimeMode = 'deterministic' | 'live'

export const DEFAULT_STATION_ID = 'hero-wide'

export function resolveMode(raw: string | undefined): RuntimeMode {
  return raw === '1' ? 'deterministic' : 'live'
}

export function resolveStationId(raw: string | undefined): string {
  return raw !== undefined && raw.trim().length > 0 ? raw.trim() : DEFAULT_STATION_ID
}

export function resolveRuntimeMode(): {
  mode: RuntimeMode
  stationId: string
  motion: MotionPreference
} {
  return {
    mode: resolveMode(process.env.WDU_DETERMINISTIC),
    stationId: resolveStationId(process.env.WDU_STATION),
    motion: resolveMotionPreference(process.env.WDU_REDUCED_MOTION),
  }
}
