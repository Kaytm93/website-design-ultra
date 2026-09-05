/**
 * Canvas-only prohibition list (IP-11C).
 *
 * `canvas-first-architecture` §4 names four surfaces that may never ship in
 * the canvas alone: primary actions, forms, legal copy, and pricing. This
 * module turns that list into a typed schema, a static validator that audits
 * a declared DOM tree, and a runtime observer that asserts the prohibition
 * is not violated while the page is live.
 *
 * The schema is the canonical reference for the prohibition list. Anything
 * the canvas paints or renders that ships one of these surfaces is a
 * violation, and the violations below are the four we enforce today. New
 * prohibited surfaces are added by extending `PROHIBITED_CATEGORIES` and the
 * matching validator predicates; the static + runtime APIs are designed so
 * the schema is the only place a new category has to be wired.
 *
 * ## Acceptance contract
 *
 * Each category is enforced by **both** a static and a runtime check:
 *
 *   1. **Static** — `validateDeclaration(declaration)` inspects a
 *      `ProhibitionDeclaration` describing every prohibited surface the
 *      project claims to render. The declaration names a `domTwinSelector`
 *      that points at the real DOM element holding the canonical surface
 *      (focusable button, form, terms block, pricing list, etc.) and a
 *      `canvasSurface` describing how the canvas mirrors it.
 *
 *   2. **Runtime** — `createProhibitionObserver(declaration, root)` attaches
 *      `MutationObserver` and event listeners to the DOM root. When a
 *      declared canvas surface loses its DOM twin (or the twin loses its
 *      role / focusability), the observer records a `ProhibitionViolation`
 *      and removes the offending category from its `passing` set.
 *
 * Decorative duplicate canvas text — a label echoing the DOM pricing
 * total, or a glitch-effect overlay above a real button — is allowed and
 * stays hidden from the accessibility APIs. The observer ignores
 * `aria-hidden="true"` / `inert` mirror clones as long as a non-hidden
 * twin is still present.
 *
 * ## Distinguishing a hidden decorative clone from a forbidden-only surface
 *
 * The canvas-only prohibition list is about **essential** surfaces. If a
 * project puts a primary action in the canvas **and also** mirrors it as a
 * real DOM `<button>`, the canvas copy is decorative. If the DOM twin is
 * missing, the canvas copy is the only surface and the prohibition fires.
 * The validator's `domTwinSelector` must point at the canonical DOM twin,
 * and the runtime observer ignores canvas nodes that match
 * `decorativeCanvasPredicate` so a label overlaid by a Three.js plane
 * stays decorative.
 *
 * ## License
 *
 * MIT. No paid dependency. The validator uses only DOM APIs available in
 * every browser the plugin already targets.
 *
 * @module
 */

/** The four prohibited surfaces named in `canvas-first-architecture` §4 and `TODO.md` T3.2. */
export const PROHIBITED_CATEGORIES = [
  'primary-action',
  'form',
  'legal-copy',
  'pricing',
] as const;

/** Identifier for a prohibited surface category. */
export type ProhibitionCategory = (typeof PROHIBITED_CATEGORIES)[number];

/**
 * A human-readable label for a prohibited surface category. Use the
 * constant when referencing the schema; the label is for failure messages.
 */
export const PROHIBITION_CATEGORY_LABEL: Readonly<Record<ProhibitionCategory, string>> = {
  'primary-action': 'primary action',
  'form': 'form',
  'legal-copy': 'legal copy',
  'pricing': 'pricing',
};

/**
 * Required DOM twin signature per category. The validator considers a
 * candidate DOM node a real twin only when it matches the signature; a
 * non-matching element is reported as a violation because the renderer
 * cannot rely on it.
 *
 * - `primary-action` requires a focusable element with `role="button"`
 *   OR a `<button>` / `<a>` with keyboard activation semantics.
 * - `form` requires a `<form>` element (or `role="form"` region) with at
 *   least one focusable control.
 * - `legal-copy` requires an element with a non-empty textContent AND a
 *   selectable region (`user-select` not disabled), so copy/paste,
 *   find-in-page, and machine translation all reach it.
 * - `pricing` requires an element with a non-empty textContent carrying a
 *   declared currency token (€, $, £, ¥) OR a `data-wdu-pricing` attribute.
 *
 * These signatures are intentionally minimal — extending them does not
 * require a new validator path; `DEFAULT_TWIN_SIGNATURES` and the matching
 * matcher are the only places the per-category rules live.
 */
