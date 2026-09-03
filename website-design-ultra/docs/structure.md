# Plugin structure and routing behaviour

The file tree, what each skill owns, and how progressive disclosure is meant
to behave. `README.md` carries the short version.

## Structure

```text
website-design-ultra/
├── .claude-plugin/plugin.json
├── .codex-plugin/plugin.json
├── LICENSE
├── commands/
│   ├── design.md
│   ├── tweak.md                    # scoped single-component track
│   ├── audit.md
│   ├── refresh.md
│   ├── immersive.md
│   └── verify.md
├── tests/
│   ├── forward/                    # SaaS, editorial, dashboard, 3D, configurator, slop
│   │   └── traces/                 # recorded provider streams, replayed offline
│   └── copy/                       # linter regression gate
│       └── fixtures/               # slop and authentic-prose pairs, en + de
├── scripts/
│   ├── validate-content.mjs        # structure + contrast + linter regression
│   ├── lint-copy.mjs               # deterministic copy linter (tiers, profiles)
│   ├── forward-trace.mjs           # provider read-trace audit + tree digest
│   ├── run-forward-tests.mjs       # isolated live plugin evals
│   ├── release.mjs                 # release provenance gate
│   ├── install-codex-sync.sh       # install hourly macOS Git sync
│   ├── sync-codex-marketplace.sh   # refresh and reinstall from GitHub
│   └── verify-browser.mjs          # capability-gated browser adapter
├── templates/
│   ├── README.md
│   ├── runtime/                    # copyable zero-dependency runtime contracts
│   ├── shaders/                    # copyable GLSL modules
│   └── material-lookdev/
│       └── material-lookdev.ts     # copyable typed material contract
└── skills/
    ├── core-rules/
    │   └── references/              # composition, recomposition, deterministic runtime
    ├── anti-slop/
    │   └── references/              # prose tells, Tier-2 words, design tells,
    │                                # German annex, operations
    ├── content-design/
    │   └── references/              # claims/proof, microcopy, localization
    ├── style-directions/
    │   └── references/          # product, editorial, expressive, signature moves
    ├── color-palettes/
    │   └── references/          # select only the needed palette family
    ├── typography/
    │   └── references/              # pairings, hierarchy/loading, licenses
    ├── motion-system/
    │   └── references/          # profiles, Motion, GSAP/scroll,
    │                            # frame-rate independence for render loops
    ├── component-patterns/
    │   └── references/          # hero, cards, forms/overlays
    ├── ui-states/
    │   └── references/          # async, forms, accessibility
    ├── immersive-3d/
    ├── reference-intake/              # on demand: 6–10 exported frames + tokens
    │   ├── references/                 # source grammar and extraction method
    │   └── templates/                  # traced contract and poster target
    ├── 3d-art-direction/
    │   └── references/          # camera, light/material/tone, spatial type
    ├── 3d-runtime-quality/
    │   └── references/          # tier matrix, adaptive runtime
    ├── r3f-patterns/
    │   └── references/          # Next.js, performance/assets
    ├── r3f-interaction/
    │   └── references/          # hotspots/camera, configurator, touch/gestures
    ├── shaders-tsl/
    │   └── references/          # TSL syntax, WebGPU feature matrix
    ├── scroll-immersion/
    ├── procedural-3d/               # on demand: procedural geometry before the asset pipeline
    │   └── references/          # catalogue with cost models, Blender contract, Houdini interchange
    ├── 3d-asset-pipeline/
    ├── canvas-first-architecture/   # on demand: the canvas is the page
    │   └── references/          # parallel DOM layer, scene state and clock
    ├── render-graph/                # on demand: passes read earlier passes
    │   └── references/          # pass catalogue, buffers and precision
    ├── loading-choreography/        # on demand: staged first frame
    │   └── references/          # manifest/buckets, warm-up and first frame
    ├── spatial-audio/               # on demand: the deliverable plays sound
    │   └── references/          # graph and mixing, event sound design
    ├── gpu-particle-systems/        # on demand: thousands of GPU particles with persistent state
    │   └── references/              # state textures, pointer field, click impulse
    └── material-lookdev/            # on demand: authored physical surface response
        └── references/              # recipes, physical fields, environment tiers
```

The last seven are add-ons behind an already-loaded 3D stack, with
`procedural-3d` placed before `3d-asset-pipeline` so generation hands off to the
existing inspect/validate/optimize path. Each description
names one activating condition and closes by naming what does not activate it,
and `validate-content.mjs` fails the build when either sentence is missing.

## Progressive disclosure

The plugin uses three levels:

1. Skill names and short trigger descriptions are always visible.
2. A triggered `SKILL.md` contains only selection logic, invariants, and the core workflow.
3. Detailed palettes, directions, component recipes, and runtime-specific code live in one-level `references/` files.

