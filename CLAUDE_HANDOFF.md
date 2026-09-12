# Claude-Handoff — Website Design Ultra 2.0.2

Stand: 12. September 2026, zweiter Durchgang. Diese Datei ist die Übergabe an die
nächste Instanz. Sie ersetzt die Fassung vom ersten Durchgang.

## Sofortiger Einstieg

```bash
cd "/Users/kaygewinner/Desktop/Claude code/website-design-ultra"
git fetch origin --prune
git switch main-without-proof-examples
git pull --ff-only origin main-without-proof-examples
git status --short --branch
```

Der GitHub-Default-Branch ist `main-without-proof-examples` und steht auf dem
Merge-Commit von PR #49, `a5b141aa52a4b46c648a1c9f793b5020171b560c`. Der
Validate-Lauf darauf ist vollständig grün: 24 Jobs `success`, `release-provenance`
vor dem Tag erwartungsgemäß übersprungen, Lauf `34714324993`. Der Tree des
Merge-Commits ist byte-identisch mit dem geprüften PR-Head `45c4d04`.

`main` steht weiterhin auf `84d3e50e6179a52297d97a66f0e770e10f8c8966` und ist
damit hinter dem Default-Branch. Beide waren zuvor bewusst synchron; ob `main`
nachgezogen wird, ist offen.

Die Reparatur dieses Durchgangs liegt in PR #49, dessen Arbeitsbranch
`fix/v2.0.2-forward-contracts` nach dem Merge entfernt wurde. Die vier Commits
sind über den Merge-Commit erreichbar:

- `ee605a95f0258f53684524c4c737122bb247d37f` — Routing der vier Live-Befunde
- `6a3eac09181e0d3dcd1e6058a3d6cd8838f4342a` — angewiesener Pfad statt Teilmenge

Plugin-Baum nach der Reparatur: 181 Dateien, SHA-256
`e58289df9a045e3d5003c13c8fcf6821fb4abbf7b81190086209bdb77d28357f`.
Der Baum, auf dem die Live-Serie lief, war
`b20c32d33cded3322ef727cb4e81a5f0bdf5515c79fdb4ef07483a479459b196`.
Die beiden Digests unterscheiden sich; jede neue Abnahme gilt nur für den neuen.

Das lokale Repo enthält ein untracked `.claude/`-Verzeichnis. Es gehört nicht zu
dieser Arbeit und darf weder gelöscht noch committed werden. Die Arbeit dieses
Durchgangs lief im Worktree
`/Users/kaygewinner/Desktop/Claude code/website-design-ultra-2.1-queue`.

## Was in diesem Durchgang erledigt ist

Alle vier Vertragsfehler der Live-Serie sind bearbeitet. In jedem der vier Fälle
zeigte der Trace auf eine Anweisung des Plugins selbst, nicht auf Modellversagen.
Keine Assertion, keine verbotene Datei, keine erforderliche Datei und keine
Pass-Schwelle wurde gelockert.

| Befund | Ursache | Reparatur |
|---|---|---|
| `editorial` las `claims-and-proof.md` | `content-design` verlangte das Claim-Ledger unbedingt; nur die Claims-Zeile zeigte auf die Datei | Ledger und Referenz getrennt: jede Antwort liefert das Ledger, nur das Abwägen eines Claims öffnet die Datei |
| `3d-hero` lud `r3f-interaction` | Gate lautete „click, hover, inspection, or configuration“; ein Scharnier, das „in motion“ verständlich wird, erfüllt „inspection“ | Gate benennt die Eingabe des Besuchers; eine nur betrachtete Szene lädt es nicht. `configurator` fordert Maus, Touch und Tastatur und feuert weiter |
| `named-direction-no-references` las eine Palette | Für „Museum Monolith“ existiert kein Material; das Modell nahm die nächstgelegene Palette | `immersive-3d`: Szenenfarbe und Tone Mapping sind Art Direction, eine unbekannte Richtung ist ein Unknown und kein Grund, `color-palettes` überhaupt zu laden |
| `slop` lieferte ein `content.unknowns` | Nichts forderte einen Eintrag pro fehlender Tatsache | Ledger fordert einen Eintrag je fehlender Tatsache; ein Satz mit sechs Unknowns ist ein Eintrag |
| `3d-hero` ohne Signal `iteration` | Plan-only war vom Look-Loop ausgenommen | Plan-only benennt Poster-Target und die erste zu messende Iteration |

Der fünfte Befund, 21.161 statt 15.000 Tokens, war ein **Messfehler, kein
Modellfehler**. `measure-path.mjs` summierte `requiredSkills` und
`requiredFiles`, also elf Dateien. `forward-trace.mjs` berechnet einen Live-Lauf
über jede geöffnete Plugin-Datei, für diesen Brief zwanzig. Die neun erlaubten
Referenzen und die Command-Datei lagen innerhalb des Vertrags und außerhalb der
Messung — das Budget konnte offline nicht scheitern und live nicht bestehen.
`maxEstimatedPluginTokens` trägt jetzt den angewiesenen Pfad; der erforderliche
Pfad behält seine 57-KB-Byte-Grenze als Kompressionsziel.

