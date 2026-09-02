# website-design-ultra — Fresh-Agent Queue 2.1 → 2.3

Diese Queue ist die ausführbare Spiegelung von GitHub Issue #22. Sie bleibt
maschinenlesbar wie `automation/immersive-production-v2/QUEUE.md`:

- ein Job = ein Fresh-Agent-Chat = genau ein Commit;
- Dependencies müssen bereits `[x]` sein;
- unabhängige Jobs dürfen in getrennten Worktrees parallel laufen;
- ein Worker setzt nur sein eigenes Häkchen;
- `PASS` braucht reale Verifikation; `UNAVAILABLE` ist niemals `PASS`;
- PR A und PR B bleiben getrennte PRs, obwohl beide auf Version 2.1.0 zielen;
- PR C zielt auf 2.2.0, PR D auf 2.3.0.

Die Baseline-Belege liegen in `BEWERTUNG-website-design-ultra-2.0.1.md`.

## PR 1 — PR A: Erreichbarkeit und Routing — 2.1.0 Teil 1

- [x] `J-A1` **Kopierbare Runtime-Dateien ins Plugin legen** — S
  - **Depends on:** none
  - **Deliver:** `website-design-ultra/templates/runtime/` mit byte-identischen Kopien der sechs Runtime-Referenzen aus `references/`; `tests/templates/sync.test.mjs`.
  - **Acceptance:** Runtime-Skills und `/verify` zeigen auf Plugin-Templates; kein installierter Pfad fehlt.
  - **Verify:** Backtick-Pfad-Regel in `validate-content.mjs`, Sync-Test, `claude plugin validate website-design-ultra --strict`.

- [x] `J-A2` **Comparator und Prohibition-Validator ins Plugin** — S
  - **Depends on:** J-A1
  - **Deliver:** `templates/runtime/compare-baselines.mjs` und `templates/runtime/canvas-only-prohibition.ts`, dependency-frei; Sync-Test erweitert.
  - **Acceptance:** `commands/verify.md` und `canvas-first-architecture` verweisen auf Plugin-Pfade; Comparator-Help läuft ohne Repo-Checkout.
  - **Verify:** Sync-Test, Pfad-Validator, `node <plugin-root>/templates/runtime/compare-baselines.mjs --help`.

- [x] `J-A3` **Router-Lücke schließen** — S
  - **Depends on:** none
  - **Deliver:** `gpu-particle-systems` und `procedural-3d` in `immersive-3d`-Add-on-Tabelle/Routing und als `core-rules`-Gate-Zeilen.
  - **Acceptance:** Jeder Skill wird genau einmal von `core-rules` oder `immersive-3d` genannt; beide Add-ons bleiben in den drei 3D-Forward-Cases verboten.
  - **Verify:** Router-Vollständigkeitsregel, `run-forward-tests.mjs --dry-run`.

- [x] `J-A4` **Lab-Module aus `shaders-tsl` referenzieren** — M
  - **Depends on:** J-A1
  - **Deliver:** `shaders-tsl/references/module-index.md` mit allen elf Modulen, fünf T2.2-Feldern, Fixture- und Copy-Pfad; GLSL nach `templates/shaders/` spiegeln.
  - **Acceptance:** Conditional References nennen den Index; jede Indexzeile zeigt auf eine existierende Template-Datei.
  - **Verify:** Index-Validator und Sync-Test gegen `lab/`.

## PR 2 — PR B: Effizienz — 2.1.0 Teil 2

- [x] `J-B1` **Eine Quelle für den Verifikationsstatus** — S
  - **Depends on:** none
  - **Deliver:** `core-rules/references/verification-status.md` ≤ 1,5 KB; sechs Statuskopien auf Pointer-Sätze reduzieren.
  - **Acceptance:** Statuswerte werden nur einmal definiert; `UNAVAILABLE`-Treffer ≤ 14.
  - **Verify:** Byte-Diff der sechs Dateien und `validate-content.mjs`.

