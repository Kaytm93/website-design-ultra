# Material recipes

These are starting values for a single authored surface. They are not a
palette and they are not an instruction to combine every effect. The complete
machine-readable map lives at `repo:lab/src/modules/material-lookdev.ts`.

| Recipe | baseColor | roughness | metalness | transmission | IOR | thickness | clearcoat | iridescence | class |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| **Ice** | `#b8e8ff` | 0.16 | 0 | 0.72 | 1.31 | 0.34 | 0.22 | 0.08 | MeshPhysicalMaterial |
| **Frost** | `#d7e6ed` | 0.60 | 0 | 0.24 | 1.31 | 0.16 | 0.05 | 0 | MeshPhysicalMaterial |
| **Glass** | `#dff7ff` | 0.04 | 0 | 0.92 | 1.50 | 0.12 | 0.12 | 0 | MeshPhysicalMaterial |
| **Metal** | `#aeb9c6` | 0.24 | 1 | 0 | 1.50 | 0 | 0 | 0 | MeshStandardMaterial |
| **Matte** | `#e5ded3` | 0.88 | 0 | 0 | 1.50 | 0 | 0 | 0 | MeshStandardMaterial |

## Recipe notes

### Ice

Use a cool base color with moderate transmission, short attenuation, a small
clearcoat, and restrained thin-film iridescence. Keep the silhouette readable;
transmission is not a substitute for a rim light.

### Frost

Raise roughness and normal variation while keeping transmission low. Frost is
surface diffusion, not a fully transparent glass shell. Avoid several
transparent layers on mobile.

### Glass

Use low roughness and high transmission only when the scene has meaningful
background/reflection structure. Set thickness and IOR together. Test the
opaque fallback because a transparent surface can otherwise disappear.

### Metal

Metalness and roughness carry the look on a standard PBR base. It does not need
transmission, clearcoat, or iridescence merely because it is reflective. Give it
an environment to reflect, but keep the environment within its tier budget.

### Matte

Use a high roughness, non-metal surface for stage/support geometry. Its role is
to hold the composition and make the hero response legible, not to compete with
it.

## Selection rule

A project selects exactly one recipe per surface role. If a requested change is
only a color change, keep the material class and physical-field state
unchanged. In particular, changing `baseColor` alone never enables a physics
feature.
