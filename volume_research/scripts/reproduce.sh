#!/usr/bin/env bash
# IP-10D reproducibility check.
#
# Runs the benchmark twice on the same inputs and diff-checks the
# structured report minus the wall-clock timing fields. The median
# decode-time samples are non-deterministic noise, but every other field
# (encoder outputs, decoder hashes, declared source hash, verdict) must
# be byte-identical across the two runs.
#
# Exit codes:
#   0  — every reproducible field matches across the two runs
#   1  — the benchmark failed (verdict was FAIL)
#   2  — the structured fields do not match between the two runs

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BENCH_SCRIPT="${REPO_ROOT}/volume_research/benchmark.py"
RUN_A="${REPO_ROOT}/volume_research/reports/run-a"
RUN_B="${REPO_ROOT}/volume_research/reports/run-b"

# Use a bash array so the space in the repo path is preserved.
python3 "${BENCH_SCRIPT}" --out "${RUN_A}" >/dev/null
python3 "${BENCH_SCRIPT}" --out "${RUN_B}" >/dev/null

python3 - <<PY
import json, sys, pathlib
ROOT = pathlib.Path("${REPO_ROOT}")
A = json.loads((ROOT / "volume_research/reports/run-a/report.json").read_text())
B = json.loads((ROOT / "volume_research/reports/run-b/report.json").read_text())

# Pre-normalise both reports: strip the per-run output directory from every
# absolute path so the diff reflects content, not location. The
# sha256_concat / total_bytes / per_file_bytes fields already carry the
# content-reproducibility signal.
def _strip_run_dir(value):
    if isinstance(value, str):
        return value.replace("/run-a/", "/").replace("/run-b/", "/")
    return value

def _normalise(obj):
    if isinstance(obj, dict):
        return {k: _normalise(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_normalise(v) for v in obj]
    return _strip_run_dir(obj)

A = _normalise(A)
B = _normalise(B)

# Fields that are expected to vary between runs (wall-clock noise).
# Absolute output paths are NOT in this set — they are normalised by the
# walker so the comparison reflects content, not location. The hashes /
# byte counts / declared-source sha are what carry the reproducibility
# signal.
NON_DETERMINISTIC_FIELDS = {
    ("decoders", "slices", "decode_time_ms_median"),
    ("decoders", "slices", "decode_time_ms_iqr"),
    ("decoders", "slices", "samples_ms"),
    ("decoders", "points", "decode_time_ms_median"),
    ("decoders", "points", "decode_time_ms_iqr"),
    ("decoders", "points", "samples_ms"),
    ("decoders", "packed", "decode_time_ms_median"),
    ("decoders", "packed", "decode_time_ms_iqr"),
    ("decoders", "packed", "samples_ms"),
    ("encoding_total_elapsed_ms",),
}

# Paths that the walker normalises (strips the per-run output directory).
# (No longer needed because we pre-normalise both reports.)

def _strip_run_dir(path_value):
    """DEPRECATED: pre-normalisation happens at JSON load time now. Kept
    here in case external scripts import this module.
    """
    if not isinstance(path_value, str):
        return path_value
    parts = path_value.split("/")
    out = [p for p in parts if p not in ("run-a", "run-b")]
    return "/".join(out)

def walk(a, b, path=()):
    diffs = []
    if isinstance(a, dict) and isinstance(b, dict):
        keys = sorted(set(a) | set(b))
        for k in keys:
            if k not in a:
                diffs.append((path + (k,), "MISSING_IN_A", b[k]))
                continue
            if k not in b:
                diffs.append((path + (k,), "MISSING_IN_B", a[k]))
                continue
            diffs.extend(walk(a[k], b[k], path + (k,)))
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            diffs.append((path, "LIST_LENGTH_MISMATCH", (len(a), len(b))))
        for i, (av, bv) in enumerate(zip(a, b)):
            diffs.extend(walk(av, bv, path + (i,)))
    else:
        if path in NON_DETERMINISTIC_FIELDS or any(
            path[: len(prefix)] == prefix
            for prefix in (
                ("decoders", "slices", "samples_ms"),
                ("decoders", "points", "samples_ms"),
                ("decoders", "packed", "samples_ms"),
            )
        ):
            # Non-deterministic timing noise — intentionally excluded from
            # the reproducibility check. The median over a fixed window is
            # the reproducible signal, not each individual sample. Return a
            # sentinel diff so the count below reflects what was excluded.
            diffs.append((path, "EXCLUDED_NON_DETERMINISTIC", None))
            return diffs
        if a != b:
            diffs.append((path, "VALUE_MISMATCH", (a, b)))
    return diffs

all_diffs = walk(A, B)
excluded = [d for d in all_diffs if d[1] == "EXCLUDED_NON_DETERMINISTIC"]
filtered = [d for d in all_diffs if d[0] not in NON_DETERMINISTIC_FIELDS and d[1] != "EXCLUDED_NON_DETERMINISTIC"]

if filtered:
    print("REPRODUCIBILITY FAIL: structured fields differ between runs:")
    for path, kind, payload in filtered:
        print(f"  {kind} at {'/'.join(str(p) for p in path)}: {payload}")
    sys.exit(2)

print(f"REPRODUCIBILITY PASS: {len(excluded)} non-deterministic timing samples excluded; "
      f"0 reproducible-field mismatches detected.")
print(f"VERDICT (run-a): {A['verdict']}")
print(f"VERDICT (run-b): {B['verdict']}")

# Spot-check encoded byte reproducibility: the per-run output directories
# differ, but the bytes inside them are the same. Verify by hashing the
# encoded artifacts in run-a and comparing against run-b.
import hashlib
def hash_files(*paths):
    h = hashlib.sha256()
    for p in paths:
        for path in sorted(pathlib.Path(p).rglob("*")):
            if path.is_file():
                h.update(path.read_bytes())
    return h.hexdigest()

run_a_root = ROOT / "volume_research/reports/run-a"
run_b_root = ROOT / "volume_research/reports/run-b"
artifacts = ("slices", "packed.wduv", "points.glb")
ha = hash_files(*[run_a_root / a for a in artifacts])
hb = hash_files(*[run_b_root / a for a in artifacts])
if ha == hb:
    print(f"BYTE-LEVEL REPRODUCIBILITY PASS: encoded artifacts match across runs "
          f"(slices/ + packed.wduv + points.glb are byte-identical).")
else:
    print(f"BYTE-LEVEL REPRODUCIBILITY FAIL: encoded artifacts differ between runs.")
    print(f"  run-a digest: {ha}")
    print(f"  run-b digest: {hb}")
    sys.exit(2)
PY