/** J-D5 deterministic fixture: the production shader-text route without extra controls. */

import type { ExperimentContext } from '../main.js';
import { mount as mountShaderText } from '../experiments/shaders/shader-text.js';

export function mount(ctx: ExperimentContext): void {
  mountShaderText(ctx);
}
