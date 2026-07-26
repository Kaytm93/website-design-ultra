# Website Design Ultra — Kontext

## Projekt

Token-effizientes Claude-/Codex-Plugin für Web- und immersive 3D-Art-Direction.
Aktueller Arbeitsstand: 1.5.0.

## Relevanter Dateibaum

```text
website-design-ultra-1.2.0/
├── CHANGELOG.md
├── project-vault/
│   └── WEBSITE-DESIGN-ULTRA/
│       ├── DASHBOARD.md
│       ├── KONTEXT.md
│       ├── INHALTE.md
│       ├── PROBLEME.md
│       ├── CHANGELOG.md
│       ├── ENTSCHEIDUNGEN.md
│       └── verlauf/
│           └── SESSION_2026-07-25.md
└── website-design-ultra/
    ├── .claude-plugin/plugin.json
    ├── .codex-plugin/plugin.json
    ├── README.md
    ├── commands/
    │   ├── audit.md
    │   ├── design.md
    │   ├── immersive.md
    │   ├── refresh.md
    │   └── verify.md
    ├── scripts/
    │   ├── forward-trace.mjs
    │   ├── run-forward-tests.mjs
    │   ├── validate-content.mjs
    │   └── verify-browser.mjs
    ├── tests/forward/
    │   ├── cases.json
    │   └── response.schema.json
    └── skills/
        ├── content-design/
        │   ├── SKILL.md
        │   ├── agents/openai.yaml
        │   └── references/
        │       ├── claims-and-proof.md
        │       ├── localization.md
        │       └── microcopy.md
        ├── core-rules/
        │   └── references/responsive-recomposition.md
        ├── typography/
        │   ├── SKILL.md
        │   └── references/
        │       ├── hierarchy-and-loading.md
        │       ├── licensing-and-alternatives.md
        │       └── pairings-and-roles.md
        └── color-palettes/
            └── references/
                ├── editorial-natural.md
                ├── expressive.md
                └── neutral-product.md
```

## Single Sources of Truth

- Arbeitsreihenfolge, Invarianten, Minimal-Routing: `core-rules`
- Responsive Wide/Portrait/Narrow-Re-Komposition: `core-rules/references/responsive-recomposition.md`
- reale Claims, Proof-Ledger, Microcopy, Lokalisierung: `content-design`
- Font-Rollen, Loading, Lizenz und freie Alternativen: `typography`
- semantische Palette und statische State-Kontrastverträge: `color-palettes`
- Fokus/State-Verhalten und dynamische Accessibility: `ui-states`
- echte Forward-Evaluationen: `tests/forward/` plus `scripts/run-forward-tests.mjs`
- tatsächliche Provider-Dateizugriffe und Plugin-Tokenbudget: `scripts/forward-trace.mjs`
- deterministische Struktur-/Kontrastprüfung: `scripts/validate-content.mjs`
- 3D-Rechtfertigung und Gesamtbudget: `immersive-3d`
- Bildsprache und Shots: `3d-art-direction`
- Laufzeit-Tiers und Adaptation: `3d-runtime-quality`
- Touch-/Pointer-Interaktion: `r3f-interaction`
- Renderer-Kompatibilität: `shaders-tsl/references/webgpu-feature-matrix.md`
- hostneutrale Browser-Captures: `scripts/verify-browser.mjs`
- visuelle Prüf-/Statusmatrix und Degradationspfad: `commands/verify.md`
