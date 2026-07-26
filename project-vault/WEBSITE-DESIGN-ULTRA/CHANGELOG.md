# Website Design Ultra — Projekt-Changelog

## 2026-07-26 — Provenance & Claude-Provider / Version 1.5.1

- Projektordner in ein Git-Repository überführt; Import-Commit als `v1.5.0`
  getaggt, ohne Zwischenstände zu erfinden.
- Changelog-Abschnitte verankern auf auflösbaren `Release-Tag`-Angaben;
  `scripts/release.mjs` prüft das, `validate-content.mjs` verbietet die alte
  „SHA nicht verfügbar"-Formulierung.
- Zwei Fehler im Claude-Trace-Pfad behoben: verworfene `plugin:skill`-Ereignisse
  und ungebundene Pfade, die eine installierte Kopie als Evidenz zählten.
- Claude-Runner gegen Betreiber-Settings und MCP isoliert.
- Provider-Verfügbarkeit folgt dem `UNAVAILABLE`-Vertrag statt hartem Abbruch.
- Rohe Provider-Ereignisströme werden archiviert und offline gegen den Parser
  abgespielt.
- Erster echter `--provider claude`-Livelauf (`dashboard`): zuerst FAIL wegen
  fehlender `border`-Kontrastangabe, nach dem Fix in `color-palettes` PASS mit
  zehn Plugin-Dateien, sechs Referenzen und ca. 7.5k beobachteten Plugin-Token.

Release-Tag: v1.5.1

## 2026-07-25 — Pre-Launch Hardening / Version 1.5.0

- Providerseitige Read-Traces für Claude und Codex ergänzt.
- Allowed-/Forbidden-Dateien, Referenzlimits und Plugin-Tokenbudgets pro
  Forward-Fall eingeführt.
- Default-Overrouting zu `component-patterns` und `style-directions` nach zwei
  echten Trace-Fehlläufen behoben.
- Unabhängigen Typografie-Overroute-Befund behoben; allgemeine
  Content-/Layout-Hierarchie aktiviert den Skill nicht.
- Dashboard-Livefall mit exklusiver Neutral-Palette, ohne Broad Reads und ca.
  8.6k Plugin-Token bestanden.
- Capability-geprüften `verify-browser.mjs`-Adapter ergänzt und gegen einen
  lokalen Vier-Zustands-Capture getestet.
- Hostneutralen `PASS | FAIL | UNAVAILABLE`-Contract inklusive offenem
  Launch-Gate für unverified Ergebnisse eingeführt.
- `NOT_APPLICABLE (plan-only)` sauber von fehlender Browserfähigkeit getrennt.

Release-Tag: v1.5.0 (nachträglich am 2026-07-26 auf den Import-Commit gesetzt).

## 2026-07-25 — Priority 2 / Version 1.4.0

- `typography` auf Progressive Disclosure umgestellt und vollständige Lizenz-/Open-Alternativen-Matrix ergänzt.
- `content-design` mit Claims/Proof, Microcopy und Lokalisierung hinzugefügt.
- Responsive Art Direction als Wide-/Portrait-/Narrow-Recomposition-Contract ergänzt.
- Dual-Provider-Forward-Harness plus fünf repräsentative Prompts ergänzt.
- Kontrastvalidator auf Focus, meaningful Border, Danger/Error, Disabled und composited Glass erweitert.
- Routing in Core, Commands, Style/Component Patterns, README und Manifesten aktualisiert.
- Zwei Forward-Test-Befunde zu Plan-only und Motion-Routing korrigiert.

Release-Tag: keine — vor Einführung der Versionskontrolle entstanden.

## 2026-07-25 — Priority 1 / Version 1.3.0

- `3d-art-direction` mit drei Referenzen und Agent-Metadaten ergänzt.
- `3d-runtime-quality` mit Tier-Matrix, Adaptionsmodell und Agent-Metadaten ergänzt.
- `/verify` mit realen Playwright-Desktop-/Mobile-/Reduced-Motion-/Fallback-Captures ergänzt.
- `r3f-interaction` um Touch/Gestures erweitert.
- `shaders-tsl` um WebGPU-Feature-Matrix erweitert.
- Routing in `immersive-3d`, `r3f-patterns`, Commands, README und Manifesten aktualisiert.
- Deterministischen Validator auf 15 Skills, 5 Commands und Priority-1-Verträge erweitert.

Release-Tag: keine — vor Einführung der Versionskontrolle entstanden.
