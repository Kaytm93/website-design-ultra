# Environment tiers

An environment is reflection/fill support with a declared cost. Select a tier
before loading or generating the environment; do not load an HDRI for a scene
that only needs a color or a matte stage. `maxTextureSize` is the production
ceiling, not permission to exceed the scene budget.

| Tier | maxTextureSize | maxSpecularSamples | dynamic | Source | Use |
|---|---:|---:|---|---|---|
| **Poster** | 0 | 0 | false | poster | Static key visual; no environment allocation |
| **Low** | 256 | 1 | false | procedural | Compact static reflection/fill |
| **Medium** | 512 | 2 | true | procedural | Balanced authored reflection response |
| **High** | 1024 | 4 | true | procedural | Detail only when the declared budget allows it |

The root-only lab uses a tiny deterministic equirectangular texture to exercise
the same switching path without a network request or a committed asset. A
production project may substitute a licensed HDRI, but it must preserve the
same tier fields, hash/license record, and fallback behavior.

## Selection rules

1. Poster is the reduced-cost, static representation. It must preserve the
   subject and tonal statement.
2. Low is the default fallback for a capable but constrained device. Keep
   transmission and reflection count conservative.
3. Medium is the normal interactive target when reflections materially carry
   the look. Measure it against the declared frame budget.
4. High is opt-in for a justified close-up. It never changes tone mapping or
   exposure automatically; quality tiers reduce cost, not art direction.

Environment intensity is not ambient-light permission. Keep key, fill, rim, and
negative-fill roles explicit in `3d-art-direction`. Dispose an old environment
texture before replacing it so tier changes do not grow GPU resources.
