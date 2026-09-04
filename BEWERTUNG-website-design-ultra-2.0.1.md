# Bewertung — website-design-ultra 2.0.1

> Baseline-Bericht für die Umsetzungsjobs 2.1 → 2.3. Jede Aussage über den
> Ausgangszustand verweist auf die geprüfte Datei und Zeile. Messwerte aus
> Befehlen sind zusätzlich im Ausführungsprotokoll des vorbereitenden Commits
> nachvollziehbar.

## Manifest und Routing

- Das Plugin meldet aktuell Version `2.0.0` und den Autor Kay im Claude-Manifest (`website-design-ultra/.claude-plugin/plugin.json:2-6`).
- Der Content-Validator erwartet 24 Skill-Verzeichnisse und prüft pro Verzeichnis die `SKILL.md` (`website-design-ultra/scripts/validate-content.mjs:126-165`).
- Die Add-on-Tabelle des 3D-Routers nennt aktuell Shader, Scroll, Interaktion, Asset-Pipeline, Render-Graph, Loading und Audio (`website-design-ultra/skills/immersive-3d/SKILL.md:60-78`).
- Das 3D-Routing nennt `procedural-3d` und `gpu-particle-systems` derzeit nicht als eigene Add-on-Zeilen (`website-design-ultra/skills/immersive-3d/SKILL.md:162-176`).
- Der allgemeine Gate-Tisch routet 3D nur auf `immersive-3d` und die nachgelagerten Pflicht-/Implementierungsschichten (`website-design-ultra/skills/core-rules/SKILL.md:40-59`).
- Der Validator prüft sieben bestehende negative Gates, deren Namen fest im Array stehen (`website-design-ultra/scripts/validate-content.mjs:843-851`).

## Kopierbare Runtime- und Verifikationsflächen

- `3d-runtime-quality` verweist für die kopierbare Telemetrie auf Root-`references/immersive-telemetry.ts` und für den Mechanismus auf Root-`references/quality-controller.ts` (`website-design-ultra/skills/3d-runtime-quality/SKILL.md:10-27`).
- Die Verifikation beschreibt den Comparator noch als Root-Testpfad unter `tests/immersive/interaction-capture/compare-baselines.mjs` (`website-design-ultra/commands/verify.md:101-121`).
- Die Canvas-Only-Dokumentation bindet den Validator an `lab/src/modules/canvas-only-prohibition.ts` (`website-design-ultra/skills/canvas-first-architecture/SKILL.md:117-130`).
- `reference-intake` behandelt die REST-/Fixture-Validatoren als Root-only und die benötigten Vorlagen als Skill-Unterordner (`website-design-ultra/skills/reference-intake/SKILL.md:25-45`).

## Forward-Budget und Negativ-Gates

- Der bestehende `3d-hero`-Case hat ein geschätztes Plugin-Limit von 23.045 Tokens (`website-design-ultra/tests/forward/cases.json:183-252`).
- Der `3d-hero`-Case verbietet die erweiterten Dateien für Canvas-first, Render-Graph, Loading, Audio, GPU-Partikel, Referenzaufnahme und prozedurale Geometrie (`website-design-ultra/tests/forward/cases.json:236-250`).
- Der text-only-3D-Case verbietet dieselben erweiterten Pfade (`website-design-ultra/tests/forward/cases.json:310-324`).
- Der Configurator-Case verbietet ebenfalls die erweiterten Pfade einschließlich GPU-Partikeln (`website-design-ultra/tests/forward/cases.json:390-403`).
- Das Forward-Skript validiert derzeit sieben Cases und akzeptiert `--repeat`/`--min-pass-rate`, bevor es aktuelle Case-Verträge ausgibt (`website-design-ultra/scripts/run-forward-tests.mjs:50-65`, `website-design-ultra/scripts/run-forward-tests.mjs:697-710`).

## Status-, Fallback- und Command-Prosa

