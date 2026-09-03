---
name: material-lookdev
description: Author physically grounded 3D surface looks with Ice, Frost, Glass, Metal, Matte recipes, explicit PBR fields, and bounded environment tiers. Use only when a 3D brief requires authored transmission, refraction, clearcoat, iridescence, attenuation, metal response, or reflection-environment selection. A standard-material color alone, ordinary 2D work, or an ordinary 3D hero does not activate this skill.
---

# Material Lookdev

Give a surface a measurable response before styling it. This skill is an
opt-in layer behind `immersive-3d`; it does not replace `3d-art-direction`,
which still owns the scene's light roles, tone mapping, and material hierarchy.

## Gate

Open this skill only when the brief names a physical surface behavior or asks
for a deliberate environment/reflection tier. Name the behavior in the art
direction contract before choosing a recipe. A color, palette, roughness tweak,
or ordinary `MeshStandardMaterial` surface is not enough.

Do not turn on every feature. Select one recipe and the smallest set of fields
that carries the visual thesis. Keep a standard material when no physical
feature is enabled; **base color alone never promotes a surface to a physical
material**.

## Copyable module

Copy [templates/material-lookdev/material-lookdev.ts](templates/material-lookdev/material-lookdev.ts) into the project. It is a dependency-free TypeScript contract with the five recipe maps, explicit environment tiers, bounded material fields, and the `MeshStandardMaterial`/`MeshPhysicalMaterial` decision gate. It imports no package; after copying, the project owns its version.

## Contract

1. Read [references/material-recipes.md](references/material-recipes.md) for the five starting recipes.
2. Read [references/physical-fields.md](references/physical-fields.md) before setting transmission, IOR, thickness, attenuation, clearcoat, or iridescence.
3. Read [references/environment-tiers.md](references/environment-tiers.md) before loading a reflection environment.
4. Use [templates/material-lookdev/material-lookdev.ts](templates/material-lookdev/material-lookdev.ts) as the copyable implementation contract. When the root-only lab is available, use the typed source contract at `repo:lab/src/modules/material-lookdev.ts` to exercise it; copy the values into the project rather than importing the lab.

The contract keeps color textures in sRGB, data textures in their data color
space, and tone mapping after material evaluation. `MeshPhysicalMaterial` is a
cost decision, not a badge: it is selected only when `hasPhysicalFeature` is
true. The selected environment tier must be recorded with the runtime budget.

## Workflow

1. State the requested surface behavior and the recipe (`ice`, `frost`,
   `glass`, `metal`, or `matte`).
2. Start from the recipe and change only fields justified by the contract.
3. Keep one light owner and one exposure/tone-mapping owner from
   `3d-art-direction`; environment light is fill/reflection support, not a
   replacement for a composed key.
4. Pick Poster, Low, Medium, or High before allocating environment resources.
5. Check the result in a neutral diagnostic light and in the intended tier.
6. Preserve the poster, reduced-motion, mobile, and capability fallback; a
   fallback may remove transmission or reflections but must keep the subject.

The lab route `?e=lookdev` is the executable reference. It exposes all five
recipes, the physical field list, the four environment tiers, reduced motion,
and a non-blank poster/fallback. There is no generic effect combiner.

## Check

- [ ] One recipe and one physical thesis are named.
- [ ] Base color alone leaves the surface on `MeshStandardMaterial`.
- [ ] Physical fields are explicit, bounded, and justified.
- [ ] Color/data texture color spaces are correct.
- [ ] Environment tier and resource ceiling are recorded.
- [ ] Light, tone mapping, and exposure still have their existing single owners.
- [ ] Poster, reduced motion, mobile, and capability fallback preserve the subject.
- [ ] `?e=lookdev` or the equivalent project fixture was exercised when lab evidence is in scope.
