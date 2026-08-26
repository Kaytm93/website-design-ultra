# Immersive implementation evaluation (IP-07B)

The first buildable implementation evaluation, per `TODO.md` T1.4 and
`QUEUE.md` `IP-07B`: a runner that asserts the ten evaluation gates against
a buildable fixture — build, runtime, keyboard, mobile, reduced motion,
fallback, interaction checkpoints, and the three telemetry budget gates
(warm GPU frame time, first meaningful frame, transfer before that frame) —
with every assertion linked to real browser evidence.

This directory is root-only by `docs/adr/ADR-011` and stays separate from
the forward routing suite (`website-design-ultra/scripts/run-forward-tests
.mjs`): that suite proves routing; this runner proves that a generated
implementation installs, builds, serves, renders, survives a pointer, and
reports its declared budget.

## Layout

```text
tests/immersive/evaluation/
├── run-implementation-evaluation.mjs   # the runner (the deliverable)
├── evaluation.test.mjs                 # offline unit tests of the gate surface
├── fixtures/
│   ├── common/                         # shared static fixture plumbing
│   │   ├── telemetry-surface.js        #   IP-03 surface with injectable defect
│   │   └── interaction-surface.js      #   pointer/focus/press/context state
│   ├── build-fail/                     # minimal Next app with a broken import
│   ├── runtime-console-error/          # a console error on load
│   ├── failed-resource/                # a script that 404s
│   ├── shader-error/                   # a fragment shader that cannot compile
│   ├── keyboard-fail/                  # Tab can never reach the declared target
│   ├── interaction-fail/               # the hover contract never reports hover
│   ├── mobile-fail/                    # the scene vanishes under the mobile width
│   ├── reduced-motion-fail/            # motion that ignores prefers-reduced-motion
│   ├── fallback-fail/                  # the declared poster fallback is not served
│   ├── telemetry-warm-gpu-fail/        # 40 ms warm frame time vs 16.7 ms budget
│   ├── telemetry-first-frame-fail/     # 9000 ms first frame vs 5000 ms budget
│   └── telemetry-transfer-fail/        # 1024-byte budget vs real page transfer
```

The green fixture is `tests/immersive/product-hero/` (IP-07A), which
declares its surfaces in `fixture.json` and its interaction checkpoints in
`lib/interaction-checkpoints.json`.

## Running

```bash
# The green product hero plus every deliberate failing fixture.
node tests/immersive/evaluation/run-implementation-evaluation.mjs \
  --fixture all --out /tmp/wdu-evaluation

# One fixture only.
node tests/immersive/evaluation/run-implementation-evaluation.mjs \
  --fixture product-hero --out /tmp/wdu-evaluation
```

The runner serves each fixture deterministically, drives the plugin
verifier (`website-design-ultra/scripts/verify-browser.mjs`) in standard
and checkpoint modes, and writes per fixture:

- `capture-standard/` — the desktop/mobile/reduced/fallback matrix plus
  `performance-summary.json` and `console-errors.txt`;
- `capture-reduced-motion/` and `capture-portrait/` — the next-app server
  states (`WDU_REDUCED_MOTION=1`, `WDU_STATION=hero-portrait`);
- `checkpoints/` — the declared interaction checkpoint captures;
- `gates/build.log` — the exact-lockfile install and build output;
- `evaluation.json` — the structured result: per-gate status, linked
  evidence paths, duration and cost statement.

Exit codes: 0 = every fixture matched its declaration, 1 = expectation
mismatch, 2 = an applicable gate was UNAVAILABLE.

## Gate contract

- **Build** — `npm ci` (exact lockfile) and `npm run build` must exit 0 and
  produce the declared evidence file.
- **Runtime** — the standard capture must produce the full artifact set, a
  first meaningful frame (the ready marker fired), a clean browser console,
  and an empty failure-evidence block. A missing capture fails the gate
  even when the build passed; a failed build produces no capture gates at
  all (`NOT_APPLICABLE`), never PASS.
- **Keyboard** — every declared keyboard checkpoint must capture, and the
  keyboard peak must wait for the identical declared outcome state as the
  pointer click peak (IP-06B).
- **Mobile** — the mobile captures must exist (and the portrait reframe
  must resolve its declared station when one is declared).
