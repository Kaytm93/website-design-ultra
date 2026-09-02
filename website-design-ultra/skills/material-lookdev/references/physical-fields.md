# Physical material fields

A field is a contract with the renderer, not a decorative label. Keep one
material owner and set these values once when the recipe changes; never create
or mutate a material in the render loop.

| Field | Meaning | Activation / constraint |
|---|---|---|
| `baseColor` | Linearized surface albedo input from an sRGB color/texture | Never a physical feature by itself |
| `roughness` | Micro-surface spread of the specular lobe | `[0, 1]`; large enough role separation to read without color |
| `metalness` | Dielectric/metal energy model | `[0, 1]`; does not require `MeshPhysicalMaterial` |
| `transmission` | Light passing through the surface | `[0, 1]`; positive value enables physical shading |
| `ior` | Index of refraction | Usually `1.0–3.0`; meaningful with transmission |
| `thickness` | Optical path length for transmission/attenuation | Non-negative; meaningful with transmission |
| `attenuationColor` | Wavelength tint through the volume | Data is not a display-color shortcut; use with transmission |
| `attenuationDistance` | Distance at which attenuation applies | Positive finite value; use with transmission |
| `clearcoat` | Thin clear protective lobe | `[0, 1]`; positive value enables physical shading |
| `clearcoatRoughness` | Roughness of the clearcoat lobe | `[0, 1]`; no effect without clearcoat |
| `iridescence` | View/thickness-dependent thin-film response | `[0, 1]`; positive value enables physical shading |
| `iridescenceIOR` | Thin-film refractive index | Usually `1.0–3.0`; no effect without iridescence |
| `envMapIntensity` | Reflection contribution from the chosen environment | Scale only; never a replacement for key/fill/rim roles |
| `normalScale` | Bounded micro-normal amplitude | Keep small; normal maps remain data textures, not sRGB |

## Material class decision

`MeshStandardMaterial` is the default PBR base. Promote to
`MeshPhysicalMaterial` only when `transmission`, `thickness`, `clearcoat`, or
`iridescence` is positive and the visual thesis needs that response. `ior` and
attenuation fields support transmission but do not activate it by themselves.

**Standard material color alone does not activate any physics feature.** A
color-only update must leave both the material class and the physical-feature
flag unchanged. This is a negative gate, not an invitation to add a dummy
transmission value.

## Color and fallback rules

- Color/albedo textures use sRGB decoding; normal, roughness, metalness, and
  thickness maps remain unencoded data.
- Evaluate in linear RGB and tone-map once at the existing renderer owner.
- On a capability or reduced-motion fallback, drop transmission/reflection
  cost deliberately and retain an opaque, non-blank subject representation.
- Do not add transparent layers or strong emission to compensate for a wrong
  normal, exposure, or environment.