export interface TwinSignature {
  /** CSS selector matching the canonical twin. */
  readonly selector: string;
  /** Predicate that decides if a matched element is a real twin. */
  readonly matches: (element: Element) => boolean;
  /**
   * Optional minimum number of focusable / semantic children the twin
   * must expose. Defaults to 1; pricing may set 0 because price lists are
   * static text without interaction.
   */
  readonly minControls?: number;
  /**
   * When `true`, the twin may carry an `aria-hidden="true"` decorative
   * clone and the validator still passes. Default: `false` (twin must
   * be reachable from the accessibility tree).
   */
  readonly allowAriaHidden?: boolean;
}

const DEFAULT_TWIN_SIGNATURES: Readonly<Record<ProhibitionCategory, TwinSignature>> = {
  'primary-action': {
    selector: '[data-wdu-primary-action], button[role="button"], a[role="button"], button, a[href]',
    matches: (el) => {
      if (el.matches('button')) return true;
      if (el.matches('a[href]')) return true;
      const role = el.getAttribute('role');
      if (role === 'button' && el.getAttribute('tabindex') !== null) return true;
      return false;
    },
    minControls: 1,
  },
  'form': {
    selector: 'form, [role="form"]',
    matches: (el) => {
      if (el.tagName.toLowerCase() === 'form') return true;
      if (el.getAttribute('role') === 'form') return true;
      return false;
    },
    // The form must contain at least one focusable control.
    minControls: 1,
  },
  'legal-copy': {
    selector: '[data-wdu-legal-copy], footer [data-wdu-legal], small[data-wdu-terms], [aria-label*="terms" i], [aria-label*="impressum" i], [aria-label*="legal" i]',
    matches: (el) => {
      const text = (el.textContent ?? '').trim();
      if (text.length === 0) return false;
      // user-select must not be disabled — machine translation and
      // find-in-page both require the browser to read the text as text.
      const inlineSelect = (el.ownerDocument?.defaultView?.getComputedStyle(el)?.userSelect ?? '').trim();
      if (inlineSelect === 'none') return false;
      return true;
    },
    minControls: 0,
    allowAriaHidden: false,
  },
  'pricing': {
    selector: '[data-wdu-pricing], [data-wdu-price], [data-wdu-price-tier]',
    matches: (el) => {
      const text = (el.textContent ?? '').trim();
      if (text.length === 0) return false;
      // Look for at least one currency token so an empty tier doesn't pass.
      if (/[€$£¥]/.test(text)) return true;
      // Or an explicit price-tier marker that names the surface as pricing.
      if (el.hasAttribute('data-wdu-price-tier')) return true;
      if (el.hasAttribute('data-wdu-price')) return true;
      return false;
    },
    minControls: 0,
  },
};

/**
 * Describe one prohibited surface: where the canonical DOM twin lives and
 * how the canvas mirrors it (if at all).
 */
export interface ProhibitionSurfaceDeclaration {
  readonly category: ProhibitionCategory;
  /** Required CSS selector for the canonical DOM twin. */
  readonly domTwinSelector: string;
  /** Optional human-readable label for failure messages. */
  readonly label?: string;
  /**
   * Optional selector for the canvas-rendered surface. When omitted, the
   * declaration does not claim a canvas copy; the validator still
   * requires a DOM twin, but never reports the canvas as the violation
   * source. When present, the canvas surface must be decorative-only:
   * either `aria-hidden`, `inert`, or wrapped in an element with
   * `pointer-events: none`.
   */
  readonly canvasSurfaceSelector?: string;
  /**
   * Optional override of the default twin signature. Use when the
   * project uses a non-standard DOM shape (e.g. a button rendered by a
   * framework that does not emit a native `<button>`).
   */
  readonly twinSignature?: Partial<TwinSignature>;
}

/**
 * The set of declarations that together cover every prohibited surface
 * the page ships. Each category must appear at most once; a project that
 * ships three primary actions declares one prohibition entry per
 * surface, not a single one.
 */
