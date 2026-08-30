/**
 * Deterministic capture fixture for the canvas-only prohibition list
 * (IP-11C). Inherits the interactive route so two clean runs under
 * WDU_DETERMINISTIC=1 hash the same canvas pixels and re-run the
 * validator against the same DOM tree, proving the prohibition list
 * is reproducible.
 *
 * @module
 */

import type { ExperimentContext } from '../main.js';
import { mount as mountCanvasOnlyProhibition } from '../experiments/shaders/canvas-only-prohibition.js';

export function mount(ctx: ExperimentContext): void {
  mountCanvasOnlyProhibition(ctx);
}