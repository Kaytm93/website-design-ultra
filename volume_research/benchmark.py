"""Volume representation research benchmark — IP-10D.

Orchestrates the encode + decode cycle for the three candidate
representations and writes a structured report plus a human-readable
markdown report. The benchmark does not pick a winner; the report layer
does that with explicit, declared margins and falls back to ``INCONCLUSIVE``
when the evidence does not establish a clear winner.

Run from the repository root:

    python3 volume_research/benchmark.py            # writes reports/report.json + report.md
    python3 volume_research/benchmark.py --out <path>

Exit codes:
    0  — every encoder and decoder ran, the structured report is written
    1  — an encoder or decoder raised
    2  — the source representation's declared statistics were not met
         (e.g. the synthetic density is too far from the declared sparsity)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import time
from dataclasses import asdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILE = REPO_ROOT / "volume_research" / "source-representation.json"
RUNTIME_FILE = REPO_ROOT / "volume_research" / "research" / "runtime.json"
DEFAULT_REPORT_DIR = REPO_ROOT / "volume_research" / "reports"

# Ensure the package is importable when invoked as a script.
sys.path.insert(0, str(REPO_ROOT))

from volume_research.encoders import encode_slices, encode_points, encode_packed  # noqa: E402
from volume_research.decoders.slices import measure_decode_slices  # noqa: E402
from volume_research.decoders.points import measure_decode_points  # noqa: E402
from volume_research.decoders.packed import measure_decode_packed  # noqa: E402
from volume_research.research import (  # noqa: E402
    load_declaration,
    build_density_field,
    assert_stats_within_tolerance,
    declaration_summary,
)
from volume_research import report as report_module  # noqa: E402


def _hash_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _clean_directory(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def run_benchmark(declaration: dict, runtime: dict, output_dir: Path) -> dict:
    """Run the full encode + decode cycle and return the structured report."""

    # Always start from a clean output directory so reproducibility is not
    # poisoned by leftover files from a previous run.
    _clean_directory(output_dir)

    # 1. Build the deterministic density field. Assert that it matches the
    # declaration's declared statistics so a wrong seed or wrong parameters
    # fail loudly.
    density, stats = build_density_field(declaration)
    assert_stats_within_tolerance(stats, declaration)

    repeats = int(runtime["decoder_repeats"])

    # 2. Encode all three representations.
    enc_started = time.perf_counter()
    slices_enc = encode_slices(declaration, density, output_dir)
    points_enc = encode_points(declaration, density, output_dir)
    packed_enc = encode_packed(declaration, density, output_dir)
    enc_elapsed_ms = (time.perf_counter() - enc_started) * 1000.0

    # 3. Decode each representation back, measuring wall-clock time.
    slice_paths = [Path(p) for p in slices_enc.output_paths]
    slices_dec = measure_decode_slices(slice_paths, repeats=repeats)
    points_dec = measure_decode_points(Path(points_enc.output_paths[0]), repeats=repeats)
    packed_dec = measure_decode_packed(Path(packed_enc.output_paths[0]), repeats=repeats)

    # 4. Encode the structured report.
    encoder_results = {
        "slices": asdict(slices_enc),
        "points": asdict(points_enc),
        "packed": asdict(packed_enc),
    }
    decoder_results = {
        "slices": asdict(slices_dec),
        "points": asdict(points_dec),
        "packed": asdict(packed_dec),
    }

    # The point fallback note comes from the encoder notes; record it
    # explicitly at the report root so the gate does not depend on reading
    # the encoder's notes block.
    point_fallback = {
        "representation": "points",
        "format": "glTF 2.0 .glb POINTS primitive",
        "path": points_enc.output_paths[0],
        "consumable_by": "3d-asset-pipeline inspect / validate / optimize",
        "visible_count": points_enc.notes["visible_count"],
        "bytes_on_disk": points_enc.total_bytes,
    }

    structured = {
        "schemaVersion": 1,
        "task": "IP-10D",
        "title": "Volume representation research gate",
        "declared_source_representation": declaration_summary(declaration),
        "declared_source_sha256": _hash_file(SOURCE_FILE),
        "runtime_config": {
            "runtime_version": runtime["runtime_version"],
            "decoder_repeats": repeats,
            "winner_margin": runtime["winner_margin"],
        },
        "density_statistics": stats,
        "encoders": encoder_results,
        "decoders": decoder_results,
        "point_fallback": point_fallback,
        "encoding_total_elapsed_ms": enc_elapsed_ms,
        "verdict": "PENDING",
        "recommendation": "",
    }

    # 5. Compute the verdict via the report module.
    structured["verdict"], structured["recommendation"] = report_module.compute_verdict(
        structured, runtime
    )

    return structured


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="IP-10D volume representation benchmark")
    parser.add_argument(
        "--out",
        default=str(DEFAULT_REPORT_DIR),
        help="Directory in which report.json and report.md are written.",
    )
    parser.add_argument(
        "--source",
        default=str(SOURCE_FILE),
        help="Path to the source-representation declaration.",
    )
    parser.add_argument(
        "--runtime",
        default=str(RUNTIME_FILE),
        help="Path to the runtime config.",
    )
    args = parser.parse_args(argv)

    declaration = load_declaration(Path(args.source))
    runtime = json.loads(Path(args.runtime).read_text(encoding="utf-8"))
    out_dir = Path(args.out)

    try:
        structured = run_benchmark(declaration, runtime, out_dir)
    except AssertionError as exc:
        _write_json(out_dir / "report.json", {
            "schemaVersion": 1,
            "task": "IP-10D",
            "verdict": "FAIL",
            "recommendation": "",
            "failure": str(exc),
        })
        print(f"FAIL: declared source statistics not met: {exc}", file=sys.stderr)
        return 2

    _write_json(out_dir / "report.json", structured)
    (out_dir / "report.md").write_text(report_module.render_markdown(structured), encoding="utf-8")
    print(structured["verdict"])
    return 0


if __name__ == "__main__":
    sys.exit(main())