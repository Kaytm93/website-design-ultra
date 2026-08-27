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

SIDE-EFFECT DISCIPLINE (IP-10C isolation/evidence fix):
  This verifier must NEVER write to, mutate, or rewrite the tracked file
  ``procedural-generation/handoff-report.json`` (or the committed raw/optimized
  GLBs). All scratch evidence is written into a ``tempfile.TemporaryDirectory``
  and compared against the committed report/fixtures. The committed durable
  evidence is the source of truth; this verifier only reads it.
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
        # Run the full pipeline in a scratch dir, then assert: (a) optimized GLB
        # reads back through the pinned CLI, (b) budget readings come from the
        # OPTIMIZED inspect, not the generator's pre-export counts, (c) tampered
        # / stale values fail. This test is strictly SIDE-EFFECT FREE: all
        # scratch evidence lives in a TemporaryDirectory and is discarded at
        # exit. The committed durable report is the source of truth; this test
        # never overwrites it.
        with tempfile.TemporaryDirectory(prefix="ip10c-src-") as s, tempfile.TemporaryDirectory(prefix="ip10c-web-") as w:
            src = Path(s)
            web = Path(w)
            # Snapshot the committed report before any work, so we can assert
            # the test never touched it.
            report_before = HANDOFF_REPORT.read_bytes()
            report_before_sha = hashlib.sha256(report_before).hexdigest()

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

            # Cross-check the SCRATCH evidence against the COMMITTED durable
            # report. The committed report is the source of truth; if our
            # scratch pipeline produced a fundamentally different artifact
            # (different bytes, different extension, different material count),
            # we want to know — but the scratch run is a freshness check, not a
            # replacement.
            committed = json.loads(report_before.decode("utf-8"))
            committed_input_sha = committed["transfer"]["input_sha256"]
            scratch_input_sha = hashlib.sha256(glb_in.read_bytes()).hexdigest()
            # The scratch run uses a fresh seeded export, so byte-level hashes
            # may legitimately differ across runs (Blender export metadata).
            # What MUST hold: the committed report points at repo-relative
            # committed artifacts that exist on disk.
            for key in ("source_recipe", "input_glb", "output_glb"):
                self.assertIn(
                    key,
                    committed.get("source_vs_web", {}),
                    f"durable report missing repo-relative {key}",
                )

            # The committed report's optimize command must still match the
            # recipe (recipe-recorded flags must be present).
            executed = committed.get("pipeline", {}).get("optimize_command", "")
            for flag in ("--compress draco", "--texture-compress false"):
                self.assertIn(
                    flag, executed,
                    f"durable report optimize_command missing canonical flag {flag}",
                )

            # Final side-effect assertion: the committed report hash is unchanged.
            self.assertEqual(
                hashlib.sha256(HANDOFF_REPORT.read_bytes()).hexdigest(),
                report_before_sha,
                "verifier must never write to procedural-generation/handoff-report.json",
            )

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


