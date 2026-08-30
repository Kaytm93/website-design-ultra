"""Deterministic volume builder for the IP-10D research gate.

Reads ``source-representation.json`` and emits the raw density buffer plus
its declared statistics. Two runs with the same seed and the same
declaration produce byte-identical buffers.

This module is the only place the source representation becomes bytes. Every
encoder consumes this buffer; the report reads its declared statistics to
verify the volume is what the declaration says it is.
"""

from __future__ import annotations

import hashlib
import json
import math
import struct
from pathlib import Path

import numpy as np

SOURCE_FILE = Path(__file__).resolve().parent.parent / "source-representation.json"


def load_declaration(path: Path = SOURCE_FILE) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def build_anchors(count: int, seed: int, bounds_min, bounds_max) -> np.ndarray:
    """Place ``count`` deterministic anchor points inside the box.

    Anchors are seeded by the declaration's ``anchors_seed``. The positions
    are reproducible across hosts because they use ``numpy.random.default_rng``
    with the seed captured at declaration load time.
    """
    rng = np.random.default_rng(seed)
    anchors = np.empty((count, 3), dtype=np.float64)
    for axis in range(3):
        anchors[:, axis] = rng.uniform(bounds_min[axis], bounds_max[axis], size=count)
    return anchors


def _nearest_neighbour_distances(anchors: np.ndarray) -> np.ndarray:
    """Brute-force nearest-neighbour distances for a small anchor set.

    The research gate declares 8 anchors, so brute force is trivial and
    keeps the gate dependency-free apart from numpy.
    """
    count = anchors.shape[0]
    diffs = anchors[:, None, :] - anchors[None, :, :]
    dists = np.sqrt(np.sum(diffs * diffs, axis=-1))
    np.fill_diagonal(dists, np.inf)
    return dists.min(axis=1)


def build_density_field(declaration: dict) -> tuple[np.ndarray, dict]:
    """Build the full density buffer and the declared statistics.

    The field is a sum-of-gaussians over ``anchors_count`` anchors placed by
    ``anchors_seed``. The falloff sigma is derived from the average nearest
    anchor spacing, which keeps the field dense enough that the visible volume
    fraction is meaningful but not opaque.
    """
    grid = declaration["grid"]
    resolution = tuple(int(v) for v in grid["resolution"])
    cell_count = int(grid["cell_count"])
    assert resolution[0] * resolution[1] * resolution[2] == cell_count, (
        "resolution must multiply to cell_count"
    )

    bounds = declaration["domain"]["bounds"]
    bounds_min = np.array(bounds["min"], dtype=np.float64)
    bounds_max = np.array(bounds["max"], dtype=np.float64)

    anchors = build_anchors(
        int(declaration["anchors_count"]),
        int(declaration["anchors_seed"]),
        bounds_min,
        bounds_max,
    )

    # Per-axis sample positions. Use linspace so the cell centers are placed
    # uniformly inside the bounds. We exclude the very edges to avoid the
    # "boundary cell" ambiguity.
    axes = [
        np.linspace(bounds_min[i], bounds_max[i], resolution[i], endpoint=False, dtype=np.float64)
        + (bounds_max[i] - bounds_min[i]) / (2 * resolution[i])
        for i in range(3)
    ]
    grid_x, grid_y, grid_z = np.meshgrid(axes[0], axes[1], axes[2], indexing="ij")

    # Sigma: half of the average nearest-neighbour anchor spacing. This keeps
    # the falloff local to each anchor and produces a "fog clusters around the
    # skeleton" topology that the report can reason about.
    if anchors.shape[0] > 1:
        nn = _nearest_neighbour_distances(anchors)
        sigma = float(nn.mean()) / 2.0
    else:
        sigma = 0.1
    sigma = max(sigma, 1e-3)

    density = np.zeros(resolution, dtype=np.float32)
    for anchor in anchors:
        dx = grid_x - anchor[0]
        dy = grid_y - anchor[1]
        dz = grid_z - anchor[2]
        r2 = dx * dx + dy * dy + dz * dz
        density += np.exp(-r2 / (sigma * sigma))

    if density.max() > 0:
        density = density / density.max()

    threshold = float(declaration["density_model"]["threshold"])
    visible_mask = density >= threshold
    sparsity = float(1.0 - visible_mask.mean())
    mean_density = float(density.mean())

    stats = {
        "resolution": list(resolution),
        "cell_count": cell_count,
        "sigma": sigma,
        "max_density": float(density.max()),
        "mean_density": mean_density,
        "sparsity_below_threshold": sparsity,
        "visible_cell_count": int(visible_mask.sum()),
        "density_byte_size": int(density.nbytes),
        "density_hash_sha256": hashlib.sha256(density.astype(np.float32).tobytes()).hexdigest(),
    }
    return density, stats


def assert_stats_within_tolerance(stats: dict, declaration: dict) -> None:
    """Verify the generated volume matches its declaration.

    ``density_statistics.expected_max_density`` is the *normalised* max (1.0
    by construction). ``density_statistics.expected_sparsity_below_threshold``
    is the target fraction of cells below the visible threshold.

    The sparsity check is the substantive gate; the max-density check is a
    structural assertion that the field was normalised.
    """
    expected = declaration["density_statistics"]
    tol = expected["tolerance"]

    # Structural: max_density is 1.0 by construction (normalisation step).
    if abs(stats["max_density"] - expected["expected_max_density"]) > tol["max"]:
        raise AssertionError(
            f"max_density {stats['max_density']:.4f} deviates from declared "
            f"normalised maximum {expected['expected_max_density']:.4f} "
            f"by more than {tol['max']:.4f}"
        )

    # Substantive: sparsity must match the declared value within tolerance.
    target = expected["expected_sparsity_below_threshold"]
    if target == 0:
        ok = abs(stats["sparsity_below_threshold"]) <= tol["sparsity"]
    else:
        ok = (
            abs(stats["sparsity_below_threshold"] - target)
            / max(abs(target), 1e-9)
            <= tol["sparsity"]
        )
    if not ok:
        raise AssertionError(
            f"sparsity {stats['sparsity_below_threshold']:.4f} not within "
            f"{tol['sparsity']:.2%} of declared {target:.4f}"
        )


def write_density_buffer(density: np.ndarray, path: Path) -> int:
    """Write the float32 density buffer to disk in row-major (x-fastest) order."""
    path.parent.mkdir(parents=True, exist_ok=True)
    flat = np.ascontiguousarray(density, dtype=np.float32).ravel()
    with path.open("wb") as fh:
        fh.write(flat.tobytes())
    return flat.nbytes


def load_density_buffer(path: Path, resolution: tuple[int, int, int]) -> np.ndarray:
    raw = np.frombuffer(path.read_bytes(), dtype=np.float32)
    expected = resolution[0] * resolution[1] * resolution[2]
    if raw.size != expected:
        raise ValueError(
            f"density buffer size {raw.size} does not match resolution product {expected}"
        )
    return raw.reshape(resolution)


def declaration_summary(declaration: dict) -> dict:
    return {
        "id": declaration["id"],
        "phenomenon": declaration["phenomenon"],
        "resolution": declaration["grid"]["resolution"],
        "cell_count": declaration["grid"]["cell_count"],
        "anchors_seed": declaration["anchors_seed"],
        "anchors_count": declaration["anchors_count"],
        "declared_asset_scope": declaration["declared_asset_scope"]["id"],
        "versioning": declaration["versioning"],
    }