# Blender Baseline Contract — Reversible Deterministic Generation

This contract makes procedural generation reversible, seeded, and measurable before any web export. It is the only generation path; Houdini is a justified interchange, not a replacement.

## 1. Reversible script contract

- Every generation runs from a **reversible Python script** or **Geometry Nodes modifier** that operates only on **named collections** and **recorded inputs**. The script must be able to rerun and to roll back (remove/recreate) without manual scene edits.
- Collections and inputs are named and documented in the deliverable (e.g., `Procedural__Crystal`, `Inputs/Seed`, `Inputs/Iterations`). Unnamed or scene-global mutation is forbidden.
- Geometry Nodes inputs are recorded as a contract block: input name, type, units, and value. Manual slider tweaks without a recorded value are not reproducible.

## 2. Deterministic seed

- Every stochastic step consumes an **explicit deterministic seed** declared in the provenance record and passed into the script/modifier. Reuse of an unseeded `random` or `noise` call fails the gate.
- Different subsystems take separate named seeds so adding a stream does not change earlier streams. Two reruns with the same seed must preserve measured topology and material assignment.
- When `WDU_DETERMINISTIC` is active, the injected clock is the time source; `performance.now()` is not read directly by scene code.

## 3. Versions

- Record **Blender version**, **Geometry Nodes modifier version** (when used), **script version/hash**, and the **exporter version**. These are part of the provenance block.
- Version drift without re-measurement is not a pass. A rerun on a different Blender patch must re-record statistics before export.

## 4. Measured statistics before export

- Before any GLB write, measure and record **geometry statistics** (object count, vertex count, triangle count, draw call/material count, collection names) and **material statistics** (material names, texture references, dimensions).
- Statistics are measured from the Blender scene in its source units, not inferred after compression. The web output is not the source of truth for generation quality.
- Measured counts are compared on rerun: same seed and inputs with the same versions reproduces the same topology/material statistics within documented tolerance.

## 5. Separate source vs web output

- The **`.blend` source** is kept separate from the **web output** directory. The source is versioned; the derived GLB and its optimized output live outside the source collection.
- No in-place mutation of the source collection for export; the script exports a declared collection to a declared path.

## 6. Reproducible rerun and rollback

- **Rerun**: invoking the same script with the same seed and inputs on the same Blender version must recreate the named collections with the same measured statistics.
- **Rollback**: removing the generated collections and derived GLB must return the source state; rerunning after rollback reaches the same state again.
- Provenance, statistics, and export logs are kept so a reviewer can verify rerun/rollback without executing Blender interactively.

## 7. Automated GLB export and handoff

- Export is automated via the script (`bpy.ops.export_scene.gltf` GLB path, with explicit collection selection, applied transforms as declared, and preserved names).
- Export does **not** fork the pipeline. The generated `output.glb` is immediately handed off to the existing `3d-asset-pipeline` commands: `inspect`, `validate`, `optimize` (then `validate` again). Do not create a second inspect/validate/optimize path.
- The existing pipeline remains the single source for transfer-size and GPU-cost validation. Procedural generation never bypasses it.

## 8. Post-handoff separation

- After handoff, source and web artifacts stay separate: `.blend` source remains in its source location; `optimized.glb` and reports live in the web output. Optimization results must be within the declared `immersive-3d` budgets; a budget exceed is a gate failure, not a different export setting.
