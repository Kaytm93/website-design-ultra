# 2.0.2: Browser-, Archiv- und Live-Freigabe

Stand: 12. September 2026. Entwicklungskandidat; `v2.0.2` ist noch nicht gesetzt.

## Geprüfter Quellstand

- Reparatur-Commit: `e61da40cb2b95a50b91e0c93fd4216350d4ccbaf`.
- Plugin: 2.0.2, 181 Dateien.
- Plugin-Baum SHA-256: `b20c32d33cded3322ef727cb4e81a5f0bdf5515c79fdb4ef07483a479459b196`.
- Live-Modellprüfungen laufen auf einem sauberen, abgetrennten Checkout dieses
  Commits. Dokumentationsänderungen im Arbeitsbranch verändern den Plugin-Baum nicht.
- Integration: [PR #48](https://github.com/Kaytm93/website-design-ultra/pull/48)
  gegen den neuen Default-Branch `main-without-proof-examples`.

## Browser-Gate: PASS

[Validate-Lauf 34684501373](https://github.com/Kaytm93/website-design-ultra/actions/runs/34684501373)
beendet 24 anwendbare Jobs erfolgreich. Nur `release-provenance` ist beim
ungetaggten PR erwartungsgemäß übersprungen. Der vollständige
[CI-Nachweis](2026-09-12-release-gates/validate-ci.json) bindet Jobs und Ergebnisse
an den geprüften Commit.

Der ursprüngliche Fehler aus PR #47 entstand vor dem Testkörper beim Erzeugen
des impliziten Playwright-Kontexts. Die Starter-Prüfungen verwenden jetzt eine
eigene Page-Fixture: pro Test ein Chromium-Prozess, Kontext-Erzeugung mit dem
gewählten Viewport, zwei Versuche mit jeweils 5 Sekunden Deadline und begrenztes
Aufräumen. Im Hochformat sind die 390 × 844 Pixel bereits beim `newContext`
wirksam. Spät eintreffende Kontexte werden geschlossen. Der Wrapper begrenzt
auch einen vollständig blockierten Testprozess auf zehn Minuten.

- [Erster Reparaturlauf](https://github.com/Kaytm93/website-design-ultra/actions/runs/34684018458):
  beide Kontextversuche liefen in ihr Zeitlimit; der echte CI-Prozess endete
  mit `UNAVAILABLE` und Exit 2. Keine Umdeutung zu PASS.
- [Zweiter Lauf](https://github.com/Kaytm93/website-design-ultra/actions/runs/34684262415):
  isoliertes Hochformat PASS; der identische Kontextfehler wanderte zum
  Storage-Test, der noch den ursprünglichen GPU-Browser wiederverwendete.
- Finaler Reparaturlauf: alle Starter-Browsertests laufen mit eigener
  Browserinstanz; Next und Vanilla sowie alle übrigen anwendbaren CI-Jobs PASS.

Assertions und die 30-Sekunden-Szenenbereitschaft bleiben unverändert.
Fachliche Fehler, auch zusammen mit UNAVAILABLE, ergeben Exit 1. Ein fehlender
oder unvollständiger Testreport kann keinen PASS erzeugen.

Lokale Zusatzprüfung: 169 Root-Tests, 74 Next-Tests, Next-Typprüfung und
Produktionsbuild PASS. Alle fünf echten Next-Browsertests PASS. Fünf gezielte
Regressionen prüfen Protokollfehler, nie antwortende Kontexte, späte Auflösung,
hängendes Cleanup und Exit-Klassifikation. Ein Prozessversuch mit künstlich
hängendem Kontext bestätigt Exit 2; ein gemischter Assertion-/Kontextfehler
bestätigt Exit 1.

## Archiv-Gate: PASS

Am 12. September wurden die beiden zuvor fehlenden Remote-Branches angelegt
und mit `git ls-remote --heads origin` gegen die vollständigen IDs geprüft:

| Branch | Commit |
|---|---|
| `archive/proof-websites-2026-09-11` | `99510869de2512ddedd29bd6947c4333ac9455db` |
| `codex/design-without-proof-examples` | `6a9db978cd0dd72318fe0c89c66a2774026d1896` |

[Remote-Nachweis](2026-09-12-release-gates/remote-branches.txt).
Der Archiv-Branch enthält den unveränderten vollständigen Quellstand vor der
Proof-Policy. Der zweite Branch sichert den ursprünglichen Policy-Kandidaten.
Weiterentwickelt wird der Default-Branch `main-without-proof-examples`.

## Live-Modell-Gate: in Arbeit

Alle sieben Fälle aus `website-design-ultra/tests/forward/cases.json` werden
gegen ihre unveränderten Skill-, Referenz-, Budget- und Antwortverträge geprüft.
Der Plan sieht fünf Versuche je Fall und die bestehende Schwelle 0,6 pro Fall
vor. Providerfehler sind nicht gewertete Modellantworten und niemals PASS.

Der erste Claude-Aufruf mit Sonnet scheiterte trotz positivem Auth-Probe an
abgelaufener OAuth-Anmeldung. Die 35 Fehler enthalten keine Modellabnahme:
[Claude-Report](2026-09-12-release-gates/claude-initial/report.json).
Die aktuelle native Claude-CLI meldet ebenfalls keine aktive Anmeldung.

Die erste Codex-Serie (`gpt-5.5`, Effort `medium`, CLI 0.153.4) lieferte drei
bestandene SaaS-Antworten. Danach griff das Kontolimit; 32 Aufrufe sind
Providerfehler. Die sechs übrigen Fälle blieben ungewertet:
[Codex-Erstreport](2026-09-12-release-gates/codex-initial/report.json).
Das Kontofenster ist inzwischen zurückgesetzt. Die Fortsetzung prüft zuerst
jeden fehlenden Fall und vervollständigt anschließend die Wiederholungen.

Die Rohtraces werden bytegetreu archiviert. In den veröffentlichten Reports
werden ausschließlich die `tracePath`-Felder auf relative, neben dem Report
auflösbare Pfade umgestellt. [SHA256SUMS](2026-09-12-release-gates/SHA256SUMS)
prüft die abgelegten Artefakte.

## Budgets und Freigabegrenze

- [Tweak-Pfad](2026-09-12-release-gates/tweak-budget.txt): 7.968 / 8.000 Bytes, PASS.
- [3D-Pfad](2026-09-12-release-gates/3d-budget.txt): 51.092 / 57.000 Bytes und
  12.773 / 15.000 geschätzte Plugin-Tokens, PASS.
- Keine Fallassertion, keine Pass-Schwelle und kein Plugin-Budget wurde gelockert.
- J-B5 und `v2.0.2` bleiben bis zur abgeschlossenen Live-Abnahme offen.
- Die pausierten Showcase-Szenen und sonstigen 2.2-/2.3-Ziele gehören nicht
  zu dieser technischen Freigabe und werden nicht als erledigt behauptet.
