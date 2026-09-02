# Site Reconnaissance Method

Use this method only after the `site-reconnaissance` gate accepts a public URL and
an implementation-reconnaissance request. The output is an evidence ledger bound
to captured artifacts. It is not a moodboard, a screenshot gallery, or permission
to copy an unlicensed implementation.

## Gate and status

Record these before opening the reference:

- the exact `http` or `https` URL, without credentials or private query values;
- the sentence in the brief that requests runtime reconnaissance;
- browser, GPU, Inspector, and shader-capture capability statuses;
- whether access is public and credential-free.

A screenshot or screen recording alone never opens this skill. A visual match,
style name, DOM snapshot, or source-code guess is not a runtime evidence request.
If a required capability is missing, record `UNAVAILABLE` and stop the applicable
capture; do not fill its fields from a screenshot or claim `PASS`.

## Evidence order

Capture one redacted artifact for each family. Give each artifact a stable id,
format, source locator, and SHA-256 in the ledger.

### 1. Bundle

Record the document's script entrypoints, framework/runtime markers, module or
chunk names, source-map availability, and relevant build/runtime versions. Treat
minified names as observations, not explanations. Preserve a small text or JSON
excerpt; do not store private source maps or authorization-bearing URLs.

### 2. Network manifest

Capture the document request and the requests that matter to the first stable
frame: method, URL with secrets removed, status, resource type, transfer or
encoded size when exposed, cache/compression headers when exposed, and ordering.
Do not forward cookies or authorization headers into the artifact. A guessed asset
list is not a network manifest.

### 3. `renderer.info`

Read the live renderer after warm-up and a stable frame. Record the renderer and
version context, then the observed `renderer.info` counters: `render.calls`,
`render.triangles`, `render.points`, `render.lines`, `render.frame`,
`memory.geometries`, `memory.textures`, and `programs` when available. Keep
unknown counters unknown; do not estimate them from a screenshot or a budget.

### 4. Inspector capture

Capture semantic Inspector output for the scene graph, camera, materials, and
programs. A screenshot may accompany it, but it must point to the semantic
capture and cannot be the only evidence. Record stable object paths, types,
material names, camera parameters, and visible ownership. Do not treat an
Inspector UI label as proof that a hidden resource was used unless the capture
contains the corresponding semantic value.

### 5. Shader extraction

Extract the actual vertex and fragment source seen by the renderer or Inspector.
Record stage, program/material locator, uniforms, defines, colour-space assumptions,
and a source hash. Note generated or minified source as such. Keep source within
project licensing boundaries; a public URL does not grant redistribution rights.

## Ledger rules

Copy [templates/site-reconnaissance.md](../templates/site-reconnaissance.md) and
fill every supported row with:

- a stable field id;
- the observed value, or `unknown` when not exposed;
- one or more evidence references with an artifact id and locator;
- an observation that says what was actually captured.

A supported row needs a non-screenshot evidence reference. The acceptance bar is
at least ten supported rows overall, with at least two from each of bundle,
network, renderer, Inspector, and shader. The URL and the brief gate do not count
as substitutes for those runtime families.

Keep contradictions and unanswered questions visible. Never merge two conflicting
captures into a plausible value. Redact cookies, authorization, API keys, signed
URLs, private hostnames, and source-map contents before committing artifacts.

## Handoff

The validator lives at `repo:automation/site-reconnaissance/validate-site-reconnaissance.mjs`.
Run it against the filled JSON ledger. Run the description gate at
`repo:automation/site-reconnaissance/validate-description.mjs` as well. A ledger
with fewer than ten supported fields, missing a family, citing only screenshots,
or reporting unavailable runtime evidence as `PASS` stays closed.
