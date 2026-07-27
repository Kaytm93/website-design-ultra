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

A merely existing path or package name is not enough. When the adapter reports
`UNAVAILABLE` but the host provides real browser automation, run the same state
matrix with that host tool. This applies in particular to Claude Cowork: use its
browser capability directly instead of imitating a Codex path.

## 3. Deterministic capture

- Wait for fonts, critical images/models, and an app-specific ready marker when one exists.
- Check the semantic snapshot structure before interacting.
- Do not wait with arbitrary long sleeps; use ready signals and at most one short stabilization beat.
- Do not disable animation globally in the desktop shot. Reduced motion is emulated separately.
- Photograph full page, and for 3D additionally the hero/viewer inside the visible viewport.

With a compatible CLI:

```bash
node "<plugin-root>/scripts/verify-browser.mjs" \
  --url "$VERIFY_URL" \
  --out "$VERIFY_OUT"
```

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

`UNAVAILABLE` is permitted only when both the capability-checked adapter and a
host browser capability are missing, or the target is externally unreachable.
Document the probe output, URL, expected states, and the manual capture
assignment. Additionally run build/typecheck and static fallback/DOM/reduced-motion
checks, but never call them a visual substitute and never report `PASS`. The
implementation may be handed over as **unverified**; a release/launch gate stays
open until a real browser run.