- [x] `J-B2` **Fallback-Regeln nur in `immersive-3d` §5** — S
  - **Depends on:** J-B1
  - **Deliver:** Fallback-Wiederholungen in `core-rules`, `r3f-patterns`, `3d-runtime-quality` und `/immersive` auf Pointer reduzieren.
  - **Acceptance:** Reduced-Motion-, Poster- und Context-Loss-Regeln stehen nur in `immersive-3d` §5.
  - **Verify:** `prefers-reduced-motion`-Treffer ≤ 5.

- [x] `J-B3` **Commands entkoppeln** — M
  - **Depends on:** J-B1, J-B2
  - **Deliver:** `commands/immersive.md` ≤ 3,5 KB und `commands/design.md` ≤ 3,5 KB; keine duplizierten Skill-Absätze.
  - **Acceptance:** Command-Dateien ≤ 4 KB; Touch-Fragen zeigen auf `r3f-interaction/references/touch-and-gestures.md`.
  - **Verify:** Command-Größen-Validator und Forward `--repeat 3` für `3d-hero`/`configurator`.

- [ ] `J-B4` **Prosa-Kompression der 3D-Skills** — L
  - **Depends on:** J-B3
  - **Deliver:** die zehn benannten 3D-SKILL.md auf ≤ 5 KB; optionale Begründungen in nicht geroutete References; Vanilla-Kontrakt aus `immersive-3d` §6 auslagern.
  - **Acceptance:** Minimum-3D-Pfad ≤ 57 KB; Checklisten und Kontrakt-YAML byte-identisch; `3d-hero` ≤ 15.000 geschätzte Plugin-Tokens.
  - **Verify:** `scripts/measure-path.mjs --case 3d-hero`, gebundene Obergrenze, Forward-Suite sieben Cases `--repeat 5 --min-pass-rate 0.6`.

- [ ] `J-B5` **`core-rules` nach Task-Klasse schneiden** — M
  - **Depends on:** J-B4
  - **Deliver:** `core-rules/SKILL.md` ≤ 6 KB; Anti-Slop-Defaults und Composition in Owner-References; 3D lädt `core-rules` nicht erneut.
  - **Acceptance:** `/tweak` ≤ 8 KB Plugin; `/immersive` liest `core-rules` nur über §3/§4.
  - **Verify:** `measure-path.mjs --command tweak`, Slop-Case `--repeat 3`.

- [ ] `J-B6` **README auf Plugin-Größe** — S
  - **Depends on:** none
  - **Deliver:** README ≤ 12 KB ohne eigenen Versionsabschnitt; Add-on-Zählung vereinheitlichen; `agents/openai.yaml` konsistent in allen oder keinem Skill.
  - **Acceptance:** `release.mjs --strict` grün und README nennt keine Version außer `plugin.json`.
  - **Verify:** README-/Manifest-Version-Validator und Größenprüfung.

## PR 3 — PR C: Ein echtes Bild — 2.2.0

- [ ] `J-C1` **Starter-Hero ersetzen** — L
  - **Depends on:** J-A1
  - **Deliver:** GLB aus `procedural-crystal`, `MeshPhysicalMaterial`, Key-Light mit Schatten, lizenziertes HDRI aus `templates/assets/`, neue Poster aus derselben Komposition.
  - **Acceptance:** kein `torusKnot` in `starters/`; deterministische, Checkpoint- und Telemetrie-Tests bleiben grün.
  - **Verify:** Starter-`npm run verify`, Deterministic Capture und Immersive Evaluation.

- [ ] `J-C2` **Look-Loop: Live-Frame gegen Poster-Target** — L
  - **Depends on:** J-A2
  - **Deliver:** `verify-browser.mjs --target`, `target-comparison.json`, Diff-PNG und Iterationsabschnitt in `3d-art-direction`.
  - **Acceptance:** `/immersive` endet nur mit Vergleichsartefakt oder begründetem `NOT_APPLICABLE`; Fixture beweist Lichtverschiebung schlechter und Korrektur besser.
  - **Verify:** `tests/immersive/look-loop/look-loop.test.mjs`, Forward `3d-hero` verlangt Iteration.

