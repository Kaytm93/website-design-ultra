"""Slice-textures decoder.

Reads the encoded slice stack back into a 3D ``uint8`` volume. Measures
wall-clock decode time over ``runtime.decoder_repeats`` iterations and
returns the median and inter-quartile range.
"""

from __future__ import annotations

import statistics
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Sequence

import numpy as np

from ._png import decode_png_gray


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


def _decode_slices_once(slice_paths: Sequence[Path]) -> np.ndarray:
    layers = [decode_png_gray(p) for p in slice_paths]
    if not layers:
        raise ValueError("no slices to decode")
    height, width = layers[0].shape
    if any(layer.shape != (height, width) for layer in layers):
        raise ValueError("slice shape mismatch")
    return np.stack(layers, axis=2).copy()


def measure_decode_slices(slice_paths: Sequence[Path], repeats: int) -> DecoderMeasurement:
    if repeats <= 0:
        raise ValueError("repeats must be positive")

    samples: list[float] = []
    decoded_volume: np.ndarray | None = None
    for _ in range(repeats):
        start = time.perf_counter()
        decoded = _decode_slices_once(slice_paths)
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        samples.append(elapsed_ms)
        decoded_volume = decoded  # last one is what we hash

    if decoded_volume is None:
        raise RuntimeError("decoder produced no output")

    decoded_hash = (
        decoded_volume.astype(np.uint8).tobytes()
        if decoded_volume.dtype == np.uint8
        else decoded_volume.astype(np.float32).tobytes()
    )
    import hashlib

    digest = hashlib.sha256(decoded_hash).hexdigest()

    median = statistics.median(samples)
    if len(samples) >= 4:
        qs = statistics.quantiles(samples, n=4)
        q1, q3 = qs[0], qs[2]
    else:
        q1, q3 = min(samples), max(samples)
    iqr = float(q3 - q1)

    return DecoderMeasurement(
        decoder="slices",
        decode_iterations=repeats,
        decode_time_ms_median=float(median),
        decode_time_ms_iqr=float(iqr),
        samples_ms=[float(s) for s in samples],
        decoded_hash_sha256=digest,
        decoded_shape=list(decoded_volume.shape),
        notes={
            "decoder": "slice_textures",
            "decoded_into": "uint8 volume (x, y, z)",
            "filter_types_supported": [0],
        },
    )