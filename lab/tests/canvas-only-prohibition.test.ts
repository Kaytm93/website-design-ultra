/**
 * Canvas-only prohibition list tests (IP-11C).
 *
 * Acceptance gates (from QUEUE.md and TODO.md):
 *   - Each prohibited category fails when its semantic DOM twin is absent.
 *   - One passing mirrored-interface fixture exists where every category
 *     has a real DOM twin and a decorative canvas surface.
 *   - Static and runtime validators agree on the same surface.
 *   - Decorative canvas overlays (aria-hidden, inert, pointer-events:none)
 *     do not trip the validator.
 *
 * The tests use a minimal jsdom-style DOM stub because the validator
 * runs against the live `document` and the lab's unit tests do not
 * import the real one.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type {
  ProhibitionDeclaration,
} from '../src/modules/canvas-only-prohibition.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES_ROOT = resolve(ROOT, 'src/modules');
const FIXTURES_ROOT = resolve(ROOT, 'src/fixtures');
const SKILL_ROOT = resolve(ROOT, '../website-design-ultra/skills/canvas-first-architecture');

function readModule(name: string): string {
  return readFileSync(resolve(MODULES_ROOT, `${name}.ts`), 'utf8');
}

function readFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_ROOT, name), 'utf8');
}

// ── Minimal DOM stub ─────────────────────────────────────────────────────────
//
// The validator walks the document via `Element.querySelectorAll`,
// `Element.matches`, `Element.getAttribute`, `Element.textContent`,
// `Element.appendChild`, and `Element.remove`. The stub mirrors just
// enough of the DOM surface for the validator to run; it is not a full
// jsdom replacement.

interface NodeLike {
  tagName: string;
  id: string;
  parentNode: NodeLike | null;
  children: NodeLike[];
  ownerDocument: DocLike;
  attrs: Map<string, string>;
  _textContent: string;
  _textContentValue?: string;
  _userSelect: 'auto' | 'none' | 'text';
  _inert: boolean;
  // Helpers exposed directly on the raw NodeLike so the validator can
  // call `.matches`, `.getAttribute`, etc. on raw nodes returned from
  // querySelectorAll without going through the Proxy layer.
  matches(selector: string): boolean;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  querySelectorAll(selector: string): NodeLike[];
  querySelector(selector: string): NodeLike | null;
  remove(): void;
  textContent: string;
}

interface DocLike {
  body: NodeLike;
  documentElement: NodeLike;
  defaultView: ViewLike | null;
  createElement(tag: string): NodeLike;
  addEventListener(type: string, fn: (...args: unknown[]) => void): void;
  removeEventListener(type: string, fn: (...args: unknown[]) => void): void;
  querySelectorAll(selector: string): NodeLike[];
}

interface ViewLike {
  MutationObserver: new (cb: MutationCallback) => unknown;
  getComputedStyle(el: NodeLike): { userSelect: string; pointerEvents: string };
}

function matchesSelector(el: NodeLike, selector: string): boolean {
  selector = selector.trim();
  if (!selector) return false;
  if (selector.includes(',')) {
    return selector.split(',').some((s) => matchesSelector(el, s.trim()));
  }
  if (/^[a-z][a-z0-9-]*$/i.test(selector)) {
    return el.tagName.toLowerCase() === selector.toLowerCase();
  }
  if (selector.startsWith('[') && selector.endsWith(']')) {
    const inner = selector.slice(1, -1);
    const eq = inner.indexOf('=');
    if (eq < 0) return el.attrs.has(inner);
    const attr = inner.slice(0, eq);
    let value = inner.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return el.attrs.get(attr) === value;
  }
  const tagEnd = selector.search(/[\[]/);
  if (tagEnd > 0) {
    const tag = selector.slice(0, tagEnd).toLowerCase();
    if (el.tagName.toLowerCase() !== tag) return false;
    const rest = selector.slice(tagEnd);
    return matchesSelector(el, rest);
  }
  return false;
}

function querySelectorAllImpl(node: NodeLike, selector: string): NodeLike[] {
  const out: NodeLike[] = [];
  const walk = (n: NodeLike | null | undefined): void => {
    if (!n || !Array.isArray(n.children)) return;
    for (const c of n.children) {
      if (c && matchesSelector(c, selector)) out.push(c);
      walk(c);
    }
  };
  walk(node);
  return out;
}

function makeNode(tagName: string, document: DocLike): NodeLike {
  const node: NodeLike = {
    tagName: tagName.toUpperCase(),
    id: '',
    parentNode: null,
    children: [],
    ownerDocument: document,
    attrs: new Map(),
    _textContent: '',
    _textContentValue: '',
    _userSelect: 'auto',
    _inert: false,
    textContent: '',
    // Placeholder signatures; replaced below.
    matches: () => false,
    getAttribute: () => null,
    hasAttribute: () => false,
    querySelectorAll: () => [],
    querySelector: () => null,
    remove: () => undefined,
  };
  node.matches = (selector: string) => matchesSelector(node, selector);
  node.getAttribute = (name: string) => node.attrs.get(name) ?? null;
  node.hasAttribute = (name: string) => node.attrs.has(name);
  node.querySelectorAll = (selector: string) => querySelectorAllImpl(node, selector);
  node.querySelector = (selector: string) => querySelectorAllImpl(node, selector)[0] ?? null;
  // textContent and _textContent mirror the same backing field so that
  // writes through either name are visible to reads through the other.
  let textContentValue = '';
  Object.defineProperty(node, '_textContent', {
    get() { return textContentValue; },
    set(v) { textContentValue = String(v); node.textContent = textContentValue; },
  });
  Object.defineProperty(node, 'textContent', {
    get() { return textContentValue; },
    set(v) { textContentValue = String(v); },
  });
  Object.defineProperty(node, 'parentElement', {
    get() { return node.parentNode; },
  });
  node.remove = (): void => {
    if (node.parentNode) {
      const idx = node.parentNode.children.indexOf(node);
      if (idx >= 0) node.parentNode.children.splice(idx, 1);
      node.parentNode = null;
    }
  };
  return node;
}

// Element-shaped helpers exposed on raw NodeLikes via Proxy get, but the
// signature.matches(el) inside the validator receives raw NodeLikes from
// querySelectorAllImpl (since querySelectorAllImpl returns raw nodes).
// Wrap the results so matches() works against the selector engine.
function wrapAll(nodes: NodeLike[]): unknown[] {
  return nodes.map((n) => wrap(n));
}

class StubMutationObserver {
  cb: MutationCallback;
  constructor(cb: MutationCallback) {
    this.cb = cb;
  }
  observe(): void {
    /* no-op */
  }
  disconnect(): void {
    /* no-op */
  }
  trigger(): void {
    this.cb([], this as unknown as MutationObserver);
  }
}

