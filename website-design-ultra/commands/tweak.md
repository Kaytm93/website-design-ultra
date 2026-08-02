---
description: Changes one existing component without loading the full design stack. For scoped edits where direction, palette, and pattern are already decided.
---

# /tweak

You will change one existing component. Direction, palette, type, and pattern are
already decided somewhere in the project; this command exists so a scoped edit
does not pay for a full page briefing.

## When /tweak, and when not

Use it when all four hold:

- exactly one component or one section is touched,
- the existing file or design system already fixes direction, palette, and type,
- at most three user-visible text surfaces change,
- no async, validation, or mutation state appears that was not there before.

If any one fails, use `/design`. A new section, a changed direction, or a fourth
changed string is not a tweak, and treating it as one is how a scoped edit turns
into an unreviewed redesign.

## Workflow

1. **Read the component and its tokens.** Nothing else. If it imports a token
   file, read that file; do not walk the design system.

2. **Load `core-rules` and check §1, §4, and §7.** Invariants apply at every
   size. The §3 routing table does not fire here, because this command has
   already made the routing decision.

3. **Skip by default:** `style-directions`, `color-palettes`, and
   `component-patterns`. Each answers a page-level question the existing
   component already answers. Load exactly one when the tweak is about that
   decision, and say which.

4. **Copy.** With at most three changed text surfaces, run the linter instead of
   reading the tell catalogue:

   ```bash
   node scripts/lint-copy.mjs --path <file> --profile marketing
   ```

   This is a shift from reading to execution, not a relaxed standard: the linter
   fires 12 of the 16 English Tier-1 tells and both Tier-3 gates deterministically
   and with rule ids. It does not cover the four tells that carry no id (the
   fake-profound kicker, both-sides hedging, synonym cycling, invented concept
   labels) or the specificity floor. So a changed H1, hero subhead, or feature
   blurb loads `anti-slop` and its prose reference as usual, and a label, tooltip,
   or state message does not. Exit code 2 is `NO-COPY`, never a pass.

5. **States and motion.** Load `ui-states` only when a state appears that did not
   exist before. Load `motion-system` only when timing changes; otherwise reuse
   the component's existing profile and timing owner.

## Output

- one sentence: what changed and why,
- the changed file, complete rather than as a diff,
- the lint command and its exit status,
- what this command deliberately did not check.

## Never

- Redirect global tokens to fix one component.
- Add a second motion timing owner inside the subtree.
- Report a copy pass without the linter's exit code.
- Let the scope grow silently. A tweak that becomes a section is a `/design`.
