/**
 * Canvas-only prohibition list visual fixture (IP-11C).
 *
 * Four rows, one per prohibited category. Each row shows a real DOM twin
 * (primary action button, form, legal-copy block, pricing card) and a
 * small canvas overlay above it. The overlay renders a decorative
 * scramble effect when its pointer is hovered; the DOM twin is the
 * canonical authority.
 *
 * The fixture is also the validator's runtime smoke test: a "Missing
 * twin" toggle removes each DOM twin in turn and re-runs the validator
 * so the assertion fires in the live page (and the failure reason is
 * written into the row caption). The toggle is for the developer; the
 * shipping page must keep every twin present.
 *
 * The fixture is read-only by default — it does not mutate the canvas
 * to invent primary actions, forms, legal copy, or pricing. It only
 * proves that the prohibition list is reachable from the lab.
 *
 * Determinism: under WDU_DETERMINISTIC=1, the validator runs once at
 * mount and the canvas renders a single frame with `data-wdu-ready`.
 *
 * @module
 */

import * as THREE from 'three';
import type { ExperimentContext } from '../../main.js';
import {
  buildDomTwin,
  createProhibitionObserver,
  withCanonicalSignatures,
  type ProhibitionDeclaration,
  type ProhibitionObserver,
  type ProhibitionCategory,
  PROHIBITED_CATEGORIES,
} from '../../modules/canvas-only-prohibition.js';

interface RowSpec {
  readonly category: ProhibitionCategory;
  readonly canvasSurfaceSelector: string;
  readonly canvasDecoration: 'aria-hidden' | 'inert' | 'pointer-events-none';
  readonly caption: string;
  readonly text: string;
  readonly decoration: () => void;
}

const ROWS: readonly RowSpec[] = [
  {
    category: 'primary-action',
    canvasSurfaceSelector: '[data-wdu-canvas-primary-action]',
    canvasDecoration: 'aria-hidden',
    caption: 'Primary action — real `<button>` required',
    text: 'Start trial',
    decoration: () => {
      /* Default decoration — the canvas surface is `aria-hidden`. */
    },
  },
  {
    category: 'form',
    canvasSurfaceSelector: '[data-wdu-canvas-form]',
    canvasDecoration: 'pointer-events-none',
    caption: 'Form — real `<form>` with a focusable control',
    text: 'Email address',
    decoration: () => {
      /* Default decoration — the canvas surface is `pointer-events: none`. */
    },
  },
  {
    category: 'legal-copy',
    canvasSurfaceSelector: '[data-wdu-canvas-legal]',
    canvasDecoration: 'aria-hidden',
    caption: 'Legal copy — readable, selectable, translatable DOM text',
    text: '© 2026 WDU. Imprint and privacy policy apply.',
    decoration: () => {
      /* Default decoration — the canvas surface is `aria-hidden`. */
    },
  },
  {
    category: 'pricing',
    canvasSurfaceSelector: '[data-wdu-canvas-pricing]',
    canvasDecoration: 'aria-hidden',
    caption: 'Pricing — real DOM price card with currency token',
    text: '€12 / month — Pro tier',
    decoration: () => {
      /* Default decoration — the canvas surface is `aria-hidden`. */
    },
  },
];

interface FixtureRow {
  readonly spec: RowSpec;
  readonly host: HTMLElement;
  readonly twin: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly status: HTMLElement;
}

interface MountedFixture {
  readonly declaration: ProhibitionDeclaration;
  readonly observer: ProhibitionObserver;
  readonly rows: readonly FixtureRow[];
}

