# Licensed HDRI template asset

`studio_small_08_1k.hdr` is the 1k HDR version of Poly Haven's Studio Small 08
HDRI. Poly Haven publishes its HDRIs under CC0, which permits redistribution in
this starter and in derivative renders.

- Source page: https://polyhaven.com/a/studio_small_08
- Download: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr
- Publisher: Poly Haven
- License: CC0 1.0 Universal
- Source SHA-256: f6a989f89432eb4eee3191364a9c1ceed195c4ec3544173a3c04fd96cb91d0ba
- Resolution: 1k HDR equirectangular environment

The same bytes are also committed under
`repo:starters/next-r3f-cinematic/public/assets/`, so that starter installs,
builds and captures with no network at all. The two are declared as one
mirrored pair in `repo:tests/templates/sync.test.mjs` and compared by SHA-256,
so the duplicate cannot quietly become a second, different asset.

Carrying 1.5 MB twice is deliberate for now, not an oversight. Both copies have
to exist as real files: the plugin ships one because a marketplace
installation has no repository checkout, and the starter ships the other
because its build and its deterministic capture must run offline. `J-D8` in
`repo:automation/website-design-ultra-2.1-2.3/QUEUE.md` is the queue item that
replaces both commits with a hash-checked fetch and stops committing the asset
at all; deduplicating before then would mean building that mechanism early.
