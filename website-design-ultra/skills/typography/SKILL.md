---
name: typography
description: Select and implement website typography. Use for font choice, pairings, display/body/mono roles, hierarchy, fluid type, loading, fallbacks, licensing, open-source alternatives, language coverage, or typographic audits. Load only the reference needed for the decision.
---

# Typography Router

Verify availability, web-embedding rights, file weight, language coverage, variable axes, and fallback metrics before committing to a font. A named commercial font is art-direction shorthand, never permission to ship its files.

## Read only what the task needs

| Decision | Read |
|---|---|
| Direction-aware display/body/mono pairing | [references/pairings-and-roles.md](references/pairings-and-roles.md) |
| Fluid hierarchy, line length, wrapping, loading, CLS | [references/hierarchy-and-loading.md](references/hierarchy-and-loading.md) |
| License status, embedding risk, open-source substitute | [references/licensing-and-alternatives.md](references/licensing-and-alternatives.md) |

For an ordinary font choice, load pairings plus the license matrix. Load hierarchy/loading only when implementing or auditing type behavior.

## Invariants

- Treat the project’s licensed brand fonts as authoritative when their usage rights cover the target.
- Use open-source or properly licensed files; never copy a font from an OS, design tool, trial, or unrelated website.
- Test the actual scripts, accents, figures, symbols, and weights needed by every supported locale.
- Keep visible text selectable and semantic. Do not rasterize live copy to bypass licensing or layout work.
- Use stable fallbacks and `font-display: swap`; prevent avoidable layout shift.
- Preserve readable measure, zoom, reflow, and natural mobile wrapping.

## Anti-default guidance

- Do not use Inter, Roboto, Arial, or `system-ui` as an unconsidered premium display choice.
- Inter or Inter Tight remains valid for body/UI text in Brutalist, Editorial, Swiss, and Magazine-Tech directions; it is not the premium hero default.
- Avoid serif body text in dense dashboard controls unless the product system explicitly supports it.
- Avoid gradient-filled display copy when weight, spacing, and color can establish the hierarchy.
- Never use Comic Sans or Papyrus as an accidental default.

These are defaults, not a license matrix. Check the selected family in the licensing reference even when it is preinstalled locally.

## Output contract

Return:

1. display/body/mono roles and rationale,
2. exact source and license status for every shipped font,
3. open-source alternative when the preferred family is restricted,
4. hierarchy/loading implementation when requested,
5. locale coverage and fallback risks.

## Check

- [ ] Only the relevant references were loaded.
- [ ] Every font file has a verified source and embedding right.
- [ ] Commercial, freeware, OS-bundled, and open-source are not conflated.
- [ ] Required locales and worst-case strings were tested.
- [ ] Mobile wrapping, zoom, and fallback metrics remain stable.
