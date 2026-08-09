# Warum die Termine nicht im CMS liegen

Die Spielpläne kommen aus dem Kassensystem und ändern sich bis zum Vorstellungs-
beginn. Ein Redakteur, der sie im CMS nachpflegt, arbeitet gegen eine Quelle,
die er nicht kontrolliert — deshalb liest die Website sie direkt aus der
Schnittstelle und speichert nur die Beschreibungstexte selbst.

## Was das kostet

Die Übersicht braucht einen Netzwerkaufruf mehr und fällt aus, wenn das
Kassensystem nachts neu startet. Für diesen Fall zeigt die Seite den letzten
erfolgreich geladenen Stand mit Zeitstempel, statt eine leere Liste zu rendern.
