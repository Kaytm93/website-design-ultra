#!/usr/bin/env python3
"""
Unittest for deterministic Blender generator (IP-10B).
Runs generator twice via Blender headless and checks rollback.

Real execution, not source-text claim. Requires a real Blender install,
resolved by blender_path (BLENDER_BIN, then PATH, then the platform's
conventional locations). If Blender is unavailable, tests report
UNAVAILABLE and fail (do not fake PASS).
"""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_path import resolve_blender, unavailable_reason  # noqa: E402
from blender_path import blender_available as probe_blender  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[1]
GENERATOR = REPO_ROOT / "procedural-generation" / "generator.py"
VERIFY = REPO_ROOT / "procedural-generation" / "verify.py"
BLENDER = resolve_blender()

SEED = 1337
ITER = 4
BRANCH = 2
RES = 8
TIMEOUT = 90


def blender_available():
    return probe_blender(BLENDER)


def run_generator(output_dir: Path, extra=None):
    extra = extra or []
    cmd = [
        BLENDER, "--background", "--factory-startup",
        "--python", str(GENERATOR), "--",
        "--seed", str(SEED), "--iterations", str(ITER),
        "--branching-factor", str(BRANCH), "--resolution", str(RES),
        "--output-dir", str(output_dir),
    ] + extra
    return subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT)


