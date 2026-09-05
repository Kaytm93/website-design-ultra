---
name: spatial-audio
description: Ship sound in a web experience — layer inventory, the gesture that unlocks playback, master and per-layer gain, ducking, event variation, positional audio, and the opt-out accessibility requires. Use only when the deliverable actually plays audio. A video element with its own controls, an existing player component, or a scene that merely could have sound does not activate this skill.
---

# Spatial Audio

Open only when the page itself controls audio. Native media controls, an existing
player, and a silent 3D scene do not activate it. Decide inventory, unlock, mix,
and opt-out before loading files.

## Sound contract

Fill before the first file is loaded; values below are examples.

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

Read [references/graph-and-mixing.md](references/graph-and-mixing.md) for buses,
gains, ducking, and positional audio, and [references/event-sound-design.md](references/event-sound-design.md)
for moments, variation, and loudness.

## Rules

Build context, buses, and gains during loading; resume only on the first qualifying
pointer/key gesture. Default to silence, persist explicit consent, and keep a
blocked resume as a visible normal state. Sound is never the only channel:
state changes and errors also appear visually. Continuous audio over three seconds
has a pause/stop or independent volume control, satisfying WCAG 2.2 SC 1.4.2.
The DOM control is persistent, named, keyboard-reachable, and announces state;
canvas painting is
not a control. Motion and sound have separate opt-outs. Fade gain changes,
limit voices, set retrigger windows, vary repeated one-shots, and suspend on
hidden/offscreen. Declare audio's weight and defer ambient beds; test a fallback
encode on every named browser.

## Routing and output

DOM/focus → `canvas-first-architecture`; loading → `loading-choreography`;
pause → `3d-runtime-quality`; label/state copy → `content-design` then
`anti-slop`. Deliver the filled contract, graph, event inventory, controls,
weight/codec evidence, and verification state.

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
