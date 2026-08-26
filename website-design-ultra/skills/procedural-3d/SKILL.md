---
name: procedural-3d
description: Generate procedural 3D geometry via crystal growth, Voronoi, marching cubes, curl noise, or L-systems. Use only when the brief explicitly requires procedural geometry generation from parameters or algorithmic growth. Ordinary imported GLB inspection, validation, or optimization alone does not activate this skill.
---

# Procedural 3D — Geometry Generation

Generate procedural geometry as a reproducible source that hands off to the existing asset pipeline. This skill owns generation; `3d-asset-pipeline` owns inspection, validation, and optimization.

## 1. Gate — selection and negative gating

This skill opens only when **all** of these hold:

1. The brief explicitly requires procedurally generated geometry from parameters, not an imported asset that only needs inspection.
2. The chosen method is one of the costed catalogue: crystal growth, Voronoi, marching cubes, curl noise, or L-systems.

If the asset already exists as a GLB, FBX, or Spline export and the task is to inspect, validate, or optimize it, this skill does not open. Use `3d-asset-pipeline` alone; ordinary imported GLB inspection stays in `3d-asset-pipeline`.

State the gate answer in the deliverable. A scene that cannot name which catalogue entry and which parameters produced the geometry took the generative path by accident.

Do not load this skill for ordinary 2D work, an ordinary 3D hero with an imported model, or any task without explicit procedural generation.

## 2. Contract — what the references own

Geometry growth, resolution, CPU/memory/geometry cost, and determinism risk are not in this file. Read the catalogue and contracts before any script runs:

- Read [references/catalogue.md](references/catalogue.md) for the five techniques and their concrete cost models covering resolution/iterations/sample or symbol growth, CPU, memory, geometry cost, and determinism risk.
- Read [references/blender-contract.md](references/blender-contract.md) for the Blender baseline reversible Python/Geometry Nodes contract with named collections/inputs, explicit deterministic seed, versions, measured geometry statistics and material statistics before export, separate `.blend` source vs web output, and reproducible rerun/rollback.
- Read [references/houdini-interchange.md](references/houdini-interchange.md) for the justified Houdini interchange contract. It is never a dependency or default, never requires a paid seat or credential, and does not provide a generic VDB exporter.

No second inspect/validate/optimize pipeline is described here. Automated GLB export hands off to the existing `3d-asset-pipeline` path described in §3. No SDF/MSDF, no npm package, and no paid dependency is provided by this skill.

## 3. Workflow — Blender baseline with handoff

1. Answer the §1 gate and name the catalogue entry and its cost class from [references/catalogue.md](references/catalogue.md).
2. Record the generation contract from [references/blender-contract.md](references/blender-contract.md): named collections, Geometry Nodes inputs, deterministic seed, Blender and script versions, and the naming convention.
3. Run the reversible Python/Geometry Nodes script that operates only on named collections and recorded inputs. Measure geometry statistics and material statistics before any export.
4. Keep the `.blend` source separate from the web output directory. The source is versioned; the web output is derived.
5. Export to GLB via the automated script (`bpy` GLB export) and immediately hand off to the existing `3d-asset-pipeline` commands — `inspect`, `validate`, `optimize` — without forking that pipeline. Do not create a second pipeline.
6. Record provenance: inputs, seed, versions, measured geometry statistics and material statistics, and the handoff report. A rerun with the same seed must reproduce the same measured topology and material statistics; a rollback removes only the generated collections/output.

Do not invent a justified Houdini path to avoid this workflow. Houdini is an interchange contract only when [references/houdini-interchange.md](references/houdini-interchange.md) justifies it for volume or simulation that is materially harder in Blender.

## 4. Routing

- Procedural geometry that must be generated from parameters → **`procedural-3d` (this skill)**, then → **`3d-asset-pipeline` for inspect/validate/optimize**
- Imported GLB/Spline asset that only needs preparation → **`3d-asset-pipeline` alone**
- Houdini interchange for justified volume/simulation → **`procedural-3d/references/houdini-interchange.md`**, then export GLB and → **`3d-asset-pipeline`** — never a default
- Budget, tiers, and quality → **`immersive-3d` §3 and `3d-runtime-quality`**

Cross-skill mentions are selection pointers, not transitive dependencies.

## Check

- [ ] The §1 gate is answered and the catalogue entry (crystal growth, Voronoi, marching cubes, curl noise, or L-system) is named with its cost model.
- [ ] [references/catalogue.md](references/catalogue.md) was read and the resolution/iterations/sample or symbol growth, CPU, memory, geometry, and determinism risk are documented.
- [ ] [references/blender-contract.md](references/blender-contract.md) is followed: reversible script, named collections/inputs, deterministic seed, versions, measured geometry statistics and material statistics before export, separate `.blend` source vs web output, reproducible rerun/rollback.
- [ ] Automated GLB export hands off to the existing `3d-asset-pipeline` inspect/validate/optimize path; no second pipeline exists.
- [ ] [references/houdini-interchange.md](references/houdini-interchange.md) is respected: Houdini only as justified interchange for volume/simulation, never a dependency/default, no generic VDB exporter, no paid credential.
- [ ] Fallback does not depend on GLB decode and no SDF/MSDF, npm package, or paid dependency was introduced.
