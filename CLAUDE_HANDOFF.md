# Claude-Handoff — Website Design Ultra 2.0.2

Stand: 12. September 2026. Diese Datei ist die Übergabe vom bisherigen
Arbeitslauf an Claude.

## Sofortiger Einstieg

```bash
cd "/Users/kaygewinner/Desktop/Claude code/website-design-ultra"
git switch main-without-proof-examples
git pull --ff-only origin main-without-proof-examples
git status --short --branch
```

Der GitHub-Default-Branch ist `main-without-proof-examples`. `main` und der
Default-Branch zeigen derzeit beide auf den Handoff-Commit
`5fc84b9883413bb120f2538cd24a0cc3c9e10e95`; der Merge-Commit von PR #48 ist
`e14b477a7d0e9b6db6d076a7ef103f84fcc930e1`. Der Arbeitsbranch
`fix/v2.0.2-release-gates` zeigt auf den PR-Head
`68a4f29fcae691728d415c131e54d49813773216`.

Das lokale Repo enthält ein bereits vorhandenes untracked `.claude/`-Verzeichnis.
Es gehört nicht zu dieser Arbeit und darf weder gelöscht noch committed werden.

## Was erledigt ist

- Der Next-Browser-Timeout aus PR #47 ist behoben. Jeder Starter-Browsertest
  erhält einen eigenen Chromium-Prozess. Der Kontext wird mit dem gewünschten
  Viewport erzeugt, zweimal mit jeweils fünf Sekunden Deadline versucht, und
  Cleanup sowie spät eintreffende Kontexte sind ebenfalls begrenzt.
- Ein Browser-/Transportproblem endet als `UNAVAILABLE` mit Exit 2. Fachliche
  Assertion-Fehler bleiben Exit 1; ein gemischter Fehler wird nicht als
  `UNAVAILABLE` verschleiert.
- Lokale Prüfung: 169 Root-Tests, 74 Next-Tests, Typecheck, Produktionsbuild,
  fünf echte Next-Browserfälle und fünf gezielte Kontext-/Status-Regressionen
  bestanden.
- GitHub Validate `34700006026` ist auf dem finalen PR-Stand vollständig grün:
  24 anwendbare Jobs PASS. `release-provenance` war vor dem Tag erwartungsgemäß
  übersprungen.
- Die fehlenden Remote-Branches sind angelegt und verifiziert:

  - `archive/proof-websites-2026-09-11` →
    `99510869de2512ddedd29bd6947c4333ac9455db`
  - `codex/design-without-proof-examples` →
    `6a9db978cd0dd72318fe0c89c66a2774026d1896`

- Audit, Rohtraces, Fallverträge und reproduzierbare Auswertung liegen unter
  `docs/audits/2026-09-12-release-gates/`.
- Das Vault wurde nach `/Users/kaygewinner/Documents/WEBSITE-DESIGN-ULTRA/`
  synchronisiert.

## Aktueller Live-Stand

Die Modellprüfung lief auf einem sauberen Checkout des unveränderten
Plugin-Baums aus `e61da40cb2b95a50b91e0c93fd4216350d4ccbaf`:

- Plugin-Baum: 181 Dateien, SHA-256
  `b20c32d33cded3322ef727cb4e81a5f0bdf5515c79fdb4ef07483a479459b196`
- Provider: Codex, Modell `gpt-5.5`, Effort `medium`, CLI 0.153.4
- Alle sieben Fälle aus `website-design-ultra/tests/forward/cases.json` haben
  mindestens eine echte Modellantwort.
- Insgesamt sind neun Antworten gewertet: fünf PASS, vier FAIL.
- Für die Zielabnahme gelten weiterhin fünf gewertete Versuche je Fall und
  mindestens 0,6 Pass-Rate. Dafür fehlen mindestens 26 weitere gewertete
  Antworten; Providerfehler zählen nicht.

| Fall | Aktueller Stand | Offener Befund |
|---|---:|---|
| `saas` | 3/3 PASS | Zwei frühere Providerfehler; zwei weitere gewertete Versuche fehlen |
| `dashboard` | 1/1 PASS | Vier weitere gewertete Versuche fehlen |
| `configurator` | 1/1 PASS | Vier weitere gewertete Versuche fehlen |
| `editorial` | 0/1 | Modell las unerlaubt `skills/content-design/references/claims-and-proof.md` |
| `3d-hero` | 0/1 | Unerlaubtes `r3f-interaction`/Touch-Referenz, 21.161 statt maximal 15.000 Plugin-Tokens, `iteration` fehlt |
| `named-direction-no-references` | 0/1 | Modell las unerlaubt `color-palettes/references/neutral-product.md` |
| `slop` | 0/1 | `content.unknowns` hat weniger als die geforderten drei Einträge |