- **Reduced motion** — the reduced captures must exist; when the fixture
  declares a static reduced pair, the two frames must be byte-identical
  (motion stopped); a next-app server must resolve
  `data-wdu-motion="reduced"`.
- **Fallback** — the WebGL-blocked capture must exist; declared poster
  fallback assets must be served; a declared canvas-free fallback must not
  contain a hero canvas.
- **Interaction checkpoints** — every declared checkpoint except the
  keyboard group must capture, and touch checkpoints must record a touch
  input method.
- **Telemetry gates** — each of the three budget gates maps through
  `performance-summary.json`; over-budget observations FAIL, missing
  measurements are UNAVAILABLE, never PASS.

Failed resources, console errors, and shader errors fail the runtime case —
that is the acceptance line `IP-07B` exists to prove, and the
`runtime-console-error`, `failed-resource`, and `shader-error` fixtures
demonstrate it live.

## Cost

The runner states duration per phase (install, build, standard capture,
reduced capture, portrait capture, checkpoint capture, evaluation) and
declares `externalServices: "none"`: it uses only the local browser CLI
(the same `@playwright/cli` capability the plugin verifier probes) and no
paid or external service.

## Offline unit tests

```bash
node --test tests/immersive/evaluation/evaluation.test.mjs
```

These exercise the pure gate surface against synthetic artifact trees: the
missing-capture-vs-build-pass rule, console/resource/shader/context-loss
failure propagation, per-gate evidence rules, telemetry mapping, and
expectation matching (a deliberate failing fixture that passes is a
mismatch, and UNAVAILABLE is never met).

## CI wiring (IP-07C)

`.github/workflows/validate.yml` runs this suite live in the
`immersive-evaluation` job on `ubuntu-latest` and archives its evidence.
The job never silently skips: browser or GPU unavailability marks the suite
UNAVAILABLE, prints the exact reason, and blocks release readiness by
failing the workflow run.

### Capability probe and status handling

Before any capture, the job runs the plugin verifier's capability probe
(`website-design-ultra/scripts/verify-browser.mjs --probe`) and fails with an
explicit message when it reports unavailable. The probe decides the suite
status up front — a missing browser CLI cannot become a pass further down the
job. This is the ADR-010 contract: browser or GPU unavailability is
`UNAVAILABLE`, never `PASS`, never a silent skip, and it prevents release
readiness because the job fails the run (exit code 2 from the runner is
handled identically).

### Caching

The job caches what its installs and downloads need:

- npm's shared cache (`~/.npm`) for the fixture's exact-lockfile install;
- the Playwright CLI package and its browser binaries under the Linux cache
  directory (`~/.cache/ms-playwright`), keyed on the runner OS plus the exact
  browser version strings pinned in the workflow env block. When a version
  changes, the key misses and fresh binaries install.

### Artifacts

Every run archives the full evidence set under one artifact named
`immersive-evaluation`, retention 30 days, with `if-no-files-found: error`
so an empty set can never pass silently:

- `<out>/<fixture>/capture-standard/` — the desktop/mobile/reduced/fallback
  matrix plus `performance-summary.json` and `console-errors.txt`;
- `<out>/<fixture>/checkpoints/` — the interaction checkpoint captures;
- `<out>/<fixture>/gates/build.log` — the exact-lockfile install/build log;
- `<out>/<fixture>/evaluation.json` — the structured per-fixture result;
- `<out>/evaluation.json` — the top-level suite summary (status,
  per-fixture gate map, durationMs, externalServices).

The archived live artifact set is the release-readiness evidence manual
release gate 6 asks to inspect before merging ("declared unavailable
capabilities"), and gate 2 names it for Tier 1: 1.11 is cut only after PR 7
is merged with every T1.1–T1.4 acceptance gate evidenced.

### Reproducing locally

```bash
node tests/immersive/evaluation/run-implementation-evaluation.mjs \
  --fixture all --out /tmp/wdu-evaluation
```

The same command produces the same evidence shape locally and in CI; the
runner requires a clean source state before and after the run.

## Browser unavailability

Browser or GPU unavailability is `UNAVAILABLE`, never `PASS` (ADR-010), and
leaves the fixture's status UNAVAILABLE with exit code 2; a required
unavailable acceptance gate keeps the queue item unchecked.