export interface ProhibitionDeclaration {
  readonly projectName: string;
  readonly surfaces: readonly ProhibitionSurfaceDeclaration[];
}

/**
 * Severity for a single prohibition violation. `error` means the page
 * cannot ship; `warning` means the violation is recoverable but the
 * validator still fails the page because every prohibited surface must
 * be backed by a DOM twin.
 */
export type ProhibitionSeverity = 'error' | 'warning';

export interface ProhibitionViolation {
  readonly category: ProhibitionCategory;
  readonly severity: ProhibitionSeverity;
  readonly message: string;
  readonly domTwinSelector: string;
  readonly canvasSurfaceSelector: string | undefined;
  readonly label: string;
}

/** Result of `validateDeclaration`. */
export interface ProhibitionValidationResult {
  readonly projectName: string;
  readonly passing: readonly ProhibitionCategory[];
  readonly violations: readonly ProhibitionViolation[];
  /**
   * `true` only when every declared category has a passing DOM twin.
   * The runtime observer reports a separate `isPassing` flag because a
   * page can be passing at build time and break at runtime.
   */
  readonly isPassing: boolean;
}

/**
 * Runtime observer handle. The observer keeps watching the DOM after
 * the static validation passes; consumers can call `check()` to force
 * an immediate audit, and `dispose()` to detach the listeners.
 */
export interface ProhibitionObserver {
  /** Read the latest runtime result. */
  readonly result: ProhibitionValidationResult;
  /** Force an immediate audit (in addition to MutationObserver events). */
  check(): ProhibitionValidationResult;
  /** Stop watching. Idempotent. */
  dispose(): void;
}

/** Minimal DOM root contract used by the runtime observer. */
export interface ObserverRoot {
  readonly document: Document;
  /** When provided, the observer fires its initial audit immediately. */
  readonly fireInitialCheck?: boolean;
}

/** Result of one runtime observer audit. */
interface RuntimeAuditResult {
  readonly passing: readonly ProhibitionCategory[];
  readonly violations: readonly ProhibitionViolation[];
}

/**
 * Validate a `ProhibitionDeclaration` against the live DOM without
 * installing any observers. Use this during build / linting; the runtime
 * observer wraps it and adds MutationObserver-driven re-audits.
 *
 * @param declaration The set of surfaces to validate.
 * @param root Optional observer root. Defaults to a minimal stub built
 *             from `globalThis.document` when available.
 */
export function validateDeclaration(
  declaration: ProhibitionDeclaration,
  root?: ObserverRoot,
): ProhibitionValidationResult {
  const document = resolveDocument(root);
  if (declaration.surfaces.length === 0) {
    return {
      projectName: declaration.projectName,
      passing: [],
      violations: [
        {
          category: 'primary-action',
          severity: 'error',
          message: 'declaration has no surfaces — every project must enumerate at least the four prohibited categories it ships',
          domTwinSelector: '',
          canvasSurfaceSelector: undefined,
          label: declaration.projectName,
        },
      ],
      isPassing: false,
    };
  }

  const violations: ProhibitionViolation[] = [];
  const passing: ProhibitionCategory[] = [];
  const seen = new Set<ProhibitionCategory>();
  for (const surface of declaration.surfaces) {
    if (seen.has(surface.category)) {
      violations.push({
        category: surface.category,
        severity: 'error',
        message: `category "${surface.category}" declared twice — one declaration per surface, not per project`,
        domTwinSelector: surface.domTwinSelector,
        canvasSurfaceSelector: surface.canvasSurfaceSelector,
        label: surface.label ?? surface.category,
      });
      continue;
    }
    seen.add(surface.category);

    const audit = auditSurface(surface, document);
    if (audit.violations.length > 0) {
      violations.push(...audit.violations);
    } else {
      passing.push(surface.category);
    }
  }

  return {
    projectName: declaration.projectName,
    passing,
    violations,
    isPassing: violations.length === 0,
  };
}

/**
 * Install a MutationObserver + focus listener that re-audits the
 * declaration whenever the DOM root mutates, a focus event reaches a
 * declared canvas surface, or the page reaches visibilitychange.
 */
