# next-r3f-cinematic

The website-design-ultra cinematic starter: a server-rendered Next.js page
around a client-only React Three Fiber canvas leaf. It scaffolds the shape a
cinematic product hero takes in this plugin, with every ownership boundary
declared before scene code.

This project lives outside the installed plugin payload by design
(`docs/adr/ADR-011-immersive-production-distribution.md`): skills reference it
by repository path and version, and it is never copied into
`website-design-ultra/`.

## Pinned matrix

Exact versions, recorded in `package.json` and `package-lock.json`:

| Package              | Version  |
| -------------------- | -------- |
| Next.js              | 15.5.24  |
| React                | 19.2.8   |
| three                | 0.185.1  |
| @react-three/fiber   | 9.7.0    |
| TypeScript           | 5.9.3    |
| Node.js              | >= 22.18 (native type stripping for tests) |

There is intentionally no `@react-three/drei` in the matrix: its convenience
helpers fetch assets over the network, and this scaffold must install, build,
and render offline.

## Quickstart

```bash
npm ci          # exact locked install
npm run dev     # live mode, wall clock
npm run typecheck
npm test
npm run build
```

## Capture entry point

Deterministic capture resolves the runtime flag per request at the application
boundary, so the same production build serves both modes:

```bash
npm run build
WDU_DETERMINISTIC=1 WDU_STATION=hero-wide npm run start
```

- `WDU_DETERMINISTIC=1` is the only value that enables deterministic mode.
  Unset and every other value select live mode.
- `WDU_STATION` names the camera station applied before the stable-frame
  sequence. Unknown ids fail explicitly; there is no fallback to the first
  station.
- The resolved mode is recorded on the document root as
  `html[data-wdu-mode="deterministic"]`.
- Readiness is `html[data-wdu-ready="true"]`, set only after the stable frame
  (frame 12) renders with the station applied, the manifest resolved, and the
  named streams initialized. It is removed on station change and on unmount.

The page is `force-dynamic` so the mode is never baked into a static page at
build time; the copy is still server-rendered into the initial HTML on every
request.

## Ownership boundaries

These are enforced by `tests/structure.test.mjs` and are part of the scaffold
contract, not conventions:

- **One camera owner.** `components/CameraRig.tsx` is the only component that
  writes camera position, target, or field of view. It applies the selected
  `CameraStation` idempotently before every render.
- **One clock.** `components/SceneRuntime.tsx` is the only `createClock` call
  site. It ticks once per rendered frame (priority 0) and evaluates the
  stable-frame marker after the visible render (priority -1). Scene code
  contains no `performance.now()` or `Date.now()` path.
- **One asset manifest.** `lib/asset-manifest.json` is the single declared
  list of runtime assets. The header mark is the only entry; the scene is
  procedural geometry and loads nothing over the network.
- **Wired determinism.** `lib/determinism-runtime.ts` is a byte-identical copy
  of the repository reference `references/determinism-runtime.ts` (IP-02B) and
  `tests/runtime.test.mjs` fails if the copies drift. The root seed is
  `next-r3f-cinematic-v1`; the hero rotation phase reads the named
  `hero-motion` stream.

## Scene systems and the injected clock

`SceneRuntime` creates the clock, the seeded stream root, and the ready marker
once per mount. `CameraRig` runs at priority 0 (child registration order puts
it before the tick; it does not read time). The clock ticks at priority 0,
`HeroObject` reads `clock.elapsed` at priority 1, and the marker check runs at
priority -1, after the visible render. Every speed is per-second, so motion is
frame-rate independent in both modes.

In live mode the station control (DOM, outside the canvas) switches named
stations. In deterministic mode the control is locked: input must not move the
camera during the stable-frame sequence.

## Scope of this scaffold

This is the IP-05A scaffold. It deliberately does not yet include the quality
controller (Poster/Low/Medium/High, IP-05B), the art-directed poster,
reduced-motion handling, context-loss recovery, portrait composition, or
disposal and route-transition checks (IP-05C). Those land as separate queue
items in the same PR group and extend this tree.

## License

MIT, matching the repository root. Part of the website-design-ultra immersive
production layer.
