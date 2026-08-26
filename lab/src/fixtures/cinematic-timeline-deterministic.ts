/**
 * Deterministic fixture for the cinematic timeline lab experiment.
 *
 * Seeks the same timeline checkpoint twice and verifies the evaluation is
 * byte-identical pure output. The mount reuses the interactive experiment
 * so the visual and evaluation contract are one.
 */

import { mount as mountTimeline } from '../experiments/cinematic-timeline.js';

export function mount(ctx: import('../main.js').ExperimentContext): void {
  mountTimeline(ctx);
}

// Deterministic helpers for the test suite (pure seek, no clock side-effects)
export { evaluateTimeline, validateTimelineManifest, createTimelineController } from '@wdu-references/cinematic-timeline.ts';
export { LAB_EVIDENCE } from './cinematic-timeline-evidence.ts';
