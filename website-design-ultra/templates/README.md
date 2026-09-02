# templates

Files a project copies. Everything here exists inside an installed plugin, so a
skill can name a path the reader can actually open.

- `runtime/` — zero-dependency TypeScript references: the telemetry surface, the
  quality controller, the determinism runtime, interaction checkpoints, the
  baseline-comparison contract, and the cinematic timeline.

Copy them into a project. Do not import them from here and do not turn this
directory into a package: the plugin ships one version of a contract, and a
project that copies it owns its own copy from that moment on.

Every file is byte-identical to the repository source it mirrors, and
`repo:tests/templates/sync.test.mjs` fails if the two ever drift apart.
