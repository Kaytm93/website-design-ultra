// device-profile.ts — Declared device profile for the procedural-crystal
// fixture. Offline, webgl2, desktop — keeps the verifier's gate reading
// consistent across the two fixtures.
import type { BudgetDeclaration } from './immersive-telemetry.ts'

export const DEVICE_PROFILE: BudgetDeclaration['device'] = {
  name: 'procedural-crystal-fixture',
  renderer: 'webgl2',
  network: 'offline',
}