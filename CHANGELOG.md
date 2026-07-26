# website-design-ultra

## 1.5.1 — Provenance & Proven Claude Provider (2026-07-26)

### Versionskontrolle

- Das Projekt liegt jetzt in einem Git-Repository. Jeder Changelog-Abschnitt
  verankert auf einem `Release-Tag`, der in diesem Repository auflösbar sein
  muss; `scripts/release.mjs` löst ihn zum Commit auf und schlägt sonst fehl.
- Ein Changelog kann die SHA des Commits, der ihn einführt, nicht enthalten.
  Anker ist deshalb der Tag-Name, der vor dem Commit feststeht; die SHA wird zur
  Prüfzeit aufgelöst.
- Der alte Platzhalter, der die SHA für nicht verfügbar erklärte, ist jetzt ein
  harter Validierungsfehler. Ein Regelwerk, das für jede Behauptung Evidenz
  verlangt, führt keine unbelegbare Herkunftsangabe über sich selbst.
- Abschnitte, die vor der Versionskontrolle entstanden sind, sagen das
  ausdrücklich, statt eine nicht auflösbare SHA zu behaupten.
- Neu: `pluginTreeDigest` — ein reproduzierbarer sha256 über den Plugin-Baum.
  Eine Routing-Behauptung gilt für einen Baum, nicht für einen Ordnernamen.

### Claude-Provider

- Zwei Fehler im Claude-Trace-Pfad behoben, die den ersten echten Lauf
  falsch bewertet hätten:
  - Plugin-Skills werden als `plugin:skill` aufgerufen. Der alte Matcher
    akzeptierte nur `[a-z0-9-]+` und verwarf damit **jedes** `Skill`-Ereignis;
    ein korrekter Lauf wäre als „trace did not observe skill" durchgefallen.
  - Pfade wurden nicht an den geprüften Plugin-Root gebunden. Ein Read der
    installierten Kopie unter `~/.claude/skills/...` zählte als Evidenz über den
    getesteten Baum. Solche Pfade sind jetzt `offRootReads` und lassen den Fall
    scheitern, statt ihn zu bestätigen.
- Der Claude-Runner isoliert die Sitzung mit `--setting-sources ""` und
  `--strict-mcp-config`. Ohne Isolation erbt der Lauf die Skills, CLAUDE.md und
  MCP-Server des Betreibers — inklusive einer installierten Kopie dieses Plugins.
- Fehlender oder nicht angemeldeter Provider endet nicht mehr in einem harten
  Abbruch, sondern in `UNAVAILABLE` mit Grund, offenem Launch-Gate und Exit 0;
  `--require-live` erzwingt in CI einen Fehlschlag. Gleicher Vertrag wie
  ADR-010 für die Browserverifikation.
- `--trace-dir` archiviert den rohen Provider-Ereignisstrom pro Fall.
  Aufgezeichnete Ströme liegen unter `tests/forward/traces/` und werden bei
  jedem `--dry-run` gegen den Parser abgespielt — der Claude-Pfad bleibt damit
  auch auf Maschinen ohne angemeldete CLI abgedeckt.
- Reports enthalten jetzt Provider-Status, Modell, Git-Provenienz und
  Baum-Digest.

### Durch den Livelauf gefundener Inhaltsfehler

- Der erste echte `--provider claude`-Lauf des Falls `dashboard` bestand alle
  Trace-Bedingungen, verfehlte aber die Kontrastangabe für `border`. Die
  Ausgabeanweisung in `color-palettes` nannte die Paare nur als Aufzählung im
  Fließtext. Sie verlangt jetzt eine benannte Contrast-Aussage pro Paar; ein
  ausgelassenes Paar ist eine Lücke, keine Kürze.
- Nach dem Fix: `PASS` mit neun benannten Kontrastzuständen.

Release-Tag: v1.5.1

---

## 1.5.0 — Trace-Proven Routing & Portable Verify (2026-07-25)

### Progressive Disclosure mit echtem Nachweis

- Forward-Harness auf providerseitige Ereignisspuren umgestellt: Claude
  `Read`/`Skill` und Codex-Command-Reads werden als tatsächliche Dateizugriffe
  ausgewertet.
- Pro Fall gelten erlaubte/verbotene Dateien, maximale Referenzzahl und ein
  deterministisches Plugin-Tokenbudget (`ceil(Bytes / 4)`).
- Broad Content Reads schlagen fehl; selbst deklarierte Skill-Routen ohne
  Read-Evidenz ebenfalls.
- Der Dashboard-Livefall beweist: nur `neutral-product.md`, keine Editorial- oder
  Expressive-Palette, keine Broad Reads, ca. 8.6k beobachtete Plugin-Token.
