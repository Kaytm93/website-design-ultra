# ADR-011: Keep immersive production sources outside the installed plugin tree

- **Status:** Accepted for implementation
- **Date:** 2026-08-24
- **Baseline:** website-design-ultra 1.9.1 (`b5474cc`)
- **Decision owner:** Immersive Production Layer proposal

## Context

Marketplace installation copies `website-design-ultra/` as the plugin payload.
The proposed starter, shader/particle lab, implementation fixtures, and browser
artifacts have lockfiles, generated assets, and browser dependencies that would
multiply the installed size without being needed by normal skill routing.
Keeping those sources in a second repository would avoid payload growth, but it
would also allow the executable examples and the skills that describe them to
version independently and drift without a failing check in either repository.

## Decision

Adopt **Option A: one repository with a bounded plugin subdirectory**.

The distribution boundary is:

```text
website-design-ultra/       # the only marketplace-installed plugin payload
starters/                   # root-only, executable starter projects
lab/                        # root-only, shader and particle experiments
tests/immersive/            # root-only, buildable implementation evaluations
automation/                 # root-only, fresh-agent queue and driver
```

The exact root-only directories may land incrementally, but they must never be
moved under `website-design-ultra/`. Marketplace manifests continue to point at
`website-design-ultra/`, and skills reference root-only artifacts by repository
path plus a repository version or tag rather than importing a sibling runtime
package.

CI must continue to run strict plugin validation against both the repository root
and `website-design-ultra/`. It must also prove that the installed payload does
not contain starter lockfiles, lab dependencies, implementation fixtures, or
generated browser artifacts. Root-only projects may have independent lockfiles;
none may become an implicit runtime dependency of a copied skill.

## Consequences

- Skills, starter code, labs, and evaluations advance in one commit graph, so a
  compatibility change can fail in the same pull request that introduced it.
- Marketplace users keep the compact plugin payload.
- Repository contributors carry the larger development tree and CI cost.
- A reusable mechanism such as the quality controller remains a copied,
  zero-dependency reference until two unrelated consumers justify packaging it.
- Root and plugin validation are separate release gates. Passing one never
  implies the other passed.

## Rejected alternative

A second `website-design-ultra-starters` repository is rejected for the first
implementation because version skew would be silent. Reconsider only if the
root-only development assets create a demonstrated repository-size or release
ownership problem that cannot be solved with sparse checkout, Git LFS, or
artifact retention rules.