- [ ] `J-C3` **Drei Referenz-Szenen im Lab** — XL
  - **Depends on:** J-A4, J-C2
  - **Deliver:** `ref-ice-block`, `ref-volume`, `ref-particle-morph`, je Poster, Capture, Telemetrie-Budget, Look-Loop-Log und Screenshot unter `lab/reference/`.
  - **Acceptance:** alle drei Gates pro Device-Profil; ≥ 5 Look-Loop-Runden mit sinkendem Score.
  - **Verify:** Lab-Suite und Immersive-Evaluation-Shards.

- [ ] `J-C4` **Prozedurales Wachstum in JS** — L
  - **Depends on:** none
  - **Deliver:** `procedural-generation/js/crystal-growth.mjs` mit Shape-/Seed-/Iterations-/Facetten-Parametern, GLB und `report.json`; Blender bleibt Alternative.
  - **Acceptance:** CI führt JS-Generator; gleicher Seed erzeugt identische Topologie-Statistik; ≥ 20.000 Dreiecke; bestehender Handoff bleibt unverändert.
  - **Verify:** `node --test procedural-generation/js/*.test.mjs`; Fixture nutzt JS-GLB.

- [ ] `J-C5` **Canvas-first-Forward-Case** — M
  - **Depends on:** J-B4
  - **Deliver:** Case `canvas-first-story` mit vier Required-Skills, `spatial-audio` verboten, Budget allowed-set + 5 %.
  - **Acceptance:** `--repeat 5 --min-pass-rate 0.6`; Pass-Rate im Changelog.
  - **Verify:** `run-forward-tests.mjs --case canvas-first-story --repeat 5`.

## PR 4 — PR D: igloo-Bausteine — 2.3.0

- [ ] `J-D1` **Skill `vanilla-three-production`** — L
  - **Depends on:** J-B4
  - **Deliver:** negativ gated Skill ≤ 5 KB, kopierbare Produktionsmodule, Vite/Three-Starter `starters/vite-three-canvas/`, gleiche Gates wie R3F.
  - **Acceptance:** immersive §2 nennt R3F und Vanilla gleichwertig mit Entscheidungskriterium; beide Starter bestehen dieselben Gates.
  - **Verify:** Starter-CI für beide und Forward `3d-hero`.

- [ ] `J-D2` **Skill `material-lookdev`** — M
  - **Depends on:** J-A4
  - **Deliver:** Ice/Frost/Glass/Metal/Matte-Rezepte, physikalische Materialfelder, Environment-Tiers und Lab `?e=lookdev`.
  - **Acceptance:** `light-material-and-tone.md:42-43` zeigt auf Skill; Standard-Materialfarbe allein aktiviert kein Physik-Feature.
  - **Verify:** Description-Validator und Lab-Test.

- [ ] `J-D3` **Skill `volume-rendering`** — L
  - **Depends on:** J-D2
  - **Deliver:** `packed.wduv`-/Slice-Atlas-Loader, `Data3DTexture`, Raymarch-Shader, Bounding Box, Volumenlicht und Punkt-GLB-Fallback.
  - **Acceptance:** `ref-volume` zeigt 64³ mit ≤ 8 ms auf Profil; Reduced Motion friert Step-Offset.
  - **Verify:** Lab-Suite und Telemetrie-Gate.

- [ ] `J-D4` **Compute-Pfad für `gpu-particle-systems` + TSL-Cheatsheet** — L
  - **Depends on:** J-A4
  - **Deliver:** `templates/particles/compute-particles.ts` mit `Fn`, `storage`, `instanceIndex`, `computeKernel`, Velocity-Farbe und Morph; Ping-Pong-Fallback bleibt; Cheatsheet ≤ 4 KB.
  - **Acceptance:** echtes WebGPU-Device PASS; ohne Device `UNAVAILABLE`; Ping-Pong bleibt grün.
  - **Verify:** Chromium-Headless WebGPU-Test mit `--enable-unsafe-webgpu`.