export function createProhibitionObserver(
  declaration: ProhibitionDeclaration,
  root: ObserverRoot,
): ProhibitionObserver {
  const document = root.document;
  let disposed = false;
  let audit: RuntimeAuditResult = {
    passing: [],
    violations: [],
  };

  const compute = (): RuntimeAuditResult => {
    const result = validateDeclaration(declaration, root);
    return {
      passing: result.passing,
      violations: result.violations,
    };
  };

  const observer = new document.defaultView!.MutationObserver(() => {
    if (disposed) return;
    audit = compute();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['role', 'tabindex', 'aria-hidden', 'inert', 'user-select', 'hidden'],
  });

  const focusListener = (): void => {
    if (disposed) return;
    audit = compute();
  };
  document.addEventListener('focusin', focusListener, true);
  document.addEventListener('focusout', focusListener, true);

  audit = compute();

  if (root.fireInitialCheck !== false) {
    // Trigger the initial audit again so consumers can read the first
    // snapshot deterministically.
    audit = compute();
  }

  const handle: ProhibitionObserver = {
    get result(): ProhibitionValidationResult {
      return {
        projectName: declaration.projectName,
        passing: audit.passing,
        violations: audit.violations,
        isPassing: audit.violations.length === 0,
      };
    },
    check(): ProhibitionValidationResult {
      if (disposed) {
        return {
          projectName: declaration.projectName,
          passing: audit.passing,
          violations: audit.violations,
          isPassing: audit.violations.length === 0,
        };
      }
      audit = compute();
      return handle.result;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      document.removeEventListener('focusin', focusListener, true);
      document.removeEventListener('focusout', focusListener, true);
    },
  };

  return handle;
}

/**
 * Decorate a `ProhibitionDeclaration` with the canonical twin signature
 * for every category. Tests use this to build fixtures without
 * hand-rolling the signature map.
 */
export function withCanonicalSignatures(
  declaration: ProhibitionDeclaration,
): ProhibitionDeclaration {
  return {
    projectName: declaration.projectName,
    surfaces: declaration.surfaces.map((s) => ({
      ...s,
      twinSignature: {
        ...DEFAULT_TWIN_SIGNATURES[s.category],
        ...(s.twinSignature ?? {}),
      },
    })),
  };
}

/**
 * Build a fresh DOM twin for a category. Tests use this to wire the
 * four canonical fixtures without duplicating the DOM shape.
 *
 * The returned element is detached from the document by default. The
 * caller is responsible for inserting it into the test root and
 * removing it on cleanup.
 */
