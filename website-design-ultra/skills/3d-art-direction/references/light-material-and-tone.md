# Light, Material Hierarchy, and Tone Mapping

## Contents

- Light dramaturgy
- Material hierarchy
- Color pipeline
- Tone mapping workflow
- Delivery checks

## Light dramaturgy

Build light in this order:

1. Set background, environment, and base contrast.
2. Place a key light that describes the most important form.
3. Fill shadows only far enough that relevant detail stays readable.
4. Use rim or kicker for separation, not as a flat neon outline.
5. Enable dynamic shadows only for the light whose direction explains the scene.

| Role | Task | Common mistake |
|---|---|---|
| Key | Form, viewing direction, daylight/studio character | Frontal and shadowless |
| Fill/Environment | Controlled readability of shadows | Cancels the entire contrast |
| Rim/Kicker | Separate silhouette from background | Equally strong outline on everything |
| Practical/Emissive | Motivated light source inside the image | Bloom as a substitute for light |
| Negative fill | Reduce unwanted reflection/flatness | Swallow detail completely |

Use an HDRI for plausible reflections, but keep aiming the key light by composition. An environment map is not finished lighting dramaturgy.

## Material hierarchy

Rank materials by visual importance and runtime cost:

| Rank | Material role | Guideline |
|---|---|---|
| 1 | Hero surface | Strongest form response; at most one characteristic effect |
| 2 | Functional secondary surfaces | Calmer roughness/metalness, clear separation |
| 3 | Interaction accent | Controlled emission or color change, not permanently maxed |
| 4 | Environment/stage | Matte, simple materials; supports the silhouette |

- Use `MeshStandardMaterial` as the PBR base; for authored physical response, load `material-lookdev` and its [physical fields](../../material-lookdev/references/physical-fields.md).
- `material-lookdev` owns transmission, clearcoat, iridescence, attenuation, and environment tiers; do not infer a physics feature from base color alone.
- Avoid multiple transparent layers and large transmission surfaces on mobile.
- Keep roughness differences large enough that the hierarchy remains readable without color.
- Use a neutral diagnostic light to separate wrong normals, roughness, and color-space problems from look development.

## Color pipeline

- Work in Linear-sRGB and output display color in sRGB.
- Mark color textures as sRGB; leave normal, roughness, metalness, and other data textures without a color profile.
- Check glTF early in a reference viewer when colors or materials look implausible.
- Avoid CSS filters on the canvas as a color-grading substitute.
- Keep background/clear color and transparent canvas composition explicit; test premultiplied-alpha behavior after Three upgrades.

## Tone mapping workflow

1. Select the tone mapping from the installed renderer version and document it.
2. Start with ACES Filmic for cinematic highlight roll-off; check a more neutral available curve when product colors and white point matter more.
3. Set exposure in exactly one place.
4. Calibrate light intensity and material values first, exposure afterwards.
5. Compare skin/brand colors, neutral gray, white, emission, and deep black in the same test scene.
6. With WebGL postprocessing, use the correct output pass; with `WebGPURenderer`, use the node/TSL-based output chain.

Do not change tone mapping or exposure automatically per quality tier. Tiers may reduce image cost, but must not recolor the art direction.

## Delivery checks

- [ ] Key, fill, rim, and environment have separate roles.
- [ ] Only justified lights cast dynamic shadows.
- [ ] The hero material stays readable without bloom.
- [ ] Color and data textures carry the correct color-space assignment.
- [ ] Tone mapping and exposure have one owner.
- [ ] Desktop, mobile, poster, and fallback have comparable tonal values.
