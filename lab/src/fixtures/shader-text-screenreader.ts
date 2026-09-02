/**
 * J-D5 screen-reader fixture.
 *
 * This route deliberately has no WebGL dependency: the semantic heading and its
 * translation control must remain useful when the canvas is unavailable.
 */

import type { ExperimentContext } from '../main.js';

const HEADLINE_EN = 'The interface keeps its meaning in the document';
const HEADLINE_DE = 'Die Oberfläche behält ihre Bedeutung im Dokument';

export function mount(ctx: ExperimentContext): void {
  const { root, deterministic } = ctx;
  const region = document.createElement('main');
  region.setAttribute('aria-label', 'Shader text screen-reader fixture');
  region.style.cssText = 'position:absolute;inset:0;padding:24px;background:#0b0d10;color:#eef2f5;font:18px/1.5 system-ui,sans-serif;';

  const heading = document.createElement('h1');
  heading.id = 'shader-text-screenreader-headline';
  heading.tabIndex = 0;
  heading.lang = 'en';
  heading.setAttribute('translate', 'yes');
  heading.textContent = HEADLINE_EN;
  heading.style.cssText = 'user-select:text;-webkit-user-select:text;max-width:42rem;outline-offset:4px;';
  region.appendChild(heading);

  const explanation = document.createElement('p');
  explanation.textContent = 'This DOM heading remains selectable and translatable when the decorative canvas is absent.';
  region.appendChild(explanation);

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  canvas.style.cssText = 'pointer-events:none;position:absolute;inset:0;';
  region.appendChild(canvas);

  const locale = document.createElement('button');
  locale.type = 'button';
  locale.textContent = 'Deutsch';
  locale.addEventListener('click', () => {
    heading.textContent = HEADLINE_DE;
    heading.lang = 'de';
  });
  region.appendChild(locale);
  root.appendChild(region);

  if (deterministic) document.documentElement.dataset.wduReady = 'true';
}