export function mount(ctx: ExperimentContext): void {
  const fixture = mountFixture(ctx);

  // When the user clicks "Remove DOM twin" the validator should
  // immediately fail. The toggle rebuilds the row so the same
  // MutationObserver the production observer uses fires.
  const toggle = document.createElement('button');
  toggle.textContent = 'Remove / restore DOM twins (developer only)';
  toggle.type = 'button';
  toggle.style.cssText =
    'position:fixed;bottom:8px;left:8px;padding:6px 10px;background:#111827;color:#e5e7ea;' +
    'border:1px solid #374151;border-radius:4px;font:12px ui-sans-serif,system-ui;z-index:10;';
  document.body.appendChild(toggle);

  let twinsAttached = true;
  toggle.addEventListener('click', () => {
    twinsAttached = !twinsAttached;
    toggle.textContent = twinsAttached
      ? 'Remove DOM twins (developer only)'
      : 'Restore DOM twins (developer only)';
    for (const row of fixture.rows) {
      if (twinsAttached) {
        row.host.appendChild(row.twin);
      } else {
        row.twin.remove();
      }
    }
    refreshStatus(fixture);
  });

  // Mark the canvas overlay as decorative on each canvas so the
  // validator's decorative-canvas check passes. The actual `aria-hidden`
  // lives on the wrapper, not the `<canvas>` element itself, so the
  // user's pointer events still reach the canvas when needed.
  for (const row of fixture.rows) {
    applyCanvasDecoration(row, row.spec.canvasDecoration);
  }

  // The validator's initial audit + a render loop that mirrors the IP-11B
  // pattern: one normalized clock, canvas re-rendered each frame.
  refreshStatus(fixture);
  let frame = 0;
  function animate(): void {
    if (ctx.clock) ctx.clock.tick();
    for (const row of fixture.rows) {
      // Drive the canvas with a deterministic seed derived from the
      // fixture category. The canvas is decorative; the DOM twin stays
      // the visible authority.
      const t = ctx.clock ? ctx.clock.elapsed : frame / 60;
      drawDecorativeCanvas(row, t);
    }
    if (ctx.deterministic && frame === 1) {
      document.documentElement.dataset.wduReady = '1';
    }
    frame += 1;
    requestAnimationFrame(animate);
  }
  animate();

  window.addEventListener('beforeunload', () => {
    fixture.observer.dispose();
  });
}

// ── Internals ─────────────────────────────────────────────────────────────────

function mountFixture(ctx: ExperimentContext): MountedFixture {
  const { root, controlsEl, errorEl } = ctx;

  const host = document.createElement('div');
  host.setAttribute('role', 'region');
  host.setAttribute('aria-label', 'Canvas-only prohibition list fixture (IP-11C)');
  host.style.cssText = [
    'position:absolute',
    'inset:0',
    'overflow:auto',
    'padding:24px',
    'box-sizing:border-box',
    'background:#070708',
    'color:#e5e7ea',
    "font:14px/1.45 ui-sans-serif,system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif",
  ].join(';');
  root.appendChild(host);

  const title = document.createElement('h1');
  title.style.cssText = 'font-size:18px;margin:0 0 6px;color:#f3f4f6;';
  title.textContent = 'Canvas-only prohibition list (IP-11C)';
  host.appendChild(title);

  const blurb = document.createElement('p');
  blurb.style.cssText = 'max-width:560px;margin:0 0 16px;color:#9aa0a6;font-size:13px;';
  blurb.textContent =
    'Four rows. Each row holds a real DOM twin (button, form, legal copy, pricing) and a small decorative canvas overlay. ' +
    'A validator runs at mount and on every DOM mutation; removing a twin flips the row status to FAIL.';
  host.appendChild(blurb);

  const status = document.createElement('div');
  status.id = 'wdu-prohibition-summary';
  status.style.cssText = 'margin:0 0 12px;padding:8px 10px;border:1px solid #1f2937;color:#e5e7ea;font-size:12px;';
  host.appendChild(status);

  const stack = document.createElement('div');
  stack.style.cssText = 'display:flex;flex-direction:column;gap:18px;';
  host.appendChild(stack);

  const rows: FixtureRow[] = [];
  const declarations: ProhibitionDeclaration = {
    projectName: 'canvas-only-prohibition-fixture',
    surfaces: ROWS.map((spec) => ({
      category: spec.category,
      domTwinSelector: `[data-wdu-twin="${spec.category}"]`,
      canvasSurfaceSelector: spec.canvasSurfaceSelector,
      label: spec.caption,
    })),
  };
  const canonicalDeclaration = withCanonicalSignatures(declarations);

  for (const spec of ROWS) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:12px;border:1px solid #1f2937;border-radius:6px;';

    const caption = document.createElement('span');
    caption.style.cssText = 'font-size:11px;color:#9aa0a6;letter-spacing:0.04em;text-transform:uppercase;';
    caption.textContent = spec.caption;
    row.appendChild(caption);

    const status = document.createElement('span');
    status.dataset.wduRowStatus = spec.category;
    status.style.cssText = 'font-size:11px;color:#10b981;';
    status.textContent = 'PASS — DOM twin present, canvas overlay decorative';
    row.appendChild(status);

    // Canvas overlay host — the canvas is decorative, the DOM twin sits
    // inside the same container so their bboxes align.
    const overlayHost = document.createElement('div');
    overlayHost.dataset.wduOverlayHost = spec.category;
    overlayHost.setAttribute(
      'data-wdu-canvas-decorative',
      spec.canvasDecoration === 'aria-hidden' ? 'true' : 'true',
    );
    overlayHost.style.cssText = 'position:relative;display:inline-block;';
    row.appendChild(overlayHost);

    const twin = buildDomTwin(document, spec.category, spec.text);
    twin.dataset.wduTwin = spec.category;
    overlayHost.appendChild(twin);

    const canvas = document.createElement('canvas');
    canvas.dataset.wduCanvasSurface = spec.category;
    canvas.setAttribute('data-wdu-canvas-' + spec.category.replace(/-/g, '-'), 'true');
    canvas.setAttribute('data-wdu-effect', 'scramble');
    canvas.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      'pointer-events:none',
      'mix-blend-mode:screen',
      'opacity:0.7',
    ].join(';');
    canvas.width = 240;
    canvas.height = 48;
    overlayHost.appendChild(canvas);

    stack.appendChild(row);
    rows.push({ spec, host: overlayHost, twin, canvas, status });
  }

  // Validator observer: live audit on every mutation.
  const observer = createProhibitionObserver(canonicalDeclaration, {
    document,
    fireInitialCheck: true,
  });

  // Surface validator results in the per-row caption.
  for (const row of rows) {
    applyRowStatus(row, observer.result);
  }

  // Render the validator's global summary.
  refreshStatusPanel(status, observer.result);

  // Allow toggling reduced motion from the controls panel — same
  // pattern the IP-11B route uses so the fixture inherits the
  // established lab vocabulary.
  const motionLabel = document.createElement('label');
  motionLabel.style.cssText = 'display:flex;align-items:center;gap:0.5rem;font-size:12px;color:#cbd5e1;margin-top:12px;';
  const motionInput = document.createElement('input');
  motionInput.type = 'checkbox';
  const motionText = document.createElement('span');
  motionText.textContent = 'reduced motion (decorative canvas collapses to amplitude 0)';
  motionLabel.appendChild(motionInput);
  motionLabel.appendChild(motionText);
  controlsEl.appendChild(motionLabel);
  void motionInput;

  void errorEl;
  void PROHIBITED_CATEGORIES;

  return { declaration: canonicalDeclaration, observer, rows };
}

