# Warm-Up and First Frame

The gap between "all assets loaded" and "the scene runs smoothly" is where most
otherwise finished experiences lose their first impression. Everything here
happens after the last byte and before the reveal.

## Why a loaded scene still stutters

Three costs are paid on first use rather than at load time:

1. **Shader program compilation and linking.** A material compiles when it is
   first rendered, and the program depends on the lights, the environment, the
   shadow configuration, and the mesh's own attributes. Compilation blocks.
2. **Texture upload.** Decoded pixels live in system memory until the first draw
   that needs them uploads to the GPU. A large atlas uploads in one visible
   hitch.
3. **First draw of a large geometry buffer.** The buffer is created on first
   use, not on parse.

A scene with twenty materials revealed without warm-up therefore pays twenty
compile stalls spread across the first seconds, which reads as an unstable frame
rate rather than as a loading artefact.

## Warm-up sequence

Run this after the critical bucket resolves and before the reveal:

1. Build the scene in its first state, with the real lights, environment map,
   shadow settings, and tone mapping. A warm-up under different settings
   compiles a different program and warms nothing.
2. Ask the renderer to compile the scene against the camera. Recent Three
   releases expose an asynchronous form that yields between programs instead of
   blocking; verify the method name against the installed release, and prefer
   the asynchronous form so the progress indicator keeps updating.
3. Force texture upload for the textures the first state uses. The renderer
   exposes an initialisation call for this; where it is unavailable, render one
   frame into a one-pixel render target with the material applied.
4. Render one frame into a render target rather than to the screen. This pays
   the remaining first-draw costs invisibly.
5. Only then reveal.

Materials that appear in later sections warm up when their bucket resolves, not
at the start. Warming everything up front trades a stutter for a longer wait,
which is the same problem moved.

## Variants multiply

A material compiles one program per variant: shadow on and off, instanced and
not, skinned and not, fog on and off, and each postprocessing configuration that
changes the material. Two consequences:

- Warm up the variants the first state actually uses, not one representative
  material per type.
- Changing a quality tier at runtime can compile new variants and stall. This is
  the reason `3d-runtime-quality` prefers uniform changes over rebuilds, and the
  reason a tier change is worth warming up during the load when the tier is
  already known.

## Reveal

The reveal is a state transition owned by the scene state machine, not a class
toggled on a wrapper. Its entry conditions are: critical bucket resolved,
warm-up complete, first frame rendered, and either the declared intro duration
elapsed or the skip taken.

Under reduced motion the reveal renders the end state directly. It does not run
the same transition faster.

## Measuring

Report two numbers, both under throttling:

- **Time to first meaningful frame** — from navigation start to the frame that
  first shows the declared content. Mark it with a performance mark placed at
  the reveal, not at the load event.
- **Time to interactive scene** — from navigation start to the first frame that
  responds to input within one frame, measured after warm-up.

Measure on a mid-range device, not on the development machine, and state the
device and network profile alongside the numbers. A time to first meaningful
frame quoted without its conditions is not a measurement.

The frame-time monitoring in `3d-runtime-quality` starts after this phase.
Feeding warm-up frames into it produces a low tier chosen from numbers that
describe compilation rather than the scene.
