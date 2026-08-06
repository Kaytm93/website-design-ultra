---
name: spatial-audio
description: Ship sound in a web experience — layer inventory, the gesture that unlocks playback, master and per-layer gain, ducking, event variation, positional audio, and the opt-out accessibility requires. Use only when the deliverable actually plays audio. A video element with its own controls, an existing player component, or a scene that merely could have sound does not activate this skill.
---

# Spatial Audio

Sound is the layer that most often ships without a contract, because it is added
last and reviewed on one machine with headphones. Decide the inventory, the
unlock, the mix, and the opt-out before the first file is loaded.

## 1. Gate

This skill activates when the deliverable plays audio the page itself controls.
It does not activate for a `<video>` or `<audio>` element with native controls,
for an existing player component, or because a 3D scene exists and sound would
suit it. `immersive-3d` does not imply this skill.

## 2. Sound contract

Fill before the first file is loaded. The block is the schema; the values are
one filled example.

```yaml
default-state: "muted on arrival"
unlock-gesture: "first pointer or key interaction, named explicitly"
persistence: "storage key, scope, and what a returning visitor hears"
layers:
  ambient: "continuous bed, lowest priority"
  music: "optional, ducked under everything"
  ui: "short confirmations tied to a control"
  event: "scene moments, tied to a state transition"
ducking: "which layer lowers which, by how much, over how long"
opt-out: "visible persistent control, keyboard reachable, state announced"
reduced-motion-relationship: "stated, because it is not automatic"
offscreen: "suspend on hidden and offscreen"
```

Read [references/graph-and-mixing.md](references/graph-and-mixing.md) to build
the graph, and [references/event-sound-design.md](references/event-sound-design.md)
to decide which moments get a sound at all.

## 3. Unlock and default state

Browsers start an audio context suspended until a user gesture, and the policies
differ between engines and change between releases. Two consequences:

- **Build the graph early, resume it late.** Create the context, buses, and
  gains during loading, then resume on the first qualifying gesture. A graph
  built inside the gesture handler is a graph built while the visitor waits.
- **Default to silence.** Autoplaying sound on arrival is blocked in most
  configurations and unwelcome in the rest. A returning visitor who enabled
  sound may hear it again, from stored consent, after their gesture.

Treat a failed resume as a normal state, not an error: the control stays
visible, and the experience stays complete without sound.

## 4. Accessibility invariants

- **Sound is never the only channel.** Every confirmation, state change, and
  error that a sound reports also reports visually. A sound is reinforcement.
- **Anything that plays automatically for more than a few seconds needs a
  control.** WCAG 2.2 Success Criterion 1.4.2 sets that boundary at three
  seconds at Level A, and it is satisfied by a pause or stop mechanism, or by an
  independent volume control. An ambient bed is exactly this case.
- **The control is real.** Persistent, reachable by keyboard, with an accessible
  name and an announced state. In a canvas-first build it lives in the DOM
  parallel layer; a painted icon is not a control.
- **Reduced motion does not cover audio.** A visitor who suppressed motion has
  said nothing about sound, and a visitor who muted sound has said nothing about
  motion. Two preferences, two controls, and the relationship between them
  stated in the contract rather than assumed.
- **No sudden loudness.** Fade in and out over a perceptible ramp; an abrupt
  gain change is unpleasant on headphones and reads as a defect.

## 5. Mix discipline

- One master gain, one gain per layer, and nothing writing gain outside them.
- Duck the bed under events rather than raising events over the bed. The mix
  stays inside its headroom that way.
- Limit concurrent voices per event type, and set a retrigger window. Without
  both, a fast pointer produces a burst that no single sample survives.
- Vary repeated one-shots by sample or by a small pitch offset. An identical
  sample fired thirty times is the audible form of the uniformity budget
  `anti-slop` measures visually.
- Suspend the context on `document.hidden` and when the experience is offscreen.
  `3d-runtime-quality` already requires audio to pause with the render loop.

## 6. Weight and format

Audio is competing with the geometry and texture budget from `immersive-3d` §3,
so declare its share rather than letting it grow into the remainder. Ambient
beds are the largest files and the least urgent: they belong in a deferred
bucket, and the experience starts without them.

Container and codec support differs between engines and changes between
releases. Verify decode support for the chosen container on every target browser
and ship one fallback encode. Do not copy a support matrix from this file or any
other; test it against the browsers the project actually names.

## 7. Routing

- Graph, buses, ducking, positional audio → **[references/graph-and-mixing.md](references/graph-and-mixing.md)**
- Which moments get a sound, variation, loudness → **[references/event-sound-design.md](references/event-sound-design.md)**
- The DOM control and its focus behavior → **`canvas-first-architecture`**
- Loading the beds without delaying the reveal → **`loading-choreography`**
- Pause on hidden and offscreen → **`3d-runtime-quality`**
- The control's label and its state copy → **`content-design`**, then **`anti-slop`**

## Check

- [ ] The contract is filled, including the unlock gesture and persistence.
- [ ] Nothing plays before a user gesture, and a blocked resume is handled as a
      normal state.
- [ ] Every sound has a visual equivalent.
- [ ] Continuous audio has a pause, stop, or independent volume control.
- [ ] The control is keyboard reachable, named, and announces its state.
- [ ] Motion and sound have separate opt-outs, and the relationship is stated.
- [ ] Voice limits, retrigger windows, and variation are in place.
- [ ] The context suspends on hidden and offscreen.
- [ ] Audio weight is declared inside the scene budget, and beds are deferred.
- [ ] Decode support was tested on the named target browsers.
