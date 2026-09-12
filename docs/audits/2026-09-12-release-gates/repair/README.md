# Reparatur der vier Vertragsfehler — Messungen

Stand: 12. September 2026, nach der Live-Serie im Elternordner. Diese Dateien
sind **Offline-Evidenz der Reparatur**, nicht Live-Modellevidenz. Der Elternordner
bleibt bytegetreu eingefroren und wird von seiner eigenen `SHA256SUMS` geprüft.

Ein aufgezeichneter Trace routet nicht. Die Dateien hier beweisen deshalb, dass
die Verträge, Budgets und Regressionen auf dem reparierten Baum bestehen — sie
beweisen nicht, dass ein Modell anders routet. Das sagt nur die Live-Serie.

| Datei | Inhalt |
|---|---|
| `path-budgets.txt` | `measure-path.mjs --all`: erforderlicher und angewiesener Pfad je Fall gegen das deklarierte Budget |
| `3d-budget-after-repair.txt` | `--case 3d-hero` nach der Korrektur; vergleichbar mit `../3d-budget.txt` vor der Korrektur |
| `tweak-budget-after-repair.txt` | `--command tweak`, unverändertes 8.000-Byte-Budget |
| `validate-content.txt` | `validate-content.mjs` |
| `forward-dry-run.txt` | `run-forward-tests.mjs --dry-run`, sieben Fallverträge geladen |
| `lint-self.txt` | `lint-copy.mjs --self` |
| `root-tests.txt` | alle 30 Root-Testdateien, 245 Tests |

Reproduzieren aus dem Repository-Root:

```bash
cd website-design-ultra
node scripts/measure-path.mjs --all
node scripts/validate-content.mjs
node scripts/run-forward-tests.mjs --dry-run
node scripts/lint-copy.mjs --self
cd .. && node --test $(find tests -name '*.test.mjs' | sort)
```

Die noch offene Live-Abnahme steht in `../../2026-09-12-release-gates.md` unter
„Budgets und Freigabegrenze".
