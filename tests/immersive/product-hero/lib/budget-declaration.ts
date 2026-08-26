/**
 * The fixture's declared immersive budget (IP-03A surface). Three gate
 * classes, no invented implicit thresholds: every number below is either the
 * immersive-3d §3 budget (draw calls, triangles, frame time) or a declared
 * project choice with a written justification. The verifier compares observed
 * values against this declaration; it never invents a universal threshold.
 */

import type { BudgetDeclaration } from './immersive-telemetry.ts'

export const BUDGET_DECLARATION: BudgetDeclaration = {
  frameTarget: {
    rate: { value: 60, unit: 'fps' },
    frameTime: { value: 16.7, unit: 'ms' },
    justification:
      'immersive-3d §3: set a frame-time target matching the display; the fixture declares a 60 Hz desktop target, stated in ms and never derived from fps.',
  },
  gates: [
    {
      class: 'warm-gpu-frame-time',
      comparison: 'less-than-or-equal',
      targets: {
        median: { value: 16.7, unit: 'ms' },
        p95: { value: 16.7, unit: 'ms' },
      },
      warmup: { value: 60, unit: 'frames' },
      sampleWindow: { value: 120, unit: 'frames' },
      justification:
        'the declared 60 Hz target from immersive-3d §3 on the fixture desktop profile; the scene renders one optimized model (5 authored materials merged to 2 by the pipeline) far below the §3 ceilings (under 100 draw calls, under 500k visible triangles).',
    },
    {
      class: 'first-meaningful-frame',
      comparison: 'less-than-or-equal',
      marker: 'html[data-wdu-ready="true"]',
      target: { value: 5000, unit: 'ms' },
      justification:
        'the ready marker fires after the stable frame with the committed local model loaded, the station applied, and the named streams initialized; the model is a few kilobytes, so 5 s bounds a cold desktop load without a network.',
    },
    {
      class: 'transfer-before-first-meaningful-frame',
      comparison: 'less-than-or-equal',
      boundary: 'first-meaningful-frame',
      target: { value: 3_000_000, unit: 'bytes' },
      justification:
        'the fixture fetches only its own committed assets — Next chunks, two posters, the brand mark, and one optimized GLB; 3 MB bounds that offline desktop load with headroom.',
    },
  ],
}
