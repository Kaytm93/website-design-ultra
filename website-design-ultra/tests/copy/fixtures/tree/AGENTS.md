# Arbeitsanweisungen für dieses Repository

Diese Datei richtet sich an Menschen und Agenten, die hier committen. Sie wird
nicht ausgeliefert und steht auf keiner Seite der Website — sie beschreibt nur,
in welcher Reihenfolge gebaut und geprüft wird.

## ✅ Vor jedem Commit

Der Build muss lokal durchlaufen, und die Inhalte unter `src/content/` brauchen
eine Freigabe von der Redaktion, weil dort die veröffentlichten Texte liegen.

## Deploy — die Reihenfolge zählt

Zuerst geht das Studio online, danach das Frontend. Wer das Frontend zuerst
deployt, bekommt für einige Minuten leere Übersichtsseiten, weil die Abfragen
dann auf Felder zeigen, die im Studio noch nicht existieren.
