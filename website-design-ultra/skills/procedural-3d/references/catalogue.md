# Procedural 3D Catalogue — Costed Techniques

Five entries. No other technique is accepted here. No generic VDB exporter, no SDF/MSDF path, no npm package.

## 1. Crystal growth

- Growth model: iterative branching from seed points. Primary drivers: **iterations** (growth steps), **branching factor**, and **grid or lattice resolution** at which collisions are tested.
- Cost model: per-iteration cost scales with active tips. CPU ~ O(tips × log occupancy) per iteration; tips grow sub-linearly when collision pruning applies. Memory ~ O(vertices + edges) linear in final crystal. Geometry cost: vertices and edges grow with iterations × branching; over-growth without pruning yields visible triangle counts that exceed `immersive-3d` budgets.
- Resolution/iterations control: raising iterations or branching increases tip count; raising collision resolution sharpens pruning at higher CPU/memory.
- Determinism risk: moderate–high if random branch direction uses untracked entropy. Must bind to explicit deterministic seed; rerun with same seed preserves tip order and final topology. Unseeded jitter breaks reproducibility and diffing.

## 2. Voronoi

- Partition model: cell generation from sample sites. Primary drivers: **sample count** (sites), **relaxation iterations** (Lloyd), and **cell resolution** (subdivision per cell edge).
- Cost model: CPU dominated by diagram construction, typically ~ O(sample count × log sample count) plus relaxation passes; memory ~ O(sample count + edges). Geometry cost: one cell ≈ one convex polygon; mesh vertices scale with sample count × average cell edge resolution; high sample counts rapidly increase draw calls if cells become separate meshes.
- Resolution/iterations control: sample count sets base geometry; relaxation iterations smooth distribution at linear cost; cell resolution sets edge tessellation.
- Determinism risk: moderate. Relaxation order and tie-breaking must be seeded and ordered; floating tie order without stable seed creates divergent edges between runs.

## 3. Marching cubes

- Volumetric iso-surface: scalar field sampled on a uniform grid. Primary drivers: **grid resolution** (e.g., 64³, 128³), **iso value**, and **field iterations/sample density** if the field itself is computed iteratively.
- Cost model: CPU ~ O(resolution³) for field sampling plus polygonization; memory ~ O(resolution³) floats for the scalar buffer (dominant); geometry cost: triangles scale with surface area crossing the grid, roughly ~ O(resolution²) for smooth surfaces, exploding near high-frequency fields. Transfer size before export is dominated by the uncompressed grid; web output must pass `3d-asset-pipeline` decimation/compression.
- Resolution/iterations control: doubling resolution multiplies memory and CPU by ~8×; budget must be declared against `immersive-3d` draw/triangle ceilings before export.
- Determinism risk: low–moderate. Deterministic when field noise offset and iso value are fixed; risk rises with unsynced curl/noise field placed underneath.

## 4. Curl noise

- Vector-field deformation: pointwise curl applied to positions or density. Primary drivers: **sample count** (points/vertices deformed), **octaves and noise resolution**, and **advection iterations** (steps along the field).
- Cost model: CPU ~ O(sample count × octaves × iterations); memory ~ O(sample count) plus noise tables; geometry cost: deformation does not add vertices unless subdivided — subdivide first, then advect; excess iterations stretch thin triangles and hurt shading without adding silhouette.
- Resolution/iterations control: octaves set frequency detail; iterations set flow length; both scale linearly per sample. Cap iterations and clamp amplitude to a declared budget.
- Determinism risk: high if noise offset evolves per frame without a seed. Must fix noise seed and advection time source to the injected clock; free-running `performance.now()` breaks deterministic capture.

## 5. L-systems

- Grammar expansion: symbol rewriting then geometric interpretation. Primary drivers: **symbol growth** (axiom length, rule expansion factor, derivation depth/iterations) and **interpretation sample** (segment length, branching angle, radius).
- Cost model: CPU dominated by string/buffer expansion — worst-case exponential in depth when rules are expanding; memory ~ O(final symbol length) before interpretation; geometry cost: one symbol ≈ one segment/joint — branch count drives final triangle count. Two depths beyond budget easily exceed mobile triangle limits.
- Resolution/iterations control: depth is the dominant lever; string length and interpreted geometry double or more per added depth for branching grammars. Declare maximum depth and maximum symbol count up front.
- Determinism risk: moderate when stochastic rules are used. Stochastic rewrite must consume a named seeded stream per rule; otherwise two runs diverge in branching and rerun evidence fails.

### Catalogue invariants

- Exactly these five entries are costed here. No SDF/MSDF, no generic volume format, no additional procedural family is added without retiring or replacing one with evidence.
- Every entry documents resolution/iterations/sample or symbol growth, CPU, memory, geometry cost, and determinism risk. Missing any dimension is a contract failure.
- All geometry lands in named collections and records the seed and versions defined in `blender-contract.md` before any GLB export, which then hands off to `3d-asset-pipeline`.
