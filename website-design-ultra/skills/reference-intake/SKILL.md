---
name: reference-intake
description: Extract traceable 3D art direction from six to ten exported PNG and SVG frames plus a written token block. Use only when both artifacts are supplied before `3d-art-direction`. A named direction, mood label, or text-only briefing without reference material does not activate this skill.
---

# Reference Intake

Turn a bounded visual reference set into evidence for `3d-art-direction`. This
skill records what the frames show; it does not turn a direction name into
imagined camera, light, or material values.

## 1. Gate

Run this skill before `3d-art-direction` only when the briefing supplies all of
the following:

- six to ten distinct exported reference frames,
- PNG and SVG material in that set, and
- a written token block supplied with the frames.

If any part is absent, do not partially run the skill. A named direction may go
directly to `3d-art-direction`; its name is not visual evidence. Do not load this
skill for ordinary 2D work, an ordinary text-only 3D hero, or a mood adjective.

The input contract is offline and tool-neutral. Keep original files unchanged
and refer to them by stable ids rather than by their order in a folder listing.
When working from a source-repository checkout at the same commit or tag, the
source-repository `repo:automation/reference-intake/validate-reference-intake.mjs`
validator
can verify the companion JSON record and exported bytes offline. Its fixtures
and optional REST helper remain outside this installed plugin tree. Manual PNG
and SVG exports plus the written token block stay the required interface; Figma
REST is optional acceleration and never an activation requirement.

## 2. Prepare the intake record

Copy [templates/reference-intake.md](templates/reference-intake.md) into the
project evidence directory and replace every input placeholder. The record must
contain:

1. one `frame-01` through `frame-10` id per supplied file, with path, format,
   dimensions, viewport, and stated role,
2. the written token block without paraphrasing it,
3. the complete sixteen-field art-direction trace ledger,
4. contradictions and open questions, and
5. a concrete poster target path.

Do not merge the written tokens into observed frame evidence. Tokens constrain
the result, but each art-direction value still needs a `source-frame` citation.

## 3. Extract visual evidence

Read [references/traceable-extraction.md](references/traceable-extraction.md)
and inspect each frame with the host's image-reading capability. Read the
written token block verbatim with the host's file reader. Record the visible
observation before interpreting it.

For every art-direction field, use exactly one of these states:

- a value plus `source-frame: frame-NN`, where that frame visibly supports it, or
- `value: unknown` plus `source-frame: unknown`.

A token, filename, direction label, or unsupported estimate is not a frame
citation. When frames disagree, record the contradiction and leave the field
`unknown` until the target set resolves it.

## 4. Produce the poster target before scene code

Create a repo-local PNG or SVG poster target from approved project material and
the traced composition. It may select an authorized source frame, crop an
approved project asset, or be a new target board; it may not silently become a
shipped copy of an unlicensed reference.

The poster target is the first visual acceptance artifact, not a fallback made
after the live scene. It fixes silhouette, subject anchor, DOM safe area,
lighting direction, material ranking, tonal range, and wide/portrait crop. Keep
`scene-code-status: blocked` until its file exists and the target fields cite the
frames that informed them. A prose description alone is not a poster target.

## 5. Handoff

Only after the intake record and poster target exist:

1. load `3d-art-direction`,
2. pass it the record before any of its camera, light, material, or type
   references are selected,
3. preserve every `source-frame` citation and every `unknown`, and
4. hold desktop, portrait, reduced-motion, and live-scene decisions against the
   poster target before scene code is accepted.

`3d-art-direction` owns implementation choices. This skill owns the boundary
between visible source evidence and an unsupported choice.

## Output

Deliver:

1. the six-to-ten-frame manifest,
2. the written token block as supplied,
3. all sixteen traced art-direction fields,
4. the contradiction and unknown ledger,
5. the concrete poster target asset and target block, and
6. a handoff stating that `reference-intake` preceded `3d-art-direction`.

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
