# Website Design Ultra — Architekturentscheidungen

## ADR-001: Art Direction und Runtime Quality als getrennte Skills

Status: angenommen, 2026-07-25

Entscheidung: `3d-art-direction` besitzt die visuelle Absicht; `3d-runtime-quality` besitzt die Laufzeitdegradation.

Begründung: Kamera, Licht und Materialhierarchie ändern sich selten und dürfen nicht durch Performance-Schalter verwässert werden. Runtime-Qualität benötigt dagegen messbare Zustände und Hysterese. Die Trennung hält beide Skills triggerbar und token-effizient.

## ADR-002: Ein zentraler Quality-Owner

Status: angenommen, 2026-07-25

Entscheidung: DPR, Shadows, LOD, PostFX, Partikel und Poster-Wechsel werden aus einem zentralen Tier abgeleitet.

Begründung: Mehrere adaptive Helfer erzeugen Oszillation und unvorhersehbare Kombinationen. Upgrades benötigen längere Fenster als Downgrades; nach jedem Wechsel gilt ein Cooldown.

## ADR-003: Verifikation über reale Browserzustände

Status: angenommen, 2026-07-25

Entscheidung: `/verify` rendert eine laufende URL mit Playwright CLI und fotografiert vier benannte Zustände.

Begründung: Build-Erfolg und Code-Review erkennen Layout-Crops, mobile Fehlkomposition, bewegte Reduced-Motion-Pfade und leere GPU-Fallbacks nicht zuverlässig.

## ADR-004: WebGPU-Support pro Feature statt Renderer-Pauschale

Status: angenommen, 2026-07-25

Entscheidung: Jedes genutzte Feature erhält Angaben zu WebGPU, WebGL2-Fallback, TSL-Postprocessing, Compute und Einschränkungen.

Begründung: `WebGPURenderer`, sein WebGL2-Backend und der klassische `WebGLRenderer` sind nicht identisch. TSL-Compile auf einem Backend beweist keine Parität auf dem anderen.

## ADR-005: Content-Wahrheit als eigener Skill

Status: angenommen, 2026-07-25

Entscheidung: `content-design` besitzt Claim-/Proof-Ledger, Microcopy und Lokalisierung. `core-rules` verbietet Erfindungen und routet Details dorthin.

Begründung: Visuelle Skills dürfen fehlende Produktfakten nicht plausibel ausformulieren. Ein eigener Owner hält Evidenzstatus, Platzhalter und Locale-Bedeutung über Hero, UI-States und 3D-DOM hinweg konsistent.

## ADR-006: Responsive Direction als Viewport-Shots

Status: angenommen, 2026-07-25

Entscheidung: Vollseiten und Signature Sections definieren Wide, Portrait und Narrow über Fokus, Reihenfolge, Media, CTA, Dichte, Proof und Interaktion.

Begründung: Breakpoints und `clamp()` beschreiben Größen, aber keine Prioritäts- oder Kompositionsänderung. Viewport-Shots machen Reorder, Replacement und Reframing prüfbar.

## ADR-007: Kontrastpaare sind Teil der Palette

Status: angenommen, 2026-07-25

Entscheidung: Kuratierte Paletten liefern Focus, meaningful Border, Danger/On-Danger und Disabled mit; der Validator komponiert Alpha-Farben vor der Messung.

Begründung: Accessibility scheitert häufig in Zuständen und Glasflächen, obwohl Body-Text besteht. Explizite Paare ermöglichen deterministische Tests statt visueller Schätzung.

## ADR-008: Forward-Tests als schema-validierte Dual-Provider-Suite

Status: angenommen, 2026-07-25

Entscheidung: Repräsentative Prompts laufen isoliert über Codex oder Claude und werden gegen ein gemeinsames JSON-Schema sowie Fallassertionen geprüft.

Begründung: Inhaltsmarker beweisen nur, dass Regeln existieren. Forward-Tests prüfen, ob ein frisches Modell die richtigen Skills routet und die Contracts auf neue Aufgaben überträgt.

## ADR-009: Provider-Trace ist die Routing-Wahrheit

Status: angenommen, 2026-07-25

Entscheidung: Progressive Disclosure gilt nur dann als nachgewiesen, wenn der
Live-Harness tatsächliche Claude-`Read`/`Skill`-Events oder Codex-Command-Reads
gegen erlaubte/verbotene Dateien, Broad-Read-Regeln, Referenzzahl und
Plugin-Tokenbudget prüft. Das Antwortfeld `skills` bleibt Ergebniscontract, ist
aber kein Ladebeweis.

Begründung: Ein Modell kann die erwartete Route nennen, obwohl es zusätzliche
Skills oder Referenzen gelesen hat. Nur die Provider-Ereignisspur macht
Overrouting und reale Kontextkosten sichtbar.

## ADR-010: Verifikation ist capability-basiert, nicht hostpfad-basiert

Status: angenommen, 2026-07-25

Entscheidung: Browser-Verifikation läuft über einen Adapter, der Session,
`run-code` und Screenshot-Fähigkeit prüft, oder über eine echte
Host-Browser-Automation. Der Statusvertrag lautet `PASS | FAIL | UNAVAILABLE`.
`UNAVAILABLE` darf statische Evidenz liefern, bleibt aber unverified und hält das
Launch-Gate offen.

Für reine Plan-/Contract-Aufträge ohne ausführbares Target gilt zusätzlich
`NOT_APPLICABLE (plan-only)` mit geplanter Capture-Matrix; dieser Status ist
keine Launch-Bewertung.

Begründung: Codex-Wrapperpfade und Slash-Commands existieren nicht auf jedem
Host. Ein fester Pfad macht den Pflichtschritt unvollziehbar; ein stiller
Fallback auf Build/Code-Review würde dagegen eine visuelle Prüfung vortäuschen.

## ADR-011: Release-Tag statt Commit-SHA als Herkunftsanker

Status: angenommen, 2026-07-26

Entscheidung: Jeder Changelog-Abschnitt trägt einen `Release-Tag`. Die SHA wird
zur Prüfzeit aus dem Tag aufgelöst, nicht in den Text geschrieben. Abschnitte
ohne Repository-Historie sagen das ausdrücklich, statt eine nicht auflösbare
SHA zu behaupten.

Begründung: Ein Changelog kann die SHA des Commits, der ihn einführt, nicht
enthalten. Eine getippte SHA ist außerdem eine Behauptung, keine Evidenz. Der
Tag-Name steht vor dem Commit fest und ist maschinell auflösbar; damit gilt für
die eigene Historie derselbe Maßstab, den das Regelwerk anderen auferlegt.

## ADR-012: Evidenz gilt nur gebunden an den geprüften Baum

Status: angenommen, 2026-07-26

Entscheidung: Ein Provider-Ereignis zählt nur als Evidenz, wenn sein Pfad
innerhalb des getesteten Plugin-Roots liegt. Pfade, die wie Plugin-Dateien
aussehen, aber außerhalb liegen, sind `offRootReads` und lassen den Fall
scheitern. Der Livelauf isoliert die Provider-Sitzung von den Einstellungen des
Betreibers. Zusätzlich hält ein reproduzierbarer `pluginTreeDigest` fest, über
welchen Baum die Aussage gilt.

Begründung: Eine installierte Kopie desselben Plugins beantwortet denselben
Prompt. Ohne Root-Bindung misst der Trace den falschen Baum und bestätigt eine
Aussage über Code, der nicht geprüft wurde. Stilles Verwerfen wäre ebenso
falsch: es erzeugt ein „keine Evidenz"-Ergebnis, dessen Ursache unsichtbar
bleibt.
