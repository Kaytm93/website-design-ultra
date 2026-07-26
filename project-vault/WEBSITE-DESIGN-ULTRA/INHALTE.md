# Website Design Ultra — Inhalte

## Inhaltsarchitektur 1.5.0

Die Prio-2-Inhalte folgen derselben Progressive-Disclosure-Struktur wie Prio 1:

- `SKILL.md` enthält Trigger, Auswahl, Invarianten, Workflow und Output-Contract.
- Matrizen, Beispiele und Varianten liegen genau eine Ebene unter `references/`.
- Detailwissen wird nicht zwischen Router und Referenz dupliziert.
- Commands routen nach Nutzerauftrag; Plan-only verlangt keinen künstlichen Code-Output.
- Cross-Skill-Verweise sind einseitige Auswahlhinweise, keine transitiven
  Ladeabhängigkeiten.
- Ein Kind-Skill lädt seinen Owner oder Geschwisterreferenzen nicht rekursiv.

## Trace-geprüftes Routing

Der Live-Harness trennt drei Aussagen:

1. Schema/Content ist korrekt.
2. Das Modell nennt die erwarteten Skills.
3. Die Provider-Ereignisspur beweist, welche Dateien tatsächlich gelesen wurden.

Nur Punkt 3 gilt als Progressive-Disclosure-Nachweis. Pro Fall existieren
Allowed-/Forbidden-Dateien, ein Referenzlimit und ein deterministisches
Plugin-Tokenbudget. Broad Content Reads sind ein Fehler. `--dry-run` validiert
nur Fixtures und Trace-Parser und sagt ausdrücklich, dass kein Modellverhalten
getestet wurde.

Der Dashboard-Livefall liest `core-rules`, `content-design`, `color-palettes`,
`ui-states` und sechs Referenzen. Innerhalb der Palette wird ausschließlich
`neutral-product.md` geladen. Beobachteter Umfang: 34.303 Bytes bzw. ca. 8.576
Plugin-Token.

## Typografie

`typography` ist jetzt ein Router mit drei unabhängigen Pfaden:

1. Pairings und Display-/Body-/Mono-Rollen
2. Fluid Hierarchy, Loading, CLS und Fallback-Metriken
3. Lizenzstatus und Open-Source-Alternativen

Die Lizenzmatrix deckt alle im Plugin empfohlenen Familien ab und trennt OFL-1.1, Free Proprietary, Commercial, OS-bundled/restricted und Unverified. Eine lokal vorhandene oder kostenlose Font-Datei gilt nicht automatisch als redistribuierbarer Webfont.

## `content-design`

Behandelt:

- `promise → mechanism → evidence → objections → action`
- Claim-/Proof-Ledger mit `verified`, `qualified`, `illustrative`, `unknown`
- CTAs, Form-, Error-, Empty-, Pending- und Consent-Microcopy
- Lokalisierung, Transcreation, ICU/CLDR-Formate, RTL und Expansion
- explizite, sichtbare Platzhalter statt plausibel erfundener Fakten

## Responsive Art Direction

Der Contract beschreibt Wide, Portrait und Narrow jeweils über:

- Fokus und erste Leseeinheit
- DOM-/Fokus-/visuelle Reihenfolge
- Medienrolle, Crop oder 3D-Kamera
- CTA-Platzierung
- Dichte sowie entfernte/ersetzte Details
- Navigations- und Interaktionsmodell
- sichtbaren Proof vor dem Scroll

Reorder, Promote/Demote, Replace, Reframe, Regroup, Reduce und Interaction Change sind erlaubte Operationen. Kleinere Fonts oder weniger Grid-Spalten allein gelten nicht als vollständige Re-Komposition.

## Forward Tests

Fünf Fälle prüfen die Übertragbarkeit:

1. B2B SaaS ohne erfundene Proof-Signale
2. zweisprachiges Editorial ohne bezahlte Font-Lizenz
3. responsives Dashboard mit State-/Glass-Kontrast
4. 3D-Hero mit Portrait-/Reduced-Motion-/GPU-Fallback
5. zugänglicher Konfigurator mit Touch-/Cancellation-Parität

Der Harness unterstützt Codex und Claude, verlangt Schema-Output, prüft
inhaltliche Signale und tatsächliche Dateizugriffe und beendet fehlgeschlagene
Fälle mit Exit-Code 1.

## Browser-Verifikation

`verify-browser.mjs` prüft eine CLI auf benannte Sessions, `run-code` und
Screenshots, bevor sie verwendet wird. Mögliche Backends sind explizites
Executable, kompatibler Codex-Wrapper, PATH-CLI oder npm-CLI. Claude Cowork kann
seine Host-Browser-Automation verwenden.

Der Statusvertrag ist `PASS | FAIL | UNAVAILABLE`. Ohne echte Browserbilder ist
`PASS` verboten. Bei `UNAVAILABLE` werden Build/Typecheck sowie statische
Poster-/DOM-/Reduced-Motion-Evidenz dokumentiert, das Ergebnis bleibt aber
unverified und nicht launch-ready.

Ein ausdrücklicher Plan/Contract ohne ausführbares Target verwendet
`NOT_APPLICABLE (plan-only)` mit geplanter Capture-Matrix. Das ist keine
Launch-Bewertung und darf nicht mit einer fehlenden Browserfähigkeit verwechselt
werden.

## Kontrast

Jede kuratierte Palette enthält:

- `bg`, `surface`, `text`, `muted`
- `action`, `on-action`
- `focus`
- meaningful `border`
- `danger`, `on-danger`
- `disabled`

Der Validator prüft 242 Paarungen. RGBA-Surface und -Border von Aurora Glass werden vor der Kontrastberechnung über den tatsächlichen Hintergrund komponiert.
