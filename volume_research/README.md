# Volume Representation Research Gate — IP-10D

This directory is the **research gate** for volume-data representations in the
website-design-ultra production layer. It exists to compare candidate
representations against each other on **measured assets only** and to keep the
recommendation narrowly scoped to the evidence collected here.

It is **not** an exporter. There is no generic VDB exporter, no shipped
runtime loader, and no plugin asset that depends on it being merged.

## What this gate decides

It decides which of three candidate representations is most suitable for the
**declared source representation** at the top of `source-representation.json`.
The candidates are:

1. **Slice textures** — a stack of 2D textures representing the volume as
   cross-sectional slices (`{res} × {res} × {res}` PNG slices).
2. **Sparse points** — a `.glb` POINTS primitive carrying the
   `point_count × {stride}` raw record. This doubles as the conventional
   **point fallback** that any immersive code can already consume via the
   existing `3d-asset-pipeline` (inspect → validate → optimize).
3. **Packed voxels** — a single custom binary blob, one byte per voxel
   (8-bit density), preceded by a small header. This is **scoped to the
   measured asset** and **not** a general volume format. It is **not**
   OpenVDB, NanoVDB, Field3D, or any other established volume format.

A representation wins only if it is best on **all three** measurements
(decode time, transfer size, GPU memory) **and** exceeds the others by a
declared margin. If the evidence does not establish a winner, the report
records `INCONCLUSIVE` and keeps the recommendation as "no general volume
exporter, no format promoted beyond the measured asset".

## Layout

```text
volume_research/
├── README.md                          # this file
├── __init__.py
├── source-representation.json         # the declared source (read first)
├── research/
│   ├── __init__.py
│   ├── runtime.json                   # decoder repeats, winner margins, io roots
│   └── build_volume.py                # synthetic density builder (deterministic)
├── encoders/
│   ├── __init__.py
│   ├── _png.py                        # minimal PNG writer (no external dep)
│   ├── slices.py                      # slice-textures encoder
│   ├── points.py                      # sparse-points / .glb encoder
│   └── packed.py                      # packed-voxels encoder (single 8-bit blob)
├── decoders/
│   ├── __init__.py
│   ├── slices.py
│   ├── points.py
│   └── packed.py
├── benchmark.py                       # orchestrates encoding + decoding + measurements
├── report.py                          # produces reports/report.md and reports/report.json
├── reports/                           # durable evidence
│   ├── report.json                    # structured benchmark result
│   └── report.md                      # human-readable, may stay INCONCLUSIVE
├── tests/
│   ├── __init__.py
│   ├── test_volume_research.py        # reproducibility + structure tests
│   └── fixtures/                      # tiny synthetic volumes used by tests
└── scripts/
    └── reproduce.sh                   # run the benchmark twice and diff the result
```

## Reproducibility

The benchmark is deterministic. Given the same `source-representation.json`
and the same `research/runtime.json`, two runs produce:

- byte-identical encoded artifacts (`sha256` per file),
- byte-identical encoded-file concatenations (recorded in the report),
- byte-identical `report.json` **excluding** the measured `wall_clock_*`
  fields, which are non-deterministic timing noise; those are recorded as a
  median ± IQR over `runtime.decoder_repeats` repeats, and the **median** is
  reproducible when `decoder_repeats` is fixed.

`scripts/reproduce.sh` runs the benchmark twice on the same inputs and
diff-checks `report.json` minus the wall-clock fields. The script exits 0
when the structured fields match, non-zero otherwise.

## Source representation is declared first

Before any encoding happens, `source-representation.json` declares:

- the **phenomenon** (e.g., a dense crystal-fog density field),
- the **grid resolution** (e.g., 32 × 32 × 32),
- the **density model** (e.g., sum-of-gaussians anchored to the procedural
  crystal skeleton),
- the **density statistics** (max density, sparsity — fraction of cells with
  density above the visible threshold),
- the **declared asset scope** (which asset(s) this gate covers).

A recommendation is **never** generalized beyond the declared scope. The
report's "recommendation" field cites the source representation id; it does
not announce a general exporter.

## What is not in this gate

- No **generic VDB exporter**. The packed format is a single-asset 8-bit blob,
  not OpenVDB.
- No **runtime loader** for any immersive fixture. The decoders are
  measurement harnesses, not plugins.
- No **npm package**, no **published artifact**, no **paid dependency**.
- No **coupling** to `procedural-3d` or to the procedural-crystal fixture —
  the source representation is synthetic and seeded, so the gate runs on a
  host without Blender.

The procedural crystal fixture remains the surface-mesh path described in
IP-10C. Volume representation is a separate question, answered separately,
scoped to the measured asset declared in `source-representation.json`.

## Run the gate

```bash
python3 volume_research/benchmark.py            # writes reports/report.json + report.md
bash volume_research/scripts/reproduce.sh       # runs it twice, diffs the structured report
python3 -m unittest volume_research/tests/test_volume_research.py
```

The gate does **not** require a GPU, a browser, Blender, or the glTF CLI. It
runs offline on a fresh host and exits `0` only when every encoder, every
decoder, and the report all ran to completion and the structured evidence
matches. A failure of any single measurement writes the failure into
`reports/report.json` and exits non-zero.