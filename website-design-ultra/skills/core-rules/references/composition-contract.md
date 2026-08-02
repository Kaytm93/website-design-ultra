# Composition Contract — 2D

The 2D twin of the art-direction contract in `3d-art-direction`. A 3D scene has
to declare its camera, safe area, and poster frame before scene code; a page had
no equivalent, so its composition was decided implicitly by whichever component
was written first. Fill this block for full pages and signature sections, under
the same condition that loads
[responsive-recomposition.md](responsive-recomposition.md).

The block is the schema, not the values. `first-screen-occupancy: 62%` is one
filled example, not a default to reuse. A contract filled from this file alone is
unfilled rather than shortened, and a plan-only or contract-only answer is
exactly where that shortcut is tempting.

```yaml
visual-thesis: "Which statement does the first screen carry?"
focal-element: "hero wordmark + the reconciliation table behind it"
first-screen-occupancy: "62% — focal element against everything else above the fold"
asymmetry: "content 7/5 split, action left, proof media bleeding right"
dominant-contrast: "5.2x type-size ratio between hero and body"
quiet-zones: "full-bleed band above the CTA, no border, no card"
signature-move: "table rows resolve as the hero settles — see style-directions"
```

## The fields

**`visual-thesis`.** One sentence, the same discipline as the 3D thesis: what
must be recognizable after two seconds. If it names a feeling rather than a
thing, it is not filled.

**`focal-element`.** The single element that wins the first screen. One. A page
with two focal elements has none, and that is the most common outcome of writing
sections independently.

**`first-screen-occupancy`.** Roughly what share of the first viewport the focal
element and its immediate support take. It converts "make it prominent" into a
number that survives a screenshot. Below about 40% the page usually reads as a
uniform grid at thumbnail size, which is what the squint test in `anti-slop`
design tells catches after the fact.

**`asymmetry`.** The deliberate imbalance, named as a ratio or a placement, plus
what fills the shorter side. `DESIGN_VARIANCE` in `core-rules` §1 is verified
here and by the uniformity budget. Symmetry is a valid answer when the direction
declares it, as Apple-like precision and Swiss both do, provided it is the
declared answer rather than the residue.

**`dominant-contrast`.** The largest single contrast on the page and the axis it
runs on: size, weight, color, density, or motion. One axis dominates; the others
support it. A page where four axes are all loud reads as noise, and a page where
none is reads as a template.

**`quiet-zones`.** Where the page deliberately holds nothing. Name at least one
for a full page. This is the field that survives contact with stakeholders least
often and matters most: a composition without rest has no emphasis either.

**`signature-move`.** The one device this page will be remembered by, drawn from
`style-directions/references/signature-moves.md`, together with the invariant it
must not break. One per viewport, as `component-patterns` requires. If the field
is empty, the page is competent and forgettable, and that is a finding.

## Relationship to the other contracts

- **Responsive recomposition** answers what changes across wide, portrait, and
  narrow. This contract answers what must survive all three. The `visual-thesis`
  and the `signature-move` are the invariants the viewport shots recompose
  around; if a narrow shot loses both, the recomposition is a different page.
- **Art direction (3D)** owns the scene. Where a page contains a scene, that
  contract's `visual-thesis` and this one are the same sentence, written once.
- **Tier-3 budgets** in `anti-slop` design tells measure the result. The token
  block in `style-directions` declares the intent. This contract sits between
  them: it says what the composition is for, and the other two check whether the
  page delivers it.

## Check

- [ ] Exactly one focal element, with an occupancy figure rather than an adjective.
- [ ] The dominant contrast names one axis; the others are explicitly secondary.
- [ ] At least one quiet zone is declared for a full page.
- [ ] The signature move is named, sourced, and paired with the invariant it
      respects.
- [ ] Thesis and signature move survive the narrow shot, or the recomposition
      says which one it replaces and with what.
