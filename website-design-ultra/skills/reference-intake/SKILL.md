---
name: reference-intake
description: Extract traceable 3D art direction from six to ten exported PNG and SVG frames plus a written token block. Use only when both artifacts are supplied before `3d-art-direction`. A named direction, mood label, or text-only briefing without reference material does not activate this skill.
---

# Reference Intake

Turn a bounded visual set into evidence for `3d-art-direction`; do not turn a
direction name into imagined values.

## Gate and input

Run before art direction only when all are supplied: six to ten distinct frames,
PNG and SVG material, and a written token block. If any part is absent, do not
partially run it; a named direction goes directly to `3d-art-direction`. Do not
load this for 2D, a text-only 3D hero, or a mood adjective.

Keep originals unchanged and address them by stable ids. The interface is offline
and tool-neutral. In a matching source checkout,
`repo:automation/reference-intake/validate-reference-intake.mjs` validates the
companion JSON and bytes; fixtures and the optional REST helper stay outside the
installed plugin. Manual exports and the written token block remain required.

## Intake record and extraction

Copy [templates/reference-intake.md](templates/reference-intake.md) into the
project evidence directory. Replace placeholders and record each frame's id,
path, format, dimensions, viewport, role, the unaltered token block, the sixteen-
field art-direction ledger, contradictions, open questions, and poster target.
Do not merge token constraints with frame observations.

Read [references/traceable-extraction.md](references/traceable-extraction.md) and
inspect every frame with the host image reader; read tokens verbatim. For every
art-direction leaf record exactly one value plus `source-frame: frame-NN`, or
`value: unknown` plus `source-frame: unknown`. A filename, token, direction name,
or estimate is not a citation; contradictions stay visible and unknown.

## Poster and handoff

Create a repo-local PNG/SVG poster target from approved material before scene code.
It fixes silhouette, anchor, DOM safe area, light direction, material ranking,
tonal range, and wide/portrait crop; it is not a silent unlicensed reference
copy. Keep `scene-code-status: blocked` until target fields cite their frames.
Only then load `3d-art-direction`, preserving citations, unknowns, target, and the
handoff order. That skill owns implementation; this one owns evidence boundaries.

## Output

Deliver the six-to-ten-frame manifest, supplied token block, sixteen traced fields,
contradiction/unknown ledger, concrete poster asset/target block, and a handoff
that names `reference-intake` before `3d-art-direction`.

## Check

- [ ] The gate received six to ten frames, including PNG and SVG, plus a written
      token block.
- [ ] Every frame has one stable id and one unchanged source path.
- [ ] Every art-direction field cites one source frame or is `unknown`.
- [ ] Tokens constrain the extraction but never replace a frame citation.
- [ ] Contradictory frames remain visible in the record.
- [ ] A concrete poster target exists before scene code.
- [ ] The handoff precedes `3d-art-direction`; no advanced module loaded for a
      text-only named direction.