| Fall | Erforderlich | Angewiesen | Vorher | Jetzt |
|---|---:|---:|---:|---:|
| `saas` | 9.298 | 17.126 | 16.112 | 17.126 |
| `editorial` | 13.352 | 21.163 | 19.863 | 21.163 |
| `dashboard` | 11.912 | 19.651 | 18.455 | 19.651 |
| `3d-hero` | 13.045 | 22.951 | 15.000 | 22.951 |
| `named-direction-no-references` | 13.045 | 22.951 | 23.045 | 22.951 |
| `configurator` | 13.928 | 26.145 | 26.399 | 26.145 |
| `slop` | 7.172 | 16.226 | 14.921 | 16.226 |

Byte-Budgets wurden dafür nicht angehoben. Jede Reparatur musste Prosa an anderer
Stelle bezahlen: `commands/immersive.md` 4.094 / 4.096, `immersive-3d`
4.995 / 5.000, `3d-art-direction` 4.999 / 5.000 bei unverändertem YAML- und
Checklisten-Hash. Der Farbschutz sitzt in `immersive-3d` statt in `core-rules`,
weil `core-rules` sein 8.000-Byte-Budget mit `commands/tweak.md` teilt und
32 Bytes frei hatte.

Neue Prüfungen, jede durch absichtliches Brechen kontrolliert:

- `validate-content.mjs` berechnet den angewiesenen Pfad selbst und verlangt
  Gleichheit mit dem deklarierten Budget;
- `measure-path.mjs` sagt dasselbe aus eigenem Lauf und endet in beiden
  Richtungen mit Exit 1; `--all` druckt alle sieben Fälle;
- `tests/skill-budget` fixiert ein Budget einen Token zu niedrig und einen zu
  hoch und prüft, dass der angewiesene Pfad jedes Falls echt breiter ist;
- `validate-content.mjs` bindet die fünf Reparatursätze als Marker, damit ein
  späterer Kompressionslauf sie nicht stumm löscht.

Offline bestanden: 245 Root-Tests, `validate-content`, `lint-copy --self`,
Forward-Dry-Run mit sieben Fallverträgen, `measure-path --all`. Messungen liegen
unter `docs/audits/2026-09-12-release-gates/repair/` mit eigener `SHA256SUMS`.
Die eingefrorene Live-Evidenz des ersten Durchgangs ist unberührt: 90 Artefakte
verifizieren weiterhin gegen ihre `SHA256SUMS`, und `summarize.mjs` reproduziert
`live-summary.json` unverändert.

## Was offen ist

**Die Live-Abnahme.** Das ist der einzige verbleibende Release-Blocker.

Offline geprüft heißt nicht geroutet. Ein aufgezeichneter Trace routet nicht,
also beweist der Dry-Run keine Routingänderung. Ein Marker beweist, dass der Satz
im Baum steht, nicht dass ein Modell ihn befolgt. Die Reparaturen sind Hypothesen
über Modellverhalten, gestützt auf gelesene Traces — bestätigt sind sie erst,
wenn echte Antworten es zeigen.

Nötig sind fünf gewertete Versuche je Fall bei `--min-pass-rate 0.6`, also
mindestens 26 weitere gewertete Antworten auf dem Digest
`e58289df9a045e3d5003c13c8fcf6821fb4abbf7b81190086209bdb77d28357f`.
Providerfehler zählen nicht und müssen wiederholt werden.

Providerlage aus dem ersten Durchgang, vor dieser Sitzung nicht neu geprüft:
Claude meldete `loggedIn`, reale Requests scheiterten an abgelaufenem OAuth;
Codex lief nach 32 Kontolimitfehlern erst nach Reset. Beides zuerst prüfen.

## Nächste Arbeit

### 1. Provider prüfen

```bash
codex --version && codex auth status --json
```

### 2. Je reparierte Route ein einzelner echter Lauf

Erst ein Fall, dann Traces lesen. Ein einzelner Lauf kostet wenig und sagt, ob
die Reparatur greift, bevor die ganze Serie Geld kostet.

```bash
cd "/Users/kaygewinner/Desktop/Claude code/website-design-ultra/website-design-ultra"
mkdir -p /tmp/wdu-verify
for CASE in editorial 3d-hero named-direction-no-references slop; do
  node scripts/run-forward-tests.mjs \
    --case "$CASE" --provider codex --model gpt-5.5 --effort medium \
    --require-live --max-budget-usd 0.60 \
    --report "/tmp/wdu-verify/$CASE.report.json" \
    --trace-dir "/tmp/wdu-verify/traces"
done
```

