# Graph and Mixing

The topology behind the contract in `spatial-audio` §2. Build it once during
loading and resume it on the unlock gesture.

## Topology

```
source ─▶ voice gain ─▶ layer bus ─▶ master gain ─▶ limiter ─▶ destination
                          ▲
                   ducking writes here
```

```js
const context = new AudioContext()

const master = context.createGain()
const limiter = context.createDynamicsCompressor()
master.connect(limiter).connect(context.destination)

const buses = {}
for (const layer of ['ambient', 'music', 'ui', 'event']) {
  const bus = context.createGain()
  bus.connect(master)
  buses[layer] = bus
}
```

The limiter is insurance, not a mix. If it is working audibly, the layer gains
are wrong. Set it with a high threshold and let it catch overlaps rather than
shape the sound.

## Never write gain directly

Assigning `gain.value` during playback produces a click, because the value jumps
between sample frames. Ramp instead, and schedule against the context clock
rather than a timer:

```js
function rampTo(node, value, seconds) {
  const now = context.currentTime
  node.gain.cancelScheduledValues(now)
  node.gain.setValueAtTime(node.gain.value, now)
  node.gain.linearRampToValueAtTime(value, now + seconds)
}
```

`setTargetAtTime` suits a continuous duck because it approaches asymptotically
and never lands hard. `linearRampToValueAtTime` suits a fade with a known end.
Use one consistently per purpose so two ramps on the same node do not fight.

## Ducking

Ducking lowers the bed while something more important plays. Declare it as a
table rather than scattering ramps through event handlers:

| Trigger | Ducks | By | Attack | Release |
|---|---|---|---|---|
| Event sound | ambient, music | to about a third | fast | slow |
| Section transition | ambient | to about a half | medium | medium |
| Interface open | music | to about a quarter | fast | fast |

Attack faster than release: a duck that returns quickly pumps, and a duck that
falls slowly is heard as a late reaction.

## Voices

`AudioBufferSourceNode` is single-use. Create one per playback, connect it
through a reusable gain, and let it be collected when it ends. Pool the gains
and the buffers, never the sources.

Cap concurrent voices per event type and drop the oldest when the cap is hit.
An uncapped one-shot bound to a pointer event produces a burst that clips the
master and sounds like a fault.

## Scheduling

Schedule against `context.currentTime`, not against `setTimeout` or the render
loop. The audio clock runs on its own thread and does not drift with frame time,
which is exactly why a sound scheduled from a frame callback arrives late under
load — precisely when the frame rate is already suffering.

For a sound tied to a visual moment, schedule it a small offset ahead of the
target time rather than reacting to the frame that shows it.

## Positional audio

Spatialize only where position carries meaning. A panner per voice costs real
CPU, and head-related transfer function panning costs considerably more than
equal-power stereo panning.

- Use a stereo panner for a sound whose only spatial property is left or right.
- Use a full panner with a declared distance model when the sound belongs to an
  object the visitor moves around.
- Give the listener one owner. The camera rig from `canvas-first-architecture`
  §3 updates listener position and orientation; no other system writes them.
- Update the listener with the same damped values the camera uses. Feeding it
  raw target values produces a listener that arrives before the picture.

Verify the listener orientation API against the installed browser set: the
property-based and method-based forms have different support histories, and the
method form is deprecated in current specifications.

## Suspend and resume

Suspend the context on `document.hidden` and when the experience is offscreen,
and ramp the master down before suspending rather than cutting. On resume, ramp
back up over the same interval. A context resumed at full gain mid-bed is the
sudden loudness `spatial-audio` §4 rules out.

Keep the mute state independent of the suspend state. A visitor who muted stays
muted through a tab change; a suspend that clears mute is a bug the visitor
experiences as the site ignoring them.
