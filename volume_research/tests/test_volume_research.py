"""Volume representation research tests — IP-10D.

Coverage:

* The synthetic density field is byte-stable across two builds.
* The three encoders are byte-stable across two runs.
* The three decoders round-trip the encoded bytes.
* The packed encoder is **not** a VDB exporter (no VDB/NanoVDB/Field3D strings,
  no shared magic, no shared header layout).
* The point fallback is recorded explicitly in the report.
* The verdict stays ``INCONCLUSIVE`` when no representation beats every
    other on every measurement by the declared margin.
* The structured report carries the declared source representation at the
  root so it is the first thing a reviewer reads.
"""

from __future__ import annotations

import json
import shutil
import struct
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from volume_research.encoders import encode_slices, encode_points, encode_packed  # noqa: E402
from volume_research.decoders.slices import measure_decode_slices  # noqa: E402
from volume_research.decoders.points import measure_decode_points  # noqa: E402
from volume_research.decoders.packed import measure_decode_packed  # noqa: E402
from volume_research.encoders import packed as packed_encoder  # noqa: E402
from volume_research.decoders import packed as packed_decoder  # noqa: E402
from volume_research import report as report_module  # noqa: E402
from volume_research.research import (  # noqa: E402
    load_declaration,
    build_density_field,
    assert_stats_within_tolerance,
)


SOURCE_PATH = REPO_ROOT / "volume_research" / "source-representation.json"
RUNTIME_PATH = REPO_ROOT / "volume_research" / "research" / "runtime.json"


def _run_full_cycle(tmp: Path) -> dict:
    declaration = load_declaration(SOURCE_PATH)
    density, stats = build_density_field(declaration)
    assert_stats_within_tolerance(stats, declaration)

    out_dir = tmp / "enc"
    slices_enc = encode_slices(declaration, density, out_dir)
    points_enc = encode_points(declaration, density, out_dir)
    packed_enc = encode_packed(declaration, density, out_dir)
    return {
        "declaration": declaration,
        "density": density,
        "stats": stats,
        "out_dir": out_dir,
        "slices_enc": slices_enc,
        "points_enc": points_enc,
        "packed_enc": packed_enc,
    }


class VolumeReproducibilityTests(unittest.TestCase):
    def test_density_field_is_byte_stable_across_two_builds(self) -> None:
        declaration = load_declaration(SOURCE_PATH)
        _, stats_a = build_density_field(declaration)
        _, stats_b = build_density_field(declaration)
        self.assertEqual(stats_a["density_hash_sha256"], stats_b["density_hash_sha256"])

    def test_encoders_are_byte_stable_across_two_runs(self) -> None:
        declaration = load_declaration(SOURCE_PATH)
        density, _ = build_density_field(declaration)

        with tempfile.TemporaryDirectory() as td:
            a = Path(td) / "a"
            b = Path(td) / "b"
            a.mkdir()
            b.mkdir()

            slices_a = encode_slices(declaration, density, a)
            slices_b = encode_slices(declaration, density, b)
            self.assertEqual(slices_a.sha256_concat, slices_b.sha256_concat)
            self.assertEqual(slices_a.total_bytes, slices_b.total_bytes)

            points_a = encode_points(declaration, density, a)
            points_b = encode_points(declaration, density, b)
            self.assertEqual(points_a.sha256_concat, points_b.sha256_concat)

            packed_a = encode_packed(declaration, density, a)
            packed_b = encode_packed(declaration, density, b)
            self.assertEqual(packed_a.sha256_concat, packed_b.sha256_concat)

    def test_decoders_round_trip_through_their_own_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            bundle = _run_full_cycle(tmp)

            decoded_slices = measure_decode_slices(
                [Path(p) for p in bundle["slices_enc"].output_paths],
                repeats=2,
            )
            self.assertEqual(decoded_slices.decoded_shape, [32, 32, 32])

            decoded_points = measure_decode_points(
                Path(bundle["points_enc"].output_paths[0]),
                repeats=2,
            )
            self.assertEqual(decoded_points.decoded_shape[1], 4)  # vec3 + density

            decoded_packed = measure_decode_packed(
                Path(bundle["packed_enc"].output_paths[0]),
                repeats=2,
            )
            self.assertEqual(decoded_packed.decoded_shape, [32, 32, 32])

            # Slices and packed decoders both reconstruct uint8 volumes;
            # their hashes must match because they were encoded from the
            # same source representation.
            self.assertEqual(
                decoded_slices.decoded_hash_sha256,
                decoded_packed.decoded_hash_sha256,
            )


