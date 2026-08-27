/**
 * Declared device profile for the procedural-crystal fixture (IP-10C). The
 * profile mirrors product-hero's offline desktop webgl2 baseline; the verifier
 * reads this through `window.__WDU_IMMERSIVE_TELEMETRY__.collect()` so the
 * runtime evidence is reproducible on the same machine across runs.
 *
 * Matches the product-hero DeviceProfile shape (id/class/browser/version/
 * renderer/viewport/scale/network) so the validateTelemetryDocument contract
 * accepts both fixtures with the same surface.
 */
import type { DeviceProfile } from './immersive-telemetry.ts'

export const DEVICE_PROFILE: DeviceProfile = {
  id: 'wdu-procedural-crystal-static-desktop',
  class: 'desktop',
  browser: 'chromium',
  browserVersion: 'declared',
  renderer: 'webgl2',
  viewport: {
    width: { value: 1440, unit: 'css-px' },
    height: { value: 1000, unit: 'css-px' },
  },
  deviceScaleFactor: { value: 1, unit: 'ratio' },
  network: 'offline',
}