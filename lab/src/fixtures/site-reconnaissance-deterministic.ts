/**
 * Deterministic capture fixture for the offline site-reconnaissance experiment.
 *
 * It reuses the same route surface while WDU_DETERMINISTIC=1 is supplied by
 * the lab URL. The experiment contains only committed fixture data and does
 * not make network requests or claim that a live reference was inspected.
 */

import type { ExperimentContext } from '../main.js';
import { mount as mountSiteReconnaissance } from '../experiments/site-reconnaissance.ts';

export function mount(ctx: ExperimentContext): void {
  mountSiteReconnaissance(ctx);
}

export {
  OFFLINE_RECONNAISSANCE_CAPTURE,
  createOfflineCaptureSignature,
} from '../experiments/site-reconnaissance.ts';
