---
name: procedural-3d
description: Generate procedural 3D geometry via crystal growth, Voronoi, marching cubes, curl noise, or L-systems. Use only when the brief explicitly requires procedural geometry generation from parameters or algorithmic growth. Ordinary imported GLB inspection, validation, or optimization alone does not activate this skill.
---

# Procedural 3D — Geometry Generation

This skill owns reproducible generation; `3d-asset-pipeline` owns inspect, validate,
and optimize. It opens only when the brief explicitly requires parameter-driven
geometry and names one costed method: crystal growth, Voronoi, marching cubes,
curl noise, or L-systems.

An existing GLB/FBX/Spline asset needing only preparation stays in
`3d-asset-pipeline`. Do not load this for 2D, an ordinary imported hero, or a
brief without explicit procedural generation. State the gate answer, method, and
parameters in the deliverable.

## Contract and workflow

Read [references/catalogue.md](references/catalogue.md) for method cost and
determinism risk, [references/blender-contract.md](references/blender-contract.md)
for reversible named collections/inputs, seed, versions, measured geometry and
material statistics, and [references/houdini-interchange.md](references/houdini-interchange.md)
for the exceptional non-dependency interchange contract. Do not answer these
technical fields from this file alone.

1. Answer the gate and record method, parameters, and cost class.
2. Record the Blender/Geometry Nodes contract and deterministic seed.
3. Run a reversible named-collection script; measure geometry/material statistics.
4. Keep `.blend` source separate from derived web output.
5. Export GLB, then hand off unchanged to `3d-asset-pipeline` inspect/validate/
   optimize. Do not create a second pipeline.
6. Record inputs, seed, versions, statistics, handoff, rerun, and rollback.

Houdini is justified interchange only for volume/simulation materially harder in
Blender; it is never a dependency, paid requirement, default, or generic VDB
exporter. Cross-skill mentions are pointers, not transitive loads.

## Routing

Procedural geometry → this skill → `3d-asset-pipeline`. Imported preparation →
`3d-asset-pipeline` alone. Budget/tiers → `immersive-3d` §3 and
`3d-runtime-quality`.

## Check

- [ ] The §1 gate is answered and the catalogue entry (crystal growth, Voronoi, marching cubes, curl noise, or L-system) is named with its cost model.
- [ ] [references/catalogue.md](references/catalogue.md) was read and the resolution/iterations/sample or symbol growth, CPU, memory, geometry, and determinism risk are documented.
- [ ] [references/blender-contract.md](references/blender-contract.md) is followed: reversible script, named collections/inputs, deterministic seed, versions, measured geometry statistics and material statistics before export, separate `.blend` source vs web output, reproducible rerun/rollback.
- [ ] Automated GLB export hands off to the existing `3d-asset-pipeline` inspect/validate/optimize path; no second pipeline exists.
- [ ] [references/houdini-interchange.md](references/houdini-interchange.md) is respected: Houdini only as justified interchange for volume/simulation, never a dependency/default, no generic VDB exporter, no paid credential.
- [ ] Fallback does not depend on GLB decode and no SDF/MSDF, npm package, or paid dependency was introduced.
