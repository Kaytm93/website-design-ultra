# Manifest and Buckets

One declaration owns what the experience loads. Systems request by id; nothing
fetches on its own. Without that rule the load order is whichever module
imported first, which is not a decision anyone made.

## Manifest shape

```json
{
  "id": "igloo-color",
  "url": "/assets/images/igloo_color.ktx2",
  "type": "texture-ktx2",
  "bucket": "critical",
  "bytes": 533374,
  "decoder": "worker"
}
```

`bytes` comes from the build, not from an estimate. A manifest with guessed
weights produces a progress readout that claims a precision it does not have,
which `loading-choreography` §3 rules out. Emit the manifest from the asset
pipeline so the numbers cannot drift from the files.

## Buckets

| Bucket | Contains | Fetched | Blocks |
|---|---|---|---|
| Critical | what the first meaningful frame is wrong without | immediately, in parallel | the reveal |
| Near | what the first interaction needs | after critical resolves | nothing; the reveal already happened |
| Deferred | per later section | on approach to that section | that section's entry condition |
| Speculative | likely-next paths | during idle time, cancellable | nothing, ever |

Two rules keep buckets from collapsing into one:

1. **Critical is a short list.** Every asset added to it delays the reveal for
   every visitor. An asset that only appears in section four is not critical
   because it happens to be large.
2. **Deferred fetches on approach, not on arrival.** Starting the fetch when the
   section becomes current guarantees the pop-in the buckets exist to prevent.
   Approach is a scroll or state distance, declared per section.

## Concurrency

Firing sixty requests at once does not make them arrive sooner; it makes the
first one arrive later. Cap in-flight requests per bucket — a small number for
critical, smaller for deferred — and let the queue drain in manifest order.
Deferred and speculative requests are cancellable, and a section change cancels
what the visitor moved away from.

Hashed, immutable filenames plus long cache lifetimes turn a second visit into a
different problem than the first, so measure both.

## Decode off the main thread

Transfer size is not the cost that stalls a frame; decode is.

| Format | Off-thread path |
|---|---|
| Compressed textures | transcoder in a worker, transferring the result |
| Standard images | `createImageBitmap`, decoded off-thread by the browser |
| HDR environment maps | parse in a worker; the parse is the expensive half |
| Compressed geometry | decoder in a worker, one per pool slot |
| Audio | `decodeAudioData` is already asynchronous, but a large decode still costs; stagger it |

Two deployment constraints belong in the contract rather than in a later
surprise:

- Worker pools cost memory. One worker per core minus one is a reasonable
  ceiling; more workers decode no faster and raise peak memory.
- `SharedArrayBuffer` requires cross-origin isolation, which means the response
  headers `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp`, and those headers break
  third-party embeds that do not opt in. Decide this at the hosting level before
  building on it, and keep a transferable-buffer path for hosts that cannot set
  the headers.

## Failure per bucket

| Bucket | On failure |
|---|---|
| Critical | retry once with a short backoff, then take the poster route |
| Near | reveal without it, and disable the interaction it served |
| Deferred | that section falls back to its own reduced state; other sections continue |
| Speculative | drop silently |

Every bucket carries a timeout. A request that never resolves is the case a
retry policy misses, and it is the one that produces an indicator running
forever.

## What the manifest is not

It does not decide compression, texture dimensions, or LOD counts — those are
`3d-asset-pipeline` decisions, and this file consumes their output. It also does
not decide which tier loads which bucket; `3d-runtime-quality` owns that, and a
low tier legitimately skips a deferred bucket the high tier loads.
