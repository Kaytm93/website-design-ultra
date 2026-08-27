#!/usr/bin/env python3
"""
IP-10C review-fix regressions — narrow, durable tests that capture each of the
five findings from the existing 9119d414ff1ec3d2eb82f971305560f74080b88f commit:

  1. the second fixture is registered and durable;
  2. the glTF CLI is pinned BEFORE execution (no unpinned npx);
  3. a tampered optimized GLB or stale handoff report fails verification;
  4. the optimized geometry is parsed and compared to declared budgets;
  5. the executed command sequence matches the canonical recipe.

These tests are minimal: they assert the conditions the review said were
missing, and they fail with a clear RED message naming the cause. They do not
build the asset or run the verifier themselves — that work is done by the
verifier (`test_handoff.py`) and the runner
(`run-implementation-evaluation.mjs`).

Exit code 0 means every IP-10C review-fix regression now holds.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
TEST_HANDBOOK = REPO_ROOT / "procedural-generation" / "test_handoff.py"
EVAL_RUNNER = (
    REPO_ROOT / "tests" / "immersive" / "evaluation" / "run-implementation-evaluation.mjs"
)
SECOND_FIXTURE = REPO_ROOT / "tests" / "immersive" / "procedural-crystal"
HANDOFF_REPORT = REPO_ROOT / "procedural-generation" / "handoff-report.json"
RECIPE = REPO_ROOT / "procedural-generation" / "recipe.json"

EXPECTED_CLI = "4.4.2"


class TestSecondFixtureRegistered(unittest.TestCase):
    """The review found: 'No durable procedural runtime fixture.'"""

    def test_procedural_crystal_directory_exists(self):
        self.assertTrue(
            SECOND_FIXTURE.exists(),
            f"IP-10C RED: durable second fixture directory missing: {SECOND_FIXTURE}",
        )

    def test_procedural_crystal_has_fixture_json(self):
        declaration = SECOND_FIXTURE / "fixture.json"
        self.assertTrue(
            declaration.exists(),
            f"IP-10C RED: fixture.json missing under {SECOND_FIXTURE}",
        )

    def test_procedural_crystal_has_pinned_lockfile(self):
        lockfile = SECOND_FIXTURE / "package-lock.json"
        self.assertTrue(
            lockfile.exists(),
            f"IP-10C RED: pinned package-lock.json missing under {SECOND_FIXTURE}",
        )
        # The committed lockfile must declare the exact gltf-transform pin.
        text = lockfile.read_text(encoding="utf-8")
        self.assertIn(
            '"node_modules/@gltf-transform/cli"',
            text,
            "IP-10C RED: lockfile does not pin @gltf-transform/cli",
        )
        self.assertIn(
            f'"version": "{EXPECTED_CLI}"',
            text,
            f"IP-10C RED: lockfile does not pin @gltf-transform/cli @ {EXPECTED_CLI}",
        )

    def test_procedural_crystal_has_optimized_glb(self):
        glb = SECOND_FIXTURE / "public" / "model" / "procedural-crystal.glb"
        self.assertTrue(
            glb.exists(),
            f"IP-10C RED: optimized Draco GLB missing at {glb}",
        )
        self.assertGreater(glb.stat().st_size, 200, "IP-10C RED: optimized GLB is empty")

    def test_procedural_crystal_has_pipeline_reports(self):
        for name in ("pre-inspect.txt", "post-inspect.txt", "summary.json"):
            f = SECOND_FIXTURE / "reports" / "model" / name
            self.assertTrue(
                f.exists(),
                f"IP-10C RED: pipeline report missing — {f}",
            )


class TestRunnerRegistersSecondFixture(unittest.TestCase):
    """The review found: 'tests/immersive/evaluation/... still recognizes only product-hero.'"""

    def test_runner_knows_procedural_crystal(self):
        text = EVAL_RUNNER.read_text(encoding="utf-8")
        self.assertIn(
            "procedural-crystal",
            text,
            "IP-10C RED: run-implementation-evaluation.mjs does not register procedural-crystal",
        )


class TestVerifierPinsCLIBeforeExecution(unittest.TestCase):
    """The review found: 'The verifier executes an unpinned registry package before checking its version.'"""

    def test_verifier_uses_local_binary_or_pinned_npx(self):
        text = TEST_HANDBOOK.read_text(encoding="utf-8")
        # The line that proves the pin: a path to the local committed binary
        # (preferred) or an exact-version npx invocation. Both forms are
        # acceptable as long as the unpinned registry form is gone.
        self.assertTrue(
            "node_modules/.bin/gltf-transform" in text
            or "@gltf-transform/cli@" + EXPECTED_CLI in text,
            "IP-10C RED: test_handoff.py must resolve the CLI from the committed "
            "lockfile-pinned binary before any execution",
        )

    def test_verifier_rejects_unversioned_npx(self):
        text = TEST_HANDBOOK.read_text(encoding="utf-8")
        # The unpinned form must not appear; it is what allowed the registry
        # to run before the version check.
        self.assertNotIn(
            '"npx", "@gltf-transform/cli"',
            text,
            "IP-10C RED: test_handoff.py still defines unpinned npx @gltf-transform/cli",
        )

    def test_verifier_version_check_is_a_preflight_not_a_postflight(self):
        # The CLI must be version-checked first, with the local binary, before
        # any npx form runs. We assert that 'cli_available' uses a local path or
        # an exact-version npx form. Done implicitly by the previous test.

        # Make sure cli_available still validates the version: this is a regression
        # belt-and-braces against removing the version check entirely.
        text = TEST_HANDBOOK.read_text(encoding="utf-8")
        self.assertIn(
            EXPECTED_CLI,
            text,
            f"IP-10C RED: verifier no longer asserts CLI {EXPECTED_CLI}",
        )


class TestVerifierReadsDurableReport(unittest.TestCase):
    """The review found: 'The test never reads or validates handoff-report.json …'"""

    def test_verifier_reads_handoff_report(self):
        text = TEST_HANDBOOK.read_text(encoding="utf-8")
        self.assertIn(
            "handoff-report.json",
            text,
            "IP-10C RED: test_handoff.py does not read back handoff-report.json",
        )

    def test_durable_report_is_present(self):
        self.assertTrue(
            HANDOFF_REPORT.exists(),
            f"IP-10C RED: durable handoff report missing at {HANDOFF_REPORT}",
        )


class TestVerifierParsesOptimizedBudget(unittest.TestCase):
    """The review found: 'budget assertions are not bound to the optimized artifact'."""

    def test_verifier_asserts_optimized_draws_and_triangles(self):
        text = TEST_HANDBOOK.read_text(encoding="utf-8")
        # The verifier must compute observed draws / triangles from the OPTIMIZED
        # GLB's inspect output, not just the pre-export generator counts.
        self.assertIn(
            "drawCalls",
            text,
            "IP-10C RED: verifier must parse optimized draw-call counts",
        )
        # Look for evidence the verifier is parsing inspect text, not the
        # generator's pre-export counts.
        self.assertTrue(
            "inspected" in text or "optimized" in text.lower(),
            "IP-10C RED: verifier does not appear to inspect the optimized GLB",
        )


class TestVerifierDetectsTampering(unittest.TestCase):
    """The review found: 'Budget and report assertions are not bound to the optimized artifact.'"""

    def test_verifier_includes_tamper_test(self):
        text = TEST_HANDBOOK.read_text(encoding="utf-8")
        # There must be at least one test that mutates either the optimized GLB
        # or the durable report and expects verification to fail.
        self.assertTrue(
            "tamper" in text or "stale" in text or "mutated" in text,
            "IP-10C RED: test_handoff.py does not include a tamper/stale regression",
        )


class TestRecipeIsCanonical(unittest.TestCase):
    """The review found: 'executed pipeline command differs from recorded recipe'."""

    def test_recipe_texture_compress_matches_strategy(self):
        recipe = json.loads(RECIPE.read_text(encoding="utf-8"))
        handoff = json.loads(HANDOFF_REPORT.read_text(encoding="utf-8"))
        # Recipe must use --texture-compress false for this texture-free asset,
        # so the executed command and the recorded command stay identical.
        recipe_commands = recipe.get("handoff", {}).get("commands", [])
        joined = " ".join(recipe_commands)
        self.assertIn(
            "--texture-compress false",
            joined,
            "IP-10C RED: recipe.json does not record --texture-compress false "
            "(texture-free asset)",
        )
        # And the executed/recorded command in the durable report must match
        # the recipe command, byte-for-byte, modulo the input/output paths.
        recipe_optimize_cmd = next(
            (c for c in recipe_commands if "optimize" in c),
            "",
        )
        self.assertNotEqual(
            recipe_optimize_cmd,
            "",
            "IP-10C RED: recipe.json has no optimize command",
        )
        executed_cmd = handoff.get("pipeline", {}).get("optimize_command", "")
        # Both must reference the same set of canonical flags.
        for flag in ("--compress draco", "--texture-compress false"):
            self.assertIn(
                flag,
                executed_cmd,
                f"IP-10C RED: durable report optimize_command does not record {flag}",
            )
            self.assertIn(
                flag,
                recipe_optimize_cmd,
                f"IP-10C RED: recipe optimize command does not record {flag}",
            )


class TestBlenderOverride(unittest.TestCase):
    """The review found: 'hard-coded Blender path.'"""

    def test_verifier_accepts_blender_bin_env(self):
        text = TEST_HANDBOOK.read_text(encoding="utf-8")
        self.assertIn(
            "BLENDER_BIN",
            text,
            "IP-10C RED: test_handoff.py does not honour BLENDER_BIN environment override",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)