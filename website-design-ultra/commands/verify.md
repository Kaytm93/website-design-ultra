---
description: Renders a real local or deployed website, photographs desktop, mobile, reduced motion, and the 3D fallback, and compares the states visually.
argument-hint: [URL or project path, optionally a route]
---

# /verify

Verify the running website in a real browser. Never replace visual inspection with code reading alone or with a successful build.

## 1. Target and server

1. Determine URL/route from the argument.
2. If a project path was passed: read `package.json`, determine the existing start/preview command, and run it without inventing script names.
3. Use a free local port and capture server logs.
4. Wait for a successful HTTP response; a running process alone does not count as ready.
5. Change application code only when the user additionally asks for a fix.

## 2. Capability gate — host independent

Slash commands and a Codex skill path are not a runtime dependency. Determine the
plugin root of this command file and check the bundled adapter first:

```bash
node "<plugin-root>/scripts/verify-browser.mjs" --probe
```

The adapter accepts a browser CLI only when the capability probe actually proves
named sessions, `run-code`, and screenshots. It tries in this order:

1. the explicit executable from `WDU_PLAYWRIGHT_CLI`,
2. an existing, compatible Codex wrapper,
3. `playwright-cli` from `PATH`,
4. `npx --yes --package @playwright/cli@0.1.17 playwright-cli`.

A merely existing path or package name is not enough. When the adapter has no
usable backend but the host provides real browser automation, run the same
state matrix with that host tool. This applies in particular to Claude Cowork: use its
browser capability directly instead of imitating a Codex path.

## 3. Deterministic capture

- For a runnable scene that needs reproducible dynamic capture, read
  `skills/core-rules/references/determinism.md`. Start a local target with
  `WDU_DETERMINISTIC=1` passed to its existing start/preview command. For a
  deployed target, use only its documented capture entry point; do not invent a
  query switch.
- Select a declared camera station by id before scene initialization. Do not drag,
  scroll, or restore browser state to approximate the shot.
- Wait for fonts and critical images/models. Under the deterministic contract,
  additionally wait for `html[data-wdu-ready="true"]`; it means the rendered
  result is the first stable frame.
- A timeout only bounds the wait. It never makes the target ready. If the marker
  does not appear during a requested deterministic run, report `FAIL` rather than
  sleeping and taking an unstable image.
- For a target outside the deterministic contract, use its real application
  readiness signals and report the capture as nondeterministic. Do not add an
  arbitrary stabilization delay.
- Check the semantic snapshot structure before interacting.
- Do not disable animation globally in the desktop shot. Reduced motion is emulated separately.
- Photograph full page, and for 3D additionally the hero/viewer inside the visible viewport.

With a compatible CLI:

```bash
node "<plugin-root>/scripts/verify-browser.mjs" \
  --url "$VERIFY_URL" \
  --out "$VERIFY_OUT"
```

For a telemetry-enabled target, inspect `performance-summary.json` before
calling the capture complete. Its top-level `status` is the launch-gate result;
`comparison.status` is only the three declared budget gates. Require browser,
GPU, and telemetry capabilities to be `AVAILABLE`, and inspect
`failureEvidence.resourceFailures`, `failureEvidence.shaderCompileErrors`,
`failureEvidence.longFrames`, and `failureEvidence.contextLoss`. A resource or
shader failure, runtime error, or context-loss event is `FAIL`; a missing
capability or required measurement is `UNAVAILABLE`. The adapter exits 1 for
`FAIL` and 2 for `UNAVAILABLE`, and writes a non-empty summary before reporting
an unavailable browser or telemetry surface.

For declared interaction checkpoints, use checkpoint capture mode. Read
`core-rules/references/determinism.md` section 7 and the manifest schema
`core-rules/references/interaction-checkpoints.schema.json`, then pass the
project's manifest:

```bash
node "<plugin-root>/scripts/verify-browser.mjs" \
  --url "$VERIFY_URL" \
  --checkpoints "$PROJECT/interaction-checkpoints.json" \
  --out "$VERIFY_OUT"
```

