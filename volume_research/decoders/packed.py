"""Packed-voxels decoder.

Reads the 32-byte header + body back into a ``uint8`` volume of the
declared resolution. Measures wall-clock decode time over multiple
iterations.

The decoder enforces the magic and version so a future format revision
fails explicitly rather than silently misreading a different blob.
"""

from __future__ import annotations

import hashlib
import statistics
import struct
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np

MAGIC = b"WDUV"
HEADER_VERSION_EXPECTED = 1
HEADER_SIZE = 32


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


def _decode_packed_once(path: Path) -> np.ndarray:
    blob = path.read_bytes()
    if len(blob) < HEADER_SIZE:
        raise ValueError(f"{path}: blob too small ({len(blob)} bytes) for {HEADER_SIZE}-byte header")
    # Header layout (must match encoders/packed.py::_pack_header):
    #   magic (4s), version (I), resolution x/y/z (III), threshold (f), reserved (8x)
    decoded_magic, version, rx, ry, rz, threshold = struct.unpack(
        "<4sIIII f 8x", blob[:HEADER_SIZE]
    )
    if decoded_magic != MAGIC:
        raise ValueError(f"{path}: bad magic {decoded_magic!r} (expected {MAGIC!r})")
    if version != HEADER_VERSION_EXPECTED:
        raise ValueError(f"{path}: unsupported header version {version}")

    body = blob[HEADER_SIZE:]
    expected = rx * ry * rz
    if len(body) != expected:
        raise ValueError(
            f"{path}: body length {len(body)} != expected {expected} for resolution ({rx},{ry},{rz})"
        )
    arr = np.frombuffer(body, dtype=np.uint8).reshape(rx, ry, rz).copy()
    return arr


def measure_decode_packed(path: Path, repeats: int) -> DecoderMeasurement:
    if repeats <= 0:
        raise ValueError("repeats must be positive")

    samples: list[float] = []
    decoded: np.ndarray | None = None
    for _ in range(repeats):
        start = time.perf_counter()
        arr = _decode_packed_once(path)
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        samples.append(elapsed_ms)
        decoded = arr

    if decoded is None:
        raise RuntimeError("decoder produced no output")

    digest = hashlib.sha256(decoded.astype(np.uint8).tobytes()).hexdigest()

    median = statistics.median(samples)
    if len(samples) >= 4:
        qs = statistics.quantiles(samples, n=4)
        q1, q3 = qs[0], qs[2]
    else:
        q1, q3 = min(samples), max(samples)
    iqr = float(q3 - q1)

    return DecoderMeasurement(
        decoder="packed",
        decode_iterations=repeats,
        decode_time_ms_median=float(median),
        decode_time_ms_iqr=float(iqr),
        samples_ms=[float(s) for s in samples],
        decoded_hash_sha256=digest,
        decoded_shape=list(decoded.shape),
        notes={
            "decoder": "packed_voxels",
            "decoded_into": "uint8 volume (x, y, z)",
            "header_size_bytes": HEADER_SIZE,
            "magic": MAGIC.decode("ascii"),
            "version": HEADER_VERSION_EXPECTED,
        },
    )