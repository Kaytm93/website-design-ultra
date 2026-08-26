/**
 * IP-08A lab harness entry point.
 *
 * Routes to one experiment per URL query parameter `?e=<name>`. There is no
 * application router, no layout component, and no marketing copy — each
 * experiment is a self-contained ES module that mounts into `#root`.
 *
 * When `WDU_DETERMINISTIC=1` is set on the URL (or as a global variable), the
 * lab activates the deterministic runtime contract. The stable-frame marker is
 * fired by whichever experiment signals readiness.
 *
 * @module
 */

import {
  createClock,
  createRandomStreams,
  type SceneClock,
  type RandomStreams,
} from '@wdu-references/determinism-runtime.ts';
import { clearError, displayError } from './compile-error.js';

export interface ExperimentContext {
  readonly clock: SceneClock;
  readonly streams: RandomStreams;
  readonly root: HTMLElement;
  readonly errorEl: HTMLElement;
  readonly controlsEl: HTMLElement;
  readonly deterministic: boolean;
}

interface ExperimentModule {
  mount(ctx: ExperimentContext): void;
}

// ── Global deterministic flags ──────────────────────────────────────────────
// WDU_DETERMINISTIC is a runtime flag, not a module constant. The reference
// determinism-runtime.ts treats it as a ClockOptions mode, so the lab reads
// it from the environment here and passes it through the ExperimentContext.

const WDU_DETERMINISTIC_FLAG: boolean =
  (typeof globalThis !== 'undefined' &&
    (globalThis as Record<string, unknown>).WDU_DETERMINISTIC === true) ||
  (typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('WDU_DETERMINISTIC'));

if (WDU_DETERMINISTIC_FLAG) {
  document.documentElement.dataset.wduMode = 'deterministic';
  console.log('[lab] deterministic mode active');
}

const clock = WDU_DETERMINISTIC_FLAG
  ? createClock({ mode: 'deterministic', stepSeconds: 1 / 60 })
  : createClock({ mode: 'live' });

const streams = WDU_DETERMINISTIC_FLAG
  ? createRandomStreams('wdu-lab-v1')
  : createRandomStreams(`live-${Date.now()}`);

// ── Experiment context ───────────────────────────────────────────────────────

const deterministic = WDU_DETERMINISTIC_FLAG;

const errorEl = document.getElementById('lab-error') as HTMLElement;
const controlsEl = document.getElementById('lab-controls') as HTMLElement;

// ── Experiment loader ───────────────────────────────────────────────────────

const experimentName =
  new URLSearchParams(window.location.search).get('e') || 'shader-fullscreen';

const EXPERIMENTS: Record<string, () => Promise<ExperimentModule>> = {
  'shader-fullscreen': () => import('./experiments/shader-fullscreen.js'),
  'particle-toy': () => import('./experiments/particle-toy.js'),
  'compile-error': () => import('./fixtures/compile-error.js'),
  'deterministic-capture': () => import('./fixtures/deterministic-capture.js'),
};

async function loadExperiment(name: string): Promise<void> {
  const root = document.getElementById('root') as HTMLElement;
  root.innerHTML = '';

  const factory = EXPERIMENTS[name];
  if (!factory) {
    root.textContent = `[wdu-lab] Unknown experiment: "${name}"`;
    return;
  }

  try {
    const mod = await factory();
    mod.mount({
      clock,
      streams,
      root,
      errorEl,
      controlsEl,
      deterministic,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.stack || err.message : String(err);
    displayError(message);
    errorEl.classList.add('visible');
  }
}

loadExperiment(experimentName).catch((err: unknown) => {
  displayError(err instanceof Error ? err.stack || err.message : String(err));
});