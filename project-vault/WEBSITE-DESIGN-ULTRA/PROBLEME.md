# Website Design Ultra — Probleme

## Gelöst

- ✅ Das Projekt lag in einem Download-Ordner ohne Versionskontrolle. Es ist
  jetzt ein Git-Repository; der ausgelieferte Stand ist als `v1.5.0` getaggt,
  die Härtung als `v1.5.1`. Es wurden keine Zwischenstände erfunden.
- ✅ Changelog-Abschnitte behaupteten eine nicht verfügbare Commit-SHA. Sie
  verankern jetzt auf einem `Release-Tag`, den `scripts/release.mjs` zum Commit
  auflöst; die alte Formulierung ist ein harter Validierungsfehler. Ein
  Changelog kann die SHA seines eigenen Commits nicht enthalten — deshalb der
  Tag-Name als Anker und die Auflösung zur Prüfzeit.
- ✅ `--provider claude` war ungetestet. Der Fall `dashboard` ist jetzt real
  gegen eine angemeldete Claude-Code-CLI (2.1.220, Sonnet, medium) gelaufen:
  zehn Plugin-Dateien, nur `neutral-product.md`, sechs Referenzen, keine Broad
  Reads, ca. 7.5k beobachtete Plugin-Token gegen ein 9k-Budget — PASS.
- ✅ Der Claude-Trace verwarf jedes `Skill`-Ereignis, weil Plugin-Skills
  namespaced als `plugin:skill` erscheinen und der Matcher nur `[a-z0-9-]+`
  akzeptierte. Der erste echte Lauf wäre fälschlich an fehlender Evidenz
  gescheitert.
- ✅ Der Claude-Trace band Pfade nicht an den geprüften Plugin-Root. Ein Read
  der installierten Kopie unter `~/.claude/skills/...` zählte als Evidenz über
  den getesteten Baum. Solche Pfade sind jetzt `offRootReads` und lassen den
  Fall scheitern.
- ✅ Der Claude-Lauf erbte Skills, CLAUDE.md und MCP-Server des Betreibers. Der
  Runner isoliert jetzt mit `--setting-sources ""` und `--strict-mcp-config`.
- ✅ Fehlender Provider-Login endete in einem harten Abbruch statt in einem
  Status. Er meldet jetzt `UNAVAILABLE` mit Grund und hält das Launch-Gate
  offen — derselbe Vertrag wie ADR-010.
- ✅ Der Claude-Pfad war nur live prüfbar. Aufgezeichnete Provider-Ströme liegen
  unter `tests/forward/traces/` und werden bei jedem `--dry-run` gegen den
  Parser abgespielt.
- ✅ Der erste echte Claude-Lauf deckte eine Inhaltslücke auf: die
  Ausgabeanweisung in `color-palettes` nannte die Kontrastpaare nur im
  Fließtext, das Modell ließ `border` weg. Sie verlangt jetzt eine benannte
  Aussage pro Paar.

- ✅ Forward-Tests prüften nur Antwort-Fixtures und selbst deklarierte
  Skill-Routen; Livefälle werten jetzt tatsächliche Claude-/Codex-Dateizugriffe,
  Broad Reads und Plugin-Tokenbudgets aus.
- ✅ Der erste Trace-Lauf deckte unnötiges `component-patterns`-Routing für ein
  generisches Dashboard auf; der Router verlangt jetzt eine konkrete,
  nicht bereits entschiedene Pattern-Recipe.
- ✅ Der zweite Trace-Lauf deckte unnötiges `style-directions`-Routing trotz
  klarem Produkt-/Palettenkontext auf; Stilfindung lädt nur noch bei echtem
  Direction-Bedarf.
- ✅ Ein unabhängiger Forward-Test interpretierte „Hierarchie matters“ als
  pauschalen Typografie-Trigger; allgemeine Content-/Layout-Hierarchie lädt
  `typography` jetzt nicht mehr.
- ✅ Der Dashboard-Livefall liest nur `neutral-product.md`, keine andere
  Palettenfamilie, keine Skill-Inhalte breit und bleibt mit ca. 8.6k
  beobachteten Plugin-Token unter dem 9k-Budget.