function buildDocumentProxied(): unknown {
  const docElement = makeNode('html', undefined as unknown as DocLike);
  const body = makeNode('body', undefined as unknown as DocLike);
  docElement.children.push(body);
  body.parentNode = docElement;
  const documentNode = docElement;
  const doc: DocLike = {
    body,
    documentElement: docElement,
    defaultView: null,
    createElement: ((tag: string) => makeNode(tag, doc)),
    addEventListener: (() => undefined),
    removeEventListener: (() => undefined),
    querySelectorAll: ((selector: string) => querySelectorAllImpl(documentNode, selector)),
  };
  docElement.ownerDocument = doc;
  body.ownerDocument = doc;
  doc.defaultView = {
    MutationObserver: StubMutationObserver as unknown as new (cb: MutationCallback) => unknown,
    getComputedStyle: (el: NodeLike) => ({
      userSelect: el._userSelect,
      pointerEvents: 'auto',
    }),
  };
  // Wrap createElement so consumers receive a Proxy, not the raw node.
  const originalCreate = doc.createElement;
  doc.createElement = ((tag: string) => wrap(originalCreate(tag))) as DocLike['createElement'];
  // Wrap body/documentElement so any consumer reading them gets the Proxy.
  const wrappedBody = wrap(body);
  const wrappedDocElement = wrap(docElement);
  (doc as unknown as { body: unknown }).body = wrappedBody;
  (doc as unknown as { documentElement: unknown }).documentElement = wrappedDocElement;
  return wrap(doc);
}

