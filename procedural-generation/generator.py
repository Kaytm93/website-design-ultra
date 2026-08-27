#!/usr/bin/env python3
"""
Deterministic reversible Blender generator — crystal-growth (IP-10B).

- Algorithm: crystal-growth (iterative branching, catalogue entry 1)
- Stable names: collection Procedural__Crystal, objects Procedural__Crystal_Segment_XXX, materials Procedural__Crystal_Material / Procedural__Crystal_Tip_Material
- Seed: deterministic random.Random(seed) — all stochastic steps consume it.
- Rerun: removes prior named collection/materials before generation (no hidden scene state).
- Rollback: removing the named collection + derived GLB returns source state; rerun recreates same stats.
- Headless: runnable with --background --factory-startup --python generator.py -- [args]
- Export: bpy.ops.export_scene.gltf with explicit options, collection selection.
- Stats: measured before export (object/vertex/triangle/material/draw-call + collection names, material names/textures/dimensions).

Usage (headless):
  /path/to/Blender --background --factory-startup --python procedural-generation/generator.py -- \
    --seed 1337 --iterations 4 --branching-factor 2 --resolution 8 \
    --output-dir /tmp/outA

Direct python (no bpy) will raise with instructions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from pathlib import Path

# Stable identifiers
COLLECTION_NAME = "Procedural__Crystal"
MATERIAL_BASE = "Procedural__Crystal_Material"
MATERIAL_TIP = "Procedural__Crystal_Tip_Material"
ALGORITHM = "crystal-growth"
SCRIPT_VERSION = "1.0.0"
RECIPE_VERSION = "1"

DEFAULT_SEED = 1337
DEFAULT_ITERATIONS = 4
DEFAULT_BRANCHING = 2
DEFAULT_RESOLUTION = 8  # radial segments per cone


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Deterministic Blender crystal generator")
    p.add_argument("--seed", type=int, default=DEFAULT_SEED, help="deterministic seed")
    p.add_argument("--iterations", type=int, default=DEFAULT_ITERATIONS, help="growth steps")
    p.add_argument("--branching-factor", type=int, default=DEFAULT_BRANCHING, help="branches per tip")
    p.add_argument("--resolution", type=int, default=DEFAULT_RESOLUTION, help="radial segments per cone (geometry resolution)")
    p.add_argument("--output-dir", type=str, default="procedural-generation/output", help="output dir for GLB/report")
    p.add_argument("--blend-path", type=str, default="", help="optional .blend save path (source separate from web output)")
    p.add_argument("--glb-name", type=str, default="Procedural__Crystal.glb")
    p.add_argument("--report-name", type=str, default="report.json")
    p.add_argument("--clean-only", action="store_true", help="only remove generated collection/materials (rollback)")
    return p.parse_args(argv)


def blender_available():
    try:
        import bpy  # noqa: F401
        return True
    except ImportError:
        return False


def clean_generated():
    import bpy
    # Remove objects in collection
    if COLLECTION_NAME in bpy.data.collections:
        coll = bpy.data.collections[COLLECTION_NAME]
        for obj in list(coll.objects):
            try:
                bpy.data.objects.remove(obj, do_unlink=True)
            except Exception:
                pass
        # unlink from parents then remove collection
        for parent in list(bpy.data.collections):
            if coll.name in parent.children:
                parent.children.unlink(coll)
        if COLLECTION_NAME in bpy.data.collections:
            try:
                bpy.data.collections.remove(coll)
            except Exception:
                pass
        # Also unlink from scene if directly linked
        if coll.name in bpy.context.scene.collection.children:
            try:
                bpy.context.scene.collection.children.unlink(coll)
            except Exception:
                pass
    # Remove stray objects with prefix (in case collection was lost)
    for obj in list(bpy.data.objects):
        if obj.name.startswith("Procedural__Crystal_Segment"):
            try:
                bpy.data.objects.remove(obj, do_unlink=True)
            except Exception:
                pass
    # Remove materials
    for mat_name in [MATERIAL_BASE, MATERIAL_TIP]:
        if mat_name in bpy.data.materials:
            try:
                bpy.data.materials.remove(bpy.data.materials[mat_name])
            except Exception:
                pass
    # Purge orphan data
    # Note: do not delete unrelated data


def create_cone_segment(bm, start, direction, length, radius_base, radius_tip, segments):
    import bmesh
    import math
    from mathutils import Vector, Matrix

    # Normalize direction
    d = direction.normalized()
    end = start + d * length

    # Build orthonormal basis
    up = Vector((0, 0, 1))
    if abs(d.dot(up)) > 0.999:
        up = Vector((1, 0, 0))
    # Basis vectors perpendicular to d
    # Use cross products
    axis_x = d.cross(up)
    if axis_x.length < 1e-8:
        axis_x = Vector((1, 0, 0))
    axis_x.normalize()
    axis_y = d.cross(axis_x)
    axis_y.normalize()

    # Create vertices
    verts_base = []
    verts_tip = []
    for i in range(segments):
        angle = (2 * math.pi * i) / segments
        offset = (axis_x * math.cos(angle) + axis_y * math.sin(angle))
        vb = start + offset * radius_base
        vt = end + offset * radius_tip
        verts_base.append(bm.verts.new(vb))
        verts_tip.append(bm.verts.new(vt))
    # Ensure lookup
    bm.verts.ensure_lookup_table()
    # Create side faces
    for i in range(segments):
        j = (i + 1) % segments
        v0 = verts_base[i]
        v1 = verts_base[j]
        v2 = verts_tip[j]
        v3 = verts_tip[i]
        try:
            bm.faces.new((v0, v1, v2, v3))
        except ValueError:
            pass
    # Cap base if radius_base > 0
    if radius_base > 1e-6:
        try:
            bm.faces.new(tuple(verts_base))
        except ValueError:
            pass
    # Tip cap is point (radius_tip ~0) -> create fan if tip radius >0 else single apex vertex
    # For cone with tip 0, apex is at end exactly, not ring. Replace tip ring with single apex.
    # Simpler: if radius_tip < 1e-6, collapse tip ring to apex
    if radius_tip < 1e-6:
        # Remove tip ring verts and create apex
        for v in verts_tip:
            bm.verts.remove(v)
        apex = bm.verts.new(end)
        for i in range(segments):
            j = (i + 1) % segments
            v0 = verts_base[i]
            v1 = verts_base[j]
            try:
                bm.faces.new((v0, v1, apex))
            except ValueError:
                pass
        # Remove old tip faces already created - they referenced removed verts, need to handle
        # Actually we already created side quads referencing tip verts which are now removed -> those faces are gone with verts
        # Re-create side faces correctly as triangles to apex
        # The quads above were removed when verts removed, so triangle faces we just added are correct
        # But we double-created quads earlier; they are gone. The base cap remains.
        pass
    return end


def generate(args, output_dir: Path):
    import bpy
    import bmesh
    from mathutils import Vector

    rng = random.Random(args.seed)

    # Clean previous
    clean_generated()

    if args.clean_only:
        return None

    # Create collection
    coll = bpy.data.collections.new(COLLECTION_NAME)
    bpy.context.scene.collection.children.link(coll)

    # Create materials (stable names, deterministic colors)
    # Use seeded hue for base; tip is lighter
    hue_base = rng.random()
    # Reset rng after hue consumption? Keep consumption deterministic but document it
    # Actually hue consumes one random; keep it
    import colorsys
    r, g, b = colorsys.hsv_to_rgb(hue_base, 0.65, 0.85)
    rt, gt, bt = colorsys.hsv_to_rgb((hue_base + 0.08) % 1.0, 0.45, 0.95)

    mat_base = bpy.data.materials.new(name=MATERIAL_BASE)
    mat_base.use_nodes = True
    nodes = mat_base.node_tree.nodes
    principled = nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = (r, g, b, 1)

    mat_tip = bpy.data.materials.new(name=MATERIAL_TIP)
    mat_tip.use_nodes = True
    nodes2 = mat_tip.node_tree.nodes
    principled2 = nodes2.get("Principled BSDF")
    if principled2:
        principled2.inputs["Base Color"].default_value = (rt, gt, bt, 1)

    # Crystal growth: iterative branching
    # Re-seed for geometry to keep hue consumption isolated? Continue rng sequence for geometry deterministically.
    # Use same rng

    segments = max(3, int(args.resolution))
    iterations = max(1, int(args.iterations))
    branching = max(1, int(args.branching_factor))

    # Tips: list of (pos Vector, dir Vector)
    tips = [(Vector((0, 0, 0)), Vector((0, 0, 1)))]

    segment_index = 0

    for it in range(iterations):
        new_tips = []
        # Radius shrinks per iteration
        radius_base = max(0.08, 0.18 - it * 0.03)
        radius_tip = max(0.0, radius_base * 0.45)
        length = 0.55 + (0.25 * (it / max(1, iterations - 1)))  # slight growth outward

        for pos, direction in tips:
            for br in range(branching):
                # Deterministic perturbation: sample cone around direction
                # Use rng for azimuth and polar deviation
                azimuth = rng.uniform(0, 2 * 3.141592653589793)
                # polar deviation: 18-35 degrees spread, increases with iteration
                polar_deg = rng.uniform(18, 32) + it * 1.5
                polar = polar_deg * 3.141592653589793 / 180.0

                # Build perturbed direction: rotate direction by polar/azimuth
                # Construct rotation around direction's perpendicular basis
                # Simpler: sample random vector within cone around direction using method
                # Create basis
                d = direction.normalized()
                up = Vector((0, 0, 1))
                if abs(d.dot(up)) > 0.999:
                    up = Vector((1, 0, 0))
                ax = d.cross(up)
                if ax.length < 1e-6:
                    ax = Vector((1, 0, 0))
                ax.normalize()
                ay = d.cross(ax)
                ay.normalize()
                # Cone sampling
                # polar as angle from d, azimuth around d
                # new_dir = d*cos(polar) + (ax*cos(az)+ay*sin(az))*sin(polar)
                import math
                new_dir = d * math.cos(polar) + (ax * math.cos(azimuth) + ay * math.sin(azimuth)) * math.sin(polar)
                new_dir.normalize()

                start = Vector(pos)
                # Create mesh object for this segment
                mesh = bpy.data.meshes.new(f"Procedural__Crystal_Segment_{segment_index:03d}_Mesh")
                bm = bmesh.new()
                end_pos = create_cone_segment(bm, start, new_dir, length, radius_base, radius_tip if it < iterations - 1 else 0.0, segments)
                bm.to_mesh(mesh)
                bm.free()

                obj = bpy.data.objects.new(f"Procedural__Crystal_Segment_{segment_index:03d}", mesh)
                # Assign material: tip iteration gets tip material, else base
                if it == iterations - 1:
                    obj.data.materials.append(mat_tip)
                else:
                    obj.data.materials.append(mat_base)
                coll.objects.link(obj)

                new_tips.append((end_pos, new_dir))
                segment_index += 1

        tips = new_tips

    return coll


def collect_statistics(coll):
    import bpy

    if coll is None:
        # after clean_only
        return {
            "object_count": 0,
            "vertex_count": 0,
            "triangle_count": 0,
            "material_count": 0,
            "draw_call_count": 0,
            "collection_names": [],
            "objects": [],
        }

    object_count = len(coll.objects)
    vertex_count = 0
    triangle_count = 0
    material_names = set()
    objects_detail = []

    for obj in sorted(coll.objects, key=lambda o: o.name):
        if obj.type == "MESH" and obj.data:
            mesh = obj.data
            # need to ensure loop_triangles calculated
            try:
                mesh.calc_loop_triangles()
            except Exception:
                pass
            vc = len(mesh.vertices)
            tc = len(mesh.loop_triangles) if hasattr(mesh, "loop_triangles") else len(mesh.polygons)
            vertex_count += vc
            triangle_count += tc
            for slot in obj.material_slots:
                if slot.material:
                    material_names.add(slot.material.name)
            objects_detail.append({"name": obj.name, "vertices": vc, "triangles": tc})

    material_count = len(material_names)
    draw_call_count = material_count  # one draw call per distinct material baseline; objects share pipeline
    # More precise: each object with distinct material is at least 1 draw; with 2 materials draw_call = at least 2
    # Keep simple and documented.

    collection_names = sorted([c.name for c in bpy.data.collections if c.name == COLLECTION_NAME])

    return {
        "object_count": object_count,
        "vertex_count": vertex_count,
        "triangle_count": triangle_count,
        "material_count": material_count,
        "draw_call_count": draw_call_count,
        "collection_names": collection_names,
        "objects": objects_detail,
    }


def collect_material_statistics():
    import bpy
    mats = []
    for mat_name in sorted([MATERIAL_BASE, MATERIAL_TIP]):
        if mat_name in bpy.data.materials:
            mat = bpy.data.materials[mat_name]
            textures = []
            dimensions = []
            # Inspect node tree for image textures
            if mat.use_nodes and mat.node_tree:
                for node in mat.node_tree.nodes:
                    if node.type == "TEX_IMAGE" and node.image:
                        img = node.image
                        textures.append(img.name)
                        dimensions.append([img.size[0], img.size[1]])
            mats.append({
                "name": mat.name,
                "textures": textures,
                "texture_count": len(textures),
                "dimensions": dimensions,
            })
    # Also include any other procedural mats if present
    return mats


def get_exporter_version():
    import bpy
    try:
        addon = bpy.context.preferences.addons.get("io_scene_gltf2")
        if addon:
            # version from bl_info if available
            import importlib
            mod = importlib.import_module("io_scene_gltf2")
            ver = getattr(mod, "bl_info", {}).get("version", None)
            if ver:
                return ".".join(str(x) for x in ver)
            return "unknown"
    except Exception:
        pass
    return "unknown"


def build_report(args, output_dir: Path, glb_path: Path, blend_path: Path | None, geometry_stats, material_stats):
    import bpy

    blender_version = bpy.app.version_string  # e.g., "4.5.13"
    blender_hash = getattr(bpy.app, "build_hash", None)
    # Script hash
    script_path = Path(__file__).resolve()
    try:
        script_hash = hashlib.sha256(script_path.read_bytes()).hexdigest()[:16]
    except Exception:
        script_hash = "unknown"

    exporter_version = get_exporter_version()

    # Stable names
    stable_names = {
        "collection": COLLECTION_NAME,
        "objects_prefix": "Procedural__Crystal_Segment_",
        "materials": [MATERIAL_BASE, MATERIAL_TIP],
    }

    report = {
        "input_contract": {
            "algorithm": ALGORITHM,
            "seed": args.seed,
            "iterations": args.iterations,
            "branching_factor": args.branching_factor,
            "resolution": args.resolution,
            "collection": COLLECTION_NAME,
            "stable_names": stable_names,
        },
        "versions": {
            "blender": blender_version,
            "blender_build_hash": str(blender_hash) if blender_hash else None,
            "script": SCRIPT_VERSION,
            "script_hash": script_hash,
            "exporter": exporter_version,
            "recipe_version": RECIPE_VERSION,
        },
        "output_paths": {
            "output_dir": str(output_dir),
            "glb": str(glb_path) if glb_path else None,
            "blend": str(blend_path) if blend_path else None,
            "report": str(output_dir / "report.json"),
        },
        "geometry_statistics": geometry_stats,
        "material_statistics": material_stats,
        "export_options": {
            "format": "GLB",
            "export_apply": True,
            "export_texcoords": True,
            "export_normals": True,
            "export_materials": "EXPORT",
            "collection": COLLECTION_NAME,
            "use_visible": False,
            "use_selection": False,
        },
        "provenance": {
            "catalogue_entry": "crystal-growth",
            "cost_model": {
                "resolution": args.resolution,
                "iterations": args.iterations,
                "branching_factor": args.branching_factor,
            },
            "determinism": "seeded random.Random(seed) consumes one value for base hue then deterministic branching",
        },
        "handoff": {
            "next_pipeline": "3d-asset-pipeline",
            "commands": [
                "npx @gltf-transform/cli inspect <glb>",
                "npx @gltf-transform/cli validate <glb>",
                "npx @gltf-transform/cli optimize <glb> optimized.glb --compress draco --texture-compress webp",
                "npx @gltf-transform/cli validate optimized.glb",
            ],
            "note": "Do not fork pipeline; IP-10C owns passing the asset through it.",
        },
    }
    return report


def main():
    # Blender passes args after "--"
    argv = sys.argv
    if "--" in argv:
        idx = argv.index("--")
        cli_args = argv[idx + 1 :]
    else:
        cli_args = []
    args = parse_args(cli_args)

    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    glb_path = output_dir / args.glb_name
    report_path = output_dir / args.report_name
    blend_path = Path(args.blend_path).resolve() if args.blend_path else None
    # Default blend separate from web output: place beside output_dir/source if not specified? Keep separation.
    # If no blend-path given, we do not save blend unless requested via default env.
    # But keep source .blend separate: if not specified, place under output_dir/source
    if blend_path is None:
        blend_path = output_dir / "source" / "Procedural__Crystal.blend"
    blend_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        import bpy
    except ImportError:
        print("ERROR: bpy not available. Run with Blender: Blender --background --factory-startup --python generator.py -- [args]", file=sys.stderr)
        sys.exit(2)

    # Ensure glTF addon enabled
    try:
        import addon_utils
        addon_utils.enable("io_scene_gltf2", default_set=True, persistent=False)
    except Exception:
        pass

    coll = generate(args, output_dir)

    if args.clean_only:
        # Write minimal report indicating cleaned
        geometry_stats = collect_statistics(None)
        material_stats = []
        report = build_report(args, output_dir, None, None, geometry_stats, material_stats)
        report["status"] = "cleaned"
        report_path.write_text(json.dumps(report, indent=2, sort_keys=False), encoding="utf-8")
        print(f"[generator] cleaned collection {COLLECTION_NAME}")
        return

    geometry_stats = collect_statistics(coll)
    material_stats = collect_material_statistics()
    report = build_report(args, output_dir, glb_path, blend_path, geometry_stats, material_stats)

    # Save .blend source (separate from web output)
    try:
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
        print(f"[generator] saved .blend to {blend_path}")
    except Exception as e:
        print(f"[generator] WARNING: could not save .blend: {e}", file=sys.stderr)

    # Export GLB with explicit options, collection selection
    # Ensure only collection objects are exported. Use collection param.
    try:
        # Deselect all then export via collection param
        bpy.ops.object.select_all(action="DESELECT")
        result = bpy.ops.export_scene.gltf(
            filepath=str(glb_path),
            export_format="GLB",
            export_copyright="",
            export_image_format="AUTO",
            export_texcoords=True,
            export_normals=True,
            export_draco_mesh_compression_enable=False,
            export_tangents=False,
            export_materials="EXPORT",
            use_selection=False,
            use_visible=False,
            use_active_collection=False,
            collection=COLLECTION_NAME,
            export_apply=True,
            export_yup=True,
            export_animations=False,
        )
        print(f"[generator] exported GLB to {glb_path} result={result}")
        report["export_result"] = str(result)
        # Hash GLB if exists
        if glb_path.exists():
            h = hashlib.sha256(glb_path.read_bytes()).hexdigest()
            report["output_hashes"] = {"glb_sha256": h, "glb_bytes": glb_path.stat().st_size}
        else:
            report["output_hashes"] = None
    except Exception as e:
        print(f"[generator] ERROR export failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        report["export_error"] = str(e)
        # Do not exit with failure if export fails due to missing collection? But collection exists
        raise

    report_path.write_text(json.dumps(report, indent=2, sort_keys=False), encoding="utf-8")
    print(f"[generator] report written to {report_path}")
    print(json.dumps({"geometry_statistics": geometry_stats, "material_statistics": material_stats}, indent=2))


if __name__ == "__main__":
    main()