- [ ] `J-D5` **Skill `shader-text` (Produktion)** — M
  - **Depends on:** J-A4
  - **Deliver:** MSDF-Atlas-Script mit Lizenzmanifest, Troika-Alternative, DOM-Text-Template und Scramble/Glitch/Dissolve-Uniforms.
  - **Acceptance:** Lab-Headline mit selektierbarem/übersetzbarem DOM-Zwilling; Screenreader-Fixture grün; Prohibition bleibt unverändert.
  - **Verify:** Lab-Suite und Canvas-Only-Validator.

- [ ] `J-D6` **Skill `scene-transitions`** — M
  - **Depends on:** J-D2, J-C5
  - **Deliver:** ein Timeline-Track, Frost/Chromatic-Pass-Kette, Loading-Prefetch und Reduced-Motion-Hard-Cut mit Crossfade ≤ 200 ms.
  - **Acceptance:** Canvas-first-Case verlangt Skill; kein zweiter Clock und genau ein Timeline-Track.
  - **Verify:** Zwei-Writer-Validator und `timeline-50`-Capture.

- [ ] `J-D7` **Skill `site-reconnaissance`** — M
  - **Depends on:** none
  - **Deliver:** negativ gated Methode/Template für Bundle, Netzwerk-Manifest, `renderer.info`, Inspector-Capture und Shader-Extraktion mit Ledger-Form.
  - **Acceptance:** öffentliche Referenz-URL erzeugt ≥ 10 belegte Ledger-Felder; Screenshot allein aktiviert nicht.
  - **Verify:** Fixture-Ledger und Description-Validator.

- [ ] `J-D8` **Asset-Vorratskammer** — S
  - **Depends on:** J-C1
  - **Deliver:** `templates/assets/manifest.json` für 2 HDRIs, 4 Texturen und 1 OFL-MSDF-Atlas; Hash-gesicherter Fetch ohne Commit der Assets.
  - **Acceptance:** jeder Lauf hat lizenziertes Environment; `3d-asset-pipeline` zeigt auf Manifest; Lizenzfelder vollständig.
  - **Verify:** Hash-Test und Lizenzfeld-Pflicht-Validator.

## Definition of done für 2.3.0

- [ ] Marketplace-Installation ohne Repo-Checkout führt jeden Skill-Pfad aus.
- [ ] `3d-hero` ≤ 15.000 Tokens; sieben Alt-Cases + `canvas-first-story` bestehen.
- [ ] Kein Torus-Knoten und kein Default-Würfel in den genannten Oberflächen.
- [ ] Drei Referenz-Szenen besitzen Poster, Look-Loop und grüne Gates.
- [ ] Jeder neue Skill ist ≤ 5 KB, negativ gated, template- und lab-ausführbar.
- [ ] Vanilla- und R3F-Starter bestehen dieselben Gates.

## Nicht tun

- Kein weiterer reiner Prosa-Skill.
- Budgets weder vor Kompression erhöhen noch nach einem einzelnen Lauf senken.
- Prohibition-Liste nicht lockern.
- Root-`references/` nicht in ein npm-Paket verwandeln.

## Worker-Zuweisung

- Produzent für J-A1–J-A4, J-B1–J-B6, J-C1, J-C4–J-C5, J-D1–J-D2, J-D5–J-D8: `openrouter / z-ai/glm-5.2:free`.
- Prüfer, nicht Produzent: `openrouter / nvidia/nemotron-3-ultra-550b-a55b:free` nach J-A3, J-B4/J-B5 und J-D8.
- Nische: `opencode / opencode/muse-spark-1.2-contributor-free` für J-C2 sowie lange Debug-Läufe J-D1/J-D6.
- Keine gemeinsamen Worktrees; keine Abhängigkeit wird übersprungen.

## Bekannter Kontext-Hinweis

`@file:"gltf-transform/core`),"`: file not found
