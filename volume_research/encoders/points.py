"""Minimal glTF 2.0 binary (.glb) writer for the IP-10D sparse-points encoder.

Writes a single POINTS primitive carrying:

* ``POSITION`` VEC3 float32 (3 * visible_count * 4 bytes)
* ``DENSITY``  scalar float32 (1 * visible_count * 4 bytes)

The decoder is responsible for reading this back into the point cloud; the
encoder only writes the canonical layout described here. The format is
self-describing because the JSON header lists the accessors and their types.

Output is byte-stable across runs: the JSON is serialised with ``sort_keys``
and the binary chunk is built in fixed order.
"""

from __future__ import annotations

import json
import struct
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

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


def _write_glb(path: Path, json_header: dict, binary_blob: bytes) -> None:
    json_bytes = json.dumps(json_header, sort_keys=True, separators=(",", ":")).encode("utf-8")
    # Pad JSON to 4-byte alignment with ASCII spaces (the standard convention).
    if len(json_bytes) % 4 != 0:
        json_bytes += b" " * (4 - len(json_bytes) % 4)
    if len(binary_blob) % 4 != 0:
        binary_blob += b"\x00" * (4 - len(binary_blob) % 4)

    total_length = (
        12  # GLB header
        + 8 + len(json_bytes)  # JSON chunk header + payload
        + 8 + len(binary_blob)  # BIN chunk header + payload
    )

    with path.open("wb") as fh:
        fh.write(struct.pack("<4sII", b"glTF", 2, total_length))
        fh.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))  # "JSON"
        fh.write(json_bytes)
        fh.write(struct.pack("<II", len(binary_blob), 0x494E4942))  # "BIN\0"
        fh.write(binary_blob)


def _quantise_visible_cells(density: np.ndarray, threshold: float) -> tuple[np.ndarray, np.ndarray]:
    """Return positions and densities for cells above the threshold.

    Positions are the world-space cell centers in [0,1]^3 (the declared
    bounds). Two runs with the same density produce byte-identical arrays
    because the threshold comparison and the sort-by-z then-y then-x are
    deterministic.
    """
    resolution = density.shape
    visible_mask = density >= threshold
    visible_density = density[visible_mask]

    coords = np.indices(resolution, dtype=np.float32)
    # Convert from grid index to world-space center in [0,1].
    cell_size = 1.0 / np.array(resolution, dtype=np.float32)
    coords = (coords + 0.5) * cell_size[:, None, None, None]
    positions = coords[:, visible_mask].T  # (N, 3)

    # Sort lexicographically (z, then y, then x) so the GLB layout is
    # reproducible across runs.
    order = np.lexsort([positions[:, 0], positions[:, 1], positions[:, 2]])
    positions = positions[order]
    visible_density = visible_density[order]
    return positions.astype(np.float32), visible_density.astype(np.float32)


def encode_points(
    declaration: dict,
    density: np.ndarray,
    output_dir: Path,
    *,
    threshold_override: Optional[float] = None,
    output_name: str = "points.glb",
) -> EncoderResult:
    threshold = (
        float(threshold_override)
        if threshold_override is not None
        else float(declaration["density_model"]["threshold"])
    )
    positions, point_density = _quantise_visible_cells(density, threshold)
    visible_count = int(positions.shape[0])

    # Interleave position (vec3) and density (scalar) into a single typed
    # array buffer for byte-stable layout.
    interleave = np.empty((visible_count, 4), dtype=np.float32)
    interleave[:, :3] = positions
    interleave[:, 3] = point_density
    interleave_bytes = interleave.tobytes()

    json_header = {
        "asset": {"generator": "wdu-volume-research-encoder-points", "version": "1"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [
            {
                "primitives": [
                    {
                        "mode": 0,  # POINTS
                        "attributes": {"POSITION": 0, "DENSITY": 1},
                    }
                ]
            }
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,  # FLOAT
                "count": visible_count,
                "type": "VEC3",
                "max": positions.max(axis=0).tolist() if visible_count else [0, 0, 0],
                "min": positions.min(axis=0).tolist() if visible_count else [0, 0, 0],
            },
            {
                "bufferView": 0,
                "componentType": 5126,  # FLOAT
                "count": visible_count,
                "type": "SCALAR",
                "max": [float(point_density.max())] if visible_count else [0.0],
                "min": [float(point_density.min())] if visible_count else [0.0],
            },
        ],
        "bufferViews": [
            {
                "buffer": 0,
                "byteOffset": 0,
                "byteLength": len(interleave_bytes),
            }
        ],
        "buffers": [{"byteLength": len(interleave_bytes)}],
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    glb_path = output_dir / output_name
    _write_glb(glb_path, json_header, interleave_bytes)
    on_disk = glb_path.stat().st_size

    import hashlib

    sha = hashlib.sha256(glb_path.read_bytes()).hexdigest()

    # GPU memory estimate:
    #   - VBO holds position(3 floats) + density(1 float) per visible cell
    #   - visible cells = visible_count (already filtered at threshold)
    #   - the points encoder is the *fallback* representation too — any
    #     immersive code that already loads GLB POINTS can consume this.
    bytes_per_point = 4 * 4  # 4 floats * 4 bytes
    gpu_memory = visible_count * bytes_per_point

    notes = {
        "encoder": "sparse_points",
        "format": "glTF 2.0 binary (.glb), POINTS primitive",
        "visible_count": visible_count,
        "bytes_per_point": bytes_per_point,
        "is_point_fallback": True,
        "threshold": threshold,
        "interleaved_layout": "vec3 position, scalar density",
    }

    return EncoderResult(
        encoder="points",
        output_paths=[str(glb_path)],
        total_bytes=on_disk,
        per_file_bytes=[on_disk],
        sha256_concat=sha,
        gpu_memory_estimate_bytes=int(gpu_memory),
        notes=notes,
    )