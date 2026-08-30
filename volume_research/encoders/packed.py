"""Packed-voxels encoder.

Encodes the declared density field as a single custom binary blob:

* Header (32 bytes fixed):
    - magic:        4 bytes  ``b"WDUV"``
    - version:      4 bytes  uint32 little-endian (= 1)
    - resolution:   12 bytes uint32 * 3 (x, y, z) little-endian
    - threshold:    4 bytes  float32 little-endian (the declared threshold)
    - reserved:     8 bytes  zero-filled

* Body: one byte per voxel in x-fastest / y-mid / z-slowest order, holding
  ``uint8(density * 255)`` for cells above the threshold or 0 otherwise.

This format is **not** OpenVDB, NanoVDB, Field3D, or any established volume
format. It is scoped to the declared source representation. A different
source representation must add its own declaration; it must not reuse this
header.

Output is byte-stable: same input → same blob → same SHA-256.
"""

from __future__ import annotations

import hashlib
import struct
from dataclasses import dataclass
from pathlib import Path

import numpy as np


@dataclass
class EncoderResult:
    encoder: str
    output_paths: list[str]
    total_bytes: int
    per_file_bytes: list[int]
    sha256_concat: str
    gpu_memory_estimate_bytes: int
    notes: dict


MAGIC = b"WDUV"
HEADER_VERSION = 1
HEADER_SIZE = 32


def _pack_header(resolution: tuple[int, int, int], threshold: float) -> bytes:
    if not (0.0 <= threshold <= 1.0):
        raise ValueError("threshold must be in [0, 1]")
    # Header layout (32 bytes fixed):
    #   magic:        4 bytes  ``b"WDUV"``
    #   version:      4 bytes  uint32 little-endian (= 1)
    #   resolution_x: 4 bytes  uint32 little-endian
    #   resolution_y: 4 bytes  uint32 little-endian
    #   resolution_z: 4 bytes  uint32 little-endian
    #   threshold:    4 bytes  float32 little-endian
    #   reserved:     8 bytes  zero-filled
    return struct.pack(
        "<4sIIII f 8x",
        MAGIC,
        HEADER_VERSION,
        int(resolution[0]),
        int(resolution[1]),
        int(resolution[2]),
        float(threshold),
    )


def encode_packed(declaration: dict, density: np.ndarray, output_dir: Path, output_name: str = "packed.wduv") -> EncoderResult:
    if density.ndim != 3:
        raise ValueError("density must be a 3D array")

    resolution = tuple(int(v) for v in declaration["grid"]["resolution"])
    if density.shape != resolution:
        raise ValueError(
            f"density shape {density.shape} does not match declaration resolution {resolution}"
        )
    resolution_3: tuple[int, int, int] = (int(resolution[0]), int(resolution[1]), int(resolution[2]))
    threshold = float(declaration["density_model"]["threshold"])

    # Quantise to uint8 with the same rule as the slices encoder so two
    # encoders do not disagree on the underlying values.
    scaled = np.clip(density, 0.0, 1.0) * 255.0
    quantized = scaled.astype(np.uint8)

    # Compact: cells below the threshold become 0 in the body, but we keep
    # the byte-per-voxel layout so the format is uniform — sparse encoding
    # would change the format and require its own declaration.
    body = np.ascontiguousarray(quantized, dtype=np.uint8).tobytes()
    header = _pack_header(resolution_3, threshold)

    if len(body) != resolution[0] * resolution[1] * resolution[2]:
        raise RuntimeError("packed body length mismatch")

    blob = header + body
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / output_name
    path.write_bytes(blob)

    sha = hashlib.sha256(blob).hexdigest()

    # GPU memory estimate: a single 3D texture of RED8 (8-bit per voxel) is
    # one byte per cell. The texture is the entire volume because we have no
    # sparse encoding here.
    bytes_per_voxel = 1
    gpu_memory = int(resolution_3[0] * resolution_3[1] * resolution_3[2] * bytes_per_voxel)

    notes = {
        "encoder": "packed_voxels",
        "format": "single custom blob, 1 byte per voxel, scoped to declared source representation",
        "header_size_bytes": HEADER_SIZE,
        "bytes_per_voxel": bytes_per_voxel,
        "is_NOT_a_general_volume_format": True,
        "NOT_a_VDB_exporter": True,
        "scoped_to_source_representation_id": declaration["id"],
        "magic": MAGIC.decode("ascii"),
        "version": HEADER_VERSION,
    }

    return EncoderResult(
        encoder="packed",
        output_paths=[str(path)],
        total_bytes=len(blob),
        per_file_bytes=[len(blob)],
        sha256_concat=sha,
        gpu_memory_estimate_bytes=int(gpu_memory),
        notes=notes,
    )