// Element-shaped proxy that exposes the surface the validator needs.
const RAW_SYMBOL = Symbol.for('wdu-test-raw-node');
function wrap(node: object): unknown {
  return new Proxy(node, {
    get(target, prop, receiver) {
      if (prop === RAW_SYMBOL) return target;
      const t = target as Record<string | symbol, unknown>;
      if (prop === 'matches') {
        return (selector: string) => matchesSelector(t as unknown as NodeLike, selector);
      }
      if (prop === 'getAttribute') {
        return (name: string) => (t.attrs as Map<string, string>).get(name) ?? null;
      }
      if (prop === 'setAttribute') {
        return (name: string, value: string) => {
          (t.attrs as Map<string, string>).set(name, value);
        };
      }
      if (prop === 'hasAttribute') {
        return (name: string) => (t.attrs as Map<string, string>).has(name);
      }
      if (prop === 'removeAttribute') {
        return (name: string) => {
          (t.attrs as Map<string, string>).delete(name);
        };
      }
      if (prop === 'appendChild') {
        return (child: NodeLike | unknown) => {
          // The argument may be a Proxy-wrapped Node. Strip the Proxy
          // off so the underlying raw node is stored in children, since
          // the validator walks children directly via querySelectorAllImpl.
          const rawNode = (child as Record<symbol, unknown>)[RAW_SYMBOL] as NodeLike | undefined;
          const raw = rawNode ?? (child as NodeLike);
          raw.parentNode = t as unknown as NodeLike;
          (t.children as NodeLike[]).push(raw);
          return child;
        };
      }
      if (prop === 'remove') {
        return () => {
          const tn = t as unknown as NodeLike;
          if (tn.parentNode) {
            const idx = tn.parentNode.children.indexOf(tn);
            if (idx >= 0) tn.parentNode.children.splice(idx, 1);
            tn.parentNode = null;
          }
        };
      }
      if (prop === 'dataset') {
        // dataset proxies attribute writes/reads with the data-* prefix,
        // converting camelCase keys to kebab-case attribute names.
        const toAttrName = (key: string | symbol): string => {
          const k = String(key);
          return 'data-' + k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
        };
        return new Proxy({}, {
          get: (_target, key) => (t.attrs as Map<string, string>).get(toAttrName(key)) ?? undefined,
          set: (_target, key, value) => {
            (t.attrs as Map<string, string>).set(toAttrName(key), String(value));
            return true;
          },
          has: (_target, key) => (t.attrs as Map<string, string>).has(toAttrName(key)),
        });
      }
      if (prop === 'querySelector') {
        return (selector: string) => {
          const all = (t as unknown as NodeLike).children.flatMap((c) =>
            querySelectorAllImpl(c, selector),
          );
          return all[0] ?? null;
        };
      }
      if (prop === 'querySelectorAll') {
        return (selector: string) => {
          const tn = t as unknown as DocLike;
          // When called on the document, walk the documentElement's tree.
          // When called on an element, walk its descendants.
          const root: NodeLike | undefined =
            (tn as unknown as { documentElement?: NodeLike }).documentElement ?? (tn as unknown as NodeLike);
          if (!root) return [];
          // When called on the document element, walk all descendants.
          // When called on a regular element, walk its descendants.
          return querySelectorAllImpl(root, selector);
        };
      }
      if (prop === 'textContent') {
        const tn = t as unknown as NodeLike;
        const collect = (n: NodeLike): string => {
          // The element's own _textContent is treated as a leading text
          // node when present, mirroring the real DOM where setting
          // textContent creates a child text node that siblings are
          // appended alongside.
          const desc = Object.getOwnPropertyDescriptor(n, '_textContent');
          const ownText = (desc?.value !== undefined ? desc.value : (desc?.get ? desc.get.call(n) : '')) as string;
          const childText = n.children.map((c) => collect(c)).join('');
          return ownText + childText;
        };
        return collect(tn);
      }
      if (prop === '_textContent') return (t as unknown as NodeLike)._textContent;
      if (prop === 'parentElement') return (t as unknown as NodeLike).parentNode;
      if (prop === 'inert') {
        return (t as unknown as NodeLike)._inert;
      }
      if (prop === 'dataset') {
        const tn = t as unknown as NodeLike;
        return new Proxy(
          {},
          {
            get(_t, key) {
              if (typeof key !== 'string') return undefined;
              return tn.attrs.get('data-' + key) ?? undefined;
            },
            set(_t, key, value) {
              if (typeof key !== 'string') return true;
              tn.attrs.set('data-' + key, String(value));
              return true;
            },
          },
        );
      }
      if (prop === 'tagName') return (t as unknown as NodeLike).tagName;
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      const t = target as Record<string | symbol, unknown>;
      if (prop === '_inert') {
        (t as unknown as NodeLike)._inert = value as boolean;
        return true;
      }
      if (prop === 'type') {
        (t.attrs as Map<string, string>).set('type', String(value));
        return true;
      }
      if (prop === 'name') {
        (t.attrs as Map<string, string>).set('name', String(value));
        return true;
      }
      if (prop === 'required') {
        (t.attrs as Map<string, string>).set('required', String(value));
        return true;
      }
      if (prop === 'inert') {
        (t as unknown as NodeLike)._inert = value as boolean;
        return true;
      }
      if (prop === 'textContent') {
        (t as unknown as NodeLike)._textContent = String(value);
        return true;
      }
      if (prop === '_userSelect') {
        (t as unknown as NodeLike)._userSelect = value as 'auto' | 'none' | 'text';
        return true;
      }
      return Reflect.set(target, prop, value, receiver);
    },
  });
}