The mode captures every declared checkpoint under deterministic mode into
`checkpoints/<checkpoint-id>.png`, writes timestamp-free metadata
(`checkpoints.json`) and a status summary (`checkpoints-summary.json`), and
exits 1 on any failed checkpoint and 2 when deterministic mode is not
resolved. The standard matrix and telemetry summary are skipped in this mode.
The manifest is the project's declaration: do not add, rename, or invent
checkpoints in the script.

When a committed baseline capture set exists, compare the new run offline
instead of judging pixels by eye. Read `core-rules/references/determinism.md`
section 8 and `core-rules/references/baseline-comparison.schema.json`, then
run the comparator that ships with this plugin, with the two capture-set
directories:

```bash
node <plugin-root>/templates/runtime/compare-baselines.mjs \
  --baseline "$BASELINE_RUN" \
  --candidate "$VERIFY_OUT" \
  --declaration "$PROJECT/baseline-comparison.json" \
  --out "$COMPARE_OUT"
```

The comparator classifies every difference into structural regression,
perceptual difference, expected dynamic variation, or nondeterministic
content; a deterministic mismatch outside every declared mask stays a
perceptual difference. It refuses to run (exit 2) when either side lacks
deterministic capture metadata, and its `comparison.json` names every
mask/tolerance and its source and labels every score as evidence, never an
aesthetic verdict, taste, or approval. A score is never approval: report it
as evidence and decide on the product outcome separately.

The comparator reads its declaration contract from the sibling
`templates/runtime/baseline-comparison.ts`, so it needs a Node that strips
TypeScript types: Node 23 and newer run it as written, Node 22 needs
`--experimental-strip-types`. Nothing else is required — no install, no
repository checkout.

The adapter closes sessions even after failures. With a host tool, produce the
same named artifacts:

| State | Viewport/setup | Files |
|---|---|---|
| Desktop | 1440×1000, normal motion | `desktop-full.png`, `desktop-hero.png` |
| Mobile | 390×844 or a project-relevant device | `mobile-full.png`, `mobile-hero.png` |
| Reduced Motion | Desktop, `reducedMotion: reduce`, two captures 750 ms apart | `reduced-motion-a.png`, `reduced-motion-b.png` |
| Fallback | Disable WebGPU/WebGL/WebGL2 before reload | `fallback-full.png`, `fallback-hero.png` |

Close sessions and the server after the capture.

## 4. Visual comparison

Open and actually inspect every image. Compare:

- Desktop: hierarchy, crop, overlap, readable typography, canvas/DOM alignment, loading/error artifacts.
- Mobile: real recomposition instead of a shrunken desktop, no horizontal overflow, CTA and touch targets visible.
- Reduced Motion A/B: no nonessential movement between the two images; content, state, and focus path stay intact.
- Fallback: poster instead of an empty canvas; headline, claim, CTA, selection state, and alternative description stay in the DOM.
- Across states: the same visual thesis, material/tonal character, and content priority.

When a baseline with the same filenames exists, additionally compare state against baseline. Report differences as intended, regression, or unclear; do not claim pixel equality without a real diff tool.

Then check console warnings/errors and failed requests. A beautiful image with runtime errors does not pass.

## 5. Result and degradation path

```text
VERIFY: PASS | FAIL | UNAVAILABLE
URL / commit:
Artifact folder:
Backend:
Telemetry summary status:

Desktop:
Mobile:
Reduced Motion:
Fallback:
Console/Network:

Regressions:
- [Severity] Observation — artifact name

Next concrete fix:
```

FAIL on an empty canvas/fallback, an obscured primary CTA, mobile overflow, a missing DOM alternative, active nonessential reduced-motion movement, or runtime errors that damage the experience.

The four status values and what each one obliges are defined in
`core-rules/references/verification-status.md`. Two things this command adds:
when the adapter has no usable browser backend but the host provides real
host browser automation, run the same state matrix with that host tool instead
of degrading; and for a missing GPU or telemetry surface, document the capability
evidence in the report.
