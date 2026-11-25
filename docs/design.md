# Design-Leitlinien

## v2.1: Layout „Kompakt“ (aktuell)
- Schmale Icon-Leiste links (Liste, Dokument, Drucken, Neu laden, Einstellungen)
- Kopfzeile: LV · Projekt als unauffällige Auswahl, Status-Punkt, Suchfeld (⌘K), „+ Position“
- Das ganze LV als eine durchgehende Liste: Titel als Gruppenköpfe mit Summe und Kostenbalken, Positionen als Zeilen
- Rechts der Inspector: bei gewählter Position das Formular ohne Rahmen, sonst eine Übersicht über Titel und LV (Summen, Anteile, MwSt., Brutto)
- Titel-Aktionen (↑↓, ✎, + UT, + Pos) erscheinen beim Überfahren

## v2.0
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


## v2.2 – Reiter „Texte“ und Aktiv-Punkt

- Vor- und Nachbemerkungen (LV und je Titel) stehen nicht mehr in der Positionsliste oder in Dialogen, sondern im eigenen Reiter **T „Texte“** (linke Leiste, über „Dokument“). Jeder Text hat einen Schalter „Im LV anzeigen“; ausgeschaltete Texte bleiben gespeichert, erscheinen aber nicht im Druck.
- Reihenfolge im Druck: Deckblatt → Inhaltsverzeichnis → LV-Vorbemerkung → Titel (Titel-Vorbemerkung unter der Überschrift, Titel-Nachbemerkung vor der Titelsumme) → Zusammenstellung → LV-Nachbemerkung.
- Grüner Punkt vor der OZ = Position aktiv, grau = inaktiv. Klick schaltet um.

## v2.3 – Druckausgabe

- Der Druck teilt die Seiten selbst auf (Paged.js, liegt unter `widgets/lv-editor/vendor/`). Dadurch sehen Fußzeile, Kopfzeile und Seitenumbrüche in Chrome, Safari und Firefox gleich aus.
- Fußzeile auf jeder Seite außer dem Deckblatt: Projekt · LV links, Druckdatum Mitte, „Seite X von Y“ rechts.
- Schlussseite: nur noch eine „Zusammenstellung“ (Untertitel eingerückt, Titel fett), darunter Summenblock netto / MwSt. / brutto, LV-Nachbemerkung und bei der Ausschreibung die Unterschriftszeile.
