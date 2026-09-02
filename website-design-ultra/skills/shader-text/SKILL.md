---
name: shader-text
description: Build production shader-driven text with a licensed MSDF atlas or a Troika alternative, while a selectable and translatable DOM twin remains authoritative. Use only when the brief explicitly requires canvas text effects such as MSDF rendering, scramble, glitch, or dissolve. Ordinary HTML/CSS text, ordinary 3D labels, and flat motion use the normal path; an ordinary text effect does not activate this skill.
---

# Shader Text — Production

Use a shader for a visual treatment, never as the document. The DOM owns the
headline, selection, translation, search, focus, and screen-reader path; the
canvas is a decorative overlay with `aria-hidden="true"` and
`pointer-events: none`.

## Gate

Open this skill only when the visual brief names shader-driven text or an MSDF /
SDF / Troika text surface. Do not load it for a normal heading, CSS text effect,
ordinary 3D label, or a canvas that has no semantic DOM twin.

## Production path

1. Copy `templates/shader-text/dom-text-template.ts` and
   `templates/shader-text/text-effects-uniforms.ts`. Mount the DOM twin first,
   set its real `lang`, and mirror pointer/focus/activation state into uniforms.
2. Validate `templates/shader-text/license-manifest.json` with
   `templates/shader-text/msdf-atlas.mjs --check` before running the declared
   `msdf-atlas-gen` command. Keep font, generator, glyph range, attribution, and
   license in the manifest; never commit a font or credential by accident.
3. Choose either the MSDF path or `templates/shader-text/troika-alternative.md`.
   Do not load both renderers for one label. Copy the existing
   `templates/shaders/sdf-text.vert` and `.frag` only after the module-index row
   and backend decision fit the project.
4. Select effects individually: `uScramble`, `uGlitch`, and `uDissolve` are
   bounded, DOM-derived uniforms. There is no apply-all path. Freeze their
   amplitudes and time under reduced motion while leaving DOM interaction live.

## Verification and routing

Run the root-only `repo:lab` `shader-text-screenreader` fixture and the
`shader-text` deterministic route. Confirm the DOM twin is selectable,
translatable, focusable, and announced once; the canvas remains decorative.
Run the unchanged `templates/runtime/canvas-only-prohibition.ts` validator for
canvas-first pages. A missing browser or GPU is `UNAVAILABLE`, never `PASS`.

Route the master 3D decision to `immersive-3d`; use `shaders-tsl` for renderer
and color-space choices and `canvas-first-architecture` when the canvas owns
the page.

## Check

- [ ] The explicit shader-text gate is true; ordinary text was not routed here.
- [ ] One renderer path is chosen and the license manifest validates first.
- [ ] The DOM twin owns text, `lang`, selection, translation, focus, and screen reading.
- [ ] Atlas metrics, line breaking, missing-glyph behavior, and color space are recorded.
- [ ] Scramble, glitch, and dissolve are separate bounded uniforms from DOM state.
- [ ] Reduced motion freezes visuals without removing DOM interaction.
- [ ] No primary action, form, legal copy, pricing, or essential text is canvas-only.
- [ ] Lab and screen-reader fixture pass; unavailable browser/GPU stays unverified.
