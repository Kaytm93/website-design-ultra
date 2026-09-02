/**
 * Offline site-reconnaissance lab experiment.
 *
 * This route demonstrates the ledger handoff without opening a reference site.
 * It renders committed fixture observations as semantic evidence cards; it is
 * not a browser crawler and it never turns a screenshot into runtime evidence.
 *
 * Routes:
 *   /?e=site-reconnaissance
 *   /?e=site-reconnaissance-deterministic&WDU_DETERMINISTIC=1
 *
 * The production site-reconnaissance skill remains gated by its root-only
 * public-reference validator. This lab surface deliberately has no source URL.
 */

import { createStableFrameMarker } from '../../../references/determinism-runtime.ts';
import type { ExperimentContext } from '../main.js';

export type OfflineEvidenceFamily =
  | 'bundle'
  | 'network'
  | 'renderer-info'
  | 'inspector'
  | 'shader';

export interface OfflineEvidenceField {
  readonly id: string;
  readonly family: OfflineEvidenceFamily;
  readonly value: string;
  readonly artifact: string;
  readonly locator: string;
}

const OFFLINE_FIELDS: readonly OfflineEvidenceField[] = [
  { id: 'bundle.entrypoints', family: 'bundle', value: 'fixture-main.js and fixture-scene.js', artifact: 'bundle.json', locator: '$.entrypoints' },
  { id: 'bundle.framework', family: 'bundle', value: 'Three.js fixture adapter', artifact: 'bundle.json', locator: '$.runtime.framework' },
  { id: 'network.document', family: 'network', value: 'offline document fixture', artifact: 'network.json', locator: '$.requests[0]' },
  { id: 'network.first-frame-assets', family: 'network', value: 'crystal.glb and environment.ktx2 fixture records', artifact: 'network.json', locator: '$.requests' },
  { id: 'renderer.type', family: 'renderer-info', value: 'WebGLRenderer fixture record', artifact: 'renderer-info.json', locator: '$.renderer.type' },
  { id: 'renderer.info.calls', family: 'renderer-info', value: '43 draw calls', artifact: 'renderer-info.json', locator: '$.rendererInfo.render.calls' },
  { id: 'renderer.info.triangles', family: 'renderer-info', value: '118402 visible triangles', artifact: 'renderer-info.json', locator: '$.rendererInfo.render.triangles' },
  { id: 'inspector.scene', family: 'inspector', value: 'Scene/CrystalGroup with 4 children', artifact: 'inspector.json', locator: '$.scene' },
  { id: 'inspector.camera', family: 'inspector', value: 'PerspectiveCamera fov 38', artifact: 'inspector.json', locator: '$.camera' },
  { id: 'inspector.materials', family: 'inspector', value: 'MeshPhysicalMaterial transmission 0.2', artifact: 'inspector.json', locator: '$.materials[0]' },
  { id: 'shader.vertex', family: 'shader', value: 'captured vertexShader for crystal-main', artifact: 'shaders.txt', locator: 'vertexShader' },
  { id: 'shader.fragment', family: 'shader', value: 'captured fragmentShader for crystal-main', artifact: 'shaders.txt', locator: 'fragmentShader' },
  { id: 'shader.uniforms', family: 'shader', value: 'uTime, uCameraPosition, uTransmission', artifact: 'shaders.txt', locator: 'uniforms' },
];

const OFFLINE_EVIDENCE_FAMILIES: readonly OfflineEvidenceFamily[] = [
  'bundle',
  'network',
  'renderer-info',
  'inspector',
  'shader',
];

/**
 * Fixture-only data. It intentionally has no sourceUrl and cannot be submitted
 * to the production ledger validator as a PASS record.
 */
export const OFFLINE_RECONNAISSANCE_CAPTURE = Object.freeze({
  status: 'OFFLINE_FIXTURE' as const,
  sourceUrl: undefined,
  sourceLabel: 'No live URL — synthetic fixture data only',
  evidenceFamilies: OFFLINE_EVIDENCE_FAMILIES,
  fieldCount: OFFLINE_FIELDS.length,
  fields: OFFLINE_FIELDS,
});

