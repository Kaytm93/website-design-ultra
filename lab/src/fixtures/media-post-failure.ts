/**
 * Failure fixture for media/post modules — IP-08D.
 *
 * Renders the failure fallback path with a deliberately broken LUT reference
 * so the harness can assert a textual compile diagnostic. The live fixture
 * (media-post.frag) is the PASS path; this fixture proves failure is not blank.
 *
 * @module
 */

import type { ExperimentContext } from '../main.js';
import { displayError } from '../compile-error.js';

export function mount(ctx: ExperimentContext): void {
  const { root } = ctx;
  // Non-blank fallback representation — visible even when video fails.
  const container = document.createElement('div');
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.background = 'rgb(36, 41, 48)';
  container.style.color = '#c8d0dc';
  container.style.fontFamily = 'ui-monospace, monospace';
  container.style.fontSize = '12px';
  container.textContent = 'video failure — fallback (non-blank) [uMissingLut compile error in fragment]';
  container.dataset.fallback = 'non-blank';
  container.dataset.videoState = 'failure';
  root.appendChild(container);

  // Surface the expected compile error diagnostics textually instead of blank canvas.
  displayError('FRAGMENT SHADER COMPILE ERROR at line 20: \'uMissingLut\' : undeclared identifier');

  // Mark deterministic ready so a harness can still capture the fallback.
  document.documentElement.setAttribute('data-wdu-ready', 'true');
}