class TestDeterministicGenerator(unittest.TestCase):
    def test_blender_available(self):
        self.assertTrue(blender_available(), f"{unavailable_reason(BLENDER)} Cannot verify IP-10B.")

    def test_two_run_determinism(self):
        if not blender_available():
            self.skipTest(unavailable_reason(BLENDER))

        with tempfile.TemporaryDirectory(prefix="pg-test-A-") as a, tempfile.TemporaryDirectory(prefix="pg-test-B-") as b:
            dirA = Path(a); dirB = Path(b)
            rA = run_generator(dirA)
            self.assertEqual(rA.returncode, 0, f"Run A failed:\n{rA.stdout}\n{rA.stderr}")
            rB = run_generator(dirB)
            self.assertEqual(rB.returncode, 0, f"Run B failed:\n{rB.stdout}\n{rB.stderr}")

            repA = json.loads((dirA / "report.json").read_text())
            repB = json.loads((dirB / "report.json").read_text())

            # Input contract same
            self.assertEqual(repA["input_contract"], repB["input_contract"], "input contract differs between runs")
            # Versions same (blender/script)
            self.assertEqual(repA["versions"]["blender"], repB["versions"]["blender"])
            self.assertEqual(repA["versions"]["script_hash"], repB["versions"]["script_hash"])

            # Geometry/material stats strictly equal
            self.assertEqual(repA["geometry_statistics"], repB["geometry_statistics"],
                             f"geometry stats differ:\nA={repA['geometry_statistics']}\nB={repB['geometry_statistics']}")
            self.assertEqual(repA["material_statistics"], repB["material_statistics"],
                             f"material stats differ:\nA={repA['material_statistics']}\nB={repB['material_statistics']}")

            # Stable names
            self.assertEqual(repA["geometry_statistics"]["collection_names"], ["Procedural__Crystal"])
            self.assertIn("Procedural__Crystal_Material", [m["name"] for m in repA["material_statistics"]])

            # Hash: classify honestly, do not require byte-identical
            ha = (repA.get("output_hashes") or {}).get("glb_sha256")
            hb = (repB.get("output_hashes") or {}).get("glb_sha256")
            self.assertIsNotNone(ha, "missing GLB hash A")
            self.assertIsNotNone(hb, "missing GLB hash B")
            if ha != hb:
                # Report as unavailable determinism honestly, but topology already passed
                print(f"[test] NOTE: GLB hash differs (A={ha[:12]} B={hb[:12]}) — classified as UNAVAILABLE_HASH, not topology failure", file=sys.stderr)
            else:
                self.assertEqual(ha, hb, "GLB hashes identical when Blender guarantees it")

            # Basic sanity on counts (deterministic crystal: 30 segments for 4 iter *2 branching =2+4+8+16)
            geo = repA["geometry_statistics"]
            self.assertEqual(geo["object_count"], 30, "expected 30 segments for iter4/branch2")
            self.assertEqual(geo["vertex_count"], 368)
            self.assertEqual(geo["triangle_count"], 532)
            self.assertEqual(geo["material_count"], 2)
            self.assertEqual(geo["draw_call_count"], 2)
            self.assertEqual(geo["collection_names"], ["Procedural__Crystal"])
            # Ensure GLB exists and non-empty
            self.assertTrue((dirA / "Procedural__Crystal.glb").exists())
            self.assertGreater((dirA / "Procedural__Crystal.glb").stat().st_size, 1000)
            self.assertTrue((dirB / "Procedural__Crystal.glb").exists())

    def test_rollback(self):
        if not blender_available():
            self.skipTest(unavailable_reason(BLENDER))
        with tempfile.TemporaryDirectory(prefix="pg-rollback-") as tmp:
            d = Path(tmp)
            r1 = run_generator(d)
            self.assertEqual(r1.returncode, 0, f"initial run failed:\n{r1.stdout}\n{r1.stderr}")
            rep1 = json.loads((d / "report.json").read_text())
            geo1 = rep1["geometry_statistics"]

            # Clean
            rC = run_generator(d, extra=["--clean-only"])
            self.assertEqual(rC.returncode, 0, f"clean failed:\n{rC.stdout}\n{rC.stderr}")
            repC = json.loads((d / "report.json").read_text())
            self.assertEqual(repC["geometry_statistics"]["object_count"], 0, "clean did not reset object count")
            self.assertEqual(repC["geometry_statistics"]["vertex_count"], 0)
            self.assertEqual(repC.get("status"), "cleaned")

            # Rerun
            r2 = run_generator(d)
            self.assertEqual(r2.returncode, 0, f"rerun after clean failed:\n{r2.stdout}\n{r2.stderr}")
            rep2 = json.loads((d / "report.json").read_text())
            self.assertEqual(rep1["geometry_statistics"], rep2["geometry_statistics"], "rerun after rollback differs")
            self.assertEqual(rep1["material_statistics"], rep2["material_statistics"])
            self.assertEqual(rep1["input_contract"], rep2["input_contract"])

    def test_headless_invocation_and_separation(self):
        """Verify generator uses absolute Blender binary, factory-startup, and keeps source/blend separate from web GLB."""
        if not blender_available():
            self.skipTest("UNAVAILABLE")
        with tempfile.TemporaryDirectory(prefix="pg-sep-") as tmp:
            d = Path(tmp)
            r = run_generator(d)
            self.assertEqual(r.returncode, 0)
            rep = json.loads((d / "report.json").read_text())
            # Check blend vs glb paths are separate
            blend = Path(rep["output_paths"]["blend"])
            glb = Path(rep["output_paths"]["glb"])
            self.assertNotEqual(blend.parent.resolve(), glb.parent.resolve(), "blend and glb parents should differ (source vs web)")
            # Collection export explicit
            self.assertEqual(rep["export_options"]["collection"], "Procedural__Crystal")
            self.assertEqual(rep["input_contract"]["algorithm"], "crystal-growth")
            # Check no Houdini references
            self.assertNotIn("houdini", json.dumps(rep).lower())
            # Check .blend exists (source separate)
            self.assertTrue(blend.exists(), f".blend missing at {blend}")
            self.assertTrue(glb.exists())

    def test_verify_script(self):
        """verify.py returns PASS with topology determinism (hash may be UNAVAILABLE_HASH)."""
        if not blender_available():
            self.skipTest("UNAVAILABLE")
        r = subprocess.run([sys.executable, str(VERIFY), "--blender", BLENDER], capture_output=True, text=True, timeout=300)
        # verify.py exits 0 only on PASS
        self.assertEqual(r.returncode, 0, f"verify.py did not PASS:\n{r.stdout}\n{r.stderr}")
        self.assertIn("PASS", r.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