function appendChild(parent: unknown, child: unknown): void {
  const parentNode = parent as { appendChild: (c: unknown) => unknown };
  parentNode.appendChild(child);
}

// ── Module surface ───────────────────────────────────────────────────────────

test('canvas-only-prohibition module exposes the IP-11C contract surface', async () => {
  const mod = await import('../src/modules/canvas-only-prohibition.ts');
  assert.deepEqual([...mod.PROHIBITED_CATEGORIES], [
    'primary-action',
    'form',
    'legal-copy',
    'pricing',
  ]);
  assert.equal(typeof mod.validateDeclaration, 'function');
  assert.equal(typeof mod.createProhibitionObserver, 'function');
  assert.equal(typeof mod.buildDomTwin, 'function');
  assert.equal(typeof mod.withCanonicalSignatures, 'function');
  assert.equal(typeof mod.isDecorativeCanvasSurface, 'function');
});

test('module documents the prohibition list explicitly', () => {
  const src = readModule('canvas-only-prohibition');
  assert.match(src, /PROHIBITED_CATEGORIES/);
  assert.match(src, /primary-action/);
  assert.match(src, /form/);
  assert.match(src, /legal-copy/);
  assert.match(src, /pricing/);
  assert.match(src, /decorative duplicate/i);
  assert.match(src, /aria-hidden/);
  assert.match(src, /pointer-events: none|inert/);
  assert.match(src, /createProhibitionObserver/);
  assert.match(src, /MutationObserver/);
});

// ── One passing mirrored-interface fixture ──────────────────────────────────

test('mirrored-interface: every category has a DOM twin and decorative canvas surface', async () => {
  const mod = await import('../src/modules/canvas-only-prohibition.ts');
  const document = buildDocumentProxied() as unknown as {
    body: unknown;
    createElement: (t: string) => unknown;
    querySelectorAll: (s: string) => unknown[];
  };
  const root = document.body as { appendChild: (c: unknown) => unknown };

  const declaration: ProhibitionDeclaration = {
    projectName: 'mirrored-interface',
    surfaces: mod.PROHIBITED_CATEGORIES.map((category) => ({
      category,
      domTwinSelector: `[data-wdu-twin="${category}"]`,
      canvasSurfaceSelector: `[data-wdu-canvas-${category}]`,
    })),
  };

  for (const category of mod.PROHIBITED_CATEGORIES) {
    const twin = mod.buildDomTwin(document as unknown as Document, category, `Sample ${category}`);
    const twinEl = twin as unknown as { setAttribute: (n: string, v: string) => void };
    twinEl.setAttribute('data-wdu-twin', category);
    appendChild(root, twin);

    const canvas = document.createElement('div');
    const canvasEl = canvas as unknown as { setAttribute: (n: string, v: string) => void };
    canvasEl.setAttribute('data-wdu-canvas-' + category, 'true');
    canvasEl.setAttribute('aria-hidden', 'true');
    appendChild(root, canvas);
  }

  const result = mod.validateDeclaration(declaration, { document: document as unknown as Document });
  assert.equal(result.isPassing, true, `expected pass, got violations: ${JSON.stringify(result.violations)}`);
  assert.equal(result.passing.length, mod.PROHIBITED_CATEGORIES.length);
  assert.equal(result.violations.length, 0);
});

