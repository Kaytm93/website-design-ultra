# Procedural Generation — Deterministic Blender Generator (IP-10B)

Blender baseline reversible generator for `procedural-3d` → `3d-asset-pipeline`.

- **Algorithm:** crystal-growth (catalogue entry 1, `website-design-ultra/skills/procedural-3d/references/catalogue.md`)
- **Determinism:** `random.Random(seed)` explicit seed; rerun with same seed + same Blender/script versions preserves measured topology/material statistics.
- **Stable names:** collection `Procedural__Crystal`, objects `Procedural__Crystal_Segment_XXX`, materials `Procedural__Crystal_Material` / `Procedural__Crystal_Tip_Material`
- **Reversible:** removes prior named collection/materials before generation; `clean` mode removes them without recreation. Generated output can be removed and rerun recreates same stats.
- **Source vs web output:** `.blend` saved to `output/source/Procedural__Crystal.blend` (source), GLB to `output/Procedural__Crystal.glb` (web), report to `output/report.json`. Web output is derived, not versioned.

## Headless usage (required binary)

```bash
/Users/kaygewinner/tools/Blender-4.5.13.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python procedural-generation/generator.py -- \
  --seed 1337 --iterations 4 --branching-factor 2 --resolution 8 \
  --output-dir /tmp/pg-out-A
```

Options:
- `--seed`, `--iterations`, `--branching-factor`, `--resolution` — generation contract
- `--output-dir` — directory for GLB/report (and `source/` subdir for .blend if `--blend-path` not set)
- `--blend-path` — explicit .blend save path (default: `<output-dir>/source/Procedural__Crystal.blend`)
- `--clean-only` — rollback: remove named collection/materials, write cleaned report

Export is automated via `bpy.ops.export_scene.gltf(filepath=..., export_format='GLB', collection='Procedural__Crystal', export_apply=True, ...)` with explicit options; handoff to the existing `3d-asset-pipeline` (`inspect`/`validate`/`optimize`) is documented in the report — IP-10C owns actually passing the asset through it. No second pipeline is created.

## Verification

```bash
python3 procedural-generation/verify.py --blender /Users/kaygewinner/tools/Blender-4.5.13.app/Contents/MacOS/Blender
python3 -m unittest procedural-generation/test_generator.py
```

`verify.py` runs the generator twice in isolated temp dirs, compares input/version/seed, geometry/material statistics and stable names, classifies GLB binary hash comparison honestly (PASS if identical, or `UNAVAILABLE_HASH` with explanation when Blender binary determinism does not guarantee byte-identical GLB), and verifies rollback + rerun.

## Inputs / statistics recorded

Before export the report records:

- **Geometry statistics:** `object_count`, `vertex_count`, `triangle_count`, `material_count`, `draw_call_count`, `collection_names`, per-object vertices/triangles
- **Material statistics:** `name`, `textures`, `texture_count`, `dimensions`
- **Versions:** Blender, script hash, exporter
- **Output paths and export options**

Same seed + same Blender/script versions must preserve measured topology/material statistics (strict equality).

## Houdini

No Houdini dependency. Houdini is an interchange contract only for justified volume/simulation (`references/houdini-interchange.md`) — not used here.
