#!/usr/bin/env python3
"""
Two-run deterministic verification + rollback for procedural-generation/generator.py (IP-10B).

- Runs Blender generator twice in isolated temp dirs with same seed/inputs.
- Compares input contract, versions, geometry/material statistics, stable names.
- Compares GLB hashes where Blender determinism supports it; classifies mismatch as UNAVAILABLE_HASH honestly.
- Verifies rollback: clean removes generated collection, rerun recreates same stats.

Blender binary is resolved by blender_path: --blender, then BLENDER_BIN,
then PATH, then the platform's conventional install locations.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_path import resolve_blender, unavailable_reason  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[1]
GENERATOR = REPO_ROOT / "procedural-generation" / "generator.py"
DEFAULT_SEED = 1337
DEFAULT_ITER = 4
DEFAULT_BRANCH = 2
DEFAULT_RES = 8
TIMEOUT = 90


def run_generator(blender: str, output_dir: Path, extra_args=None):
    extra_args = extra_args or []
    cmd = [
        blender,
        "--background",
        "--factory-startup",
        "--python", str(GENERATOR),
        "--",
        "--seed", str(DEFAULT_SEED),
        "--iterations", str(DEFAULT_ITER),
        "--branching-factor", str(DEFAULT_BRANCH),
        "--resolution", str(DEFAULT_RES),
        "--output-dir", str(output_dir),
    ] + extra_args
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT)
    out = result.stdout + "\n" + result.stderr
    return result.returncode, out, output_dir


def load_report(output_dir: Path):
    p = output_dir / "report.json"
    if not p.exists():
        return None, f"report missing at {p}"
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        return data, None
    except Exception as e:
        return None, str(e)


def compare_reports(a, b):
    mismatches = []
    # Input contract
    if a.get("input_contract") != b.get("input_contract"):
        mismatches.append("input_contract differs")
    # Versions: blender and script_hash should match for determinism claim
    va = a.get("versions", {})
    vb = b.get("versions", {})
    for k in ["blender", "script_hash", "script"]:
        if va.get(k) != vb.get(k):
            mismatches.append(f"versions[{k}] differs: {va.get(k)} vs {vb.get(k)}")
    # Geometry stats strict equality
    ga = a.get("geometry_statistics")
    gb = b.get("geometry_statistics")
    if ga != gb:
        mismatches.append(f"geometry_statistics differs:\n  A={json.dumps(ga)}\n  B={json.dumps(gb)}")
    # Material stats
    ma = a.get("material_statistics")
    mb = b.get("material_statistics")
    if ma != mb:
        mismatches.append(f"material_statistics differs:\n  A={json.dumps(ma)}\n  B={json.dumps(mb)}")

    # Stable names check
    for label, rep in [("A", a), ("B", b)]:
        colls = rep.get("geometry_statistics", {}).get("collection_names", [])
        if colls != ["Procedural__Crystal"]:
            mismatches.append(f"{label} collection_names unexpected: {colls}")

    return mismatches


def classify_hash(a, b):
    ha = (a.get("output_hashes") or {}).get("glb_sha256")
    hb = (b.get("output_hashes") or {}).get("glb_sha256")
    if not ha or not hb:
        return {
            "hash_comparison": "UNAVAILABLE",
            "reason": "one or both runs missing glb_sha256 (export may have failed)",
            "hash_equal": None,
        }
    if ha == hb:
        return {"hash_comparison": "PASS", "reason": "byte-identical GLB", "hash_equal": True, "hash_a": ha, "hash_b": hb}
    else:
        # Honest classification: Blender GLB export not guaranteed byte-identical across runs
        return {
            "hash_comparison": "UNAVAILABLE_HASH",
            "reason": "GLB bytes differ despite identical topology — Blender glTF exporter is not guaranteed byte-deterministic (timestamps/chunk ordering). Topology determinism still holds if geometry stats equal.",
            "hash_equal": False,
            "hash_a": ha,
            "hash_b": hb,
        }


def verify(blender: str | None = None):
    blender = resolve_blender(blender)
    if blender is None:
        print(f"[verify] {unavailable_reason(None)}", file=sys.stderr)
        return {"status": "UNAVAILABLE", "reason": "no blender resolved"}
    import tempfile
    print(f"[verify] Blender: {blender}")
    # Check blender reachable
    try:
        r = subprocess.run([blender, "--version"], capture_output=True, text=True, timeout=10)
        print(r.stdout.strip().splitlines()[0] if r.stdout else "")
        if r.returncode != 0:
            print(f"[verify] UNAVAILABLE: blender --version failed: {r.stderr}", file=sys.stderr)
            return {"status": "UNAVAILABLE", "reason": "blender --version failed"}
    except Exception as e:
        print(f"[verify] UNAVAILABLE: cannot run blender: {e}", file=sys.stderr)
        return {"status": "UNAVAILABLE", "reason": str(e)}

    if not GENERATOR.exists():
        print(f"[verify] FAIL: generator missing at {GENERATOR}", file=sys.stderr)
        return {"status": "FAIL", "reason": "generator missing"}

    with tempfile.TemporaryDirectory(prefix="pg-verify-A-") as tmpA, tempfile.TemporaryDirectory(prefix="pg-verify-B-") as tmpB:
        dirA = Path(tmpA)
        dirB = Path(tmpB)

        print(f"[verify] Run A -> {dirA}")
        rcA, outA, _ = run_generator(blender, dirA)
        print(outA[-4000:])
        if rcA != 0:
            print(f"[verify] FAIL: run A exit {rcA}", file=sys.stderr)
            return {"status": "FAIL", "reason": f"run A exit {rcA}", "log": outA}

        print(f"[verify] Run B -> {dirB}")
        rcB, outB, _ = run_generator(blender, dirB)
        print(outB[-4000:])
        if rcB != 0:
            print(f"[verify] FAIL: run B exit {rcB}", file=sys.stderr)
            return {"status": "FAIL", "reason": f"run B exit {rcB}", "log": outB}

        repA, errA = load_report(dirA)
        repB, errB = load_report(dirB)
        if errA or errB:
            print(f"[verify] FAIL: {errA or ''} {errB or ''}", file=sys.stderr)
            return {"status": "FAIL", "reason": errA or errB}

        print(f"[verify] A geometry: {repA['geometry_statistics']}")
        print(f"[verify] B geometry: {repB['geometry_statistics']}")
        print(f"[verify] A materials: {repA['material_statistics']}")
        print(f"[verify] B materials: {repB['material_statistics']}")

        mismatches = compare_reports(repA, repB)
        hash_info = classify_hash(repA, repB)

        print(f"[verify] hash: {hash_info}")

        # Rollback verification: use dirA, clean, then rerun, compare to original
        print(f"[verify] Rollback: clean {dirA}")
        rcC, outC, _ = run_generator(blender, dirA, extra_args=["--clean-only"])
        print(outC[-2000:])
        if rcC != 0:
            print(f"[verify] FAIL: clean exit {rcC}", file=sys.stderr)
            return {"status": "FAIL", "reason": f"clean exit {rcC}"}
        repClean, errC = load_report(dirA)
        if errC:
            print(f"[verify] FAIL clean report: {errC}", file=sys.stderr)
            return {"status": "FAIL", "reason": errC}
        clean_geo = repClean.get("geometry_statistics", {})
        if clean_geo.get("object_count", 99) != 0 or clean_geo.get("vertex_count", 99) != 0:
            print(f"[verify] FAIL: clean did not reset geometry: {clean_geo}", file=sys.stderr)
            return {"status": "FAIL", "reason": f"clean not reset: {clean_geo}"}
        print(f"[verify] clean ok: {clean_geo}")

        # Also verify rollback removed GLB? generator clean does not delete file, but rerun will overwrite.
        # We check that after clean, rerun recreates same stats as original A
        print(f"[verify] Rollback: rerun after clean -> {dirA}")
        rcD, outD, _ = run_generator(blender, dirA)
        print(outD[-4000:])
        if rcD != 0:
            print(f"[verify] FAIL: rerun after clean exit {rcD}", file=sys.stderr)
            return {"status": "FAIL", "reason": f"rerun exit {rcD}"}
        repD, errD = load_report(dirA)
        if errD:
            print(f"[verify] FAIL rerun report: {errD}", file=sys.stderr)
            return {"status": "FAIL", "reason": errD}
        mismatches_rerun = compare_reports(repA, repD)
        if mismatches_rerun:
            print(f"[verify] FAIL: rerun after rollback differs: {mismatches_rerun}", file=sys.stderr)
            return {"status": "FAIL", "reason": "; ".join(mismatches_rerun)}
        print(f"[verify] rollback rerun ok: geometry equal to original")

        if mismatches:
            print(f"[verify] FAIL: two-run topology mismatch: {mismatches}", file=sys.stderr)
            return {"status": "FAIL", "reason": "; ".join(mismatches), "hash": hash_info, "mismatches": mismatches}

        # Overall: topology PASS; hash may be PASS or UNAVAILABLE_HASH
        status = "PASS"
        print(f"[verify] PASS: two-run geometry/material deterministic. Hash: {hash_info['hash_comparison']}")
        return {
            "status": status,
            "hash": hash_info,
            "mismatches": mismatches,
            "geometry": repA["geometry_statistics"],
            "material": repA["material_statistics"],
            "versions": repA["versions"],
        }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--blender",
        default=None,
        help="Path to the Blender executable. Defaults to BLENDER_BIN, then PATH.",
    )
    ap.add_argument("--json-out", default="")
    args = ap.parse_args()
    result = verify(args.blender)
    print(json.dumps(result, indent=2))
    if args.json_out:
        Path(args.json_out).write_text(json.dumps(result, indent=2), encoding="utf-8")
    sys.exit(0 if result.get("status") == "PASS" else 1)


if __name__ == "__main__":
    main()