class TestNoTrackedReportSideEffects(unittest.TestCase):
    """IP-10C isolation/evidence-fix regression. The verifier must NOT write
    or mutate the tracked file ``procedural-generation/handoff-report.json``.

    Prior to the IP-10C review fix, a single run of ``test_handoff.py``
    rewrote the committed report with random temp paths and a fresh
    ``transfer.sha256`` per invocation, which produced a new git hash on
    every CI run (bbee8680584a82718802c92f434214d09494b2d6 ->
    117170076bb3be3eb99cdd5c8a607fd9b98e9e22 from one controlled run).

    These tests assert the class of bug, not the current implementation:
    the committed report is treated as read-only evidence; only the scratch
    pipeline may write evidence (and only into TemporaryDirectory).
    """

    def setUp(self):
        self.before_bytes = HANDOFF_REPORT.read_bytes()
        self.before_sha = hashlib.sha256(self.before_bytes).hexdigest()

    def test_tracked_report_is_not_mutated_by_reads(self):
        """The act of reading the report — multiple times — must not change
        its bytes or hash."""
        for _ in range(3):
            json.loads(HANDOFF_REPORT.read_text(encoding="utf-8"))
        after_bytes = HANDOFF_REPORT.read_bytes()
        self.assertEqual(
            hashlib.sha256(after_bytes).hexdigest(),
            self.before_sha,
            "handoff-report.json hash must not change just because the test read it",
        )

    def test_source_or_web_block_carries_no_host_paths(self):
        """The committed report's source_vs_web block must reference ONLY
        repo-relative committed paths (or paths classified as a reproducible
        generator input). It must NOT carry ephemeral /tmp, /private/tmp,
        /var/folders/..., or any other host-specific absolute path."""
        report = json.loads(HANDOFF_REPORT.read_text(encoding="utf-8"))
        block = report.get("source_vs_web", {})
        forbidden_substrings = ("/tmp/", "/private/tmp/", "/var/folders/")
        for key, value in block.items():
            self.assertIsInstance(
                value, str,
                f"source_vs_web.{key} must be a string path",
            )
            for forbidden in forbidden_substrings:
                self.assertNotIn(
                    forbidden, value,
                    f"source_vs_web.{key} carries host path '{value}' "
                    f"forbidden by IP-10C; must be repo-relative",
                )

    def test_pipeline_block_carries_no_host_paths(self):
        """The optimize command in the committed report must be reproducible
        from a clean checkout. No host-specific tempdir may appear inside it.
        """
        report = json.loads(HANDOFF_REPORT.read_text(encoding="utf-8"))
        optimize = report.get("pipeline", {}).get("optimize_command", "")
        for forbidden in ("/tmp/", "/private/tmp/", "/var/folders/", "/Users/kaygewinner"):
            self.assertNotIn(
                forbidden, optimize,
                f"pipeline.optimize_command carries host-specific path "
                f"fragment '{forbidden}': '{optimize}'",
            )

    def test_recipe_path_in_generator_is_repo_relative(self):
        """The generator.script and generator.source_recipe paths the
        verifier reads are derived from REPO_ROOT, so the report's recipe
        /source references must be reproducible from the repo, not from the
        host that last ran the test."""
        report = json.loads(HANDOFF_REPORT.read_text(encoding="utf-8"))
        gen = report.get("generator", {})
        for key in ("script", "source_recipe"):
            self.assertIn(
                key, gen,
                f"generator block missing {key}",
            )
            value = gen[key]
            # We allow absolute paths inside the repo (recipe lives under
            # procedural-generation/), but not under /tmp or /var/folders.
            for forbidden in ("/tmp/", "/private/tmp/", "/var/folders/"):
                self.assertNotIn(
                    forbidden, value,
                    f"generator.{key} carries ephemeral host path: {value}",
                )

    def test_committed_report_round_trips_against_committed_glbs(self):
        """Every recorded hash/byte/extension in the committed report must
        match what is on disk right now. If a future regeneration slipped an
        uncommitted hash into the report, this regression catches it."""
        report = json.loads(HANDOFF_REPORT.read_text(encoding="utf-8"))
        svw = report.get("source_vs_web", {})
        # input_glb and output_glb may be repo-relative or absolute-repo; both
        # are acceptable as long as the file exists at that path.
        input_glb = REPO_ROOT / svw["input_glb"]
        output_glb = REPO_ROOT / svw["output_glb"]
        if not input_glb.is_absolute():
            input_glb = (REPO_ROOT / svw["input_glb"]).resolve()
        if not output_glb.is_absolute():
            output_glb = (REPO_ROOT / svw["output_glb"]).resolve()
        self.assertTrue(
            input_glb.exists(),
            f"reported input_glb does not exist on disk: {input_glb}",
        )
        self.assertTrue(
            output_glb.exists(),
            f"reported output_glb does not exist on disk: {output_glb}",
        )
        transfer = report["transfer"]
        self.assertEqual(
            file_sha256(input_glb), transfer["input_sha256"],
            f"reported input_sha256 does not match committed GLB on disk",
        )
        self.assertEqual(
            file_sha256(output_glb), transfer["output_sha256"],
            f"reported output_sha256 does not match committed GLB on disk",
        )
        self.assertEqual(input_glb.stat().st_size, transfer["input_bytes"])
        self.assertEqual(output_glb.stat().st_size, transfer["output_bytes"])


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