/** Return the stable semantic payload that a deterministic capture observes. */
export function createOfflineCaptureSignature(): string {
  return JSON.stringify({
    status: OFFLINE_RECONNAISSANCE_CAPTURE.status,
    sourceLabel: OFFLINE_RECONNAISSANCE_CAPTURE.sourceLabel,
    evidenceFamilies: OFFLINE_RECONNAISSANCE_CAPTURE.evidenceFamilies,
    fields: OFFLINE_RECONNAISSANCE_CAPTURE.fields,
  });
}

function addText(parent: HTMLElement, tagName: string, text: string, className?: string): HTMLElement {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

export function mount(ctx: ExperimentContext): void {
  const { root, clock, deterministic } = ctx;
  document.documentElement.setAttribute('data-wdu-recon-source', 'offline-fixture');
  document.documentElement.setAttribute('data-wdu-recon-status', OFFLINE_RECONNAISSANCE_CAPTURE.status);
  document.documentElement.setAttribute('data-wdu-recon-field-count', String(OFFLINE_RECONNAISSANCE_CAPTURE.fieldCount));
  const host = document.createElement('section');
  host.setAttribute('data-wdu-site-reconnaissance', 'offline-fixture');
  host.setAttribute('data-wdu-recon-source', 'offline-fixture');
  host.setAttribute('data-wdu-recon-status', OFFLINE_RECONNAISSANCE_CAPTURE.status);
  host.setAttribute('data-wdu-recon-field-count', String(OFFLINE_RECONNAISSANCE_CAPTURE.fieldCount));
  host.setAttribute('data-wdu-recon-capture-mode', deterministic ? 'deterministic' : 'interactive');
  host.style.cssText = [
    'position:absolute',
    'inset:0',
    'overflow:auto',
    'padding:24px',
    'box-sizing:border-box',
    'background:#10131a',
    'color:#e8edf4',
    "font:14px/1.45 ui-sans-serif,system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif",
  ].join(';');
  root.appendChild(host);

  const content = document.createElement('div');
  content.style.cssText = 'max-width:820px;margin:0 auto;';
  host.appendChild(content);
  addText(content, 'h1', 'Site reconnaissance — offline ledger lab');
  addText(
    content,
    'p',
    'No live URL was inspected. This route renders committed fixture observations only; the production gate remains separate.',
    'wdu-recon-note',
  );

  const status = document.createElement('p');
  status.setAttribute('data-wdu-recon-status-label', 'offline-fixture');
  status.style.cssText = 'display:inline-block;margin:4px 0 18px;padding:5px 9px;border:1px solid #477a61;border-radius:999px;color:#9ee2b8;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;';
  status.textContent = 'OFFLINE_FIXTURE · no source URL · screenshot is supplemental only';
  content.appendChild(status);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;';
  content.appendChild(grid);

  for (const family of OFFLINE_RECONNAISSANCE_CAPTURE.evidenceFamilies) {
    const card = document.createElement('article');
    card.setAttribute('data-wdu-recon-family', family);
    card.style.cssText = 'padding:12px;border:1px solid #2b3442;border-radius:8px;background:#171c25;';
    addText(card, 'h2', family, 'wdu-recon-family-title');
    const list = document.createElement('ul');
    list.style.cssText = 'display:grid;gap:8px;margin:8px 0 0;padding-left:18px;';
    for (const field of OFFLINE_RECONNAISSANCE_CAPTURE.fields.filter((entry) => entry.family === family)) {
      const item = document.createElement('li');
      item.setAttribute('data-wdu-recon-field', field.id);
      addText(item, 'strong', field.id);
      addText(item, 'span', `${field.value} · ${field.artifact} · ${field.locator}`);
      list.appendChild(item);
    }
    card.appendChild(list);
    grid.appendChild(card);
  }

  // createStableFrameMarker publishes data-wdu-ready after the second stable render.
  const marker = createStableFrameMarker({ target: document.documentElement, stableFrame: 2 });
  let frame = 0;
  const captureSignature = createOfflineCaptureSignature();
  document.documentElement.setAttribute('data-wdu-recon-signature', captureSignature);
  host.setAttribute('data-wdu-recon-signature', captureSignature);

  function render(): void {
    if (marker.ready) return;
    clock.tick();
    frame += 1;
    host.setAttribute('data-wdu-recon-frame', String(frame));
    marker.afterVisibleRender({
      frame,
      assetsReady: true,
      cameraStationApplied: true,
      streamsInitialized: true,
    });
    if (!marker.ready) requestAnimationFrame(render);
  }

  render();
}
