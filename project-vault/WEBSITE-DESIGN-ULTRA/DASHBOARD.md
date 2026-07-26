# Website Design Ultra — Dashboard

Stand: 2026-07-26

## Status

Priorität 1 und 2, die Pre-Launch-Härtung und das Prozess-Loch der eigenen
Historie sind erledigt. Aktueller Release-Stand: **1.5.1** mit 16 Skills und
5 Commands, unter Versionskontrolle.

Neu in 1.5.1:

- Projekt ist ein Git-Repository; `v1.5.0` markiert den importierten Stand,
  `v1.5.1` die Härtung
- Changelog-Abschnitte verankern auf auflösbaren `Release-Tag`-Angaben statt auf
  einer behaupteten Commit-SHA
- zwei Fehler im Claude-Trace behoben (verworfene `plugin:skill`-Ereignisse,
  ungebundene Pfade)
- Claude-Runner gegen Betreiber-Settings und MCP isoliert
- Provider-Verfügbarkeit als `UNAVAILABLE` statt hartem Abbruch
- aufgezeichnete Provider-Ströme, offline gegen den Parser abspielbar
- reproduzierbarer `pluginTreeDigest` über den geprüften Baum

## Was gerade läuft

Nichts blockiert. Offen sind das Setzen eines `origin`-Remotes samt Push und die
vier Livefälle, die für Claude noch nicht gelaufen sind.

## Validierung

- Plugin-Content: 16 Skills, 5 Commands ✅
- 20 Paletten / 242 State-Kontrastprüfungen ✅
- RGBA-Compositing für Aurora Glass ✅
- Claude Plugin `--strict` ✅ (Stand 1.5.0)
- Forward-Fixtures für SaaS, Editorial, Dashboard, 3D-Hero und Konfigurator ✅
- Codex-Livefall `dashboard` mit Dateizugriffsspur: PASS ✅ (Stand vor 1.5.1)
- **Claude-Livefall `dashboard`: PASS** ✅ — CLI 2.1.220, Sonnet, medium,
  isolierte Sitzung, 14 Turns
  - 10 Plugin-Dateien, 4 Skills, 6 Referenzen (Budget 7)
  - nur `neutral-product.md`; keine Editorial- oder Expressive-Palette
  - 29.916 beobachtete Bytes, ca. 7.479 Plugin-Token (Budget 9.000)
  - 0 Broad Reads, 0 Off-Root-Reads, 0 fremde Skills
  - gemeldete Skills stimmen exakt mit der Lesespur überein
  - Baum-Digest `9f381e25…21a93e21`, 68 Dateien
- Parser-Konformität gegen aufgezeichneten Claude-Strom, ohne CLI ✅
- Release-Gate `scripts/release.mjs --strict` ✅
- portabler Verify-Adapter: Probe und Vier-Zustands-Capture auf lokalem
  Testserver ✅

## Nächste Schritte

1. `origin` setzen und `main` plus Tags `v1.5.0`/`v1.5.1` pushen.
2. `saas`, `editorial`, `3d-hero` und `configurator` zusätzlich mit
   `--provider claude` fahren; bis dahin gelten sie für Claude als unbewiesen.
3. Codex-Livelauf gegen den neuen Baum-Digest wiederholen, damit beide Provider
   dieselbe Version belegen.
4. Vor echtem Launch mindestens einen realen Projektlauf mit Browserartefakten
   aus allen vier Zuständen durchführen.
5. Priorität 3: Starter-Assets, Rapier, XR/Audio und Marketplace-Präsentation.
