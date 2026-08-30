# IP-10D Volume Representation Research Gate

**Verdict:** INCONCLUSIVE

## Declared source representation (read first)

- id: `crystal-fog-density-32`
- phenomenon: dense crystal-fog density field
- resolution: (32, 32, 32) (32768 cells)
- anchors: 8 (seed=1337)
- declared asset scope: `crystal-fog-density-32`
- declaration SHA-256: `b52b0d2d36c318302a8b713f522c5d81a93955cc607309bdb71dd6cc2e1231fd`

## Density statistics (post-build)

- max density: 1.000000
- mean density: 0.353888
- sparsity below threshold: 0.401520
- visible cell count: 19611
- density hash SHA-256: `c05a545d382ef2d4e99240c7ddc2401232a634d9df48728d98afd255689472d6`

## Encoders (transfer size + GPU memory estimate)

| Representation | Total bytes | GPU memory est. | Files | SHA-256 |
|---|---|---|---|---|
| slice textures | 33.5 KiB | 1.0 KiB | 32 | `cedcca2c15fde8ff…` |
| sparse points | 307.0 KiB | 306.4 KiB | 1 | `5741bde22ed65af0…` |
| packed voxels | 32.0 KiB | 32.0 KiB | 1 | `263c25a6e188b8b2…` |

## Decoders (decode time, median over fixed window)

| Representation | Iterations | Median | IQR | Decoded hash | Shape |
|---|---|---|---|---|---|
| slice textures | 16 | 1.42 ms | 0.04 ms | `44dd2bcff586f134…` | 32×32×32 |
| sparse points | 16 | 0.05 ms | 0.00 ms | `7d0f3195c600e594…` | 19611×4 |
| packed voxels | 16 | 0.02 ms | 0.00 ms | `44dd2bcff586f134…` | 32×32×32 |

## Conventional point fallback

- Format: glTF 2.0 .glb POINTS primitive
- Path: `/Users/kaygewinner/Desktop/Claude code/website-design-ultra-pr14-run/volume_research/reports/points.glb`
- Consumable by: 3d-asset-pipeline inspect / validate / optimize
- Visible points: 19611
- Bytes on disk: 307.0 KiB

## Verdict

**INCONCLUSIVE** — No single representation beats every other on every measurement. The measurements disagree (transfer best: packed voxels, GPU best: slice textures, decode best: packed voxels); the gate stays INCONCLUSIVE. No general volume exporter is shipped or announced; any future decision is scoped to the measured source representation id only.

## Scope

This gate covers the declared source representation id only. It is not a general volume-format recommendation. No VDB exporter is shipped or announced. No npm package is published. No paid dependency is required. The sparse-points representation is the conventional point fallback that any immersive code consuming `3d-asset-pipeline` (inspect / validate / optimize) can already load.

