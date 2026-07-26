---
name: 3d-asset-pipeline
description: Prepare 3D models, textures, animations, and HDRIs for the web. Use for Blender or Spline exports, glTF/GLB, Draco, Meshopt, gltfjsx, KTX2, LODs, texture optimization, asset validation, licensing, or Blender MCP workflows.
---

# 3D Asset Pipeline

Deliver validated glTF assets that fit the scene budget. Choose compression based on decode cost, compatibility, and content rather than stacking every tool.

## 1. Inspect before optimizing

```bash
npx @gltf-transform/cli inspect input.glb
npx @gltf-transform/cli validate input.glb
```

Record transfer size, decoded geometry, textures, draw calls/materials, animations, and extension support.

## 2. Export

- Prefer `.glb` for self-contained delivery; use `.gltf` with external resources when caching or streaming benefits justify it.
- Apply transforms deliberately, export only required collections, and keep useful object/material names.
- Remove hidden geometry, duplicate materials, unused animations, and oversized texture sources.
- Preserve a clean uncompressed source asset outside the web output directory.

## 3. Optimize once

Start with one geometry codec:

```bash
# Broad, compact baseline with WebP textures
npx @gltf-transform/cli optimize input.glb optimized.glb \
  --compress draco \
  --texture-compress webp

# Or faster Meshopt decode; inspect help for installed-version options
npx @gltf-transform/cli optimize input.glb optimized.glb \
  --compress meshopt \
  --texture-compress webp
```

For GPU-compressed KTX2 textures, run the dedicated command after geometry optimization:

```bash
# ETC1S: smallest for color textures
npx @gltf-transform/cli etc1s optimized.glb optimized-ktx2.glb

# UASTC: higher quality for normal maps or demanding material detail
npx @gltf-transform/cli uastc optimized.glb optimized-ktx2.glb
```

Do not run Blender Draco, glTF Transform, `gltfpack`, and `gltfjsx --transform` blindly in sequence. Pick one reproducible pipeline and compare its output.

## 4. Validate the result

```bash
npx @gltf-transform/cli inspect optimized-ktx2.glb
npx @gltf-transform/cli validate optimized-ktx2.glb
```

Compare both transfer and decoded GPU cost. A small download may still decode into large textures or geometry.

## 5. R3F integration

```bash
npx gltfjsx optimized-ktx2.glb
```

Use `--transform` only when it is intentionally the chosen optimization step, not after an already finalized pipeline. Put runtime assets under `/public/models/`, preload only likely-needed assets, and configure the required Draco, Meshopt, and KTX2 decoders.

## Budget guidance

- Start with the total scene budget from `immersive-3d`; allocate per asset afterward.
- Texture dimensions follow screen-space use, not a universal 2K target.
- Use LODs or simplified mobile assets for large hero models.
- Atlas only when it reduces real material/draw-call cost without damaging reuse or resolution.
- Resample animation tracks and remove unused clips.
- Keep HDRIs as small as the lighting/reflection quality permits.

## Sources and licensing

- Poly Haven and Quaternius: verify the asset’s current license and attribution requirements.
- Sketchfab and marketplace assets: record author, asset URL, license, modification rights, and redistribution restrictions.
- Do not ship model or font files when the license allows use but not redistribution.

## Blender MCP

Use Blender MCP only when configured and explicitly useful. Save the `.blend` file before arbitrary code execution. Work in small reversible steps, inspect screenshots and geometry statistics, then export through the same validated pipeline.

## Check

- [ ] Source asset and web output are separate.
- [ ] Input and output pass `inspect` and `validate`.
- [ ] One geometry codec and one texture strategy were selected deliberately.
- [ ] Runtime decoders match used extensions.
- [ ] Decoded GPU cost and scene budget pass.
- [ ] LOD/mobile representation exists when needed.
- [ ] Asset origin and license are recorded.
