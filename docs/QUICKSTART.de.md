# Website Design Ultra verwenden

Voraussetzungen: Git und Node.js ab 22.18. Für die KI-Workflows brauchst du
Codex oder Claude Code mit deinem eigenen angemeldeten Konto. Figma, Blender
und kostenpflichtige Designtools sind für den Einstieg nicht erforderlich.

## Überarbeiteten Stand vorbereiten

Der Produktionscheck liegt inzwischen in PR #47. Die hier beschriebene Fassung
baut darauf auf und ist der Entwicklungskandidat mit pausierten Proof-Websites.
Die neue Fassung wurde wegen fehlendem GitHub-Schreibzugriff als übertragbares
Git-Paket vorbereitet. Eine Installation von `main` enthält sie noch nicht.

Das Paket `website-design-ultra-2.0.2-candidate.zip` entpacken. Im entpackten
Paketverzeichnis einen neuen Checkout aus der enthaltenen Git-Historie erstellen:

```bash
git clone --branch codex/design-without-proof-examples repository.bundle ../wdu-candidate
cd ../wdu-candidate
git remote set-url origin https://github.com/Kaytm93/website-design-ultra.git
```

Der Checkout enthält die neue Fassung und die vorherige Referenzversion in
separaten Branches. Die Paket-Anleitung erklärt deren Wiederherstellung und
den späteren Upload. Die folgenden Schritte verwenden diesen neuen Checkout.

## Plugin aus diesem Checkout installieren

Codex CLI, im Repository-Verzeichnis:

```bash
codex plugin marketplace add .
codex plugin add website-design-ultra@kay-design
```

Die lokale Marketplace-Quelle wird von `codex plugin marketplace add --help`
ausdrücklich unterstützt. Falls `kay-design` bereits installiert ist, vorher
die bestehende Quelle und Version in der Plugin-Verwaltung prüfen; für diesen
Stand muss sie auf den neuen lokalen Checkout zeigen. Nach Änderungen eine neue
Sitzung öffnen. Das Laden des Plugins mit einer angemeldeten Modell-CLI ist in
dieser Arbeitsumgebung noch nicht live abgenommen.

Claude Code kann das Plugin für eine lokale Sitzung direkt laden, ebenfalls aus
dem Repository-Verzeichnis:

```bash
claude --plugin-dir ./website-design-ultra
```

Die regulären GitHub-Marketplace-Kommandos stehen in der Root-README. Sie sind
für den auf GitHub veröffentlichten Stand gedacht. Für reproduzierbare Projekte
Plugin und Starter vom selben geprüften Commit verwenden.

Das Plugin stellt Anweisungen, Referenzen und Prüfwerkzeuge bereit. Dein
Website-Projekt, dessen Inhalte und die zum Auftrag passenden Assets bleiben
separat. Eine Marketplace-Installation installiert keine Website-Abhängigkeiten.

## Optional: technische 3D-Ausgangsbasis exportieren

Neue Websites erhalten ihre Gestaltung aus dem Briefing, Projektinhalten und
gewählten Referenzen. Die vorhandenen Proof-Seiten dienen als technische
Fixtures; ihre visuelle Weiterentwicklung ist pausiert. Details und Sicherung:
[Proof-Websites](PROOF-WEBSITES.de.md).

Im so vorbereiteten Repository:

```bash
node scripts/create-project.mjs --starter next --out ../meine-website
cd ../meine-website
npm ci
npm run verify
npm run dev
```

Für eine statische Website ohne React den Wert `next` durch `vanilla` ersetzen.
Der Export überschreibt keine bestehenden Verzeichnisse. Er enthält den
Starter mit Lockfile, Tests, Postern, Herkunftsdatei, Lizenz und Browserprüfer.
Abhängigkeiten und Build-Ausgaben werden nicht mitkopiert.

| Projekt | Vorschau | Produktion | Wichtige Dateien |
|---|---|---|---|
| Next/R3F | `npm run dev`, Port 3000 | `npm run build`, danach `npm start` auf einem Node-Host | `app/page.tsx`, `app/layout.tsx`, `components/HeroObject.tsx`, `lib/asset-manifest.json` |
| Vite/Three | `npm run dev`, Port 5173 | `npm run build`, `dist/` auf statischem Hosting ausliefern | `index.html`, `src/scene.ts`, `src/hero-geometry.ts`, `src/asset-manifest.json` |

`npm run preview` dient beim Vite-Starter zur lokalen Prüfung des Builds.
Vor Veröffentlichung Inhalte, Seitentitel, Metadaten, Modelle, Markenassets und
Links anpassen. Die Ausgangsszenen prüfen technische Mechanismen. Ihr Layout,
Kristallmotiv, Licht und ihre Poster sind keine gestalterischen Vorgaben für
deine Website.

Ein passender Auftrag im neuen Projekt:

> Nutze Website Design Ultra für diese Website. Lies zuerst das vorhandene
> Projekt. Gestalte es für [Angebot], [Zielgruppe] und [Hauptaktion]. Verwende
> meine Inhalte und Assets, markiere unbekannte Angaben und prüfe Desktop,
> Hochformat, Tastatur, Reduced Motion und den Ausfall von WebGL.
> Übernimm aus den Proof-Seiten nur benötigte technische Mechanismen;
> entwickle die Gestaltung aus meinem Briefing und meinen Referenzen.

## Browserprüfung

Im erzeugten Projekt, bei laufender Vorschau und in einem zweiten Terminal:

```bash
npm run verify:browser -- --probe
npm run verify:browser -- --url http://127.0.0.1:3000 --out output/verify
```

Für Vanilla Port 5173 verwenden. Der Prüfer benötigt eine kompatible
Playwright-CLI und deren Chromium; eine fehlende Fähigkeit wird ausdrücklich
als `UNAVAILABLE` ausgewiesen. Der Poster bleibt bei fehlendem WebGL sichtbar.
`npm run capture:poster` rendert neue Poster, wenn du die Szene geändert hast.
Die erweiterten IP06-Kommandos in `STARTER.md` gehören zum ursprünglichen
Repository; im Export arbeitet `verify:browser` mit deinem tatsächlichen Server.

## Repository warten

Im ursprünglichen Checkout:

```bash
npm ci
npm run setup
npm run doctor
npm run verify
npm run audit:dependencies
npx --no-install playwright install chromium
npm run test:browser
```

`verify` prüft Pluginverträge, historische Trace-Fixtures, die Offline-Suites
sowie Typen, Tests und Builds beider Starter und des Labors. Die Browser-Suite
prüft standardmäßig Vanilla; `WDU_TEST_STARTER=next npm run test:browser` prüft
Next. GitHub CI exportiert beide Starter in separate Verzeichnisse, installiert
sie frisch und prüft die Produktionsseiten in Chromium.

Die automatischen Checks sind keine vollständige Release-Abnahme. Wiederholte
Live-Modelltests, gerätespezifische GPU-Leistung und die visuelle Bewertung eines
konkreten Kundenprojekts brauchen eigene Ergebnisse. Details und verbleibender
Umfang: [Produktionscheck](audits/2026-09-09-production.md).
