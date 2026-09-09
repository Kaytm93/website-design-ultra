# Website Design Ultra

Website and 3D design skills for Codex and Claude Code. The plugin contains
26 skills, six Claude commands, a copy linter, runtime templates and browser
verification tools. The version lives in the
[plugin manifest](website-design-ultra/.codex-plugin/plugin.json).

The 2.1 release is in preparation. Its repeated live-model acceptance remains
open; a green build alone does not complete it. See the
[implementation queue](automation/website-design-ultra-2.1-2.3/QUEUE.md).

German setup and project export: [Startanleitung](docs/QUICKSTART.de.md).

Create an independent starter without copying build output:

```bash
npm run create -- --starter next --out ../my-site
# or: --starter vanilla
```

Repository checks: `npm ci`, `npm run setup`, then `npm run verify`.

## Install

Codex CLI:

```bash
codex plugin marketplace add Kaytm93/website-design-ultra --ref main
codex plugin add website-design-ultra@kay-design
```

Claude Code, inside a session:

```text
/plugin marketplace add Kaytm93/website-design-ultra
/plugin install website-design-ultra@kay-design
```

Use a new session after an update. `main` receives development changes; check
the [releases](https://github.com/Kaytm93/website-design-ultra/releases) for a
published version. The installed payload is `website-design-ultra/`; starters
and the lab remain in the repository. Detailed routing and maintenance:
[plugin guide](website-design-ultra/README.md).

## A 2D project

Open the website project and provide its actual content and brand assets:

> Use Website Design Ultra to build a responsive landing page for this offer.
> Use the existing content and brand assets, with one primary action. Check
> desktop, mobile, keyboard operation and reduced motion. Mark unknown claims.

For a small existing-component edit, use the plugin's tweak workflow. In Claude
Code this is `/website-design-ultra:tweak`; in Codex ask for the scoped tweak
in ordinary language. A changed button label does not need a new page direction.

## A 3D project

Start with a concrete reason for depth and state the available assets:

> Use Website Design Ultra for a 3D product hero explaining the three hinge
> positions of a modular desk lamp. Only those positions and a replaceable
> shade are verified. Provide desktop and portrait composition, keyboard
> access, reduced motion, a poster fallback and measured performance gates.

To run the existing scaffold, use Node >=22.18 and a checkout at the commit or
release tag matching the chosen plugin source:

```bash
git clone https://github.com/Kaytm93/website-design-ultra.git
cd website-design-ultra
# Choose the reviewed release tag or commit before copying the starter.
git checkout <reviewed-tag-or-commit>
cd starters/next-r3f-cinematic
npm ci
npm run verify
npm run dev
```

The [starter guide](starters/next-r3f-cinematic/README.md) documents capture flags,
interaction checkpoints and quality ownership. Both starters ship seeded crystal geometry and scene posters. Further reference
scenes remain tracked in the implementation queue.

## Check the result

From a source checkout:

```bash
node website-design-ultra/scripts/validate-content.mjs
node website-design-ultra/scripts/run-forward-tests.mjs --dry-run
node website-design-ultra/scripts/verify-browser.mjs --probe
```

The dry run validates contracts and replays historical traces. Current model
behavior needs an authenticated provider and recorded live runs. Browser/GPU
`UNAVAILABLE` is unverified and keeps the corresponding gate open.

[CI and implementation evidence](automation/immersive-production-v2/IP-11D-EVIDENCE.md)
records the tested commit and run. Image quality still requires visual review.
