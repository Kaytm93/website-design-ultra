# Event Sound Design

Which moments get a sound, and what keeps a small set of files from becoming
tiring. The graph in the sibling reference plays whatever this file authorises.

## Inventory

Declare the whole set before recording or licensing anything. A production set
is small: a bed, a short music cue, three to five interface sounds, and one
sound per scene moment that matters.

| Layer | Purpose | Typical count | Loading bucket |
|---|---|---|---|
| Ambient | one continuous bed that establishes the space | 1, sometimes 2 by section | deferred |
| Music | an optional cue, never continuous under interface sound | 0 or 1 | deferred |
| Interface | confirmation of an action the visitor took | 3 to 5 | near |
| Event | a scene state change the eye can miss | 1 per moment | with its section |

A set larger than this is usually a set where every hover received a file.

## When a sound earns its place

It marks a state change that is easy to miss, it confirms an action the visitor
initiated, or it carries a physical property of an object that the picture alone
does not convey. That is the whole list.

It does not earn its place for existing, for a hover, for a scroll tick, or
because the section felt quiet. A sound bound to a continuous input fires
hundreds of times in a session, and no sample survives that.

## Repetition

Two mechanisms, both required:

1. **Variation.** Three to four samples per interface sound, selected without
   repeating the previous one, or one sample with a small random detune. A fixed
   pitch offset per repetition is audible as a scale and is worse than none.
2. **Retrigger window.** A minimum interval per event type, below which the
   trigger is ignored rather than queued. Queueing produces a delayed burst,
   which is the same problem arriving later.

Combine both with the voice cap from the graph reference. The three together
turn a fast pointer from a fault into a texture.

## Loudness

Relative levels, set in this order and checked as a whole:

1. The bed sits far below everything, at the level where removing it is
   noticeable but hearing it is not.
2. Interface sounds sit at a level that is audible over the bed without ducking
   doing the work.
3. Event sounds are the loudest, and duck the bed rather than exceeding the
   headroom.

Check the mix on laptop speakers and on a phone speaker, not only on headphones.
Small speakers lose the low end that carries most of a bed, so a mix balanced on
headphones frequently has an inaudible ambient layer and interface sounds that
are far too loud everywhere else.

## The mute test

Run the experience once with the master muted, start to finish. Every state
change, confirmation, and error must still be unambiguous. Anything that becomes
unclear was carrying information in the audio channel alone, which
`spatial-audio` §4 does not allow. Fix it visually rather than by making the
sound louder.

## Sourcing

Record the origin, licence, modification rights, and redistribution terms for
every file, in the same ledger `3d-asset-pipeline` uses for models and textures.
A licence that permits use in a project but not redistribution still prohibits
committing the file to a public repository, and audio libraries carry that
restriction more often than model libraries do.

## Copy

The control's label, its two states, and any text describing the audio go
through `content-design` and then the `anti-slop` copy gate. "Sound on" and
"Sound off" state what happens; a speaker icon alone states nothing to a screen
reader.
