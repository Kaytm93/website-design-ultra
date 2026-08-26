# Houdini Interchange Contract — Justified Only

Houdini is an interchange contract, never a baseline, dependency, or default for this skill.

## Scope

- Houdini may be used only when a **justified volume, simulation, or procedural system is materially harder in Blender** and the brief establishes that the result cannot be reached with the Blender baseline plus the catalogue in `catalogue.md`.
- The justification must be documented: which volume/simulation requirement exceeds Blender's practical path and why the chosen Houdini network addresses it.
- A missing or generic justification ("higher quality", "industry standard") does not activate this contract.

## Never a dependency or default

- Houdini is **never a default tool**, never a required dependency, and never installed as an implicit prerequisite. An ordinary procedural task runs the Blender baseline alone.
- No paid seat, credential, license server, or private plugin is committed or required. The optional interchange uses only exported artifacts, not a live Houdini session in CI.
- The deliverable must not require the reviewer to have Houdini to verify it; exported GLB and provenance carry the evidence.

## Interchange format

- The interchange exports to a **neutral web-compatible artifact**: typically a GLB/FBX/ABC that is then converted to GLB, plus the Houdini network provenance (node names, parameters, seed) as a metadata record.
- The exported artifact is handed off to the existing `3d-asset-pipeline` (`inspect`, `validate`, `optimize`) exactly like the Blender output. No second pipeline, no separate validation rules.

## Not a generic VDB exporter

- This skill does **not** provide or recommend a **generic VDB exporter**. Volume data handling is deferred to `IP-10D` (T3.3) and requires a measured research gate with declared source representation, transfer/GPU/decode comparison, and a conventional point fallback. Do not ship or announce a general VDB capability.
- No broad volume format is introduced as free infrastructure; any packed volume format is scoped to the measured assets that justified it.

## Provenance when Houdini is used

- Record the Houdini version, network/asset name, parameters, seed, and why Blender was materially harder for this case.
- Record the same geometry/material statistics before export as the Blender contract requires (object/vertex/triangle/material counts).
- Keep the Houdini source (`.hip` or equivalent) separate from the web output, mirroring the Blender source vs web output separation. Interchange verification reads the exported GLB, not the `.hip`.

## Cost and reproducibility

- The same cost and determinism expectations from `catalogue.md` apply: document resolution, iterations/sample or symbol growth, CPU, memory, geometry cost, and determinism risk. A Houdini path that hides cost behind a generic exporter fails the gate.
- Reproducibility still binds to an explicit deterministic seed; an unseeded DOP or POP network is not interchangeable evidence.
