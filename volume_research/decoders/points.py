"""Sparse-points / .glb decoder.

Reads the POINTS primitive back into a (N, 4) float32 array (vec3 position
+ scalar density). Measures wall-clock decode time over multiple iterations.

The decoder is intentionally minimal — it does not validate every glTF
invariant; it reads the JSON header and the single BIN chunk and copies
the typed-array view. That is what an in-process immersive decoder would
do in practice.
"""

from __future__ import annotations

import hashlib
import json
import statistics
import struct
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

import numpy as np


@dataclass
class DecoderMeasurement:
    decoder: str
    decode_iterations: int
    decode_time_ms_median: float
    decode_time_ms_iqr: float
    samples_ms: list[float]
    decoded_hash_sha256: str
    decoded_shape: list[int]
    notes: dict


def _read_glb(path: Path) -> tuple[dict, bytes]:
    raw = path.read_bytes()
    magic, version, length = struct.unpack("<4sII", raw[:12])
    if magic != b"glTF":
        raise ValueError(f"{path}: not a glTF binary (magic={magic!r})")
    if version != 2:
        raise ValueError(f"{path}: only glTF 2 is supported (version={version})")
    if length != len(raw):
        raise ValueError(f"{path}: GLB length {length} != on-disk {len(raw)}")

    json_length, json_type = struct.unpack("<II", raw[12:20])
    if json_type != 0x4E4F534A:  # "JSON"
        raise ValueError(f"{path}: first chunk is not JSON (type={json_type:#x})")
    json_bytes = raw[20 : 20 + json_length]
    json_obj = json.loads(json_bytes.decode("utf-8"))

    bin_offset = 20 + json_length
    bin_length, bin_type = struct.unpack("<II", raw[bin_offset : bin_offset + 8])
    if bin_type != 0x494E4942:  # "BIN\0"
        raise ValueError(f"{path}: second chunk is not BIN (type={bin_type:#x})")
    bin_start = bin_offset + 8
    bin_bytes = raw[bin_start : bin_start + bin_length]
    return json_obj, bin_bytes


def _decode_points_once(path: Path) -> np.ndarray:
    json_obj, bin_bytes = _read_glb(path)
    accessors = json_obj["accessors"]
    position_acc = next(a for a in accessors if a["type"] == "VEC3")
    count = int(position_acc["count"])
    expected_bytes = count * 4 * 4  # 4 floats * 4 bytes
    if len(bin_bytes) != expected_bytes:
        raise ValueError(
            f"{path}: BIN chunk length {len(bin_bytes)} != expected {expected_bytes}"
        )
    arr = np.frombuffer(bin_bytes, dtype=np.float32).reshape(count, 4).copy()
    return arr


def measure_decode_points(path: Path, repeats: int) -> DecoderMeasurement:
    if repeats <= 0:
        raise ValueError("repeats must be positive")

    samples: list[float] = []
    decoded: np.ndarray | None = None
    for _ in range(repeats):
        start = time.perf_counter()
        arr = _decode_points_once(path)
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        samples.append(elapsed_ms)
        decoded = arr

    if decoded is None:
        raise RuntimeError("decoder produced no output")

    digest = hashlib.sha256(decoded.astype(np.float32).tobytes()).hexdigest()

    median = statistics.median(samples)
    if len(samples) >= 4:
        qs = statistics.quantiles(samples, n=4)
        q1, q3 = qs[0], qs[2]
    else:
        q1, q3 = min(samples), max(samples)
    iqr = float(q3 - q1)

    return DecoderMeasurement(
        decoder="points",
        decode_iterations=repeats,
        decode_time_ms_median=float(median),
        decode_time_ms_iqr=float(iqr),
        samples_ms=[float(s) for s in samples],
        decoded_hash_sha256=digest,
        decoded_shape=list(decoded.shape),
        notes={
            "decoder": "sparse_points_glb",
            "decoded_into": "float32 (N, 4): position xyz + density",
            "glb_version": 2,
        },
    )