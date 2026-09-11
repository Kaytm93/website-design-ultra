# Proof-Websites: gesicherter Stand und neue Rolle

Stand: 11. September 2026. Entwicklungskandidat für Plugin 2.0.2.

## Gesicherte Version

`archive/proof-websites-2026-09-11` zeigt auf den unveränderten Commit
`99510869de2512ddedd29bd6947c4333ac9455db` aus PR #47. Er enthält das gesamte
Plugin einschließlich aller damaligen Test-Websites, Assets und Prüfungen.
Dieser Archiv-Branch wird nicht weiterentwickelt.

Die neue Fassung liegt in `codex/design-without-proof-examples`. Der lokale
Quellstand wird durch `candidate/2.0.2-proof-policy-2026-09-11` markiert. Das ist
ein Entwicklungskandidat, keine veröffentlichte oder vollständig abgenommene
Produktionsversion. Die Referenzen werden zusammen mit der Git-Historie im
Übertragungspaket gesichert; GitHub hat den Schreibversuch mit HTTP 403 abgewiesen.

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
für den Next-Hochformattest. Diese Änderung behebt diesen Browser-Hänger nicht.
Auch eine wiederholte aktuelle Live-Modellabnahme steht aus. Die vorhandene
technische Evidenz und die historischen Ziele für 2.1 bis 2.3 werden dadurch
nicht zu einem vollständigen Freigabenachweis für diesen Kandidaten.
