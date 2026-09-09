# Produktionscheck vom 9. September 2026

Ausgangscommit: `6ba9a0977fe1de3007b1824ebe7d9970ee71c382`.
Branch: `codex/production-readiness-2026-09-09`.

## Umfang und Aussagegrenze

Die Ausgangsbasis umfasst 800 versionierte Dateien und 26 Skills. Geprüft
wurden Dateiinventar, Manifeste, Routing, aktuelle Roadmap und CI, Auslieferung,
Starter-Lifecycle, gemeinsame Runtime, Testtreiber, Abhängigkeiten und
Nutzungsdokumentation. Historische Berichte und Binärassets wurden nicht als
Beleg für den neuen Stand übernommen. Dies ist kein Versprechen, dass jede
Zeile der historischen Fixtures und Forschungsergebnisse semantisch geprüft ist.

Der letzte Hauptbranch hatte einen grünen
[CI-Lauf](https://github.com/Kaytm93/website-design-ultra/actions/runs/34056565754).
Diese Evidenz gehört zum Ausgangscommit, nicht automatisch zu den Änderungen.

## Behobene Nutzungsprobleme

- Gemeinsamer Quality Controller: Tab-Sichtbarkeit und Viewport-Sichtbarkeit
  bleiben unabhängige Bedingungen. Ein Tabwechsel startet keine offscreen Szene.
  Wiederholtes Anbinden und React-Effekt-Neustarts ersetzen die alten Observer.
- Blockierte Storage-Getter, fehlgeschlagene Lesezugriffe und erschöpfte
  Speicherquoten verhindern den Start und die Motion-Steuerung nicht mehr.
- Vanilla: ein abbrechbarer Frame-Owner, keine vervielfachten Schleifen nach
  schnellen Pause/Resume-Wechseln; vollständige Event-/Observer-Bereinigung,
  Pausieren für den Back/Forward-Cache und Wiederaufnahme beim Zurückkehren.
- Vanilla: deterministische Aufnahmen verwenden den Szenenclock und ignorieren
  gespeicherte Qualitäts-/Motion-Vorgaben. Stillstände planen keine leeren
  Frames weiter. Resize zeichnet neu, ohne den eingefrorenen Zeitpunkt zu ändern.
- Vanilla: Poster bis zum fertigen Frame, Poster bei Kontextverlust, erneutes
  Rendern nach Wiederherstellung, eigenes Hochformatposter und Kamerawahl.
- Next: WebGL2-Verfügbarkeit vor dem asynchronen R3F-Start prüfen, damit die
  semantische Seite und das Poster bei fehlendem WebGL erhalten bleiben.
- Projekt-Export: eigenständiger Starter inklusive Browserprüfer und dessen
  transitiven Dateien. Kopien brauchen keine Repository-Nachbarn. Die
  Synchronitätsprüfung der Vorlagen bleibt verpflichtend im Root-Testlauf.
- Plan-Routing aus PR #42 übernommen und auf ausdrücklich angeforderte visuelle
  Entscheidungen begrenzt. Die Tweak- und 3D-Budgets wurden nicht erhöht.
- Labor: dieselben TypeScript-Tests über `node --import tsx` ohne zusätzlichen
  IPC-Testprozess; CI prüft jetzt auch Typen und Produktionsbuild.

## Abhängigkeiten

Vite wurde von 6.3.5 auf die korrigierte 6.4.3 aktualisiert. Die Next-15-Projekte
verwenden exakt fixierte Overrides für PostCSS 8.5.23 und sharp 0.35.4. Das hält
die bestehende Framework-Hauptversion bei aktualisierten betroffenen Abhängigkeiten.
Die Overrides müssen bei künftigen Next-Upgrades neu geprüft werden.

Quellen: [Vite-Advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff),
[PostCSS-Advisory](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp),
[sharp-Advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c).

`npm run audit:dependencies` prüft Root, beide Starter, Labor und beide positiven
3D-Fixtures anhand ihrer Lockfiles. Keine bekannten Meldungen ist der Status
zum Prüfzeitpunkt und keine Garantie gegen zukünftige Schwachstellen.

## Verifikation

| Prüfung | Lokales Ergebnis |
|---|---|
| Root-Suites | 164 Tests bestanden |
| Next/R3F-Starter | 74 Tests bestanden; Typprüfung und Produktionsbuild erfolgreich |
| Vite/Three-Starter | 34 Tests bestanden; Typprüfung und Produktionsbuild erfolgreich |
| Labor | 151 Tests bestanden; Typprüfung und Produktionsbuild erfolgreich |
| Queue-Driver / Volume Research | 13 / 12 Python-Tests bestanden |
| Dependency-Audit | 6 Lockfiles, jeweils 0 bekannte Schwachstellen |
| Plugin-Validierung | 26 Skills; Referenzpfade, Kontrast- und Copy-Regressionsprüfungen bestanden |
| Forward-Dry-Run | Vertragsprüfung und historische Trace-Replays bestanden; kein Live-Modelllauf |

Damit sind 423 Node-Tests und 25 Python-Tests ohne Fehler nachgewiesen; die
Node-Suites haben keine übersprungenen Tests. Die Protokolle liegen zusätzlich
im übertragbaren Änderungspaket. Der erneut gestartete Gesamtprozess lieferte
nur ein unvollständiges Log bis zur Next-Seitengenerierung; die nachfolgenden
Starter-/Labor-Prüfungen und Produktionsbuilds wurden deshalb separat bestätigt.

Die neue CI-Konfiguration prüft Exporte außerhalb des Checkouts einschließlich
Installation, Typprüfung, Tests, Build und Chromium. Dieser geänderte Workflow
ist noch nicht auf GitHub gelaufen. Der lokale Playwright-Versuch scheiterte
vor dem Seitenstart an der fehlenden Chromium-Datei; die Installation endete
mit Download-Timeouts. Der zusätzliche Cloud-Browser-Versuch brach beim Öffnen
der lokalen Seite mit einem Verbindungsfehler ab. Deshalb sind Browser/GPU,
visuelle Qualität und echte Geräteperformance für diesen Stand **UNVERIFIED**.
Ein fehlender Browser oder GPU ist kein PASS.

## Übertragung

Die Änderungen sind lokal versioniert. Git-Push konnte keine GitHub-Anmeldung
verwenden; der Schreibversuch über die verbundene GitHub-Integration wurde mit
HTTP 403 (`Resource not accessible by integration`) abgewiesen. Es wurden kein
Remote-Branch und kein Pull Request angelegt. Das Änderungspaket enthält eine
Git-Patch-Serie, die sich auf den oben genannten Ausgangscommit anwenden lässt.
Die Startanleitung beschreibt diesen Weg ausdrücklich.

## Noch offene Freigabe und Erweiterungen

- Wiederholte Live-Forward-Abnahme auf dem endgültigen Plugin-Baum. Codex und
  Claude waren zunächst nicht auf PATH verfügbar. Später ließ sich eine Codex-
  CLI unter `/opt/codex/bin/codex` mit erfolgreichem Anmeldestatus erreichen;
  das ist noch kein Nachweis eines erfolgreichen Modelllaufs. Der Dry-Run
  führt ausschließlich Vertragsprüfung und historische Trace-Replays aus.
- Kein neues Release-Tag: das bestehende Manifest bezeichnet weiterhin 2.0.1;
  dieser Branch ist ein überprüfbarer Entwicklungskandidat.
- Die zusätzlichen 2.2/2.3-Roadmapziele bleiben eigenständige Arbeit: drei
  visuell abgenommene Referenzszenen, Volume Runtime, Scene Transitions,
  Asset-Vorrat und echte WebGPU-Compute-Evidenz. Die offenen PRs #31 bis #34
  wurden untersucht, aber nicht pauschal in diesen Branch übernommen.
  Sie basieren teilweise auf älteren Ständen; ein vollständiger Branch-Diff
  würde bereits ausgelieferte Funktionen wieder entfernen.

Der vorhandene Funktionsumfang kann mit der
[Startanleitung](../QUICKSTART.de.md) verwendet werden. Eine pauschale Freigabe
als vollständig abgeschlossenes 2.3-Produkt wird mit diesem Check nicht behauptet.
