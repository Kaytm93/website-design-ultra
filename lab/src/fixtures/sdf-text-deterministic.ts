/**
 * Deterministic capture fixture for the SDF/MSDF text foundation (IP-11A).
 *
 * Loads the same experiment as the interactive route but is registered as a
 * separate lab route so the verifier can drive it under deterministic mode
 * without touching the controls UI. The fixture inherits the same atlas
 * generator (deterministic by construction) so two clean runs produce
 * byte-identical captures when the browser, GPU and seed match.
 *
 * @module
 */

import type { ExperimentContext } from '../main.js';
import { mount as mountSdfText } from '../experiments/shaders/sdf-text.js';

export function mount(ctx: ExperimentContext): void {
  mountSdfText(ctx);
}