Intended routing contracts (a passing live attempt is still required for an
exact provider, case, and tree):

- SaaS palette request → `color-palettes/SKILL.md` plus `color-palettes/references/neutral-product.md`.
- Any shipped copy line → `anti-slop/SKILL.md` plus `anti-slop/references/prose-tells.md`; the
  design, vocabulary, locale, and operations references stay unread.
- German landing page → the same two files plus `anti-slop/references/locale-de.md`.
- Reporting findings or running the linter → `anti-slop/references/operations.md`;
  writing one line does not load it.
- A hand-judged Tier-2 cluster → `anti-slop/references/tier2-vocabulary.md`; a
  linted surface never needs it.
- One scoped component via `/tweak` → `core-rules/SKILL.md` plus a linter run;
  no direction, palette, or pattern skill.
- Visual refresh with unchanged copy → `anti-slop/references/design-tells.md` only.
- Full page composition → `core-rules/references/composition-contract.md` next to
  the responsive contract; a component does not load either.
- Signature device for a page → `style-directions/references/signature-moves.md`
  after the direction is chosen, never during the shortlist.
- Claim/CTA rewrite → `content-design/SKILL.md` plus only claims or microcopy.
- Localized editorial page → content localization plus typography licensing, not every type reference.
- Full-page responsive work → `core-rules` plus `core-rules/references/responsive-recomposition.md`.
- Reproducible dynamic capture, a visual baseline, a poster/checkpoint frame, or
  scene bug reproduction → `core-rules/references/determinism.md`; ordinary 2D
  work and an ordinary 3D hero do not load it.
- Declared interaction checkpoints under deterministic capture →
  `core-rules/references/interaction-checkpoints.schema.json` plus
  `core-rules/references/determinism.md` §7; the manifest is the project's
  declaration, never a verifier hardcode.
- Comparing a committed baseline capture set against a candidate run →
  `core-rules/references/baseline-comparison.schema.json` plus
  `core-rules/references/determinism.md` §8; a diff score is evidence,
  never an aesthetic verdict.
- Form component → `component-patterns/SKILL.md` plus `component-patterns/references/navigation-forms-overlays.md`.
- R3F in Next.js → `r3f-patterns/SKILL.md` plus `r3f-patterns/references/nextjs.md`.
- Six to ten exported PNG and SVG frames plus a written token block for a 3D
  direction → `reference-intake/SKILL.md` before `3d-art-direction`; a named
  direction without reference material does not load it.
- 3D camera/light brief → `3d-art-direction/SKILL.md` plus only the relevant shot, light, or type reference.
- Runtime adaptation → `3d-runtime-quality/SKILL.md` plus tier matrix and only then the adaptive controller.
- WebGPU feature → `shaders-tsl/SKILL.md` plus `shaders-tsl/references/webgpu-feature-matrix.md`.
- Simple CSS hover → `motion-system/SKILL.md`; no GSAP or Motion reference.
- Procedural geometry that must be generated from parameters → `procedural-3d/SKILL.md` before `3d-asset-pipeline`; ordinary imported GLB inspection, validation, or optimization alone does not activate it.
- Authored physical material response or reflection-environment tier → `material-lookdev/SKILL.md`; a standard-material color alone does not activate it.
- 3D hero on a normal page → the three mandatory 3D skills only. The
  procedural-3d, canvas-first, render-graph, loading, audio, gpu-particle, and material-lookdev add-ons stay unread, and the ordinary 3D forward cases forbid all seven files.
- The canvas owns the page → `canvas-first-architecture/SKILL.md` plus
  `canvas-first-architecture/references/parallel-dom-layer.md`; a hero above a DOM page never reaches it.
- One bloom → `r3f-patterns`; a chain whose passes read each other →
  `render-graph/SKILL.md` plus only the catalogue or the buffer reference.
- One model behind Suspense → `r3f-patterns`; a staged manifest with an
  art-directed arrival → `loading-choreography/SKILL.md`.
- Sound named in the brief → `spatial-audio/SKILL.md`; a scene that merely could
  have sound does not load it.
- A hand-written `useFrame` damp → `motion-system/references/frame-rate-independence.md`;
  a GSAP or Motion tween is already time-based and does not.

Do not preload all design skills or all references.

Cross-skill mentions are selection pointers, not transitive dependencies. The
router decides a task gate before reading a child; a child does not recursively
reload its owner or sibling references.

The live forward suite audits this from provider events. It extracts actual
Claude `Read`/`Skill` calls or Codex command reads, rejects broad content scans,
enforces per-case allowed files and reference/token budgets, and fails when a
self-reported skill lacks read evidence. The dashboard contract requires
`neutral-product.md` while forbidding the editorial and expressive palette
families. Only a passing live attempt establishes that result for its exact
provider, case, and tree.
