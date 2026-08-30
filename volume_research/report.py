"""Verdict + markdown report for the IP-10D volume research gate.

A representation only wins when it is best on **all three** measurements
(decode time, transfer size, GPU memory) **and** exceeds every other
representation on every measurement by the declared relative margin. When
that condition is not met, the verdict is ``INCONCLUSIVE`` and the
recommendation is recorded as such. The gate explicitly refuses to declare
a winner from a single measurement, even if that measurement is dominant.
"""

from __future__ import annotations

from typing import Sequence

REPRESENTATIONS: tuple[str, ...] = ("slices", "points", "packed")
REPRESENTATION_LABELS: dict[str, str] = {
    "slices": "slice textures",
    "points": "sparse points",
    "packed": "packed voxels",
}


def _pick_best_by(metric: dict[str, int], *, minimize: bool) -> tuple[str, list[str]]:
    """Return ``(best_name, ties)`` where ``best`` has the lowest (or highest) value."""
    items = list(metric.items())
    if minimize:
        items.sort(key=lambda kv: kv[1])
    else:
        items.sort(key=lambda kv: -kv[1])
    best_value = items[0][1]
    best = items[0][0]
    ties = [k for k, v in items[1:] if v == best_value]
    return best, ties


def _is_margin(value: float, best_value: float, *, relative_margin: float, minimize: bool) -> bool:
    """Return True if ``value`` is more than ``relative_margin`` worse than ``best_value``."""
    if best_value == 0:
        # If the leader is zero on this metric, every other representation
        # is infinitely worse — the margin rule trivially passes.
        return value != 0
    if minimize:
        return (value - best_value) / best_value > relative_margin
    return (best_value - value) / best_value > relative_margin


def compute_verdict(structured: dict, runtime: dict) -> tuple[str, str]:
    """Return ``(verdict, recommendation)``.

    Verdict logic:
      * ``PASS`` / ``WINNER_<NAME>`` — one representation beats every
        other on every measurement by the declared margin.
      * ``INCONCLUSIVE`` — no representation clears the bar; do not
        promote a winner.
    """
    encoders = structured["encoders"]
    margins = runtime["winner_margin"]

    transfer_bytes = {name: encoders[name]["total_bytes"] for name in REPRESENTATIONS}
    gpu_memory = {name: encoders[name]["gpu_memory_estimate_bytes"] for name in REPRESENTATIONS}
    decode_ms = {
        name: structured["decoders"][name]["decode_time_ms_median"]
        for name in REPRESENTATIONS
    }

    best_transfer, _ = _pick_best_by(transfer_bytes, minimize=True)
    best_gpu, _ = _pick_best_by(gpu_memory, minimize=True)
    best_decode, _ = _pick_best_by(decode_ms, minimize=True)

    if best_transfer != best_gpu or best_gpu != best_decode:
        recommendation = (
            "No single representation beats every other on every measurement. "
            "The measurements disagree (transfer best: "
            f"{REPRESENTATION_LABELS[best_transfer]}, GPU best: "
            f"{REPRESENTATION_LABELS[best_gpu]}, decode best: "
            f"{REPRESENTATION_LABELS[best_decode]}); the gate stays "
            "INCONCLUSIVE. No general volume exporter is shipped or announced; "
            "any future decision is scoped to the measured source "
            "representation id only."
        )
        return "INCONCLUSIVE", recommendation

    winner = best_transfer
    winner_label = REPRESENTATION_LABELS[winner]
    other_names = [n for n in REPRESENTATIONS if n != winner]

    for other in other_names:
        # Transfer: must beat by margin
        if _is_margin(transfer_bytes[other], transfer_bytes[winner], relative_margin=margins["transfer_bytes_relative"], minimize=True):
            return _inconclusive(margins)
        if _is_margin(gpu_memory[other], gpu_memory[winner], relative_margin=margins["gpu_memory_bytes_relative"], minimize=True):
            return _inconclusive(margins)
        if _is_margin(decode_ms[other], decode_ms[winner], relative_margin=margins["decode_time_relative"], minimize=True):
            return _inconclusive(margins)

    recommendation = (
        f"Within the declared source representation "
        f"'{structured['declared_source_representation']['id']}' only, "
        f"{winner_label} beats every other candidate on all three "
        f"measurements by more than the declared margin. The gate recommends "
        f"{winner_label} **for this measured asset only**. The gate does NOT "
        f"promote {winner_label} as a general-purpose format, does NOT "
        f"introduce a VDB exporter, and does NOT publish an npm package. "
        f"A different asset must add its own declaration and re-run the gate."
    )
    return f"WINNER_{winner.upper()}", recommendation


