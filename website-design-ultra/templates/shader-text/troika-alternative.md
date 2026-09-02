# Troika text alternative

Use this path when the application already depends on the MIT-licensed
`troika-three-text` package and its atlas/layout pipeline is a better fit than
owning a generated MSDF asset. Troika is an alternative renderer, not an
additional effect layer: choose one path for a label.

```ts
import { Text } from 'troika-three-text'

const text = new Text()
text.text = headline
text.font = projectFontUrl
text.fontSize = 0.4
text.anchorX = 'center'
text.anchorY = 'middle'
text.sync(() => scene.add(text))
// On removal: text.dispose(); scene.remove(text)
```

Pin `troika-three-text` in the consuming project and verify the installed API;
this plugin does not add it, fetch it, or hide it behind a runtime CDN. Keep the
same `dom-text-template.ts` twin beside the Troika mesh. Troika owns glyph
layout and the canvas decoration; the DOM owns the actual heading, selection,
translation, `lang`, find-in-page, and screen-reader output.

Do not use Troika and a hand-written MSDF material for the same label. Do not
copy an essential heading only into the mesh. If font loading fails, keep the
DOM text visible and report a visible canvas fallback rather than a blank
surface. Dispose the mesh and release the renderer resource on route change.

The three effects remain separate uniforms from `text-effects-uniforms.ts`:
`uScramble`, `uGlitch`, and `uDissolve`. Their source is DOM state; Troika does
not become an interaction owner. Freeze visual amplitudes under reduced motion
without disabling DOM focus or translation.