// ── One failing fixture per prohibited category ─────────────────────────────

test('primary-action: missing DOM twin fails the validator', async () => {
  const mod = await import('../src/modules/canvas-only-prohibition.ts');
  const document = buildDocumentProxied() as unknown as { body: unknown; createElement: (t: string) => unknown };
  const declaration: ProhibitionDeclaration = {
    projectName: 'missing-primary-action',
    surfaces: [{
      category: 'primary-action',
      domTwinSelector: '[data-wdu-twin="primary-action"]',
    }],
  };
  const result = mod.validateDeclaration(declaration, { document: document as unknown as Document });
  assert.equal(result.isPassing, false);
  const violation = result.violations.find((v) => v.category === 'primary-action');
  assert.ok(violation, 'primary-action violation recorded');
  assert.match(violation.message, /no DOM element matches/);
});

test('form: missing DOM twin fails the validator', async () => {
  const mod = await import('../src/modules/canvas-only-prohibition.ts');
  const document = buildDocumentProxied() as unknown as { body: unknown; createElement: (t: string) => unknown };
  const declaration: ProhibitionDeclaration = {
    projectName: 'missing-form',
    surfaces: [{
      category: 'form',
      domTwinSelector: 'form#signup',
    }],
  };
  const result = mod.validateDeclaration(declaration, { document: document as unknown as Document });
  assert.equal(result.isPassing, false);
  const violation = result.violations.find((v) => v.category === 'form');
  assert.ok(violation);
  assert.match(violation.message, /no DOM element matches/);
});

test('legal-copy: present twin with disabled user-select fails (machine translation cannot read it)', async () => {
  const mod = await import('../src/modules/canvas-only-prohibition.ts');
  const document = buildDocumentProxied() as unknown as { body: unknown; createElement: (t: string) => unknown };
  const twin = mod.buildDomTwin(document as unknown as Document, 'legal-copy', 'Terms');
  const twinNode = twin as unknown as { _userSelect: 'none' };
  twinNode._userSelect = 'none';
  appendChild(document.body, twin);
  const declaration: ProhibitionDeclaration = {
    projectName: 'legal-copy-no-select',
    surfaces: [{
      category: 'legal-copy',
      domTwinSelector: 'small[data-wdu-terms]',
    }],
  };
  const result = mod.validateDeclaration(declaration, { document: document as unknown as Document });
  assert.equal(result.isPassing, false);
  const violation = result.violations.find((v) => v.category === 'legal-copy');
  assert.ok(violation);
  assert.match(violation.message, /none matched/);
});

test('pricing: present twin without currency token fails (decorative-only DOM cannot be priced)', async () => {
  const mod = await import('../src/modules/canvas-only-prohibition.ts');
  const document = buildDocumentProxied() as unknown as { body: unknown; createElement: (t: string) => unknown };
  const twin = document.createElement('div');
  const twinEl = twin as unknown as { setAttribute: (n: string, v: string) => void; textContent: string };
  twinEl.setAttribute('data-wdu-pricing', 'true');
  twinEl.setAttribute('aria-label', 'pricing');
  twinEl.textContent = 'Free tier';
  appendChild(document.body, twin);
  const declaration: ProhibitionDeclaration = {
    projectName: 'pricing-no-currency',
    surfaces: [{
      category: 'pricing',
      domTwinSelector: '[data-wdu-pricing]',
    }],
  };
  const result = mod.validateDeclaration(declaration, { document: document as unknown as Document });
  assert.equal(result.isPassing, false);
  const violation = result.violations.find((v) => v.category === 'pricing');
  assert.ok(violation);
});

// ── Decorative canvas overlays are allowed ──────────────────────────────────