Die erste Claude-Serie ist nicht verwertbar: Die CLI meldete Authentifizierung,
reale Requests scheiterten aber an einer abgelaufenen OAuth-Sitzung. Die erste
Codex-Serie wurde nach drei SaaS-Antworten durch das Nutzungslimit unterbrochen;
32 Providerfehler liegen separat archiviert. Diese Fehler sind nicht als
Modellverhalten zu werten.

Die maschinelle Zusammenfassung mit `releaseEligible: false` steht in
`docs/audits/2026-09-12-release-gates/live-summary.json`. Die Nachweise sind mit
`SHA256SUMS` abgesichert.

## Nächste Arbeit für Claude

1. Zuerst das Vault und diese Datei lesen. Danach die vier konkreten
   Vertragsfehler untersuchen, ohne Budgets oder Fallassertions zu lockern:
   Editorial-Routing auf erlaubte Referenzen begrenzen, 3D-Hero von
   Interaktionsmaterial fernhalten und `iteration`/Tokenbudget sicherstellen,
   Named-Direction ohne Referenzmaterial von Farbpaletten fernhalten, und beim
   Slop-Fall mindestens drei belastbare `content.unknowns` liefern.
2. Die vorhandenen Regressionen und den Content-Validator lokal ausführen.
3. Für jede reparierte Route zunächst einen einzelnen echten Forward-Lauf
   ausführen und die Traces prüfen. Danach die vollständige Serie mit fünf
   gewerteten Versuchen je Fall und `--min-pass-rate 0.6` starten. Providerfehler
   wiederholen, bis fünf gewertete Antworten pro Fall vorliegen.
4. Die bestehende Auswertung erneut ausführen:

   ```bash
   node docs/audits/2026-09-12-release-gates/summarize.mjs
   node website-design-ultra/scripts/validate-content.mjs
   ```

5. Nur wenn alle sieben Fälle die Schwelle erfüllen: Audit, QUEUE und Vault
   aktualisieren, Merge-Commit und finalen CI-Lauf prüfen, dann erst den Tag
   setzen und pushen:

   ```bash
   git tag -a v2.0.2 -m "Release website-design-ultra 2.0.2" \
     e14b477a7d0e9b6db6d076a7ef103f84fcc930e1
   git push origin v2.0.2
   ```

Bis dahin muss der Changelog den Satz
`development candidate, not a published release` behalten. Den Tag nicht
vorziehen, wenn die Live-Abnahme rot oder unvollständig ist.

## Relevante Dateien und Links

- Browserfix: `tests/starter-browser/fixtures.mjs`,
  `starters/next-r3f-cinematic/scripts/browser-context.mjs`
- Status-/Exit-Wrapper: `tests/starter-browser/run.mjs` und
  `tests/starter-browser/status-reporter.mjs`
- Audit: `docs/audits/2026-09-12-release-gates.md`
- Fallzusammenfassung: `docs/audits/2026-09-12-release-gates/live-summary.json`
- Queue: `automation/website-design-ultra-2.1-2.3/QUEUE.md`
- GitHub PR: https://github.com/Kaytm93/website-design-ultra/pull/48
- Grüner finaler CI-Lauf:
  https://github.com/Kaytm93/website-design-ultra/actions/runs/34700006026

## Aufwandsschätzung

Die technische Browser-Reparatur, Branch-Sicherung, CI und Dokumentation sind
fertig. Für die eigentliche Release-Freigabe fehlen realistisch noch vier
Routing-/Antwortkorrekturen, mindestens 26 gewertete Modellantworten, die
Wiederholungs- und Belegprüfung, ein finaler CI-Lauf und der Tag. Bei verfügbarer
Claude-Authentifizierung sind das etwa 3–6 Stunden fokussierte Arbeit; falls die
vier Routen mehrere Iterationen benötigen, eher 1–2 Arbeitstage. Das Release
ist aktuell zu ungefähr 70 % erledigt: technische Basis und Evidenz stehen,
die Live-Abnahme und Tag-Freigabe sind noch offen.
