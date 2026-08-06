# Frame-Rate Independence

Motion that runs inside a render loop rather than on a DOM timeline has to be
written against elapsed time. A tween library already does this; a hand-written
`useFrame` body does not, and the difference only appears on hardware the author
did not test.

## The failure

```js
// Frame-rate dependent. Do not ship this.
current += (target - current) * 0.1
```

This converges in a fixed number of frames, not in a fixed amount of time. On a
120 Hz display it settles in half the time it takes on a 60 Hz display, and on a
machine dropping to 30 it takes twice as long. The same code produces three
different feels, and each one was tuned on one of them.

`motion-system` §3 bans fixed-factor damping for this reason. This file is the
replacement.

## Exponential damping

The correct form decays by elapsed time:

```
current = target + (current - target) * exp(-lambda * dt)
```

`lambda` is a rate in reciprocal seconds: higher converges faster. Around 4 is
slow and heavy, around 10 is responsive, above 20 is nearly immediate.

Three implementations of the same formula are already available, so write it by
hand only when none is present:

| Source | Call |
|---|---|
| Three | `THREE.MathUtils.damp(current, target, lambda, dt)` |
| maath | `easing.damp(object, key, target, smoothTime, dt)` |
| By hand | the expression above |

`maath` parameterises by smoothing time rather than by rate; both are
time-based, and mixing the two parameter styles inside one scene makes the
values incomparable. Pick one.

## Converting existing code

A per-frame coefficient tuned at 60 Hz converts without retuning. Publish the
frame ratio from the clock — `dt` divided by the reference step — and raise the
remaining fraction to it:

```js
const REFERENCE_STEP = 1 / 60
const ratio = dt / REFERENCE_STEP

// A per-frame lerp coefficient, made time-based:
const coefficient = 1 - Math.exp(Math.log(1 - c60) * ratio)
current += (target - current) * coefficient

// A per-frame friction factor, made time-based:
velocity *= Math.exp(Math.log(f60) * ratio)
```

Both are the same identity: the surviving fraction per frame, compounded over
the real elapsed time instead of over a frame count. At exactly 60 Hz the ratio
is 1 and the values are unchanged, which is what makes this a safe migration
rather than a retune.

## Springs

Exponential damping smooths but never overshoots. A spring that should overshoot
needs an integrator, and an explicit integrator is unstable at a variable step.

- **Non-stiff smoothing** — camera follow, cursor lag, value settling: use
  exponential damping. It cannot explode.
- **Stiff or contact-based simulation** — cloth, chains, collisions: integrate at
  a fixed sub-step and interpolate the remainder for display. Feeding a raw
  variable delta into a stiff spring produces the explosion that appears only on
  a slow machine or after a tab returns from the background.
- **Overshoot with a known target** — a settling UI value: a duration-based
  spring from the animation runtime is simpler than an integrator and is already
  time-based.

## Delta hygiene

Clamp the delta before any of this. A tab returning from the background reports
a gap measured in seconds, and every formula here treats that as real elapsed
time: the damp lands instantly, the friction zeroes the velocity, the spring
diverges. `canvas-first-architecture` specifies the clock that clamps and
publishes the ratio; a scene without that skill clamps in its own loop.

## When this does not apply

- GSAP and Motion animate against time already. Do not wrap their output in a
  damp — that is two clocks writing one value, which `motion-system` §2 rules
  out.
- CSS transitions are duration-based by definition.
- A scrubbed timeline driven by scroll position has no delta to be independent
  of. Its smoothing belongs to the scroll master in `scroll-immersion`.

## Verification

Run the scene at 30, 60, and 120 frames per second and compare settle time, not
appearance. A correct implementation reaches the same position at the same
moment in all three; a frame-rate-dependent one reaches it in the same number of
frames. Throttling in the browser's rendering tools produces the low end, and a
high-refresh display or a forced frame cap produces the high end.
