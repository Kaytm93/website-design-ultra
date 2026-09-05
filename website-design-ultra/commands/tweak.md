---
description: Changes one existing component without loading the full design stack. For scoped edits where direction, palette, and pattern are already decided.
---

# /tweak

Change one existing component using its established direction, palette, type and pattern.

## When /tweak, and when not

Use it when all four hold:

- exactly one component or one section is touched,
- the existing file or design system already fixes direction, palette, and type,
- at most three user-visible text surfaces change,
- no async, validation, or mutation state appears that was not there before.

If any condition fails, use `/design` and state the scope change.

## Workflow

1. **Read the component and its tokens.** Nothing else. If it imports a token
   file, read that file; do not walk the design system.

2. **Use `core-rules` §4 and §7 once.** This command selects the scoped-tweak
   task class; skip the page profile and page routing. Reuse already-read rules.

3. **Conditional choices:** Load `style-directions`, `color-palettes` or
   `component-patterns` only if that exact decision changes.

4. **Copy.** For up to three changed text surfaces, run the bundled linter.
   Resolve its path from this plugin, not the project being linted:

   ```bash
   node "<plugin-root>/scripts/lint-copy.mjs" --path <file> --profile marketing
   ```

   Use the marketing register for changed UI copy regardless of file type.

   The linter covers 12 of 16 English Tier-1 tells and both Tier-3 gates;
   four uncodified tells and the specificity floor need a reader. A changed H1,
   hero subhead or feature blurb therefore loads `anti-slop` and its prose
   reference; labels, tooltips and state messages use the linter. Exit code 2
   is `NO-COPY`, never a pass.

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
