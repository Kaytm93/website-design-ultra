# Proof-Websites: gesicherter Stand und neue Rolle

Stand: 12. September 2026. Entwicklungskandidat für Plugin 2.0.2.

## Gesicherte Version

[`archive/proof-websites-2026-09-11`](https://github.com/Kaytm93/website-design-ultra/tree/archive/proof-websites-2026-09-11) zeigt auf den unveränderten Commit
`99510869de2512ddedd29bd6947c4333ac9455db` aus PR #47. Er enthält das gesamte
Plugin einschließlich aller damaligen Test-Websites, Assets und Prüfungen.
Dieser Archiv-Branch wird nicht weiterentwickelt.

Der ursprüngliche Entwicklungskandidat ist unter
[`codex/design-without-proof-examples`](https://github.com/Kaytm93/website-design-ultra/tree/codex/design-without-proof-examples)
auf Commit `6a9db978cd0dd72318fe0c89c66a2774026d1896` gesichert. Beide Branches
wurden am 12. September 2026 erfolgreich gepusht und mit `git ls-remote`
gegen die genannten vollständigen Commit-IDs geprüft. Der frühere HTTP-403-
Schreibfehler ist damit behoben.

Die Weiterentwicklung läuft auf dem GitHub-Default-Branch
[`main-without-proof-examples`](https://github.com/Kaytm93/website-design-ultra/tree/main-without-proof-examples).
Die Archivierung allein ist keine Release-Abnahme; `v2.0.2` wird erst nach den
Browser- und Live-Modell-Gates auf dem Merge-Commit gesetzt.

## Was pausiert

Die vorhandenen Proof-Seiten werden vorerst weder optisch ausgebaut noch als
Designbeispiele für neue Websites verwendet. Die geplanten drei Showcase-Szenen
aus J-C3 bleiben pausiert. Ihre Umsetzung benötigt eine ausdrückliche Wiederaufnahme.

| Bestand | Weiterhin verwendbar für | Keine Vorgabe für neue Projekte |
|---|---|---|
| Next/R3F- und Vite/Three-Starter | Lifecycle, Export, Build, Browser- und Fallbacktests | Seitenaufbau, Texte, Kristallmotiv, Licht, Materialien, Poster |
| Product-Hero- und Procedural-Crystal-Fixtures | Asset-Pipeline, Eingaben, Barrierefreiheit, Telemetrie | Produktgestaltung, Hero-Komposition oder Markenauftritt |
| Bestehende Lab-Szenen | Shader-/Runtime-Mechanismen und Regressionen | Visuelle Referenz oder Showcase-Qualitätsmaßstab |
| Gespeicherte Screenshots | Reproduzierbarkeit und Erkennen unbeabsichtigter Änderungen | Zielbild einer neuen Website |

Die Dateien behalten ihre bisherigen Pfade, damit Tests und technische
Verweise funktionieren. Ein optionaler Starter-Export bleibt verfügbar; er ist
als technische Ausgangsbasis gekennzeichnet. Sein vorhandenes Design ist keine
Vorgabe für die anschließend erstellte Website.

## Was aktiv bleibt

- Build, Typprüfung, Abhängigkeitenaudit und technische Regressionstests.
- Browser-, Tastatur-, Reduced-Motion-, WebGL-Fallback- und Performanceprüfungen.
- Pflege der gemeinsam verwendeten Runtime, Kompatibilität und Sicherheitsfixes.
- Gestaltung und visuelle Prüfung des tatsächlich beauftragten Website-Projekts.
- Bestehende Stilrichtungen, Farbpaletten, Typografie- und Kompositionsmethoden.

Eine technische Korrektur darf die Fixtures weiterhin ändern, soweit das für
Funktion, Barrierefreiheit oder Performance erforderlich ist. Ein roter Test
wird durch diese Eingrenzung weder abgeschaltet noch als bestanden umgedeutet.

## Neue Websites

Die gestalterische Richtung entsteht aus dem konkreten Briefing, den
Projektinhalten, Markenassets und gewählten Referenzen. Benötigte Runtime-Module
können übernommen werden. Die Seitenansicht und das Motiv der Proof-Websites
werden dabei nicht zum Standard und nicht zum Ziel des Look-Loops.

Passender Auftrag:

> Nutze Website Design Ultra für [Angebot], [Zielgruppe] und [Hauptaktion].
> Leite die Gestaltung aus meinen Inhalten, Markenassets und Referenzen ab.
> Die Repository-Proof-Seiten sind technische Testfälle, keine Designvorlagen.
> Übernimm bei Bedarf Runtime-Mechanismen und prüfe das tatsächliche Projekt
> auf Desktop, Mobile, Tastaturbedienung, Reduced Motion und Performance.

## Verifikationsgrenzen

Die vorherige CI von PR #47 scheiterte beim Anlegen eines Playwright-Kontexts
für den Next-Hochformattest. Die Reparatur erzeugt pro Test einen eigenen
Chromium-Prozess und den Kontext mit dem gewünschten Viewport in zwei
zeitlich begrenzten Versuchen. Fehlende Browser-Evidenz endet mit Exit 2.
Der vollständige [Validate-Lauf 34684501373](https://github.com/Kaytm93/website-design-ultra/actions/runs/34684501373)
ist auf Commit `e61da40cb2b95a50b91e0c93fd4216350d4ccbaf` grün.

Die aktuelle Live-Prüfung deckt alle sieben Forward-Fälle ab, zeigt aber vier
Fälle mit Vertragsfehlern. Die wiederholte Abnahme ist nicht abgeschlossen;
`v2.0.2` bleibt ungesetzt. Details und Rohtraces stehen im
[Audit vom 12. September](audits/2026-09-12-release-gates.md). Die historischen
Ziele für 2.1 bis 2.3 und die pausierten Showcase-Szenen bleiben eigenständige
Arbeit und werden durch technische CI nicht als abgeschlossen behauptet.