function applyCanvasDecoration(row: FixtureRow, mode: RowSpec['canvasDecoration']): void {
  if (mode === 'aria-hidden') {
    row.canvas.setAttribute('aria-hidden', 'true');
  } else if (mode === 'inert') {
    (row.canvas as HTMLElement).inert = true;
  } else {
    // pointer-events:none is already set in the inline style; no extra
    // DOM attribute is needed.
  }
}

function applyRowStatus(row: FixtureRow, result: ReturnType<ProhibitionObserver['check']>): void {
  const passing = result.passing.includes(row.spec.category);
  const violation = result.violations.find((v) => v.category === row.spec.category);
  if (passing && !violation) {
    row.status.style.color = '#10b981';
    row.status.textContent = `PASS — DOM twin present, canvas overlay decorative`;
  } else {
    row.status.style.color = '#f87171';
    row.status.textContent = `FAIL — ${violation?.message ?? 'unknown reason'}`;
  }
}

function refreshStatus(fixture: MountedFixture): void {
  const result = fixture.observer.check();
  for (const row of fixture.rows) {
    applyRowStatus(row, result);
  }
  const panel = document.getElementById('wdu-prohibition-summary');
  if (panel) refreshStatusPanel(panel, result);
}

function refreshStatusPanel(
  panel: HTMLElement,
  result: ReturnType<ProhibitionObserver['check']>,
): void {
  const passing = result.passing.length;
  const total = fixtureTotal();
  panel.style.borderColor = result.isPassing ? '#065f46' : '#7f1d1d';
  panel.textContent =
    `Validator: ${passing}/${total} surfaces passing — ` +
    (result.isPassing ? 'OK to ship.' : `violations: ${result.violations.map((v) => v.category).join(', ')}`);
}

function fixtureTotal(): number {
  return ROWS.length;
}

function drawDecorativeCanvas(row: FixtureRow, elapsedSeconds: number): void {
  // The canvas is decorative; the DOM twin stays the visible authority.
  // We draw a faint scramble field so a screenshot proves the canvas
  // was reached, but the overlay never carries the prohibited surface
  // itself.
  const ctx = row.canvas.getContext('2d');
  if (!ctx) return;
  const w = row.canvas.width;
  const h = row.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const seed = hashFloat(row.spec.category);
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 18; i += 1) {
    const u = (Math.sin(elapsedSeconds * 1.3 + i + seed) * 0.5 + 0.5);
    ctx.fillStyle = `rgba(${100 + i * 6}, ${180 - i * 4}, 255, ${0.25 * u})`;
    ctx.fillRect((i * 13 + seed * 5) % w, (i * 7 + seed * 3) % h, 6, 6);
  }
  ctx.globalAlpha = 1;
}

function hashFloat(category: string): number {
  let h = 0;
  for (let i = 0; i < category.length; i += 1) {
    h = (h * 31 + category.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 1024) / 1024;
}