test('aria-hidden canvas overlay is accepted (decorative duplicate)', async () => {
  const mod = await import('../src/modules/canvas-only-prohibition.ts');
  const document = buildDocumentProxied() as unknown as { body: unknown; createElement: (t: string) => unknown };
  const twin = mod.buildDomTwin(document as unknown as Document, 'primary-action', 'Sign up');
  const twinEl = twin as unknown as { setAttribute: (n: string, v: string) => void };
  twinEl.setAttribute('data-wdu-twin', 'primary-action');
  appendChild(document.body, twin);
  const canvas = document.createElement('div');
  const canvasEl = canvas as unknown as { setAttribute: (n: string, v: string) => void };
  canvasEl.setAttribute('data-wdu-canvas-primary-action', 'true');
  canvasEl.setAttribute('aria-hidden', 'true');
  appendChild(document.body, canvas);

  const declaration: ProhibitionDeclaration = {
    projectName: 'decorative-aria-hidden',
    surfaces: [{
      category: 'primary-action',
      domTwinSelector: '[data-wdu-twin="primary-action"]',
      canvasSurfaceSelector: '[data-wdu-canvas-primary-action]',
    }],
  };
  const result = mod.validateDeclaration(declaration, { document: document as unknown as Document });
  assert.equal(result.isPassing, true, `expected pass, got violations: ${JSON.stringify(result.violations)}`);
});

test('canvas overlay inside a data-wdu-canvas-decorative wrapper is accepted', async () => {
  const mod = await import('../src/modules/canvas-only-prohibition.ts');
  const document = buildDocumentProxied() as unknown as { body: unknown; createElement: (t: string) => unknown };
  const twin = mod.buildDomTwin(document as unknown as Document, 'form', 'Email');
  const twinEl = twin as unknown as { setAttribute: (n: string, v: string) => void };
  twinEl.setAttribute('data-wdu-twin', 'form');
  appendChild(document.body, twin);
  const wrapper = document.createElement('div');
  const wrapperEl = wrapper as unknown as { setAttribute: (n: string, v: string) => void };
  wrapperEl.setAttribute('data-wdu-canvas-decorative', 'true');
  const canvas = document.createElement('div');
  const canvasEl = canvas as unknown as { setAttribute: (n: string, v: string) => void };
  canvasEl.setAttribute('data-wdu-canvas-form', 'true');
  appendChild(wrapper, canvas);
  appendChild(document.body, wrapper);

  const declaration: ProhibitionDeclaration = {
    projectName: 'decorative-wrapper',
    surfaces: [{
      category: 'form',
      domTwinSelector: '[data-wdu-twin="form"]',
      canvasSurfaceSelector: '[data-wdu-canvas-form]',
    }],
  };
  const result = mod.validateDeclaration(declaration, { document: document as unknown as Document });
  assert.equal(result.isPassing, true, `expected pass, got violations: ${JSON.stringify(result.violations)}`);
});

test('non-decorative canvas overlay (no aria-hidden, no pointer-events:none) fails', async () => {
  const mod = await import('../src/modules/canvas-only-prohibition.ts');
  const document = buildDocumentProxied() as unknown as { body: unknown; createElement: (t: string) => unknown };
  const twin = mod.buildDomTwin(document as unknown as Document, 'primary-action', 'Sign up');
  const twinEl = twin as unknown as { setAttribute: (n: string, v: string) => void };
  twinEl.setAttribute('data-wdu-twin', 'primary-action');
  appendChild(document.body, twin);
  const canvas = document.createElement('div');
  const canvasEl = canvas as unknown as { setAttribute: (n: string, v: string) => void };
  canvasEl.setAttribute('data-wdu-canvas-primary-action', 'true');
  appendChild(document.body, canvas);

  const declaration: ProhibitionDeclaration = {
    projectName: 'canvas-only-violation',
    surfaces: [{
      category: 'primary-action',
      domTwinSelector: '[data-wdu-twin="primary-action"]',
      canvasSurfaceSelector: '[data-wdu-canvas-primary-action]',
    }],
  };
  const result = mod.validateDeclaration(declaration, { document: document as unknown as Document });
  assert.equal(result.isPassing, false);
  const violation = result.violations.find((v) => v.category === 'primary-action');
  assert.ok(violation);
  assert.match(violation.message, /reachable from the accessibility tree/);
});

// ── Runtime observer ────────────────────────────────────────────────────────