- Zwei durch den neuen Trace sichtbar gewordene Über-Routes behoben:
  `component-patterns` und `style-directions` laden nicht mehr pauschal für ein
  funktional bereits klares Dashboard.

### Hostneutrale Browser-Verifikation

- Neuer `scripts/verify-browser.mjs`-Adapter mit Capability-Probe für Session,
  `run-code` und Screenshots; kein fester `$CODEX_HOME`-Pfad mehr.
- Kompatibler Codex-Wrapper, PATH-CLI oder npm-CLI werden nur nach erfolgreichem
  Probe akzeptiert; Claude Cowork kann seine Host-Browser-Fähigkeit verwenden.
- `/verify`, `/immersive`, `immersive-3d`, `3d-runtime-quality` und die
  WebGPU-Matrix verwenden `PASS | FAIL | UNAVAILABLE`.
- `UNAVAILABLE` liefert statische Evidenz und eine offene Capture-Matrix, bleibt
  aber ausdrücklich **unverified** und blockiert Launch-Readiness.
- Reine Plan-/Contract-Aufträge verwenden stattdessen
  `NOT_APPLICABLE (plan-only)`; beim ersten ausführbaren Build wird die Prüfung
  Pflicht.

Release-Tag: v1.5.0 — nachträglich am 2026-07-26 auf den Import-Commit des ausgelieferten Ordnerstands gesetzt. Der Tag belegt genau diesen Stand, keine Zwischenschritte seiner Entstehung.

---

## 1.4.0 — Content Truth, Responsive Recomposition & Forward Tests (2026-07-25)

### Content und Responsive

- Neuer `content-design`-Skill mit separaten Referenzen für Claim-/Proof-Ledger, Interface-Microcopy sowie Lokalisierung/Transcreation.
- `core-rules` um einen Wide-/Portrait-/Narrow-Contract für echte Re-Komposition, Reframing, Reordering, Replacement und Interaction-Wechsel ergänzt.
- Routing in `/design`, `/immersive`, `/audit`, `/refresh`, Component Patterns und Style Directions aktualisiert.

### Typografie

- `typography` in einen Progressive-Disclosure-Router umgebaut.
- Pairings/Rollen, Hierarchie/Loading und Lizenzmatrix laden unabhängig.
- Vollständige Matrix aller empfohlenen Font-Familien mit Commercial-/Free-Proprietary-/OS-Restricted-/OFL-Status und Open-Source-Alternativen ergänzt.

### Validierung und Forward Tests

- Palette-Verträge um `focus`, meaningful `border`, `danger`, `on-danger` und `disabled` erweitert.
- Validator berechnet RGBA-Glass-Surfaces/-Borders nach sRGB-Compositing und prüft alle State-Kontraste deterministisch.
- Live-Harness mit Schema-Ausgabe und fünf repräsentativen Fällen für SaaS, Editorial, Dashboard, 3D-Hero und Konfigurator ergänzt.
- Manifeste und README auf Version 1.4.0 / 16 Skills aktualisiert.

Release-Tag: keine — diese Version ist vor Einführung der Versionskontrolle entstanden. Es existiert kein Commit, der sie belegt.

---

## 1.3.0 — 3D Direction, Runtime Quality & Visual Verify (2026-07-25)

### Neue Pflichtschichten

- `3d-art-direction`: Kamera/FOV, Komposition, Lichtdramaturgie, Materialhierarchie, Color Pipeline, Tone Mapping, Mobile-Reframing und räumliche Typografie.
- `3d-runtime-quality`: Poster-/Low-/Medium-/High-Tiers, adaptive Shadows, LOD, PostFX, Partikel, DPR, Offscreen-/Visibility-Pause und Quality-Hysterese.

### Interaktion und Renderer

- `r3f-interaction` um einen cancellable Touch-/Gesture-State-Machine-Flow ergänzt: Drag-Schwellen, Pinch/Zoom, Pointer Capture, `touch-action`, Hover-Fallback, `pointercancel` und `lostpointercapture`.
- `shaders-tsl` um eine gepflegte Feature-Matrix mit WebGPU, `WebGPURenderer`-WebGL2-Fallback, TSL-Postprocessing, Compute-Abhängigkeit und bekannten Einschränkungen ergänzt.

### Verifikation

- Neuer `/verify`-Command rendert eine reale URL, fotografiert Desktop, Mobile, Reduced Motion und deaktivierten WebGPU/WebGL-Fallback und verlangt tatsächliche visuelle Inspektion.
- Validator prüft 15 Skills, 5 Commands sowie die neuen Priority-1-Verträge.
- Manifeste und README auf Version 1.3.0 aktualisiert.