- Der Verifikationsstatus wird in `immersive-3d` mit `PASS`, `FAIL`, `UNAVAILABLE` und `NOT_APPLICABLE (plan-only)` erklärt (`website-design-ultra/skills/3d-runtime-quality/SKILL.md:59-67`, `website-design-ultra/skills/immersive-3d/SKILL.md:178-193`).
- Reduced Motion, Poster, Lazy Loading, Suspense und DOM-Alternativen stehen als vollständige Fallback-Regeln in `immersive-3d` (`website-design-ultra/skills/immersive-3d/SKILL.md:123-136`).
- `r3f-patterns` wiederholt Robustheits- und Context-Loss-Regeln (`website-design-ultra/skills/r3f-patterns/SKILL.md:110-127`).
- Der `/immersive`-Command trägt weiterhin Workflow-, Fallback-, Touch- und Output-Regeln über mehrere Abschnitte (`website-design-ultra/commands/immersive.md:42-120`).
- Der `/design`-Command enthält ebenfalls eigene Routing-, Kompositions-, Output- und Verifikationsregeln (`website-design-ultra/commands/design.md:11-94`).
- Das README führt einen eigenen historischen Versionsabschnitt mit `1.9.1` (`website-design-ultra/README.md:652-671`).

## Starter und visuelle Runtime

- Der Starter-Hero rendert aktuell ein `torusKnotGeometry` mit `meshStandardMaterial` sowie einen Zylinder (`starters/next-r3f-cinematic/components/HeroObject.tsx:172-193`).
- Der Starter ist ein Next/R3F-Projekt mit React 19, Three 0.185.1 und einem `verify`-Script aus Typecheck, Tests und Build (`starters/next-r3f-cinematic/package.json:11-33`).
- Das Starter-README beschreibt die deterministische Capture-Station, den Stable-Frame-Marker und die aktuelle Torus-Knot-Ausrichtung des Interaktionsankers (`starters/next-r3f-cinematic/README.md:40-87`).
- Die prozedurale Fixture lädt bereits ein lokales Draco-GLB über `ProductModel` (`tests/immersive/procedural-crystal/components/ProductModel.tsx:27-49`).
- Das Fixture-Manifest beschreibt dieses GLB als durch den bestehenden Inspect/Validate/Optimize-Pfad verarbeitet und aus `procedural-generation/generator.py` erzeugt (`tests/immersive/procedural-crystal/lib/asset-manifest.json:28-33`).
- Der bestehende Fixture-Generator konsumiert das rohe GLB; seine Aufgabe ist ausschließlich die Pipeline `inspect → validate → optimize → inspect → validate` (`tests/immersive/procedural-crystal/scripts/build-model.mjs:4-16`, `tests/immersive/procedural-crystal/scripts/build-model.mjs:158-177`).

## Shader-Lab

- `shaders-tsl` verweist aktuell nur auf Cheatsheet, WebGPU-Matrix und die Owner-Skills; einen Modulindex gibt es dort nicht (`website-design-ultra/skills/shaders-tsl/SKILL.md:92-97`).
- Die vorhandenen Lab-Shader werden aus den Experimenten geladen (`lab/src/main.ts:72-92`); die experimentellen Module dokumentieren ihre Shader-Schnittstellen und Kostenklassen in `lab/src/modules/noise.ts:1-20` und `lab/src/modules/fresnel-iridescence.ts:1-20`. Diese Quellen liegen außerhalb des installierten Plugin-Roots.
- Die Lab-Tests enthalten bereits deterministische Shader-, Medien-, SDF-, Partikel- und Canvas-Only-Fixtures (`lab/tests/determinism.test.ts:1-200`, `lab/tests/gpu-particles.test.ts:1-200`, `lab/tests/canvas-only-prohibition.test.ts:1-200`).

## Bewertungsgrenze

Diese Datei beschreibt nur den Ausgangszustand vor J-A1–J-D8. Eine spätere
Abweichung ist erst als Erfüllungsbeleg gültig, wenn der jeweilige Job-Test,
der Commit und — bei Browser/GPU-Fähigkeiten — der Status `PASS`, `FAIL` oder
`UNAVAILABLE` separat ausgewiesen sind.