test('runtime observer reports the same result as the static validator', async () => {
  const mod = await import('../src/modules/canvas-only-prohibition.ts');
  const document = buildDocumentProxied() as unknown as { body: unknown; createElement: (t: string) => unknown; querySelectorAll: (s: string) => unknown[] };
  const declaration: ProhibitionDeclaration = {
    projectName: 'runtime-mirrored',
    surfaces: mod.PROHIBITED_CATEGORIES.map((category) => ({
      category,
      domTwinSelector: `[data-wdu-twin="${category}"]`,
    })),
  };

  const observer = mod.createProhibitionObserver(declaration, { document: document as unknown as Document });
  assert.equal(observer.result.isPassing, false);

  for (const category of mod.PROHIBITED_CATEGORIES) {
    const twin = mod.buildDomTwin(document as unknown as Document, category, `Sample ${category}`);
    const twinEl = twin as unknown as { setAttribute: (n: string, v: string) => void };
    twinEl.setAttribute('data-wdu-twin', category);
    appendChild(document.body, twin);
  }
  const result = observer.check();
  assert.equal(result.isPassing, true, `expected pass after attaching twins, got: ${JSON.stringify(result.violations)}`);

  const all = document.querySelectorAll('[data-wdu-twin="primary-action"]');
  const primaryAction = all[0] as { remove?: () => void } | undefined;
  assert.ok(primaryAction && typeof primaryAction.remove === 'function');
  primaryAction.remove!();
  const resultAfter = observer.check();
  assert.equal(resultAfter.isPassing, false);
  const violation = resultAfter.violations.find((v) => v.category === 'primary-action');
  assert.ok(violation);

  observer.dispose();
});

// ── buildDomTwin wiring ─────────────────────────────────────────────────────

test('buildDomTwin returns a usable element for every category', async () => {
  const mod = await import('../src/modules/canvas-only-prohibition.ts');
  const document = buildDocumentProxied() as unknown as { body: unknown; createElement: (t: string) => unknown };
  for (const category of mod.PROHIBITED_CATEGORIES) {
    const twin = mod.buildDomTwin(document as unknown as Document, category, `Sample ${category}`);
    const twinEl = twin as unknown as { tagName: string; textContent: string };
    assert.equal(twinEl.tagName.length > 0, true);
    assert.equal(twinEl.textContent.length > 0, true, `${category} twin should have textContent`);
  }
});

// ── Wiring checks: route, fixture, manifest ─────────────────────────────────

test('main router wires the canvas-only-prohibition routes', () => {
  const main = readFileSync(resolve(ROOT, 'src/main.ts'), 'utf8');
  assert.match(main, /'canvas-only-prohibition'/);
  assert.match(main, /'canvas-only-prohibition-deterministic'/);
});

test('manifest declares the canvas-only-prohibition entry with all five required fields', () => {
  const manifest = readModule('manifest');
  const start = manifest.indexOf("id: 'canvas-only-prohibition'");
  assert.ok(start >= 0, 'manifest contains canvas-only-prohibition entry');
  const end = manifest.indexOf('];', start);
  const block = manifest.slice(start, end);
  assert.match(block, /rendererSupport:\s*\[\s*'webgl2'\s*\]/);
  assert.match(block, /costClass:\s*'low'/);
  assert.match(block, /reducedMotion:/);
  assert.match(block, /colorSpace:/);
  assert.match(block, /fixture:/);
  assert.match(block, /noCombine:\s*true/);
});

test('deterministic capture fixture exists and inherits the same experiment', () => {
  const det = readFixture('canvas-only-prohibition-deterministic.ts');
  assert.match(det, /mount as mountCanvasOnlyProhibition/);
  assert.match(det, /export function mount\(ctx: ExperimentContext\)/);
});

// ── Skill-side documentation ─────────────────────────────────────────────────

test('canvas-first-architecture SKILL.md Check list cites the prohibition validator', () => {
  const skillPath = resolve(SKILL_ROOT, 'SKILL.md');
  const skill = readFileSync(skillPath, 'utf8');
  assert.match(skill, /prohibition/i, 'SKILL.md mentions prohibition');
  assert.match(skill, /validateDeclaration|createProhibitionObserver|prohibition-list\.md/i,
    'SKILL.md references the prohibition validator module or its reference');
});

test('canvas-first-architecture references/prohibition-list.md exists and binds to the four categories', () => {
  const refPath = resolve(SKILL_ROOT, 'references', 'prohibition-list.md');
  const ref = readFileSync(refPath, 'utf8');
  assert.match(ref, /primary-action/);
  assert.match(ref, /form/);
  assert.match(ref, /legal-copy/);
  assert.match(ref, /pricing/);
  assert.match(ref, /canvas-only-prohibition\.ts|validateDeclaration/);
});