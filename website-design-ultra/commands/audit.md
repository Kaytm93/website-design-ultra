---
description: Audits existing code and design for anti-slop violations, motion gaps, missing UI states, 3D problems, and accessibility issues.
---

# /audit

You will audit existing frontend code for quality.

## Workflow

1. **Establish scope** — Which path, which file(s)? If unclear: ask.

2. **Reconnaissance**:
   - Stack check (`package.json`)
   - Existing system (`tokens.css`, `DESIGN.md`, existing CSS vars)
   - Motion-gap search:
     ```bash
     rg -n "\{.*(&&|\?).*<" --glob '*.{tsx,jsx}' .
     ```
   - Copy slop, deterministic — run this before reading copy by hand:
     ```bash
     node "<plugin-root>/scripts/lint-copy.mjs" --path src --profile marketing
     node "<plugin-root>/scripts/lint-copy.mjs" --path src --locale de   # explicit override
     ```
     Locale is detected per file when the flag is omitted. Report the resolved
     locale and every auto-detection warning together with the tier counts and
     measured numbers. A `PASS` means no
     catalogued pattern was found; it is not a content approval. If the project
     ships a `.anti-slop-protect.json`, pass it with `--protect` and report any
     entry that was ignored for missing a reason.
   - Visual slop, measured:
     ```bash
     rg -n "\[[0-9]+px\]|p-\[|gap-\[|mt-\[" --glob '*.{tsx,jsx,css}' .   # off-scale spacing
     rg -n "rounded-2xl shadow-lg|border-l-4|border-t-4" --glob '*.{tsx,jsx}' .
     ```
   - Banned-pattern search:
     ```bash
     rg -n "h-screen|w-\[calc|transition:\s*all" --glob '*.{tsx,jsx,css}' .
     # Check hits instead of reporting blindly: body Inter is allowed in Brutalist,
     # Editorial, Swiss, and Magazine-Tech — only Inter as display/hero is banned.
     rg -n "font-inter|Inter" --glob '*.{tsx,jsx,css}' .
     ```
   - Is 3D present?
     ```bash
     rg -l "useFrame|<Canvas" --glob '*.{tsx,jsx}' .
     rg -n "onPointerOver|onPointerDown|onClick" --glob '*.{tsx,jsx}' .   # clickable 3D?
     rg -n "setPointerCapture|pointercancel|lostpointercapture|touch-action|touchAction" --glob '*.{ts,tsx,js,jsx,css}' .
     rg -n "dynamic\(.*ssr:\s*false|from ['\"]framer-motion|MathUtils\.lerp\(.*0\.[0-9]" --glob '*.{ts,tsx,js,jsx}' .
     ```

3. **Audit by layer** — Load skills, check against:
   - `core-rules` → invariants, justified defaults/exceptions, performance, stack
   - `content-design` → claim sources, strength of evidence, CTA/state copy and localization risks, when copy is in scope
   - `anti-slop` → tier findings from the linter plus the tells a regex cannot
     see: fake-profound kickers, synonym cycling, category headlines that pass
     the swap test by accident. Load the design reference only when the audit
     covers visuals, and the locale annex only for non-English copy. Run the
     squint test on the `/verify` screenshots before judging hierarchy.
   - `motion-system` → only when motion exists: timing owner, cleanup, runtime, reduced motion
   - `ui-states` → only with data/interaction: applicable states and accessibility
   - `color-palettes` → semantic tokens and calculated contrast
   - `typography` → font bans **including exceptions** (body Inter allowed in Brutalist/Editorial/Swiss/Magazine-Tech)
   - Responsive recomposition reference from `core-rules` → real wide/portrait/narrow priority instead of mere scaling

   Only when 3D appears in the code, additionally:
   - `immersive-3d` → anti-slop 3D (§4), perf budget respected (§3), mandatory fallbacks present (§5)
   - `3d-art-direction` → explicit camera/FOV, light/material hierarchy, tone mapping, portrait reframe, poster, and DOM typography
   - `3d-runtime-quality` → four tiers, one quality owner, hysteresis, pause, adaptive shadows/LOD/PostFX/particles/DPR
   - `r3f-patterns` → version matrix, `useFrame`+`delta`, asset lifecycle, correct Next client boundary
   - `r3f-interaction` → **keyboard parity (§2)**, drag/pinch/touch-action/cancellation, `stopPropagation`, `<Bvh>`/`raycast={null}`, only one camera source
   - `shaders-tsl` → for WebGPU, check every feature against WebGPU, WebGL2 fallback, TSL PostFX, compute, and limitations

4. **Output format**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUDIT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 [X] Critical  🟡 [X] Important  🟢 [X] Opportunities
Designer bias inferred: [Emil/Jakub/Jhey] ([reason])
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall Assessment:
[1 paragraph: does this read as polished? Too much? Too little?]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✗ [Issue] — `file.tsx:line`
  [What is wrong, what it should be]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟡 IMPORTANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✗ [Issue] — `file.tsx:line`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 OPPORTUNITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

→ [Suggestion] — `file.tsx:line`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S WORKING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ [Observation] — `file.tsx:line`
```

A missing keyboard equivalent for canvas interaction is always 🔴 Critical — it is invisible when testing with a mouse. An empty canvas fallback, or a touch surface that unintentionally blocks page scrolling, is also 🔴 Critical.

## Never

- Blanket verdicts such as "this is badly designed"
- Change code without the user explicitly asking
- More than 10 issues at once — prioritize, prefer a very concrete top 5
- Report an Inter hit without checking whether it is body or display
- Report a single Tier-2 word as a finding; vocabulary counts as a cluster or in
  a heading, and `robust` in a reliability claim is the correct word
- Report a lint `PASS` as proof that the copy is true or specific