Danach prüfen, ob die vier alten Befunde verschwunden sind: `editorial` ohne
`claims-and-proof.md`, `3d-hero` ohne `r3f-interaction` und mit `iteration`,
`named-direction-no-references` ohne `color-palettes`, `slop` mit mindestens drei
`content.unknowns`. Neue, andere Befunde sind möglich und dann der nächste Schritt.

### 3. Vollständige Serie

Sieben Fälle × fünf Versuche. Laut `--help` bis zu 21 USD bei 0,60 je Aufruf.

```bash
cd "/Users/kaygewinner/Desktop/Claude code/website-design-ultra/website-design-ultra"
node scripts/run-forward-tests.mjs \
  --provider codex --model gpt-5.5 --effort medium \
  --repeat 5 --min-pass-rate 0.6 --require-live --max-budget-usd 0.60 \
  --report /tmp/wdu-series/report.json \
  --trace-dir /tmp/wdu-series/traces
```

Providerfehler wiederholen, bis je Fall fünf **gewertete** Antworten vorliegen.
Ein Providerfehler ist keine gewertete Antwort und kein FAIL.

### 4. Offline-Gates erneut

```bash
cd "/Users/kaygewinner/Desktop/Claude code/website-design-ultra/website-design-ultra"
node scripts/measure-path.mjs --all
node scripts/validate-content.mjs
node scripts/run-forward-tests.mjs --dry-run
node scripts/lint-copy.mjs --self
cd .. && node --test $(find tests -name '*.test.mjs' | sort)
```

### 5. Erst bei sieben bestandenen Fällen

Audit, QUEUE und Vault mit der neuen Evidenz aktualisieren, PR öffnen und
mergen, Validate-Lauf auf dem Merge-Commit prüfen, dann tagen:

```bash
git tag -a v2.0.2 -m "Release website-design-ultra 2.0.2" <merge-commit>
git push origin v2.0.2
```

Bis dahin behält der Changelog den Satz
`development candidate, not a published release`. Den Tag nicht vorziehen, wenn
die Live-Abnahme rot oder unvollständig ist. Das Tokenbudget ist korrigiert, nicht
gelockert — wer es weiter senken will, muss Prosa kürzen, nicht die Zahl.

## Relevante Dateien

- Reparierte Verträge: `website-design-ultra/skills/content-design/SKILL.md`,
  `skills/immersive-3d/SKILL.md`, `skills/3d-art-direction/SKILL.md`,
  `commands/immersive.md`
- Messung: `website-design-ultra/scripts/measure-path.mjs`
- Bindung: `website-design-ultra/scripts/validate-content.mjs`
  (`liveRoutingContracts`, Budgetgleichheit), `tests/skill-budget/skill-budget.test.mjs`
- Budgets: `website-design-ultra/tests/forward/cases.json`
- Audit: `docs/audits/2026-09-12-release-gates.md`
- Reparaturmessungen: `docs/audits/2026-09-12-release-gates/repair/`
- Eingefrorene Live-Evidenz: `docs/audits/2026-09-12-release-gates/`
- Queue: `automation/website-design-ultra-2.1-2.3/QUEUE.md`
- PR dieses Durchgangs: https://github.com/Kaytm93/website-design-ultra/pull/49,
  gemergt als `a5b141a`; grüner Lauf auf dem Merge-Commit:
  https://github.com/Kaytm93/website-design-ultra/actions/runs/34714324993
- PR des ersten Durchgangs: https://github.com/Kaytm93/website-design-ultra/pull/48
- Grüner CI-Lauf des ersten Durchgangs:
  https://github.com/Kaytm93/website-design-ultra/actions/runs/34700006026
- Der dokumentierte Branch `codex/design-without-proof-examples` ist remote
  entfernt. Sein Commit `6a9db978cd0dd72318fe0c89c66a2774026d1896` bleibt aus
  `main` und aus dem Default-Branch erreichbar; verloren ist nur das Label.
  `archive/proof-websites-2026-09-11` auf `99510869` besteht unverändert.

## Aufwandsschätzung

Die Plugin-Arbeit ist fertig und offline belegt. Offen sind die Providerprüfung,
vier einzelne Verifikationsläufe, mindestens 26 gewertete Antworten, ein
Auswertungs- und Dokumentationsdurchgang, ein CI-Lauf auf dem Merge-Commit und
der Tag. Bei funktionierender Anmeldung und ohne neue Befunde sind das etwa
2–4 Stunden, überwiegend Wartezeit auf die Serie. Zeigt die Serie neue
Routingbefunde, kommt je Befund ein Reparaturzyklus dazu.

Das Release ist bei ungefähr 85 %: technische Basis, Evidenz und alle bekannten
Vertragsfehler sind erledigt, die Live-Abnahme und der Tag sind offen.