class PackedFormatGuardTests(unittest.TestCase):
    """The packed format must NOT be a generic volume format."""

    def test_magic_is_not_a_known_volume_format(self) -> None:
        # OpenVDB, NanoVDB, Field3D, MetaImage, NRRD, MHD all have their own
        # distinctive magic / extension. The packed encoder must not pretend
        # to be one of them.
        forbidden_magics = {
            b"VDB",   # OpenVDB / NanoVDB magic
            b"OPENVDB_FILE",
            b"FIELDS3D",
            b"NRRD",
            b"MHD",
        }
        self.assertNotIn(packed_encoder.MAGIC, forbidden_magics)

    def test_format_does_not_export_a_general_volume_writer(self) -> None:
        # The packed module exposes encode_packed only. It must not expose
        # anything that looks like a generic volume API.
        exports = [n for n in dir(packed_encoder) if not n.startswith("_")]
        forbidden = {"VDBWriter", "NanoVDBWriter", "Field3DWriter", "VolumeWriter"}
        self.assertTrue(forbidden.isdisjoint(exports), f"forbidden exports present: {forbidden & set(exports)}")

    def test_decoder_rejects_unknown_magic(self) -> None:
        bogus = b"FAKEMAGIC" + b"\x00" * 28 + b"\x00" * 128
        with tempfile.NamedTemporaryFile(suffix=".wduv", delete=False) as fh:
            fh.write(bogus)
            path = Path(fh.name)
        try:
            with self.assertRaises(ValueError):
                packed_decoder._decode_packed_once(path)
        finally:
            path.unlink(missing_ok=True)


