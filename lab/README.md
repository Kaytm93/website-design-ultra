# WDU shader / particle lab

`lab/` is the root-only IP-08A experiment harness. It is intentionally outside
`website-design-ultra/`: the lab owns its Vite dependencies and lockfile, while
`references/determinism-runtime.ts` remains a copyable zero-dependency runtime
reference. There is no application router, layout, or marketing surface.

## Routes

Start the lab with:

```bash
npm ci
npm run dev
```

Then open one experiment at a time:

- `/?e=shader-fullscreen` — fullscreen GLSL shader with live raw-source HMR and uniform controls;
- `/?e=particle-toy` — GPU particle ping-pong simulation (RGBA16F HalfFloat, NearestFilter, NoColorSpace, no depth/stencil, one owner swap, deterministic `particles/spawn`, normalized pointer field with capped Gaussian falloff, one recovering click impulse, reduced-motion/poster/capability fallback);
- `/?e=compile-error` — deliberate undeclared-uniform failure with source/line diagnostics;
- `/?e=deterministic-capture&WDU_DETERMINISTIC=1` — seeded, stable-frame capture fixture;
- `/?e=foundational-shaders` — noise, Fresnel, iridescence, dissolve (IP-08B);
- `/?e=transition-interaction` — frosted transition, chromatic offset, shockwave, flow field (IP-08C);
- `/?e=media-post` — video states, LUT render-graph pass, frame-rate-independent grain (IP-08D);
- `/?e=media-post-deterministic&WDU_DETERMINISTIC=1` — seeded capture for media/post;
- `/?e=media-post-failure` — failure/fallback states with compile-error fixture (non-blank);
- `/?e=media-post-reduced-motion` — reduced-motion freeze: paused video, zero grain, static fallback.
- `/?e=gpu-particles-deterministic&WDU_DETERMINISTIC=1` — deterministic GPU particle spawn/reset, pointer normalization, capped falloff, one-shot impulse (IP-09A, `particles/spawn`).

## Verification

```bash
npm run verify
WDU_PLAYWRIGHT_CLI=/path/to/playwright-cli npm run verify:harness
```

`verify:harness` performs a clean install, typecheck, unit tests, production
build, real-browser compile-error assertion, two-run deterministic screenshot
hash comparison, and an edit-to-update measurement for the fullscreen fragment
shader. A missing browser CLI is reported as `UNAVAILABLE` (exit code 2), never
as a passing result. The HMR check restores the edited shader in a `finally`
block so the working tree remains clean after the run.
