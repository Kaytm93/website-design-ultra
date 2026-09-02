# Shader-text production contract

This is the detailed contract behind `shader-text/SKILL.md`. It keeps the
installed payload copyable while the root-only lab proves the behavior.

## Renderer and atlas

The default is WebGL2 with one MSDF atlas texture and a bounded text pass. Atlas
pixels are linear, unencoded distance data (`RGB8`, three channels); they are
not display colors. Decode the median of RGB in the shader, derive screen-space
coverage from glyph metrics, and tone-map after the text pass. Keep the atlas
sample and transparent overdraw in the declared budget.

Run the installed `templates/shader-text/msdf-atlas.mjs` with
`--check templates/shader-text/license-manifest.json` before generation. The
script validates the manifest without a package install, then can invoke the
explicit `msdf-atlas-gen` executable with the supplied font and output paths.
The manifest records generator license, font family/license/source,
attribution, glyph set, distance range, and the fact that no paid font or
credential is committed. A missing or non-permissive license blocks generation.
Generated PNG/JSON output and font binaries stay project-owned build artifacts;
the plugin does not ship a font binary or a generic npm package.

The atlas interface needs tile/UV bounds, advance, bearing, line height, and a
missing-glyph sentinel. Break lines from those metrics without splitting a word
or grapheme cluster; if a codepoint is absent, paint a visible failure tile and
keep its measured advance instead of silently dropping it.

## Troika alternative

For a project that already has `troika-three-text`, choose the
`templates/shader-text/troika-alternative.md` path instead of shipping a second
MSDF renderer. Troika owns atlas packing and glyph layout; the project still
keeps the same DOM twin, reduced-motion policy, disposal, and visible failure
state. Do not mix Troika and a hand-written MSDF material for one label, and do
not make Troika a plugin dependency. A real application declares its own pinned
version and verifies its installed API.

## DOM authority

`templates/shader-text/dom-text-template.ts` creates the semantic twin before
canvas work. The text element is a native heading or paragraph, has real
`textContent`, the correct `lang`, `translate="yes"`, `tabIndex=0` when focus
state drives effects, and `user-select: text`. The canvas overlay is
`aria-hidden="true"`, `inert` where supported, and `pointer-events: none` so
selection, find-in-page, machine translation, browser zoom, and assistive
technology reach the DOM. A resize observer supplies layout revision; it is not
a second animation clock.

The unchanged `templates/runtime/canvas-only-prohibition.ts` contract remains
the gate for primary actions, forms, legal copy, and pricing. Shader text may
repeat a DOM value decoratively; it may not become the only copy of a prohibited
or essential surface.

## Uniform contract

`templates/shader-text/text-effects-uniforms.ts` derives three independent
payloads from the DOM mirror:

- `uScramble`: pointer UV, bounded glyph-offset amplitude, and a layout/event seed.
- `uGlitch`: focus/activation pulse age, bounded channel offset, and seed.
- `uDissolve`: activation progress, bounded edge width, and seed.

The injected scene clock is the only time owner. No `performance.now()` or
`Math.random()` belongs in a render loop, and the canvas never invents pointer,
focus, or activation state. Under reduced motion, all visual amplitudes and
progress are frozen at zero while the DOM events remain live. A project selects
the minimum effect set; there is deliberately no combined “apply all” helper.

## Evidence

The root-only routes are `repo:lab/src/experiments/shaders/shader-text.ts`,
`repo:lab/src/fixtures/shader-text-deterministic.ts`, and
`repo:lab/src/fixtures/shader-text-screenreader.ts`. Run the lab suite with
`npm run verify:harness`. A real browser capture is required for a visual PASS;
missing browser/GPU capability is `UNAVAILABLE` and must remain unchecked.