class PointFallbackTests(unittest.TestCase):
    def test_point_fallback_is_present_in_the_report(self) -> None:
        declaration = load_declaration(SOURCE_PATH)
        density, stats = build_density_field(declaration)

        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            slices_enc = encode_slices(declaration, density, tmp)
            points_enc = encode_points(declaration, density, tmp)
            packed_enc = encode_packed(declaration, density, tmp)

            # Build a minimal decoders dict so compute_verdict has the
            # fields it reads.
            def _dec(median):
                return {
                    "decode_iterations": 1,
                    "decode_time_ms_median": median,
                    "decode_time_ms_iqr": 0.0,
                    "decoded_hash_sha256": "x" * 64,
                    "decoded_shape": [32, 32, 32],
                    "samples_ms": [median],
                }

            report = {
                "encoders": {
                    "slices": slices_enc.__dict__,
                    "points": points_enc.__dict__,
                    "packed": packed_enc.__dict__,
                },
                "decoders": {
                    "slices": _dec(1.0),
                    "points": _dec(0.5),
                    "packed": _dec(0.4),
                },
                "point_fallback": {
                    "representation": "points",
                    "format": "glTF 2.0 .glb POINTS primitive",
                    "path": points_enc.output_paths[0],
                    "consumable_by": "3d-asset-pipeline inspect / validate / optimize",
                    "visible_count": points_enc.notes["visible_count"],
                    "bytes_on_disk": points_enc.total_bytes,
                },
                "declared_source_representation": {
                    "id": declaration["id"],
                },
            }
            verdict, recommendation = report_module.compute_verdict(
                report,
                json.loads(RUNTIME_PATH.read_text(encoding="utf-8")),
            )
            self.assertIn(verdict, {"INCONCLUSIVE", "WINNER_SLICES", "WINNER_POINTS", "WINNER_PACKED"})
            md = report_module.render_markdown({
                **report,
                "declared_source_representation": {
                    "id": declaration["id"],
                    "phenomenon": declaration["phenomenon"],
                    "resolution": declaration["grid"]["resolution"],
                    "cell_count": declaration["grid"]["cell_count"],
                    "declared_asset_scope": declaration["declared_asset_scope"]["id"],
                    "anchors_seed": declaration["anchors_seed"],
                    "anchors_count": declaration["anchors_count"],
                    "versioning": declaration["versioning"],
                },
                "density_statistics": stats,
                "declared_source_sha256": "0" * 64,
                "verdict": verdict,
                "recommendation": recommendation,
                "encoding_total_elapsed_ms": 5.0,
                "runtime_config": {
                    "runtime_version": "1",
                    "decoder_repeats": 1,
                    "winner_margin": {
                        "decode_time_relative": 0.0,
                        "transfer_bytes_relative": 0.0,
                        "gpu_memory_bytes_relative": 0.0,
                    },
                },
            })
            self.assertIn("point fallback", md.lower())

    def test_points_representation_is_the_point_fallback(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            bundle = _run_full_cycle(tmp)
            self.assertTrue(bundle["points_enc"].notes["is_point_fallback"])


class VerdictTests(unittest.TestCase):
    """The verdict must stay INCONCLUSIVE when evidence does not establish
    a winner. The current measured asset does not establish a winner, so the
    gate records INCONCLUSIVE."""

    def test_default_run_is_inconclusive(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            bundle = _run_full_cycle(tmp)
            report = {
                "declared_source_representation": {
                    "id": bundle["declaration"]["id"],
                },
                "encoders": {
                    "slices": bundle["slices_enc"].__dict__,
                    "points": bundle["points_enc"].__dict__,
                    "packed": bundle["packed_enc"].__dict__,
                },
                "decoders": {
                    "slices": {
                        "decode_iterations": 1,
                        "decode_time_ms_median": 1.0,
                        "decode_time_ms_iqr": 0.0,
                        "decoded_hash_sha256": "x" * 64,
                        "decoded_shape": [32, 32, 32],
                        "samples_ms": [1.0],
                    },
                    "points": {
                        "decode_iterations": 1,
                        "decode_time_ms_median": 0.05,
                        "decode_time_ms_iqr": 0.0,
                        "decoded_hash_sha256": "y" * 64,
                        "decoded_shape": [1, 4],
                        "samples_ms": [0.05],
                    },
                    "packed": {
                        "decode_iterations": 1,
                        "decode_time_ms_median": 0.02,
                        "decode_time_ms_iqr": 0.0,
                        "decoded_hash_sha256": "z" * 64,
                        "decoded_shape": [32, 32, 32],
                        "samples_ms": [0.02],
                    },
                },
            }
            runtime = json.loads(RUNTIME_PATH.read_text(encoding="utf-8"))
            verdict, recommendation = report_module.compute_verdict(report, runtime)
            self.assertEqual(verdict, "INCONCLUSIVE")
            self.assertIn("INCONCLUSIVE", recommendation.upper())


class DeclaredSourceFirstTests(unittest.TestCase):
    def test_source_representation_is_the_first_field_in_the_report(self) -> None:
        declaration = load_declaration(SOURCE_PATH)
        density, stats = build_density_field(declaration)

        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            slices_enc = encode_slices(declaration, density, tmp)
            points_enc = encode_points(declaration, density, tmp)
            packed_enc = encode_packed(declaration, density, tmp)

            report = {
                "declared_source_representation": {
                    "id": declaration["id"],
                    "phenomenon": declaration["phenomenon"],
                    "resolution": declaration["grid"]["resolution"],
                    "cell_count": declaration["grid"]["cell_count"],
                    "declared_asset_scope": declaration["declared_asset_scope"]["id"],
                    "anchors_seed": declaration["anchors_seed"],
                    "anchors_count": declaration["anchors_count"],
                    "versioning": declaration["versioning"],
                },
                "encoders": {
                    "slices": slices_enc.__dict__,
                    "points": points_enc.__dict__,
                    "packed": packed_enc.__dict__,
                },
            }
            # The first key in the rendered markdown should be the declared
            # source representation, not the encoders.
            md = report_module.render_markdown({
                **report,
                "decoders": {
                    "slices": {"decode_iterations": 1, "decode_time_ms_median": 1.0, "decode_time_ms_iqr": 0.0, "decoded_hash_sha256": "x" * 64, "decoded_shape": [32, 32, 32], "samples_ms": [1.0]},
                    "points": {"decode_iterations": 1, "decode_time_ms_median": 1.0, "decode_time_ms_iqr": 0.0, "decoded_hash_sha256": "y" * 64, "decoded_shape": [1, 4], "samples_ms": [1.0]},
                    "packed": {"decode_iterations": 1, "decode_time_ms_median": 1.0, "decode_time_ms_iqr": 0.0, "decoded_hash_sha256": "z" * 64, "decoded_shape": [32, 32, 32], "samples_ms": [1.0]},
                },
                "point_fallback": {
                    "representation": "points",
                    "format": "glTF 2.0 .glb POINTS primitive",
                    "path": points_enc.output_paths[0],
                    "consumable_by": "3d-asset-pipeline inspect / validate / optimize",
                    "visible_count": points_enc.notes["visible_count"],
                    "bytes_on_disk": points_enc.total_bytes,
                },
                "density_statistics": stats,
                "declared_source_sha256": "0" * 64,
                "verdict": "INCONCLUSIVE",
                "recommendation": "",
                "encoding_total_elapsed_ms": 1.0,
                "runtime_config": {
                    "runtime_version": "1",
                    "decoder_repeats": 1,
                    "winner_margin": {"decode_time_relative": 0.0, "transfer_bytes_relative": 0.0, "gpu_memory_bytes_relative": 0.0},
                },
            })
            source_index = md.index("Declared source representation")
            encoders_index = md.index("Encoders (transfer size")
            self.assertLess(source_index, encoders_index)


class NoAbsolutePathLeakTests(unittest.TestCase):
    """The committed structured report is host-independent.

    Every string-typed field in the structured report must be expressible
    without a per-host filesystem prefix. If an encoder ever returns an
    absolute path that bypasses the benchmark's normaliser, this test
    fails so the leak never reaches ``volume_research/reports/report.json``.
    """

    @staticmethod
    def _walk_strings(obj, path=()):
        if isinstance(obj, dict):
            for key, value in obj.items():
                yield from NoAbsolutePathLeakTests._walk_strings(value, path + (key,))
            return
        if isinstance(obj, list):
            for index, value in enumerate(obj):
                yield from NoAbsolutePathLeakTests._walk_strings(value, path + (index,))
            return
        if isinstance(obj, str):
            yield path, obj

    def _run_benchmark_into(self, out_dir: Path) -> dict:
        declaration = load_declaration(SOURCE_PATH)
        runtime = json.loads(RUNTIME_PATH.read_text(encoding="utf-8"))
        from volume_research import benchmark as benchmark_module
        return benchmark_module.run_benchmark(declaration, runtime, out_dir)

    def test_no_string_in_structured_report_is_absolute(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            structured = self._run_benchmark_into(tmp)

            offenders = []
            for field_path, value in self._walk_strings(structured):
                # POSIX absolute, Windows drive-letter absolute, and UNC
                # paths all count as host-prefixed and are forbidden.
                if (
                    value.startswith("/")
                    or value.startswith("\\")
                    or (len(value) >= 3 and value[1] == ":" and value[2] in ("/", "\\"))
                ):
                    offenders.append((field_path, value))

            self.assertEqual(
                offenders,
                [],
                msg=(
                    "Absolute paths leaked into the structured report: "
                    + ", ".join(f"{'/'.join(map(str, p))}={v!r}" for p, v in offenders)
                ),
            )

    def test_point_fallback_path_is_repo_relative(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            structured = self._run_benchmark_into(tmp)
            rel = structured["point_fallback"]["path"]
            # Must not be absolute; must still point at a points.glb-style
            # file inside the output directory the benchmark just wrote.
            self.assertFalse(rel.startswith("/"))
            self.assertFalse(rel.startswith("\\"))
            self.assertFalse(
                len(rel) >= 3 and rel[1] == ":" and rel[2] in ("/", "\\"),
                msg=f"point_fallback.path looks Windows-absolute: {rel!r}",
            )
            self.assertTrue(
                rel.endswith("points.glb"),
                msg=f"point_fallback.path does not look like a points.glb path: {rel!r}",
            )
            # And it must resolve to a file that actually exists on disk.
            self.assertTrue(
                (tmp / rel).exists(),
                msg=f"point_fallback.path does not resolve under the output dir: {rel!r}",
            )


if __name__ == "__main__":
    unittest.main()