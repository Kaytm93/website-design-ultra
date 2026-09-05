# Website Design Ultra: Nutzbarkeit und Abschlussplan

Stand: 5. September 2026. Geprüfter Hauptbranch: `69100377afd59120638269622a9b158230635929`, Pluginversion **2.0.1**.

## Ergebnis

Das Plugin ist als Designhilfe für normale Websites bereits nutzbar. Für eine vollständig aus der Marketplace-Installation nutzbare und durchgehend verifizierte 3D-Produktion fehlen Auslieferung, Integration und Praxisevidenz. Die Erweiterungen bis 2.3 sind ein zusätzlicher Funktionsumfang; ihr gesamter Abschluss ist keine Voraussetzung für den Einsatz der vorhandenen 2D-Skills.

Die Prüfung umfasst das Inventar der 692 versionierten Dateien, die 24 Skill-Einstiegsdateien, Commands, Manifeste, zentrale Dokumentation und Roadmap, ausgewählte Runtime-/Verifier- und Testimplementierungen, lokale Offline-Prüfungen sowie GitHub-CI und PR-Status. Sie ist kein vollständiger zeilenweiser Review aller 692 Dateien und kein neuer visueller Abnahmelauf. Binärassets wurden inventarisiert, nicht sämtlich visuell geprüft. Live-Modelltests, Blender-Generierung und Browser/GPU-Suites wurden lokal nicht neu ausgeführt. Aussagen über diese Ausführungen beziehen sich auf die ausdrücklich genannten GitHub-Läufe.

## Bereits belastbar vorhanden

- 24 Skills, 6 Claude-Commands, 20 Farbpaletten und 12 Stilrichtungen.
- Inhalts-/Claim-Regeln, Typografie, responsive Komposition, Motion, UI-Zustände und deutsch-/englischsprachiger Copy-Linter.
- Next/R3F-Starter, sechs Runtime-Referenzen, deterministische Aufnahme, Telemetrie, Interaktionsmanifeste, Shader-/Partikellabor und zwei ausführbare 3D-Fixtures.
- Ein deterministischer Blender-Generator und eine separate Untersuchung von Volumendatenformaten.
- Marketplace-Manifeste für Claude und Codex sowie MIT-Lizenz.

Lokal auf dem geprüften Hauptbranch bestanden:

| Prüfung | Beobachtung |
|---|---|
| `node website-design-ultra/scripts/validate-content.mjs` | PASS; 24 Skills, 7 bedingt aktivierte Erweiterungen, 6 Commands, 282 Kontrastprüfungen, 20 Copy-Lint-Regressionsfälle |
| `node website-design-ultra/scripts/run-forward-tests.mjs --dry-run` | 7 Fallverträge validiert und 2 historische Traces abgespielt; ausdrücklich kein aktuelles Modellverhalten getestet |
| Node-Tests für Reference Intake, Telemetrie und Evaluation | 61 bestanden, 0 fehlgeschlagen |
| Node-Tests für Determinismus, Capture-Comparator, Interaktionen und Timeline | 60 bestanden, 0 fehlgeschlagen |

Die letzten beiden Gruppen sind **121 Offline-Tests**. Ihre Ergebnisse ersetzen keine Browser- oder Modelltests.

## Priorität 1: Installation vervollständigen

Die Marketplaces liefern ausschließlich `website-design-ultra/`. Die installierte Version enthält noch kein übergeordnetes `templates/`-Verzeichnis. Mehrere obligatorische Arbeitsschritte verweisen jedoch auf Dateien außerhalb des Plugin-Pakets:

| Aufrufende Stelle | Datei außerhalb des installierten Pakets |
|---|---|
| `skills/3d-runtime-quality/SKILL.md:17–21` | `references/immersive-telemetry.ts`, `references/quality-controller.ts` |
| `commands/verify.md:101–113` | `tests/immersive/interaction-capture/compare-baselines.mjs` |
| `skills/canvas-first-architecture/SKILL.md:121` | `lab/src/modules/canvas-only-prohibition.ts` |

