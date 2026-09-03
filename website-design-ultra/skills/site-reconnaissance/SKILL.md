---
name: site-reconnaissance
description: Reverse-engineer a public live 3D reference URL into bundle, network, renderer.info, Inspector, and shader evidence. Use only when the brief explicitly requests runtime reconnaissance of a public URL. A screenshot alone, an ordinary 2D audit, or an ordinary 3D hero does not activate this skill.
---

# Site Reconnaissance

Turn a public live 3D reference into inspectable implementation evidence. This skill
records what the running site exposes; it does not copy a visual impression into
code and it does not replace an asset, performance, or art-direction contract.

## 1. Gate

Load this skill only when all three conditions hold:

1. The brief explicitly asks to reverse-engineer or investigate a public reference
   URL for implementation clues.
2. The URL is reachable without credentials, a private session, or a paid design
   tool.
3. Runtime evidence is in scope: bundle, network, `renderer.info`, Inspector
   capture, or extracted shader source.

A screenshot, screen recording, DOM-only audit, named style, or visual similarity
request is not runtime evidence. Do not load this skill for ordinary 2D work or
an ordinary 3D hero. If browser, GPU, Inspector, or shader capture is unavailable,
record `UNAVAILABLE`; never turn that limitation into `PASS`.

## 2. Contract

Read [references/reconnaissance-method.md](references/reconnaissance-method.md)
before opening the URL. Copy
[templates/site-reconnaissance.md](templates/site-reconnaissance.md) into the
project evidence directory. The ledger is the handoff, not an informal notebook:
every supported field cites a non-screenshot artifact, locator, and observation.

The five evidence families are mandatory for a `PASS` ledger:

- bundle entrypoints and framework/runtime clues,
- network request manifest and transfer/loading facts,
- live `renderer.info` counters,
- semantic Inspector capture with an optional screenshot supplement, and
- vertex/fragment shader extraction with uniforms, defines, or source hashes.

The method requires at least two supported fields from each family and at least ten supported fields overall. An unknown value stays unknown; an unsupported
inference is not a field.

## 3. Procedure

1. Answer the gate and record the public URL and runtime capability statuses.
2. Freeze bundle and network observations before interpreting the visual result.
3. Capture `renderer.info` after a stable frame and record the renderer/version
   context beside its counters.
4. Capture the Inspector's semantic scene, camera, material, and program views;
   keep any PNG as supplemental evidence only.
5. Extract actual vertex and fragment shader text, uniforms, defines, and stable
   locators or hashes. Do not claim shader behaviour from a screenshot.
6. Fill the ledger in the template, then run the root-only validator from its
   repository checkout. A ready handoff has ten or more supported fields and all
   five families represented.

## 4. Output

Deliver the filled ledger, evidence manifest, redacted artifacts, open questions,
and a status of `PASS`, `FAIL`, `UNAVAILABLE`, or `NOT_APPLICABLE`. Keep cookies,
authorization headers, query credentials, and private source maps out of every
artifact. This skill owns observation and provenance; downstream skills decide
whether an implementation should reproduce the observed technique.

## Check

- [ ] The brief names a public URL and explicitly requests runtime reconnaissance.
- [ ] The gate did not fire for a screenshot alone, ordinary 2D audit, or ordinary 3D hero.
- [ ] Bundle, network, `renderer.info`, Inspector, and shader evidence are present.
- [ ] Every supported ledger field cites a non-screenshot artifact, locator, and observation.
- [ ] At least two supported fields come from each family and at least ten are supported overall.
- [ ] Evidence is redacted and contains no credential or private-session material.
- [ ] Browser/GPU/tool limits are `UNAVAILABLE`, never `PASS`.
- [ ] The fixture-ledger and description validators pass before handoff.
