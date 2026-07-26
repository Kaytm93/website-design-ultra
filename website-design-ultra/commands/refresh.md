---
description: Refreshes an existing design into a new aesthetic direction. Keeps functionality, changes look and feel completely.
---

# /refresh

You will refresh existing frontend into a new direction. Functionality stays, the aesthetic is rebuilt.

## Workflow

1. **Scope** — Which file(s)? Which new direction does the user want?
   - If the user names a direction (e.g. "make it brutalist"): apply it directly
   - If the user names no direction: offer 3 proposals from `style-directions` and let the user choose

2. **Load only the relevant skills/references**:
   - `style-directions` — the chosen direction family
   - `content-design` — when hierarchy, claims, CTA, state, or locale copy changes
   - `color-palettes` — only when color tokens change
   - `typography` — only when typography changes
   - `motion-system` — only when the motion profile changes
   - `component-patterns` — only for patterns actually being replaced
   - `ui-states` — only for affected data/interaction-dependent components
   - Responsive recomposition reference from `core-rules` — when signature sections or viewport priorities change
   - For 3D: `immersive-3d`, `3d-art-direction`, `3d-runtime-quality` plus only the affected implementation skills

3. **Refresh strategy**:
   - **Redirect CSS variables** instead of rewriting components (when they exist)
   - **Swap the hero completely** (otherwise the old direction stays visible)
   - **Exchange the motion profile** (Emil style → Jhey style feels different even without layout changes)
   - **Review defaults deliberately** — respect invariants; stylistic defaults may be overridden with justification by the new direction. Body Inter stays possible in the documented contexts.
   - **Preserve content truth** — do not "creatively" change claims, prices, names, or capabilities; mark unknown facts.
   - **Recompose for mobile** — redefine focus, order, media/crop, CTA, density, and interaction for narrow/portrait.

4. **Before/after diff**:
   - What stays? (functionality, data structure, states)
   - What changes? (palette, type, motion profile, hero variant, card style)
   - What must be installed? (`npm install …`)

5. **Output**:
   - One sentence: old direction → new direction + reason
   - Changed files (complete, not just diffs — otherwise copy-paste breaks)
   - Customization hooks in case the user wants to fine-tune

## When NOT /refresh, but /design?

- When the existing code is so fragmented that patching would cost more than rewriting
- When the user says "completely new page" — then use /design

## Never

- Switch direction mid-refresh
- Mix multiple directions in the output
- Change functionality without mentioning it
- Lose fallbacks or keyboard parity when refreshing a 3D scene (`immersive-3d` §5, `r3f-interaction` §2)
- Merely scale down the desktop camera instead of composing a new portrait shot (`3d-art-direction`)
- Add quality switches without a shared owner or hysteresis (`3d-runtime-quality`)
