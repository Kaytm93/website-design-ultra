# Look-loop: measuring the live frame against the poster target

A poster is a target, not proof that the live scene matches it. The loop below
turns a look claim into a measured distance. It is read when a scene has been
implemented and its image is being corrected — not when the poster is first
composed.

## The loop

1. Capture the live hero frame in the declared desktop shot, with the same
   camera, exposure, and tone mapping the contract fixed.
2. Run `verify-browser.mjs --target <poster-target.png>` against that frame.
   The verifier writes `target-comparison.json` and `target-diff.png` beside
   the capture. The report records the target and live-frame hashes, both
   dimensions, the score, the tolerance, and the iteration label.
3. Read the score and the diff PNG as evidence of visual change, never as an
   aesthetic verdict. They say the image moved; they do not say it improved.
4. Name the one decision you are changing — key-light direction, camera
   distance, material roughness — change only that, and capture again.

## The iteration log

One row per capture, kept beside the artifacts:

| field | what it holds |
| --- | --- |
| `iteration` | the label written into the comparison report |
| `changed-decision` | the single contract field this round altered |
| `score` | the measured distance to the target |
| `diff-artifact` | path to that round's `target-diff.png` |
| `next-reason` | why the next correction is the one being made |

A correction counts as better only when its measured distance to the target
decreases. Prose that says the frame looks closer, with a score that rose, is a
regression with a story attached.

## Dimensions and tolerance

The target and the live frame must share dimensions; a comparison across two
shapes measures the resize, not the image. Tolerance is a property of the shot,
not of the run — record it in the report rather than tightening it after seeing
a score.

## Status

Browser, GPU, or tool unavailability leaves the comparison `UNAVAILABLE` and the
look claim unverified. It never becomes a pass, and it is not the same as
`NOT_APPLICABLE`, which is a scene that was never implemented in this session.