Release-Tag: keine — diese Version ist vor Einführung der Versionskontrolle entstanden. Es existiert kein Commit, der sie belegt.

---

## 1.2.1 — Correctness & Progressive Disclosure (2026-07-25)

### Fehler korrigiert

- Next.js App Router: `ssr: false` liegt jetzt in einer kleinen Client-Wrapper-Komponente statt in `app/page.tsx`.
- R3F-Kompatibilität nicht mehr als pauschales „v9 + React 18/19“ beschrieben; installierte Versionen müssen geprüft werden.
- glTF Transform: den gültigen, aber unspezifischen KTX2-Shortcut durch einen expliziten ETC1S-/UASTC-Entscheidungsweg ergänzt; `inspect` und `validate` sind Pflicht.
- WebGL-`@react-three/postprocessing` und WebGPU-/TSL-Postprocessing klar getrennt.
- Scroll-Kamera nutzt delta-basiertes Damping statt Fixwert-`lerp`.
- Lenis/GSAP nutzt einen Ticker mit Cleanup; `scrollerProxy` ist nur noch für echte Proxy-Scroller vorgesehen.
- Motion for React auf `motion` / `motion/react` aktualisiert.
- GLTF-Klonen sowie Material-/Geometrie-/RenderTarget-Lifecycle ergänzt.
- Canvas-A11y korrigiert: keine interaktiven Controls unter `role="img"`; duplizierte Canvas-Ansicht kann `aria-hidden` sein.

### Regelwerk konsolidiert

- Neue Hierarchie: Invarianten → Defaults → begründete Direction-Ausnahmen.
- Pure Black, mehrere unterstützende Farben, zentrierte Apple-Heroes und Font-Pairings widersprechen nicht länger pauschalen Hard Bans.
- Eine dominante Action-Farbe bleibt Pflicht; zusätzliche Farben sind dekorativ oder semantisch.
- `transition: all` entfernt.
- UI-States werden nach Verhalten ausgewählt, nicht mehr für jede statische Komponente erzwungen.

### Token-Effizienz

Große Skills sind jetzt Router mit bedarfsgeladenen `references/`:

- `style-directions`: Product / Editorial / Expressive.
- `color-palettes`: Neutral-Product / Editorial-Natural / Expressive.
- `motion-system`: Profile / Motion React / GSAP-Scroll.
- `component-patterns`: Heroes / Bento-Cards / Navigation-Forms-Overlays.
- `ui-states`: Async / Forms-Feedback / Accessibility.
- `r3f-patterns`: Next.js / Performance-Assets.
- `r3f-interaction`: Hotspots-Camera-Text / Configurator-Animation.

Skill-Descriptions wurden gekürzt und redundante `metadata.version`-Blöcke entfernt. Die Plugin-Version lebt nur in den Manifesten.

### Packaging

- Claude-Manifest auf `1.2.1`.
- Codex-Manifest mit drei Starter-Prompts ergänzt.
- README auf Dual-Host-Installation, korrekte Commands und neue Referenzstruktur aktualisiert.
- Deterministischer Validator prüft Skill-Frontmatter, Referenzpfade, Manifest-Versionen, veraltete Patterns und alle 20 Palette-Kontraste.

Release-Tag: keine — diese Version ist vor Einführung der Versionskontrolle entstanden. Es existiert kein Commit, der sie belegt.

---

## 1.2.0 — Interactive 3D

Release-Tag: keine — diese Version ist vor Einführung der Versionskontrolle entstanden. Es existiert kein Commit, der sie belegt.

13 Skills + 4 Commands. Alle `SKILL.md` tragen `metadata.version: "1.2.0"`, passend zur Plugin-Version. YAML validiert.

## Installation

```bash
# Backup
cp -R ~/.claude/skills/website-design-ultra ~/Desktop/wdu-backup-$(date +%F)

# Skills und Commands ersetzen (Pfad zum Download anpassen)
cp -R ~/Downloads/website-design-ultra/skills/.   ~/.claude/skills/website-design-ultra/skills/
cp -R ~/Downloads/website-design-ultra/commands/. ~/.claude/skills/website-design-ultra/commands/

# Version im Manifest hochziehen: "version": "1.2.0"
open -e ~/.claude/skills/website-design-ultra/.claude-plugin/plugin.json

claude plugin validate ~/.claude/skills/website-design-ultra --strict
```

Dann in einer Sitzung `/reload-plugins`, danach `claude plugin details website-design-ultra` — erwartet: **17 Komponenten** (13 Skills + 4 Commands).

---

## Neu: Skill `r3f-interaction`