def _inconclusive(margins: dict) -> tuple[str, str]:
    return (
        "INCONCLUSIVE",
        (
            "The evidence does not establish a winner: at least one other "
            "representation is within the declared margin on one of the three "
            "measurements (decode time, transfer size, GPU memory). No general "
            "volume exporter is shipped or announced. The sparse-points "
            "representation remains the conventional point fallback. Any future "
            "decision is scoped to the measured source representation id only."
        ),
    )


def _format_bytes(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KiB"
    return f"{n / (1024 * 1024):.2f} MiB"


def _format_ms(ms: float) -> str:
    return f"{ms:.2f} ms"


def render_markdown(structured: dict) -> str:
    decl = structured["declared_source_representation"]
    encoders = structured["encoders"]
    decoders = structured["decoders"]

    lines: list[str] = []
    lines.append("# IP-10D Volume Representation Research Gate")
    lines.append("")
    lines.append("**Verdict:** " + structured["verdict"])
    lines.append("")
    lines.append("## Declared source representation (read first)")
    lines.append("")
    lines.append(f"- id: `{decl['id']}`")
    lines.append(f"- phenomenon: {decl['phenomenon']}")
    lines.append(f"- resolution: {tuple(decl['resolution'])} ({decl['cell_count']} cells)")
    lines.append(f"- anchors: {decl['anchors_count']} (seed={decl['anchors_seed']})")
    lines.append(f"- declared asset scope: `{decl['declared_asset_scope']}`")
    lines.append(f"- declaration SHA-256: `{structured['declared_source_sha256']}`")
    lines.append("")

    lines.append("## Density statistics (post-build)")
    lines.append("")
    stats = structured["density_statistics"]
    lines.append(f"- max density: {stats['max_density']:.6f}")
    lines.append(f"- mean density: {stats['mean_density']:.6f}")
    lines.append(f"- sparsity below threshold: {stats['sparsity_below_threshold']:.6f}")
    lines.append(f"- visible cell count: {stats['visible_cell_count']}")
    lines.append(f"- density hash SHA-256: `{stats['density_hash_sha256']}`")
    lines.append("")

    lines.append("## Encoders (transfer size + GPU memory estimate)")
    lines.append("")
    lines.append("| Representation | Total bytes | GPU memory est. | Files | SHA-256 |")
    lines.append("|---|---|---|---|---|")
    for name in REPRESENTATIONS:
        enc = encoders[name]
        sha = enc["sha256_concat"]
        lines.append(
            f"| {REPRESENTATION_LABELS[name]} | {_format_bytes(enc['total_bytes'])} | "
            f"{_format_bytes(enc['gpu_memory_estimate_bytes'])} | "
            f"{len(enc['output_paths'])} | `{sha[:16]}…` |"
        )
    lines.append("")

    lines.append("## Decoders (decode time, median over fixed window)")
    lines.append("")
    lines.append("| Representation | Iterations | Median | IQR | Decoded hash | Shape |")
    lines.append("|---|---|---|---|---|---|")
    for name in REPRESENTATIONS:
        dec = decoders[name]
        sha = dec["decoded_hash_sha256"]
        shape = "×".join(str(v) for v in dec["decoded_shape"])
        lines.append(
            f"| {REPRESENTATION_LABELS[name]} | {dec['decode_iterations']} | "
            f"{_format_ms(dec['decode_time_ms_median'])} | "
            f"{_format_ms(dec['decode_time_ms_iqr'])} | `{sha[:16]}…` | {shape} |"
        )
    lines.append("")

    lines.append("## Conventional point fallback")
    lines.append("")
    pf = structured["point_fallback"]
    lines.append(
        f"- Format: {pf['format']}\n"
        f"- Path: `{pf['path']}`\n"
        f"- Consumable by: {pf['consumable_by']}\n"
        f"- Visible points: {pf['visible_count']}\n"
        f"- Bytes on disk: {_format_bytes(pf['bytes_on_disk'])}"
    )
    lines.append("")

    lines.append("## Verdict")
    lines.append("")
    lines.append(f"**{structured['verdict']}** — {structured['recommendation']}")
    lines.append("")

    lines.append("## Scope")
    lines.append("")
    lines.append(
        "This gate covers the declared source representation id only. It is "
        "not a general volume-format recommendation. No VDB exporter is "
        "shipped or announced. No npm package is published. No paid "
        "dependency is required. The sparse-points representation is the "
        "conventional point fallback that any immersive code consuming "
        "`3d-asset-pipeline` (inspect / validate / optimize) can already load."
    )
    lines.append("")

    return "\n".join(lines) + "\n"