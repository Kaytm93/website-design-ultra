# aurora-cinematic

A real starter copy fixture for the website-design-ultra root-surface
self-lint. It stands in for the executable starters ADR-011 keeps outside the
installed plugin tree, so the regression suite can prove that starter copy is
linted without building a full Next.js tree.

## What the fixture proves

- The copy surfaces are discovered from the starter root.
- The lint runs with the default register split: shipped page copy under
  `app/` and `components/`, this README in the docs register.
- Generated and vendor output (`next-env.d.ts`, `dist/`) stays excluded and
  never enters the report.
- Placeholder copy in the sibling fixture fails the placeholder gate.

The `dist/` directory and `next-env.d.ts` in this fixture are bait: they hold
copy-shaped text that must never be read by the lint.
