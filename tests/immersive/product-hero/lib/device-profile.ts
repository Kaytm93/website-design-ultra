/**
 * The fixture's declared device profile (IP-03A surface). The document the
 * telemetry surface exposes is compared against this profile's declared
 * budget; the verifier additionally probes the live GPU and reports the
 * observed capability separately. The profile is a declaration, so the
 * fixture keeps working when the capturing host differs.
 */

import type { DeviceProfile } from './immersive-telemetry.ts'

export const DEVICE_PROFILE: DeviceProfile = {
  id: 'wdu-product-hero-desktop-1440x1000',
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
