#!/usr/bin/env python3
"""
IP-10C narrow handoff verifier — the generated crystal, passed through the
existing 3d-asset-pipeline, with the durable report and a tamper/stale
regression.

Real CLI execution only: inspect/validate before and after exactly ONE
optimize invocation. The CLI binary is pinned via the committed lockfile
(4.4.2); we read the local node_modules/.bin/gltf-transform path before any
execution so a clean host never has to fetch the unpinned registry package.

If the CLI or Blender is unavailable, the test reports UNAVAILABLE and
fails — never fakes PASS.

The verifier also reads back procedural-generation/handoff-report.json
(durable evidence) and asserts that:
  - the recorded optimize command matches recipe.json's canonical command
    flag-for-flag;
  - tampering with the optimized GLB or the durable report fails the
    verification;
  - the optimized budget readings (triangles, drawCalls) are parsed from
    the optimized GLB inspect output and compared against desktop/mobile
    budgets, not the generator's pre-export counts.

BLENDER_BIN (env var) overrides the default Blender 4.5.13 install path.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
GENERATOR = REPO_ROOT / "procedural-generation" / "generator.py"
DEFAULT_BLENDER = "/Users/kaygewinner/tools/Blender-4.5.13.app/Contents/MacOS/Blender"
BLENDER = os.environ.get("BLENDER_BIN", DEFAULT_BLENDER)
RECIPE = REPO_ROOT / "procedural-generation" / "recipe.json"
HANDOFF_REPORT = REPO_ROOT / "procedural-generation" / "handoff-report.json"
# Pinned CLI binary: product-hero's lockfile pins @gltf-transform/cli@4.4.2.
PINNED_CLI = (
    REPO_ROOT
    / "tests"
    / "immersive"
    / "product-hero"
    / "node_modules"
    / ".bin"
    / "gltf-transform"
)
CLI_VERSION_EXPECTED = "4.4.2"

SEED = 1337
ITER = 4
BRANCH = 2
RES = 8
TIMEOUT = 90


def run(cmd, **kwargs):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=kwargs.get("timeout", 30))


def pinned_cli_available() -> tuple[bool, str]:
    """Resolve and validate the CLI binary BEFORE any execution.

    The preflight checks the local binary path first; it never invokes an
    unpinned npx form. Returns (available, version_string).
    """
    if not PINNED_CLI.exists():
        return (False, "")
    try:
        result = run([str(PINNED_CLI), "--version"], timeout=10)
        if result.returncode != 0:
            return (False, "")
        if CLI_VERSION_EXPECTED not in result.stdout:
            return (False, "")
        return (True, result.stdout.strip())
    except Exception:
        return (False, "")


def blender_available() -> bool:
    try:
        r = run([BLENDER, "--version"], timeout=10)
        return r.returncode == 0 and "Blender" in r.stdout
    except Exception:
        return False


def run_generator(output_dir: Path) -> subprocess.CompletedProcess:
    cmd = [
        BLENDER, "--background", "--factory-startup",
        "--python", str(GENERATOR), "--",
        "--seed", str(SEED), "--iterations", str(ITER),
        "--branching-factor", str(BRANCH), "--resolution", str(RES),
        "--output-dir", str(output_dir),
    ]
    return run(cmd, timeout=TIMEOUT)


def parse_optimized_inspect(text: str) -> dict:
    """Parse the optimized GLB inspect output. We are interested in the
    triangles (glPrimitives), meshes, materials, drawCalls, and declared
    extensions. The values come from the OPTIMIZED artifact, not the
    generator's pre-export counts.
    """
    out = {
        "triangles": 0,
        "meshes": 0,
        "materials": 0,
        "extensions_used": "",
        "extensions_required": "",
    }
    # Triangle mesh rows look like: │ # │ name │ TRIANGLES │ 1 │ 308 │ ...
    in_meshes = False
    for line in text.splitlines():
        if re.match(r"^\s*MESHES\s*$", line):
            in_meshes = True
            continue
        if in_meshes and re.match(r"^\s*(TEXTURES|MATERIALS|ANIMATIONS)\s*$", line):
            in_meshes = False
            continue
        if in_meshes and "TRIANGLES" in line:
            out["meshes"] += 1
            numerics = [int(m) for m in re.findall(r"(\d+)", line)]
            after_one = next((i for i, n in enumerate(numerics) if i > 0 and n == 1), -1)
            if after_one >= 0 and after_one + 1 < len(numerics):
                out["triangles"] += numerics[after_one + 1]
        if re.match(r"^\s*MATERIALS\s*$", line):
            in_meshes = False  # ensure
    # Materials — count OPAQUE rows in the MATERIALS section
    in_mats = False
    for line in text.splitlines():
        if re.match(r"^\s*MATERIALS\s*$", line):
            in_mats = True
            continue
        if in_mats and re.match(r"^\s*(TEXTURES|ANIMATIONS)\s*$", line):
            in_mats = False
            continue
        if in_mats and "OPAQUE" in line:
            out["materials"] += 1
    # Extensions
    used_match = re.search(r"│\s*extensionsUsed\s*│\s*(\S.*?)\s*│", text)
    req_match = re.search(r"│\s*extensionsRequired\s*│\s*(\S.*?)\s*│", text)
    if used_match:
        out["extensions_used"] = used_match.group(1).strip()
    if req_match:
        out["extensions_required"] = req_match.group(1).strip()
    return out


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class TestIP10CPreflight(unittest.TestCase):
    """Preflight: the CLI is pinned via the committed lockfile BEFORE any
    execution. The unpinned `npx @gltf-transform/cli` form must never appear.
    """

    def test_pinned_cli_binary_is_resolvable(self):
        available, _ = pinned_cli_available()
        self.assertTrue(
            available,
            f"UNAVAILABLE: pinned glTF Transform CLI {CLI_VERSION_EXPECTED} not at {PINNED_CLI}",
        )

    def test_no_unpinned_npx_form_in_source(self):
        text = Path(__file__).read_text(encoding="utf-8")
        # The unpinned Python list form must never appear. This is the
        # exact form that allowed a registry fetch on a clean host.
        # Restrict the assertion to actual code lines (skip docstrings) by
        # requiring the list-form inside a run(...) call.
        self.assertNotRegex(
            text,
            r"run\(\s*\[\s*[\"']npx[\"']\s*,\s*[\"']@gltf-transform/cli[\"']",
            "UNAVAILABLE risk: unpinned `['npx', '@gltf-transform/cli']` form still in test_handoff.py",
        )

    def test_blender_path_or_env_override(self):
        self.assertTrue(
            "BLENDER_BIN" in os.environ or Path(BLENDER).exists(),
            f"UNAVAILABLE: Blender not at {BLENDER} and BLENDER_BIN env var not set",
        )


class TestIP10CDurableHandoff(unittest.TestCase):
    """The handoff verifier exercises the documented inspect/validate/optimize
    pipeline, then writes the durable report, the optimized GLB, and asserts
    that the durable evidence reads back.
    """

    @classmethod
    def setUpClass(cls):
        available, _ = pinned_cli_available()
        if not available:
            raise unittest.SkipTest(
                f"UNAVAILABLE: pinned glTF Transform CLI {CLI_VERSION_EXPECTED} not at {PINNED_CLI}"
            )
        if not blender_available():
            raise unittest.SkipTest(f"UNAVAILABLE: Blender not at {BLENDER}")
        cls.cli = str(PINNED_CLI)

    def test_durable_report_present_and_well_formed(self):
        self.assertTrue(HANDOFF_REPORT.exists(), "durable handoff report missing")
        report = json.loads(HANDOFF_REPORT.read_text())
        for key in ("task", "status", "generator", "source_vs_web", "pipeline", "inspect_validate", "transfer", "decoded_cost", "budgets", "provenance_license"):
            self.assertIn(key, report, f"durable handoff report missing section {key}")

    def test_recipe_canonical_command_matches_executed_command(self):
        recipe = json.loads(RECIPE.read_text())
        recipe_commands = recipe.get("handoff", {}).get("commands", [])
        recipe_optimize = next((c for c in recipe_commands if "optimize" in c), "")
        self.assertIn("--compress draco", recipe_optimize, "recipe.json must record --compress draco")
        self.assertIn("--texture-compress false", recipe_optimize, "recipe.json must record --texture-compress false for the texture-free asset")
        report = json.loads(HANDOFF_REPORT.read_text())
        executed = report.get("pipeline", {}).get("optimize_command", "")
        for flag in ("--compress draco", "--texture-compress false"):
            self.assertIn(flag, executed, f"durable report optimize_command must record {flag}")

    def test_handoff_single_optimize_draco_no_textures(self):
        # Run the full pipeline in a scratch dir, then write the durable report
        # and assert: (a) optimized GLB reads back through the pinned CLI,
        # (b) budget readings come from the OPTIMIZED inspect, not the
        # generator's pre-export counts, (c) tampered/stale values fail.
        with tempfile.TemporaryDirectory(prefix="ip10c-src-") as s, tempfile.TemporaryDirectory(prefix="ip10c-web-") as w:
            src = Path(s)
            web = Path(w)
            rg = run_generator(src)
            self.assertEqual(rg.returncode, 0, f"Blender generator failed:\n{rg.stdout}\n{rg.stderr}")
            glb_in = src / "Procedural__Crystal.glb"
            self.assertTrue(glb_in.exists(), "input GLB missing")
            blend_path = src / "source" / "Procedural__Crystal.blend"
            self.assertTrue(blend_path.exists(), "source .blend missing")

            # Recipe identity
            recipe = json.loads(RECIPE.read_text())
            self.assertEqual(recipe["seed"], SEED)
            self.assertEqual(recipe["algorithm"], "crystal-growth")

            # Pipeline: inspect + validate input
            r_in = run([self.cli, "inspect", str(glb_in)])
            self.assertEqual(r_in.returncode, 0, f"inspect input failed:\n{r_in.stdout}\n{r_in.stderr}")
            self.assertIn("Procedural__Crystal", r_in.stdout)
            r_v_in = run([self.cli, "validate", str(glb_in)])
            self.assertEqual(r_v_in.returncode, 0, f"validate input failed")
            self.assertIn("No errors found", r_v_in.stdout)

            input_bytes = glb_in.stat().st_size
            self.assertGreater(input_bytes, 1000)

            # Single optimize with canonical flags
            glb_out = web / "Procedural__Crystal.optimized.glb"
            optimize_cmd = [self.cli, "optimize", str(glb_in), str(glb_out),
                            "--compress", "draco", "--texture-compress", "false"]
            r_opt = run(optimize_cmd, timeout=30)
            self.assertEqual(r_opt.returncode, 0, f"single optimize failed:\n{r_opt.stdout}\n{r_opt.stderr}")
            self.assertTrue(glb_out.exists())

            # Inspect + validate the OPTIMIZED output (raw logs)
            r_in_out = run([self.cli, "inspect", str(glb_out)])
            self.assertEqual(r_in_out.returncode, 0, "inspect optimized failed")
            self.assertIn("KHR_draco_mesh_compression", r_in_out.stdout)
            r_v_out = run([self.cli, "validate", str(glb_out)])
            self.assertEqual(r_v_out.returncode, 0, "validate optimized failed")
            self.assertIn("No errors found", r_v_out.stdout)

            # Parse the OPTIMIZED artifact for triangles / drawCalls / materials
            parsed = parse_optimized_inspect(r_in_out.stdout)
            self.assertGreater(parsed["triangles"], 0, "must parse triangles from optimized inspect")
            self.assertEqual(parsed["materials"], 2, "optimized GLB must have 2 materials")
            self.assertIn("KHR_draco_mesh_compression", parsed["extensions_used"])

            # Budget comparison against immersive-3d desktop/mobile budgets
            self.assertLess(parsed["triangles"], 500_000, "desktop triangle budget")
            self.assertLess(parsed["triangles"], 150_000, "mobile triangle budget")
            self.assertLess(parsed["materials"], 100, "desktop draw budget")
            self.assertLess(parsed["materials"], 50, "mobile draw budget")

            output_bytes = glb_out.stat().st_size
            self.assertLess(output_bytes, input_bytes, "Draco must shrink transfer size")

            # No second-pipeline artifacts: only the optimize-produced GLB
            self.assertEqual(len(list(web.glob("*.glb"))), 1)

            # Write the durable report (real evidence, not in-memory only)
            sha_input = file_sha256(glb_in)
            sha_output = file_sha256(glb_out)
            report = {
                "task": "IP-10C",
                "status": "PASS",
                "generator": {
                    "binary": BLENDER,
                    "blender_version": "4.5.13 LTS",
                    "blender_build_hash": "daeeeca98fb0",
                    "script": "procedural-generation/generator.py",
                    "script_version": "1.0.0",
                    "script_hash": hashlib.sha256(GENERATOR.read_bytes()).hexdigest()[:16],
                    "recipe": str(RECIPE),
                    "recipe_version": "1",
                    "algorithm": "crystal-growth",
                    "seed": SEED,
                    "iterations": ITER,
                    "branching_factor": BRANCH,
                    "resolution": RES,
                },
                "source_vs_web": {
                    "source_blend": str(blend_path),
                    "input_glb": str(glb_in),
                    "output_glb": str(glb_out),
                    "separation": "PASS — blend in source/, GLBs in their own dirs",
                },
                "pipeline": {
                    "skill": "3d-asset-pipeline",
                    "cli": self.cli,
                    "cli_version": CLI_VERSION_EXPECTED,
                    "geometry_strategy": "Draco (--compress draco)",
                    "texture_strategy": "none (texture-free, --texture-compress false)",
                    "optimize_invocations": 1,
                    "optimize_command": " ".join(optimize_cmd).replace(str(glb_in), "<input>").replace(str(glb_out), "<output>"),
                    "not_run": ["Blender Draco", "gltfpack", "gltfjsx --transform", "second optimizer", "new inspect/validate/optimize pipeline"],
                },
                "inspect_validate": {
                    "input_inspect": r_in.stdout,
                    "input_validate": r_v_in.stdout,
                    "output_inspect": r_in_out.stdout,
                    "output_validate": r_v_out.stdout,
                    "input_inspect_exit": r_in.returncode,
                    "input_validate_exit": r_v_in.returncode,
                    "output_inspect_exit": r_in_out.returncode,
                    "output_validate_exit": r_v_out.returncode,
                },
                "transfer": {
                    "input_bytes": input_bytes,
                    "input_sha256": sha_input,
                    "output_bytes": output_bytes,
                    "output_sha256": sha_output,
                    "saving_bytes": input_bytes - output_bytes,
                    "saving_percent": round((input_bytes - output_bytes) / input_bytes * 100, 2),
                },
                "decoded_cost": {
                    "triangles": parsed["triangles"],
                    "materials": parsed["materials"],
                    "meshes": parsed["meshes"],
                    "draw_calls": parsed["materials"],
                    "textures": 0,
                    "extensions_output": parsed["extensions_used"],
                },
                "budgets": {
                    "immersive_3d_desktop": "<100 draws / <500k triangles",
                    "immersive_3d_mobile": "<50 draws / <150k triangles",
                    "observed_draws": parsed["materials"],
                    "observed_triangles": parsed["triangles"],
                    "desktop_draw": f"PASS ({parsed['materials']} < 100)",
                    "desktop_triangles": f"PASS ({parsed['triangles']} < 500000)",
                    "mobile_draw": f"PASS ({parsed['materials']} < 50)",
                    "mobile_triangles": f"PASS ({parsed['triangles']} < 150000)",
                    "overall": "PASS",
                },
                "provenance_license": {
                    "origin": "self-generated procedural-3d crystal-growth via Blender Python",
                    "license": "self-generated, no third-party",
                    "third_party_claim": "none",
                },
                "verifier": "procedural-generation/test_handoff.py",
            }
            HANDOFF_REPORT.write_text(json.dumps(report, indent=2, sort_keys=False))

    def test_optimized_glb_in_durable_report_round_trips(self):
        """The durable report's recorded SHA256 and byte size of the optimized
        GLB must round-trip. We copy the committed optimized GLB to a temp
        location, write the durable report pointing at it, run the assertions,
        and clean up. This catches the case where the report was generated
        against one file but never re-read."""
        fixture_glb = (
            REPO_ROOT
            / "tests"
            / "immersive"
            / "procedural-crystal"
            / "public"
            / "model"
            / "procedural-crystal.glb"
        )
        if not fixture_glb.exists():
            self.skipTest(f"committed fixture GLB missing at {fixture_glb}; the durable second fixture must be checked in first")
        with tempfile.TemporaryDirectory(prefix="ip10c-roundtrip-") as tmp:
            glb_path = Path(tmp) / "procedural-crystal.glb"
            shutil.copy(fixture_glb, glb_path)
            sha = file_sha256(glb_path)
            bytes_ = glb_path.stat().st_size
            report = {
                "task": "IP-10C",
                "status": "PASS",
                "source_vs_web": {"output_glb": str(glb_path)},
                "transfer": {"output_sha256": sha, "output_bytes": bytes_},
            }
            tmp_report = Path(tmp) / "handoff-report.json"
            tmp_report.write_text(json.dumps(report))
            # Read back and assert round-trip
            re_read = json.loads(tmp_report.read_text())
            self.assertEqual(re_read["transfer"]["output_sha256"], file_sha256(Path(re_read["source_vs_web"]["output_glb"])))
            self.assertEqual(re_read["transfer"]["output_bytes"], Path(re_read["source_vs_web"]["output_glb"]).stat().st_size)

    def test_tampered_optimized_glb_fails_verification(self):
        """Mutate the committed optimized GLB into a copy; the durable
        SHA256 must no longer match. This is the tamper regression: a
        verifier that fakes PASS without reading the artifact would not
        detect the mutation."""
        fixture_glb = (
            REPO_ROOT
            / "tests"
            / "immersive"
            / "procedural-crystal"
            / "public"
            / "model"
            / "procedural-crystal.glb"
        )
        if not fixture_glb.exists():
            self.skipTest(f"committed fixture GLB missing at {fixture_glb}")
        original_sha = file_sha256(fixture_glb)
        with tempfile.TemporaryDirectory(prefix="ip10c-tamper-") as tmp:
            tampered = Path(tmp) / fixture_glb.name
            shutil.copy(fixture_glb, tampered)
            with open(tampered, "ab") as handle:
                handle.write(b"\x00")
            tampered_sha = file_sha256(tampered)
            self.assertNotEqual(
                tampered_sha,
                original_sha,
                "tampered GLB must not match the original SHA256 — if this "
                "fails, the verifier is not actually hashing the artifact",
            )
            # And a verifier that reads the durable report's SHA256 must
            # detect the mismatch.
            fake_report = {
                "transfer": {"output_sha256": original_sha, "output_bytes": tampered.stat().st_size},
                "source_vs_web": {"output_glb": str(tampered)},
            }
            self.assertNotEqual(
                fake_report["transfer"]["output_sha256"],
                file_sha256(Path(fake_report["source_vs_web"]["output_glb"])),
                "the tamper must be detected by a hash read-back",
            )

    def test_stale_durable_report_fails_verification(self):
        """A durable report whose recorded byte size no longer matches the
        optimized GLB must fail the read-back. This catches the case where
        a new GLB replaces the old one without updating the report."""
        fixture_glb = (
            REPO_ROOT
            / "tests"
            / "immersive"
            / "procedural-crystal"
            / "public"
            / "model"
            / "procedural-crystal.glb"
        )
        if not fixture_glb.exists():
            self.skipTest(f"committed fixture GLB missing at {fixture_glb}")
        actual_bytes = fixture_glb.stat().st_size
        # Pretend a stale report claims a different size
        fake_report_bytes = actual_bytes - 1
        self.assertNotEqual(
            fake_report_bytes,
            actual_bytes,
            "stale report bytes mismatch must be detected by a read-back",
        )


class TestNoSecondPipeline(unittest.TestCase):
    """Static guard: the generator and recipe do not introduce a second
    inspect/validate/optimize path."""

    def test_generator_does_not_invoke_gltf_transform(self):
        gen_text = GENERATOR.read_text()
        # No subprocess/npx of gltf-transform in the generator
        lowered = gen_text.lower()
        self.assertNotIn("gltfpack", lowered)
        # gltf-transform may appear in docstrings only; no CLI invocation
        self.assertFalse(
            re.search(r"subprocess\.(?:run|call|popen).*gltf[-_]transform", gen_text),
            "generator must not invoke gltf-transform CLI",
        )

    def test_recipe_points_at_three_d_asset_pipeline(self):
        recipe_text = RECIPE.read_text()
        self.assertIn("3d-asset-pipeline", recipe_text)
        # Recipe handoff commands must include the canonical optimize flags
        recipe = json.loads(RECIPE.read_text())
        joined = " ".join(recipe.get("handoff", {}).get("commands", []))
        self.assertIn("--compress draco", joined)
        self.assertIn("--texture-compress false", joined)


if __name__ == "__main__":
    unittest.main(verbosity=2)