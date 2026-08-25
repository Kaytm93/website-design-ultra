# Reproducible reference intake

This directory is root-only automation. It validates and, optionally, prepares
reference artifacts without becoming part of the installed
`website-design-ultra/` plugin payload.

## Required offline path

The required path is a directory that can be archived, reviewed, and validated
with no design-tool connection:

1. Export six to ten distinct reference frames. Keep at least one PNG and one
   SVG in the set; do not convert one file twice merely to satisfy the formats.
2. Write the project-supplied design decisions to a separate written token block
   named `tokens.json`. This is a design-token artifact, not an authentication
   token.
3. Create `reference-intake.json` using
   `tests/immersive/reference-intake/fixtures/reference-intake.valid.json` as the
   executable shape and
   `website-design-ultra/skills/reference-intake/templates/reference-intake.md`
   as the human review shape.
4. Record each export as `frame-01` through `frame-10`, its repo-relative path,
   format, SHA-256, dimensions or SVG view box, viewport, role, and provenance.
5. Fill all sixteen trace rows. A supported value cites one manifest frame. If
   pixels do not support a value, keep both `value` and `sourceFrame` as
   `unknown`; a direction name or token value is not visual evidence.
6. Produce the concrete PNG or SVG poster target before changing
   `sceneCodeStatus` to `ready-for-3d-art-direction`.
7. Run the validator from the repository root:

```bash
node automation/reference-intake/validate-reference-intake.mjs \
  path/to/reference-intake.json
```

The validator is zero-dependency and offline. It reads file signatures, PNG
IHDR dimensions, SVG view boxes, hashes, the design-token block, the complete
trace ledger, and the poster target. Paths and symlinks may not escape the
intake directory. It rejects duplicate exports, credential-bearing token files,
and any observed value whose evidence is missing. Its timestamp-free JSON
summary lists the fields that correctly remain unknown.

Run the committed valid and invalid fixtures with:

```bash
node --test tests/immersive/reference-intake/reference-intake.test.mjs
```

The required path needs no paid seat, Dev Mode, MCP, browser login, or live Figma session.
It also needs no personal access token or network access. Manually exported
files from any authorized source are sufficient.

## Optional Figma REST acceleration

`export-figma-rest.mjs` is optional acceleration only. It turns selected Figma
node ids into the same offline PNG/SVG files, copied `tokens.json`, hashes, and
`figma-export-manifest.json` that the required path consumes. The downstream
trace and poster work is unchanged; the REST response never becomes a visual
citation by itself.

The optional script uses only:

- `GET /v1/files/:key/nodes` to verify the selected nodes, and
- `GET /v1/images/:key` to request PNG and SVG exports.

Prepare a JSON config with `fileKey`, the path to the written token block, and
six to ten frame entries. Each entry needs `id`, `nodeId`, `format`, `file`,
`viewport`, `role`, and `provenance`. The committed
`tests/immersive/reference-intake/fixtures/figma-export.config.json` is a
network-free example of the exact shape.

A Figma personal access token with only the `file_content:read` scope is enough
for these endpoints under the product authority recorded in `TODO.md`; no paid
seat is part of this path. Personal tokens expire after at most 90 days. Treat
the expiry as a rotation deadline, and revoke a token immediately if it reaches
logs, shell history, or a commit.

Pass the credential only through the process environment:

```bash
read -s FIGMA_ACCESS_TOKEN
export FIGMA_ACCESS_TOKEN
node automation/reference-intake/export-figma-rest.mjs \
  --config path/to/figma-export.config.json \
  --out path/to/empty-reference-artifacts
unset FIGMA_ACCESS_TOKEN
```

Never commit a personal access token. Do not put it in the config,
`tokens.json`, `reference-intake.json`, an `.env` file, or a command-line
argument. The script has no token flag, does not serialize request headers,
redacts the credential from errors, and does not forward the Figma header to
signed image-download hosts. The repository ignores `.env` variants as a final
accident guard, but the environment-only rule remains authoritative.

The optional route requires network access and a pre-existing personal token;
it is never a prerequisite for validation. If REST is unavailable or unwanted,
return to the required offline path rather than browser automation. No browser
login or open design session is needed to consume and validate the resulting
artifacts.
