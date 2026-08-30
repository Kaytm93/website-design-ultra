/**
 * Deterministic capture fixture for DOM-mirrored shader text effects (IP-11B).
 *
 * Loads the same experiment as the interactive route but is registered as a
 * separate lab route so the verifier can drive it under deterministic mode
 * without touching the controls UI. The fixture inherits the same DOM
 * mirror so every uniform is still produced from real DOM events; the only
 * difference from the interactive route is that no controls are exposed
 * for human use.
 *
 * Determinism: under WDU_DETERMINISTIC=1 the deterministic clock drives the
 * effect time. Two clean runs of the same commit and declared device
 * profile produce byte-identical captures when the DOM state matches at
 * frame 1 (no pointer / focus / activation has been received yet).
 *
 * @module
 */

import type { ExperimentContext } from '../main.js';
import { mount as mountDomTextEffects } from '../experiments/shaders/dom-text-effects.js';

export function mount(ctx: ExperimentContext): void {
  mountDomTextEffects(ctx);
}