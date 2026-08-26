/**
 * Deterministic capture fixture for the foundational shader module experiment.
 *
 * Loads the same experiment as the interactive route, but activates the
 * deterministic runtime contract so two clean runs produce byte-identical
 * PNG captures. The seed is fixed and the stable-frame marker is applied
 * after three visible renders.
 *
 * @module
 */

import type { ExperimentContext } from '../main.js';
import { mount as mountFoundationalShaders } from '../experiments/shaders/foundational-shaders.js';

export function mount(ctx: ExperimentContext): void {
  mountFoundationalShaders(ctx);
}
