# Design-Leitlinien

## Umgesetzt in v2
- **Drei Spalten wie bei moderner Bürosoftware:** links die Gliederung (Baum), in der Mitte die Positionen, rechts der Inspector zum Bearbeiten. Er erscheint nur, wenn eine Position gewählt ist.
- **Kopfleiste statt Auswahlkasten:** Projekt › LV als „Breadcrumb“, dazu der Status als Pill und die LV-Summe immer sichtbar.
- **Ruhige Flächen:** weiße Karten auf hellgrauem Grund, dünne Linien, wenig Schatten.
- **Akzentfarbe Grist-Grün** (`#16a37a`), damit das Widget zu Grist passt. Sie ist in `style.css` unter `--accent-solid` zentral änderbar.
- **Dark Mode:** Die Farben übernehmen die Grist-Theme-Variablen (`--grist-theme-*`).
- **Monospace für die OZ**, damit die Nummern bündig untereinander stehen. Zahlen sind tabellarisch und rechtsbündig.
- **Farbige Badges** für Eventual-, Bedarfs- und Alternativpositionen, durchgestrichen für inaktive.
- **Weniger Klicks:** automatisches Speichern, Tastaturkürzel, Aktionen erscheinen beim Überfahren (Sortieren, Bearbeiten).
- **Druck im Stil klassischer AVA-Ausdrucke:** Deckblatt mit Bieterfeldern, Kopfzeile auf jeder Seite, Seitenzahl x/y, Summen je Ebene, Zusammenstellung.

## Ideen für später
- Gliederung per Drag & Drop
- Kompakt- und Komfortansicht (Zeilenhöhe) umschaltbar
- Kleines Balkendiagramm der Kosten je Titel über der Tabelle
- Befehlspalette (Strg/Cmd+K): „Neue Position“, „Gehe zu 03.01“, „Drucken“
- Firmenlogo im Druck (als Bild-URL in den Einstellungen)
