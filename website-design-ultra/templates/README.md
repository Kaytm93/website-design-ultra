# templates

Files a project copies. Everything here exists inside an installed plugin, so a
skill can name a path the reader can actually open.

- `runtime/` — zero-dependency TypeScript references: the telemetry surface, the
  quality controller, the determinism runtime, interaction checkpoints, the
  baseline-comparison contract, and the cinematic timeline. It also holds two
  executables: `compare-baselines.mjs`, which compares two deterministic
  capture sets offline, and `canvas-only-prohibition.ts`, which checks that a
  canvas-first page keeps its primary actions, forms, legal copy, and pricing
  in the DOM.

- `shaders/` — the GLSL the lab's shader modules are built from. Read
  `skills/shaders-tsl/references/module-index.md` first: it says which file
  carries which effect, at what cost, on which backend.

- `particles/` — copyable WebGPU/TSL compute kernels. They use storage buffers
  for persistent state and must ship with the existing WebGL2 ping-pong fallback.

`compare-baselines.mjs` reads its declaration contract from the sibling
`baseline-comparison.ts`, so it needs a Node that strips TypeScript types:
Node 23 and newer run it as written, Node 22 needs `--experimental-strip-types`.
It has no other dependency.

Copy them into a project. Do not import them from here and do not turn this
directory into a package: the plugin ships one version of a contract, and a
project that copies it owns its own copy from that moment on.

Every file is byte-identical to the repository source it mirrors, and
`repo:tests/templates/sync.test.mjs` fails if the two ever drift apart.