**Erforderlich:** Die kleinen benötigten Runtime-Dateien und Prüfer mit ausliefern, interne Verweise umstellen und Kopien gegen ihre Quellen testen. Ein Test muss ausschließlich das installierbare Plugin-Verzeichnis erhalten und die dokumentierten Pfade ausführen. Starter und Labor dürfen weiterhin außerhalb des Plugin-Pakets bleiben; das entspricht ADR-011. Ihr Abruf braucht einen klaren Pfad mit kompatiblem Tag oder Commit.

Diese Arbeit ist in J-A1/J-A2 beschrieben und im Diff von [PR #36](https://github.com/Kaytm93/website-design-ultra/pull/36) bereits weitgehend enthalten. **Vorhandener PR-Code ist noch keine ausgelieferte Fähigkeit.**

## Priorität 2: Die echte CI-Lücke schließen

Auf [main, Lauf 33889883121](https://github.com/Kaytm93/website-design-ultra/actions/runs/33889883121), bestehen Inhaltsprüfung, Root-Suites, Labor, Starter, deterministische Aufnahme und die Product-Hero-Evaluation. `procedural-crystal` endet hingegen in `UNAVAILABLE`:

- PASS: Build, Runtime, Mobile, Reduced Motion, Fallback und alle drei Telemetriegates.
- UNAVAILABLE: Interaktions-Checkpoints und Tastaturprüfung.
- Daher bleibt `immersive-evaluation-gate` rot.

Das ist keine Evidenz dafür, dass die gesamte Szene defekt oder grundsätzlich keine GPU verfügbar ist. Es fehlen die erforderlichen erfolgreichen Eingabeprüfungen. Die genaue Ursache muss anhand der Checkpoint-Artefakte und des Verifier-Ablaufs diagnostiziert werden.

Auch [PR #37, Lauf 33982908311](https://github.com/Kaytm93/website-design-ultra/actions/runs/33982908311) schließt die Lücke nicht: Dort enden sowohl `product-hero` als auch `procedural-crystal` bei Interaktion und Tastatur in `UNAVAILABLE`; Reduced Motion besteht bei beiden. Die Beschreibung des PRs allein darf deshalb nicht als aktueller Abschlussbeleg verwendet werden.

**Abnahme:** Beide positiven Fixtures müssen auf dem endgültigen Integrationscommit alle Gates bestehen. Absichtlich fehlerhafte Fixtures müssen weiterhin ihren vorgesehenen Fehler erkennen. Anschließend den grünen Lauf im Evidenzindex nennen. Keine Umdeutung von `UNAVAILABLE` zu PASS und keine bloße Lockerung der Assertions.

## Priorität 3: Routing und Kontextverbrauch abschließen

`gpu-particle-systems` und `procedural-3d` existieren, fehlen aber als eigene Auswahlzeilen in der zentralen Add-on-Tabelle von `immersive-3d` und im allgemeinen Gate-Tisch. Ein Shader-Modulindex zu kopierbaren Lab-Implementierungen fehlt auf main ebenfalls.

J-A3/J-A4 schließen diese Erreichbarkeitslücken. J-B1–J-B6 reduzieren redundante Regeln. Auf main beträgt das **erlaubte geschätzte Plugin-Tokenbudget** des `3d-hero`-Fallvertrags 23.045; das ist keine gemessene tatsächliche Nutzung. Das 2.1-Ziel lautet höchstens 15.000 geschätzte Plugin-Tokens. Das Plugin-README umfasst 52.622 Bytes; `design.md` 6.342 und `immersive.md` 8.350 Bytes.

[PR #36](https://github.com/Kaytm93/website-design-ultra/pull/36) bündelt die Reachability-/Effizienz-Vorarbeit und J-B4. Sein Diff enthält Runtime-Templates, Sync-Tests, den Shader-Modulindex und komprimierte Skills. Die früheren [PR #24](https://github.com/Kaytm93/website-design-ultra/pull/24) und [PR #25](https://github.com/Kaytm93/website-design-ultra/pull/25) wurden geschlossen, **ohne selbst gemergt zu sein**. PR #28 bleibt parallel offen.

**Erforderlich:** Den vorgesehenen Integrationspfad festlegen, Abhängigkeiten erhalten, doppelte PRs nach erfolgreicher Integration bereinigen und die fehlende J-B5-Arbeit abschließen. Danach aktuelle Live-Forward-Tests auf dem tatsächlich freizugebenden Plugin-Baum durchführen. Die beiden historischen Trace-Fixtures stammen aus 1.5.1 und 1.6.0; ein Dry-Run beweist kein aktuelles Routing.

## Priorität 4: Visuelle Produktionsqualität demonstrieren

Der Starter verwendet weiterhin `torusKnotGeometry`. Der eigene 3D-Skill warnt vor dem generischen Torusknoten als Hero. Damit existiert ein technisches Gerüst, aber noch kein überzeugender Nachweis des angestrebten visuellen Endergebnisses.

Die 2.2-Arbeiten sollten in dieser Reihenfolge abgenommen werden:

1. **J-C1:** Starter-Hero durch ein charakteristisches Modell mit abgestimmtem Licht, Material und passenden Postern ersetzen. Vorarbeit: [PR #29](https://github.com/Kaytm93/website-design-ultra/pull/29).
2. **J-C2:** Live-Bild gegen ein vorher festgelegtes Zielbild vergleichen und Verbesserungsrunden dokumentieren. Vorarbeit: [PR #30](https://github.com/Kaytm93/website-design-ultra/pull/30).
3. **J-C3:** Drei vollständige Referenzszenen für Eis, Volumen und Partikelmorphing mit Zielbild, Browseraufnahmen und Leistungsnachweisen erstellen.
4. **J-C4:** Optionalen JS-Generator fertigstellen, damit prozedurales Wachstum auch ohne Blender möglich wird. Vorarbeit: [PR #31](https://github.com/Kaytm93/website-design-ultra/pull/31). Bestehende GLB-Nutzung benötigt keine erneute Blender-Generierung.
5. **J-C5:** Einen echten Canvas-first-Forward-Fall ergänzen und wiederholt ausführen.

Ein Bild-Differenzwert unterstützt die Prüfung, ersetzt aber keine visuelle Beurteilung.

## Was für den gesamten geplanten Umfang bis 2.3 fehlt

Die folgenden Erweiterungen stehen in der Roadmap, sind auf dem geprüften main aber noch nicht als vollständiges Produktionspaket ausgeliefert:

| Job | Ergebnis | Sichtbare Vorarbeit |
|---|---|---|
| J-D1 | Vanilla-Three-Produktionsskill und Vite-Starter mit denselben Gates wie R3F | Noch kein entsprechender offener PR im geprüften Satz |
| J-D2 | Material-Lookdev mit Eis/Glas/Metall-Rezepten und Labor | [PR #32](https://github.com/Kaytm93/website-design-ultra/pull/32) |
| J-D3 | Ausführbares Volume Rendering mit Loader, Raymarcher und Fallback | Research-Verzeichnis vorhanden; es erklärt ausdrücklich, keinen Runtime-Loader zu liefern |
| J-D4 | Ausgeführter WebGPU/TSL-Compute-Pfad für Partikel | [PR #33](https://github.com/Kaytm93/website-design-ultra/pull/33); echte Geräteausführung erforderlich |
| J-D5 | Produktionsfähige Shader-Typografie mit lizenziertem Atlas und DOM-Text | [PR #34](https://github.com/Kaytm93/website-design-ultra/pull/34) |
| J-D6 | Szenenübergänge über eine gemeinsame Timeline | Noch kein entsprechender offener PR im geprüften Satz |
| J-D7 | Belegte technische Untersuchung einer Referenzwebsite | [PR #35](https://github.com/Kaytm93/website-design-ultra/pull/35) |
| J-D8 | Asset-Manifest mit Lizenzen, Hashes und reproduzierbarem Abruf | Erste Assets in J-C1 vorgesehen; vollständige Abnahme offen |

Die Backend-Matrix des Hauptbranches markiert WebGPU für mehrere Lab-Module ausdrücklich `UNAVAILABLE`. WebGL2-Code oder Offline-Mathematik darf nicht als WebGPU-Nachweis gelten. Allgemeine Volumenexporter sind bewusst außerhalb des bisherigen Leistungsversprechens.

## Dokumentation und Veröffentlichung

- Ein kurzes Root-README mit Einstieg, Voraussetzungen, Installationswegen und je einem 2D-/3D-Beispiel ergänzen. Aktuell liegt die Anleitung ausschließlich im Plugin-Unterordner.
- Version und Umfang konsistent nennen; der historische Versionsblock des Plugin-README beginnt weiterhin mit 1.9.1.
- Roadmap-Status aus ausgelieferten Commits und Tests ableiten. Issue #22 ist geschlossen, während die Queue auf main weiterhin alle 23 Umsetzungsjobs offen führt. Die alte 36/36-Queue betrifft einen anderen Umfang und ist kein Abschlussnachweis für 2.3.
- Nach bestandener Integration eine passende Version mit Tag und Release-Provenance veröffentlichen; für Releases muss die verlangte grüne CI tatsächlich vorliegen.
- Eine frische Marketplace-Installation und einen vollständigen Beispielprojektlauf auf dem freigegebenen Stand prüfen.

## Praktischer Einstieg heute

Für vorhandene 2D-Funktionen genügt das installierte Plugin im jeweiligen Website-Projekt. Ein geeigneter Auftrag lautet:

> Nutze Website Design Ultra für dieses Projekt. Erstelle eine responsive Landingpage für [Angebot] mit [Zielgruppe] und [Hauptaktion]. Verwende die vorhandenen Inhalte und Markenassets und prüfe Desktop, Mobile, Tastatur und Reduced Motion.

Für den heutigen 3D-Stand zusätzlich das vollständige Repository am oben genannten Commit bereitstellen. Der Starter liegt unter `starters/next-r3f-cinematic/`; sein README verlangt Node >=22.18 und dokumentiert `npm ci`, `npm run dev` sowie `npm run verify`. Projektbezogene Inhalte, Modelle und Markenentscheidungen bleiben Eingaben des jeweiligen Website-Auftrags.

Empfohlene Reihenfolge: **3D-Prüfung stabilisieren → Runtime-Auslieferung und Routing integrieren → aktuelle Live-Evidenz und kurze Anleitung → 2.1 freigeben → visuelle Referenzprojekte für 2.2 → optionale 2.3-Fähigkeiten.**

## Primärquellen

- [Geprüfter Quellstand](https://github.com/Kaytm93/website-design-ultra/tree/69100377afd59120638269622a9b158230635929)
- [Plugin-Anleitung](https://github.com/Kaytm93/website-design-ultra/blob/69100377afd59120638269622a9b158230635929/website-design-ultra/README.md)
- [Queue 2.1–2.3](https://github.com/Kaytm93/website-design-ultra/blob/69100377afd59120638269622a9b158230635929/automation/website-design-ultra-2.1-2.3/QUEUE.md)
- [Distributionsentscheidung ADR-011](https://github.com/Kaytm93/website-design-ultra/blob/69100377afd59120638269622a9b158230635929/docs/adr/ADR-011-immersive-production-distribution.md)
- [CI-Konfiguration](https://github.com/Kaytm93/website-design-ultra/blob/69100377afd59120638269622a9b158230635929/.github/workflows/validate.yml)
- [Bisheriger Evidenzindex](https://github.com/Kaytm93/website-design-ultra/blob/69100377afd59120638269622a9b158230635929/automation/immersive-production-v2/IP-11D-EVIDENCE.md)
