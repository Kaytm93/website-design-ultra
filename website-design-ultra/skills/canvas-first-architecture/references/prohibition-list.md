# Canvas-Only Prohibition List

`canvas-first-architecture` §4 names the categories that must never ship
in the canvas alone: the primary action, any form input, legal copy,
and pricing. Each declared surface needs a DOM twin, and the canvas
overlay, if any, must remain decorative. This reference is the
executable binding for that rule: the validator module, its surface
shape, the four categories, the signature map, and the runtime observer.

## Module

`repo:lab/src/modules/canvas-only-prohibition.ts` exports:

| Export | Shape | Role |
|---|---|---|
| `PROHIBITED_CATEGORIES` | readonly `ProhibitionCategory[]` | Closed list: `primary-action`, `form`, `legal-copy`, `pricing`. |
| `validateDeclaration(declaration, root?)` | `ProhibitionValidationResult` | Static audit. Walks the DOM, applies the signature map, records violations. |
| `createProhibitionObserver(declaration, root)` | `ProhibitionObserver` | Runtime audit. Attaches a `MutationObserver` and `focusin/focusout` listeners, returns `check()` for on-demand re-runs. |
| `buildDomTwin(document, category, text)` | `HTMLElement` | Canonical twin per category. `<button>`, `<form>` with `<input required>`, `<small>`, or `<div data-wdu-price-tier>`. |
| `withCanonicalSignatures(declaration)` | `ProhibitionDeclaration` | Decorate a declaration with the canonical signature map. |
| `isDecorativeCanvasSurface(element)` | `boolean` | Reads `aria-hidden`, `inert`, computed `pointer-events`, and the `data-wdu-canvas-decorative` ancestor chain. |

Both `validateDeclaration` and `createProhibitionObserver` share one
result vocabulary: `{ passing: ProhibitionCategory[]; violations: ProhibitionViolation[]; isPassing: boolean }`. The runtime observer reports the same shape via `.result` and `.check()`.

## Surface declaration

A `ProhibitionDeclaration` enumerates one entry per category it ships:

```ts
interface ProhibitionDeclaration {
  projectName: string;
  surfaces: ProhibitionSurfaceDeclaration[];
}

interface ProhibitionSurfaceDeclaration {
  category: 'primary-action' | 'form' | 'legal-copy' | 'pricing';
  domTwinSelector: string;          // required CSS selector for the canonical DOM twin
  canvasSurfaceSelector?: string;    // optional selector for the decorative canvas overlay
  twinSignature?: TwinSignature;    // override the default signature for this surface
  label?: string;                    // human-readable label used in violation messages
}
```

A declaration with zero surfaces is itself a violation. The validator
returns `declaration has no surfaces; every project must enumerate at
least the four prohibited categories it ships`. A surface whose
category is declared twice is a duplicate violation, not a re-pass.

## Signature map

| Category | Selector | Twin signature |
|---|---|---|
| `primary-action` | `[data-wdu-primary-action], button[role="button"], a[role="button"], button, a[href]` | `el.matches('button')` or `el.matches('a[href]')` or (`role === 'button'` and `tabindex` present). `minControls: 1`. The twin itself or a descendant must be a focusable control. |
| `form` | `form, [role="form"]` | tag `form` or `role === 'form'`. `minControls: 1`. Focusable input, select, or textarea inside. |
| `legal-copy` | `[data-wdu-legal-copy], footer [data-wdu-legal], small[data-wdu-terms], [aria-label*="terms" i], [aria-label*="impressum" i], [aria-label*="legal" i]` | non-empty `textContent` after trim; computed `user-select !== 'none'` (machine translation and find-in-page require selectable text). |
| `pricing` | `[data-wdu-pricing], [data-wdu-price], [data-wdu-price-tier]` | non-empty `textContent`; either a currency token (`€`, `$`, `£`, `¥`) in the text, or `data-wdu-price-tier` / `data-wdu-price` attribute. |

`minControls: 0` means the surface is satisfied by its twin alone.
`minControls: 1` requires a focusable control reachable from the
canonical twin or co-located with it. The validator counts both
descendants and the twin itself against the focusable selector
(`a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])`).

## Failure paths

`validateDeclaration` records four distinct failure shapes, in this
order:

1. `no DOM element matches selector "${domTwinSelector}"`. The
   project did not declare a DOM twin for the category. A build that
   skips the twin is a defect, not a default.
2. `selector ... found N element(s), none matched the
   ${category} twin signature`. The twin exists but does not
   satisfy the canonical signature (for example, a `<div>` where the
   form twin is required, or `user-select: none` on a legal-copy
   twin).
3. `${label} twin is present but has no focusable control`.
   `minControls: 1` is declared (primary-action, form) and neither the
   twin nor a descendant satisfies the focusable selector. Keyboard and
   screen reader paths cannot reach the surface.
4. `canvas surface "${canvasSurfaceSelector}" is reachable from the
   accessibility tree`. `isDecorativeCanvasSurface(canvasEl)` returns
   `false`: the overlay has no `aria-hidden`, no `inert`, no
   `pointer-events: none`, and no `data-wdu-canvas-decorative`
   ancestor. The category would ship in the canvas alone.

The same vocabulary is used by the runtime observer. When a
`MutationObserver` fires on `document.documentElement` with the
declared attribute filter (`role`, `tabindex`, `aria-hidden`, `inert`,
`user-select`, `hidden`), the observer re-runs `compute()` and updates
its `result`. A focusin or focusout event triggers the same recompute.

## Decorative-only contract

A canvas overlay is decorative when any of:

- `aria-hidden="true"` on the canvas surface, or
- `inert` attribute on the surface (or `element.inert === true`), or
- computed `pointer-events: none`, or
- the surface lives inside a `[data-wdu-canvas-decorative]` ancestor.

`aria-hidden` and `inert` are read from the underlying DOM; the
validator does not invent them. A decorative-only canvas surface
contributes a `null` violation regardless of whether the surface
exists; a non-decorative canvas surface contributes an explicit
violation. A project that ships no canvas overlay at all is also
conformant. The prohibition is about the canvas-only failure mode,
not about the presence of a surface.

## Test binding

The list is exercised by `repo:lab/tests/canvas-only-prohibition.test.ts`:

- One mirrored-interface test confirms every category has a DOM twin
  and a decorative canvas surface.
- Four failing-fixture tests assert each failure path
  (`primary-action` missing, `form` missing, `legal-copy` with
  `user-select: none`, `pricing` without a currency token).
- Two decorative-overlay tests accept `aria-hidden` and a
  `data-wdu-canvas-decorative` wrapper, and reject a non-decorative
  overlay.
- The runtime observer test exercises the static-to-runtime parity:
  same DOM, same result vocabulary, plus mutation-driven
  recomputation.
- `buildDomTwin` returns a usable element for every category.
- Wiring checks assert `main.ts` exposes both routes,
  `manifest.ts` declares the entry, and the deterministic capture
  fixture inherits the interactive route.