- ✅ `/verify` hing an einem Codex-spezifischen Playwright-Pfad; der neue Adapter
  prüft die tatsächliche CLI-Oberfläche und unterstützt Host-Browser als
  Alternative.
- ✅ Der verpflichtende 3D-Verifikationsschritt hatte keinen Degradationspfad;
  `UNAVAILABLE` bleibt ausdrücklich unverified und hält das Launch-Gate offen.
- ✅ Plan-only war gegenüber fehlender Runtime unklar;
  `NOT_APPLICABLE (plan-only)` ist jetzt von `UNAVAILABLE` getrennt.
- ✅ Typografie war ein monolithischer Skill; jetzt Router plus Pairing-, Hierarchie-/Loading- und Lizenzreferenz.
- ✅ Font-Empfehlungen unterschieden Lizenzklassen nicht vollständig; jetzt vollständige Matrix mit offiziellen Quellen und freien Alternativen.
- ✅ Content-Hierarchie, echte Claims, Microcopy und Lokalisierung hatten keinen Owner; jetzt `content-design`.
- ✅ Responsive Guidance nannte Reframing nur allgemein; jetzt expliziter Wide-/Portrait-/Narrow-Contract mit Recomposition-Operationen.
- ✅ Forward-Tests waren nicht automatisiert; jetzt Dual-Provider-Harness plus fünf strukturierte Fälle.
- ✅ Kontrastvalidator prüfte nur Text/Muted/Action; jetzt 242 Checks inklusive Focus, Border, Error, Disabled und RGBA-Glass.
- ✅ Claude akzeptierte den Draft-2020-12-Metaverweis und Codex `uniqueItems` im Output-Schema nicht; Schema auf den gemeinsamen Structured-Output-Subset reduziert.
- ✅ Plan-only-Forward-Prompts kollidierten mit dem Working-Code-Output der Commands; Plan-/Contract-Modus explizit ergänzt.
- ✅ `MOTION_INTENSITY > 3` konnte Motion trotz fehlender Motion-Aufgabe unnötig routen; Routing folgt jetzt der tatsächlichen Direction/Interaktion.
- ✅ 3D-Art-Direction war über mehrere Skills verstreut; jetzt eigener Contract mit bedarfsgeladenen Referenzen.
- ✅ Quality-Tiers waren nur als Anforderung genannt; jetzt vollständige Vier-Tier-Matrix plus Hysterese und Offscreen-Pause.
- ✅ Touch-Parität nannte Cancellation nur allgemein; jetzt vollständige Pointer-/Gesture-State-Machine.
- ✅ WebGPU-Kompatibilität war Fließtext; jetzt Feature-Matrix mit fünf Pflichtdimensionen.
- ✅ Verifikation war eine Checkliste; jetzt realer Browser-Capture für vier Zustände.
- ✅ Falsche erste `playwright-cli run-code`-Syntax im Entwurf wurde durch echten Browser-Test erkannt und korrigiert.
- ✅ `quick_validate.py` fehlte lokal `PyYAML`; isoliert über `uv run --with pyyaml` erfolgreich ausgeführt.

## Offen / Umgebung

- 🟡 Kein `origin`-Remote gesetzt; `git push` steht noch aus. Das Repository ist
  vollständig lokal, Commits und Tags existieren.
- 🟡 Nur der Fall `dashboard` ist live gegen Claude bewiesen. `saas`,
  `editorial`, `3d-hero` und `configurator` sind für Claude weiterhin
  unbewiesen; sie melden bis dahin keinen Pass, sondern nichts.
- 🟡 Der Codex-Livelauf stammt aus dem Stand vor 1.5.1 und ist gegen den neuen
  Baum-Digest nicht erneut geprüft.
- 🟡 Es existierte vor der Session kein gleichnamiger Projekt-Vault. Wegen des
  case-insensitiven Dateisystems liegt die Quelle unter
  `project-vault/WEBSITE-DESIGN-ULTRA` und wird nach Documents synchronisiert.
- ✅ Ein erster case-kollidierter Sync enthielt Plugin-Dateien; der erzeugte
  Zielordner wurde vollständig in den Papierkorb verschoben und sauber neu
  aufgebaut.