Macht 3D anfassbar. Events & Raycasting (`stopPropagation`, `<Bvh>`, `raycast={null}`, `onPointerMissed`) · **Tastatur-Parität als Pflicht** · Hotspots via `<Html>` · Kamera-Zustände mit `easing.damp3` · Konfigurator-Varianten · GLTF-Clips mit Cross-Fade · Text im 3D-Raum.

Verdrahtet in `immersive-3d` (§2 Stack-Tabelle, §7 Routing), `core-rules` (§3), `motion-system`, `r3f-patterns` und im Command `/immersive`.

## Erweitert: `r3f-patterns`

Next.js-Integration (`dynamic` mit `ssr: false`, `'use client'` in der Scene statt in der Page, ein globaler Canvas + `<View track>` statt mehrerer Canvases) und Robustheit (`webglcontextlost`, Canvas-a11y als SoT, `leva` nur im Dev).

## Dedupe: Single Sources of Truth

| Regel | Einzige Quelle |
|---|---|
| `prefers-reduced-motion`, Focus-Ringe, Kontrast | `ui-states` §6 |
| Reduced-Motion & 2D-Fallback für 3D | `immersive-3d` §5 |
| 3D-Perf-Budget | `immersive-3d` §3 |
| Anti-Slop-3D | `immersive-3d` §4 |
| 3D-Stack-Wahl | `immersive-3d` §2 |
| Farb-Verbote | `core-rules` §4 |
| Font-Verbote | `typography` |
| Eine Animations-Bibliothek pro Tree | `core-rules` §6 |
| Canvas-a11y (`role="img"`) | `r3f-patterns` |

Alle anderen Stellen verweisen nur noch. Das TSL-Cheatsheet ist jetzt reine Syntax-Referenz.

## Zwei Widersprüche aufgelöst

1. **Inter** — als **Body** in Brutalist/Editorial/Swiss/Magazine-Tech erlaubt, als **Display/Hero** im Premium-Kontext verboten. Ausnahme steht in `typography`.
2. **Purple** — Direktion D (Glassmorphism): Slate-950 → Teal-900 → Cyan-950 statt Indigo→Purple.

## Commands nachgezogen

Die Commands trugen die Duplikate weiter, die aus den Skills entfernt wurden.

**`/immersive`** — routet jetzt auf `r3f-interaction`; neuer Schritt 7 „Interaktion & Tastatur-Parität"; die drei Regeln im „Niemals"-Block (Fallbacks, Bibliotheks-Mix, unkomprimierte Modelle) sind Verweise auf `immersive-3d` §4/§5 und `core-rules` §6 statt eigener Formulierungen; Farb-Regel zeigt auf `core-rules` §4.

**`/audit`** — neuer 3D-Layer (`immersive-3d`, `r3f-patterns`, `r3f-interaction`), der nur bei vorhandenem 3D greift; Greps für `useFrame`/`<Canvas>` und Pointer-Handler; fehlende Tastatur-Parität ist immer 🔴 Critical; Lila-Ban zeigt jetzt auf `core-rules` §4 statt auf `color-palettes`; der pauschale `font-inter`-Grep meldet nicht mehr blind, sondern prüft Body vs. Display.

**`/refresh`** — „Inter raus, Lila raus" ersetzt durch Verweise auf `typography` und `core-rules` §4 samt Body-Inter-Ausnahme; 3D-Refresh darf Fallbacks und Tastatur-Parität nicht verlieren.

**`/design`** — Weiche nach `/immersive`, wenn das Briefing 3D verlangt.

## Token-Kosten

Vorher ~1.351 tok always-on bei 16 Komponenten. `r3f-interaction` kommt mit grob ~110 tok dazu → ~1.460 tok.

Der Hebel liegt weiter beim On-Invoke-Teil: eine normale Design-Anfrage feuert `core-rules` + `style-directions` + `component-patterns` + `motion-system` + `ui-states` ≈ **11k Token**. Progressive Disclosure für `component-patterns` (~3k) und `color-palettes` (~1,5k) — Index-Tabelle im SKILL.md, Details nach `references/` — würde davon grob die Hälfte sparen.

## Noch offen

- Progressive Disclosure für `component-patterns` und `color-palettes`
- Font-Lizenzhinweise (PP Mori, PP Editorial, Berkeley Mono, Helvetica Now sind kostenpflichtig)
- Verifikations-Loop nach Output (Anschluss an `plan-design-review`)
- `README.md` im Plugin-Root: nennt vermutlich noch 12 Skills und 4 Commands — nicht einsehbar, bitte selbst nachziehen
- Optional: `r3f-physics` (`@react-three/rapier`)
