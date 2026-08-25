# Traceable Extraction

Use this procedure after the `reference-intake` gate has accepted six to ten
frames and a written token block. Its output separates observation from choice
so `3d-art-direction` can see where each value came from.

## Source grammar

Assign ids once: `frame-01` through `frame-10`. A `source-frame` value is either
one of those ids or `unknown`; no filename, direction name, token key, URL, or
memory-based citation is valid in that field.

For each frame, record:

- unchanged repo-relative path and format,
- pixel dimensions or SVG view box,
- wide, portrait, square, or component viewport,
- intended state such as first screen, detail, transition, or poster candidate,
- provenance or rights note supplied by the project, and
- visible subject, crop, safe area, light direction, material response, type
  layer, and tonal range.

Describe pixels before conclusions. “Bright edge on upper-left silhouette” is
an observation. “Use a cool rim light” is a later art-direction choice.

## Field extraction

Fill the trace ledger in the template in its existing order.

| Field group | Evidence a frame can support | Leave `unknown` when |
|---|---|---|
| Visual thesis and hero subject | repeated focal object, recognizable silhouette, visual hierarchy | the frames do not agree on one subject or statement |
| Camera framing, FOV, position, target, near/far | crop, convergence, perspective compression, visible planes, depth separation | a numeric camera value cannot be recovered from pixels |
| Subject anchor and DOM safe area | normalized subject bounds, quiet regions, overlay guides | no frame shows the page and scene together |
| Lighting | shadow direction, highlight shape, rim, fill, motivated practicals | the image is flat, composited, or internally contradictory |
| Material order | relative roughness, reflection, transmission, emission, surface prominence | two materials cannot be ranked from the supplied views |
| Color output and tone mapping | highlight roll-off, neutral point, saturation, black floor | the renderer or output transform is not evidenced by a frame |
| Mobile reframe | a dedicated portrait crop and changed subject/text relationship | the set contains no intentional portrait frame |
| Spatial type | DOM overlays, object labels, decorative world type, occlusion | the frame does not reveal layer ownership or semantics |
| Poster frame | strongest static silhouette, message, crop, and tonal target | no supplied frame can anchor a static target |

Do not reverse-engineer precision a frame cannot carry. A plausible focal length
is still `unknown` when the image offers no calibration. Written tokens may
reject a candidate value, but they do not become its `source-frame`.

## Multiple frames and contradiction

Choose one primary frame citation per field. Put corroborating frames in the
observation text. If two frames imply different targets, add a contradiction
entry with both ids and the unresolved axis; do not average them into a third
unsupported value.

A contradiction is resolved only by a supplied priority, a new approved target,
or an explicit art-direction decision after handoff. Until then, the field stays
`unknown`.

## Poster target

Produce the poster target before scene code. Start with the strongest authorized
frame and carry over only traced attributes:

1. fix wide and portrait bounds,
2. place the subject and DOM safe area,
3. preserve the recognizable silhouette,
4. state key-light direction and material ranking,
5. state black floor, highlight ceiling, and dominant contrast, and
6. export or select the concrete PNG or SVG target asset.

The target is ready when another reviewer can compare a live frame at the same
container size and answer whether silhouette, anchor, safe area, crop, material
ranking, and tonal range match. “Cinematic” or another direction label is not a
comparison criterion.

## Handoff check

Before loading `3d-art-direction`, verify:

- every manifest id resolves to one supplied file,
- every trace row has a valid `source-frame` or paired `unknown` values,
- every contradiction names the frames and axis involved,
- the poster target asset exists,
- the written token block is preserved separately, and
- `scene-code-status` remains blocked until all preceding items are true.