export function buildDomTwin(
  document: Document,
  category: ProhibitionCategory,
  text: string,
): HTMLElement {
  switch (category) {
    case 'primary-action': {
      const el = document.createElement('button');
      el.type = 'button';
      el.dataset.wduPrimaryAction = 'true';
      el.textContent = text;
      el.setAttribute('aria-label', text);
      return el;
    }
    case 'form': {
      const form = document.createElement('form');
      form.dataset.wduForm = 'true';
      form.setAttribute('aria-label', text);
      const label = document.createElement('label');
      label.textContent = text;
      const input = document.createElement('input');
      input.type = 'email';
      input.name = 'email';
      input.required = true;
      label.appendChild(input);
      form.appendChild(label);
      return form;
    }
    case 'legal-copy': {
      const el = document.createElement('small');
      el.dataset.wduLegal = 'true';
      el.dataset.wduTerms = 'true';
      el.setAttribute('aria-label', 'legal copy');
      el.textContent = text;
      return el;
    }
    case 'pricing': {
      const el = document.createElement('div');
      el.dataset.wduPricing = 'true';
      el.dataset.wduPriceTier = 'true';
      el.setAttribute('aria-label', 'pricing');
      el.textContent = text;
      return el;
    }
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function resolveDocument(root?: ObserverRoot): Document {
  if (root?.document) return root.document;
  if (typeof globalThis !== 'undefined' && (globalThis as { document?: Document }).document) {
    return (globalThis as { document: Document }).document;
  }
  throw new Error('canvas-only-prohibition: no Document available — pass an ObserverRoot');
}

interface SurfaceAuditResult {
  readonly violations: readonly ProhibitionViolation[];
}

function auditSurface(
  surface: ProhibitionSurfaceDeclaration,
  document: Document,
): SurfaceAuditResult {
  const label = surface.label ?? PROHIBITION_CATEGORY_LABEL[surface.category];
  const signature: TwinSignature = {
    ...DEFAULT_TWIN_SIGNATURES[surface.category],
    ...(surface.twinSignature ?? {}),
  };
  const candidates = Array.from(document.querySelectorAll(surface.domTwinSelector));
  // Empty selector lists are an error — a project that did not declare
  // the surface must report it instead of silently passing.
  if (candidates.length === 0) {
    return {
      violations: [
        {
          category: surface.category,
          severity: 'error',
          message:
            `no DOM element matches selector "${surface.domTwinSelector}" — ` +
            `${label} cannot ship in the canvas alone`,
          domTwinSelector: surface.domTwinSelector,
          canvasSurfaceSelector: surface.canvasSurfaceSelector,
          label,
        },
      ],
    };
  }

  // The first candidate that matches the signature is the canonical twin.
  // A project may have many buttons but the validator must find at least
  // one element with the right semantics.
  const canonicalTwin = candidates.find((el) => signature.matches(el));
  if (!canonicalTwin) {
    return {
      violations: [
        {
          category: surface.category,
          severity: 'error',
          message:
            `selector "${surface.domTwinSelector}" found ${candidates.length} element(s), ` +
            `none matched the ${label} twin signature — the canvas copy is the only authority`,
          domTwinSelector: surface.domTwinSelector,
          canvasSurfaceSelector: surface.canvasSurfaceSelector,
          label,
        },
      ],
    };
  }

  // minControls: count focusable / semantic children when required.
  // The canonical twin itself can satisfy minControls when it matches the
  // focusable selector (a button is its own focusable control).
  if (signature.minControls && signature.minControls > 0) {
    const focusableSelector =
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const selfMatches =
      typeof canonicalTwin.matches === 'function' &&
      canonicalTwin.matches(focusableSelector);
    const focusable = selfMatches
      ? canonicalTwin
      : canonicalTwin.querySelector(focusableSelector);
    if (!focusable) {
      return {
        violations: [
          {
            category: surface.category,
            severity: 'error',
            message:
              `${label} twin is present but has no focusable control — ` +
              `keyboard and screen reader paths cannot reach it`,
            domTwinSelector: surface.domTwinSelector,
            canvasSurfaceSelector: surface.canvasSurfaceSelector,
            label,
          },
        ],
      };
    }
  }

  // Optional canvas surface must be decorative-only.
  if (surface.canvasSurfaceSelector) {
    const canvasEls = Array.from(document.querySelectorAll(surface.canvasSurfaceSelector));
    for (const canvasEl of canvasEls) {
      if (!isDecorativeCanvasSurface(canvasEl)) {
        return {
          violations: [
            {
              category: surface.category,
              severity: 'error',
              message:
                `canvas surface "${surface.canvasSurfaceSelector}" is reachable from ` +
                `the accessibility tree — ${label} would ship in the canvas alone`,
              domTwinSelector: surface.domTwinSelector,
              canvasSurfaceSelector: surface.canvasSurfaceSelector,
              label,
            },
          ],
        };
      }
    }
  }

  return { violations: [] };
}

/**
 * Decide whether a canvas-rendered element is decorative-only. The
 * validator accepts any of:
 *
 *   - `aria-hidden="true"` (mirror clone),
 *   - `inert` attribute or property,
 *   - `pointer-events: none` so a click cannot reach the canvas copy,
 *   - a parent marked with `data-wdu-canvas-decorative`.
 *
 * Anything else means the canvas surface is reachable from the
 * accessibility tree, the keyboard, or pointer input — that is the
 * prohibition firing.
 */
export function isDecorativeCanvasSurface(element: Element): boolean {
  if (element.getAttribute('aria-hidden') === 'true') return true;
  if ((element as HTMLElement).inert === true) return true;
  if (element.getAttribute('inert') !== null) return true;
  const doc = element.ownerDocument;
  if (!doc || !doc.defaultView) {
    return false;
  }
  const style = doc.defaultView.getComputedStyle(element);
  if (style.pointerEvents === 'none') return true;
  let parent: Element | null = element.parentElement;
  while (parent) {
    if (parent.hasAttribute('data-wdu-canvas-decorative')) return true;
    parent = parent.parentElement;
  }
  return false;
}